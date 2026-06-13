from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import re

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from .categories import classify_service, infer_service_from_contact, is_generic_service, normalize
from .database import (
    authenticate_user,
    get_connection,
    find_user_by_phone,
    init_db,
    ignore_merge_suggestion,
    insert_contact,
    list_merge_suggestions,
    list_categories,
    merge_contacts,
    row_to_contact,
    row_to_public_profile,
    row_to_public_user_profile,
    row_to_user,
    update_contact,
    upsert_google_user,
    upsert_user,
)
from .schemas import AddressLookupOut, AiChatIn, AiChatOut, CategoryOut, ContactCreate, ContactOut, GoogleLoginIn, LoginIn, MergeDecisionIn, MergeSuggestionOut, PublicProfileOut, SearchOut, UserCreate, UserOut

BASE_DIR = Path(__file__).resolve().parent.parent


def load_local_env() -> None:
    env_path = BASE_DIR / ".env.local"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_local_env()

app = FastAPI(title="Network Agenda API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5174", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "network-agenda-api"}


@app.get("/api/categories", response_model=list[CategoryOut])
def categories() -> list[dict]:
    with get_connection() as connection:
        return list_categories(connection)


@app.get("/api/contacts", response_model=list[ContactOut])
def contacts(
    query: str = Query(default=""),
    category: str = Query(default="all"),
    user_id: str = Query(default="demo-user"),
) -> list[dict]:
    normalized_query = normalize(query)
    owner_id = str(user_id or "demo-user")
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM contacts WHERE owner_id = ? ORDER BY datetime(created_at) DESC, id DESC",
            (owner_id,),
        ).fetchall()

    results = []
    for row in rows:
      category_match = category == "all" or row["category_id"] == category
      search_match = not normalized_query or normalized_query in row["search_text"]
      if category_match and search_match:
          results.append(row_to_contact(row))

    return results


def follow_up_slot(value: str | None) -> str:
    return str(value or "").strip()[:16]


def ensure_follow_up_slot_available(connection, owner_id: str, next_follow_up_at: str | None, contact_id: int | None = None) -> None:
    slot = follow_up_slot(next_follow_up_at)
    if not slot:
        return
    query = "SELECT id, name FROM contacts WHERE owner_id = ? AND substr(next_follow_up_at, 1, 16) = ?"
    params: tuple = (owner_id, slot)
    if contact_id is not None:
        query += " AND id != ?"
        params = (owner_id, slot, contact_id)
    conflict = connection.execute(query, params).fetchone()
    if conflict is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Já existe follow-up nesse dia e horário para {conflict['name']}. Escolha outro horário.",
        )


@app.post("/api/contacts", response_model=ContactOut, status_code=201)
def create_contact(payload: ContactCreate) -> dict:
    with get_connection() as connection:
        data = payload.model_dump()
        owner_id = str(data.get("owner_id") or "demo-user")
        ensure_follow_up_slot_available(connection, owner_id, data.get("next_follow_up_at"))
        registered_user = find_user_by_phone(connection, data["phone"])
        if registered_user is not None:
            user = row_to_user(registered_user)
            data["name"] = data["name"] or user["name"]
            data["city"] = user["city"] or data.get("city")
            data["address"] = user["address"] or data.get("address")
            data["source"] = "Perfil cadastrado"
        row = insert_contact(connection, data)
        connection.commit()
        return row_to_contact(row)


@app.put("/api/contacts/{contact_id}", response_model=ContactOut)
def edit_contact(contact_id: int, payload: ContactCreate) -> dict:
    with get_connection() as connection:
        data = payload.model_dump()
        owner_id = str(data.get("owner_id") or "demo-user")
        ensure_follow_up_slot_available(connection, owner_id, data.get("next_follow_up_at"), contact_id)
        registered_user = find_user_by_phone(connection, data["phone"])
        if registered_user is not None:
            user = row_to_user(registered_user)
            data["city"] = user["city"] or data.get("city")
            data["address"] = user["address"] or data.get("address")
            data["source"] = "Perfil cadastrado"
        row = update_contact(connection, contact_id, data)
        connection.commit()
        if row is None:
            raise HTTPException(status_code=404, detail="Contato não encontrado.")
        return row_to_contact(row)


@app.delete("/api/contacts/{contact_id}", status_code=204, response_class=Response)
def delete_contact(contact_id: int, user_id: str = Query(default="demo-user")) -> Response:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM contacts WHERE id = ? AND owner_id = ?", (contact_id, str(user_id or "demo-user")))
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Contato não encontrado.")
    return Response(status_code=204)


@app.get("/api/merge-suggestions", response_model=list[MergeSuggestionOut])
def merge_suggestions(user_id: str = Query(default="demo-user")) -> list[dict]:
    with get_connection() as connection:
        return list_merge_suggestions(connection, str(user_id or "demo-user"))


@app.post("/api/merge-suggestions/ignore", status_code=204, response_class=Response)
def ignore_duplicate(payload: MergeDecisionIn) -> Response:
    with get_connection() as connection:
        try:
            ignore_merge_suggestion(connection, payload.owner_id, payload.primary_contact_id, payload.duplicate_contact_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        connection.commit()
    return Response(status_code=204)


@app.post("/api/merge-suggestions/merge", response_model=ContactOut)
def merge_duplicate(payload: MergeDecisionIn) -> dict:
    with get_connection() as connection:
        try:
            row = merge_contacts(connection, payload.owner_id, payload.primary_contact_id, payload.duplicate_contact_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        connection.commit()
        return row_to_contact(row)


@app.post("/api/users", response_model=UserOut)
def save_user(payload: UserCreate) -> dict:
    if not (payload.google_connected or payload.google_contacts_imported_at or payload.google_profile_synced_at):
        raise HTTPException(status_code=422, detail="Conta Google obrigatória para salvar o perfil.")
    with get_connection() as connection:
        try:
            row = upsert_user(connection, payload.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        connection.commit()
        return row_to_user(row)


@app.post("/api/login", response_model=UserOut)
def login(payload: LoginIn) -> dict:
    with get_connection() as connection:
        row = authenticate_user(connection, payload.email, payload.password)
        if row is None:
            raise HTTPException(status_code=401, detail="Email ou senha inválidos.")
        return row_to_user(row)


@app.post("/api/google-login", response_model=UserOut)
def google_login(payload: GoogleLoginIn) -> dict:
    with get_connection() as connection:
        row = upsert_google_user(connection, payload.model_dump())
        connection.commit()
        return row_to_user(row)


@app.get("/api/users", response_model=list[UserOut])
def users() -> list[dict]:
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM users ORDER BY datetime(created_at) DESC, id DESC").fetchall()
        return [row_to_user(row) for row in rows]


@app.get("/api/users/lookup", response_model=UserOut | None)
def lookup_user(phone: str = Query(default="")) -> dict | None:
    with get_connection() as connection:
        row = find_user_by_phone(connection, phone)
        return row_to_user(row) if row is not None else None


@app.get("/api/address/lookup", response_model=AddressLookupOut)
def lookup_address(query: str = Query(min_length=3)) -> dict:
    digits = re.sub(r"\D", "", query or "")
    if len(digits) == 8:
        cep_request = Request(
            f"https://viacep.com.br/ws/{digits}/json/",
            headers={"User-Agent": "network-agenda-mvp/0.1"},
        )
        try:
            with urlopen(cep_request, timeout=8) as response:
                cep_result = json.loads(response.read().decode("utf-8"))
        except Exception:
            cep_result = {}
        if cep_result and not cep_result.get("erro"):
            city = cep_result.get("localidade") or ""
            state = cep_result.get("uf") or ""
            address_parts = [
                cep_result.get("logradouro") or "",
                cep_result.get("bairro") or "",
                ", ".join([part for part in (city, state) if part]),
            ]
            display_address = ", ".join([part for part in address_parts if part]) or f"{digits[:5]}-{digits[5:]}"
            return {
                "query": query,
                "results": [
                    {
                        "address": display_address,
                        "city": city,
                        "state": state,
                        "cep": f"{digits[:5]}-{digits[5:]}",
                        "lat": None,
                        "lng": None,
                    }
                ],
            }

    params = urlencode({"q": query, "format": "jsonv2", "addressdetails": 1, "limit": 6, "countrycodes": "br"})
    request = Request(
        f"https://nominatim.openstreetmap.org/search?{params}",
        headers={"User-Agent": "network-agenda-mvp/0.1"},
    )
    try:
        with urlopen(request, timeout=8) as response:
            results = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Não foi possível buscar o endereço.") from exc

    if not results:
        raise HTTPException(status_code=404, detail="Endereço não encontrado.")

    options = []
    seen = set()
    for result in results:
        address = result.get("address", {})
        city = address.get("city") or address.get("town") or address.get("municipality") or address.get("village") or ""
        state = address.get("state") or ""
        cep = address.get("postcode") or ""
        display_address = result.get("display_name") or query
        key = (display_address, cep)
        if key in seen:
            continue
        seen.add(key)
        try:
            lat = float(result.get("lat")) if result.get("lat") is not None else None
            lng = float(result.get("lon")) if result.get("lon") is not None else None
        except (TypeError, ValueError):
            lat = None
            lng = None
        options.append({"address": display_address, "city": city, "state": state, "cep": cep, "lat": lat, "lng": lng})

    return {"query": query, "results": options}


@app.get("/api/public-profiles", response_model=list[PublicProfileOut])
def public_profiles(query: str = Query(default="")) -> list[dict]:
    normalized_query = normalize(query)
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM public_profiles ORDER BY score DESC, people DESC").fetchall()
        user_rows = connection.execute(
            "SELECT * FROM users WHERE public_visible = 1 ORDER BY datetime(created_at) DESC, id DESC"
        ).fetchall()

    results = []
    for row in rows:
        if not normalized_query or normalized_query in row["search_text"]:
            results.append(row_to_public_profile(row))
    for row in user_rows:
        profile = row_to_public_user_profile(row)
        if not normalized_query or normalized_query in profile["search_text"]:
            results.append(profile)

    return results


@app.get("/api/search", response_model=SearchOut)
def search(query: str = Query(default=""), user_id: str = Query(default="demo-user")) -> dict:
    private_results = contacts(query=query, category="all", user_id=str(user_id or "demo-user"))
    public_results = public_profiles(query=query)
    return {
        "query": query,
        "private_results": private_results,
        "public_results": public_results,
        "has_private_results": len(private_results) > 0,
    }


def build_contact_suggestions(rows: list) -> list[dict]:
    suggestions = []
    for row in rows:
        suggested_service = infer_service_from_contact(row["name"], row["service"], row["note"], row["source"])
        category = classify_service(" ".join([suggested_service, row["name"], row["note"], row["source"]]))
        current_category = row["category_id"]
        service_changed = normalize(suggested_service) != normalize(row["service"])
        category_changed = category.id != current_category
        needs_review = is_generic_service(row["service"]) or current_category == "general"
        if not (service_changed or category_changed or needs_review):
            continue

        reason = "Encontrei sinais no nome, cargo, empresa, email ou origem do contato."
        if category.id == "general":
            reason = "Não há pistas suficientes; mantive como contato para revisar."

        suggestions.append(
            {
                "contact_id": row["id"],
                "name": row["name"],
                "current_service": row["service"],
                "suggested_service": suggested_service,
                "category_id": category.id,
                "category_label": category.label,
                "reason": reason,
            }
        )
    return suggestions[:20]


CONTACT_MATCH_STOPWORDS = {
    "marcar", "marca", "colocar", "coloca", "botar", "bota", "mudar", "muda", "trocar", "troca",
    "deixar", "deixa", "agendar", "agenda", "programar", "programa", "concluir", "conclui",
    "finalizar", "finaliza", "remover", "remove", "retirar", "retira", "tirar", "tira",
    "cancelar", "cancela", "classificar", "classifica", "categorizar", "categoriza", "categoria",
    "follow", "retorno", "lembrete", "lembrar", "oportunidade", "prioridade", "pausado",
    "ativo", "conversa", "crm", "como", "para", "pra", "com", "sem", "de", "da", "do", "dos",
    "das", "o", "a", "os", "as", "um", "uma", "contato", "contatos",
}


def normalized_words(value: str) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9 ]+", " ", normalize(value))
    return [word for word in cleaned.split() if word]


def useful_words(value: str) -> list[str]:
    return [word for word in normalized_words(value) if len(word) > 2 and word not in CONTACT_MATCH_STOPWORDS]


def row_value(row, key: str) -> str:
    try:
        return str(row[key] or "")
    except (KeyError, IndexError):
        return ""


def contact_match_score(message: str, row) -> int:
    searchable = " ".join(normalized_words(message))
    message_words = normalized_words(message)
    useful_message_words = [word for word in message_words if word not in CONTACT_MATCH_STOPWORDS]
    compact_message = searchable.replace(" ", "")
    message_digits = re.sub(r"\D+", "", message)

    name = " ".join(normalized_words(row_value(row, "name")))
    name_words = useful_words(row_value(row, "name"))
    compact_name = name.replace(" ", "")
    score = 0

    if name and f" {name} " in f" {searchable} ":
        score = max(score, 140 + len(name))
    if compact_name and compact_name in compact_message:
        score = max(score, 125 + len(compact_name))
    if name_words and all(word in message_words for word in name_words):
        score = max(score, 110 + sum(len(word) for word in name_words))
    if len(name_words) >= 2 and name_words[0] in message_words and name_words[-1] in message_words:
        score = max(score, 105 + len(name_words[0]) + len(name_words[-1]))

    for word in name_words:
        if word in message_words:
            score = max(score, 80 + len(word))
        elif len(word) >= 4 and any(candidate.startswith(word[:4]) or word.startswith(candidate[:4]) for candidate in useful_message_words if len(candidate) >= 4):
            score = max(score, 68 + len(word))
        elif len(word) >= 4 and any(len(candidate) >= 4 for candidate in useful_message_words):
            best_ratio = max(SequenceMatcher(None, word, candidate).ratio() for candidate in useful_message_words if len(candidate) >= 4)
            if best_ratio >= 0.84:
                score = max(score, 58 + len(word))

    phone_digits = re.sub(r"\D+", "", row_value(row, "phone"))
    if message_digits and phone_digits and len(message_digits) >= 4 and message_digits in phone_digits:
        score = max(score, 118 + len(message_digits))

    service_words = useful_words(row_value(row, "service"))
    service_hits = [word for word in service_words if word in message_words]
    if service_hits:
        score = max(score, 48 + (len(service_hits) * 8) + max(len(word) for word in service_hits))
    category_words = useful_words(row_value(row, "category_label"))
    category_hits = [word for word in category_words if word in message_words]
    if category_hits:
        score = max(score, 36 + (len(category_hits) * 5))

    return score


def find_mentioned_contacts(message: str, rows: list) -> list:
    matches = []
    for row in rows:
        score = contact_match_score(message, row)
        if score >= 45:
            matches.append((score, row))
    matches.sort(key=lambda item: (item[0], row_value(item[1], "name")), reverse=True)
    seen = set()
    result = []
    for _, row in matches:
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        result.append(row)
    return result[:5]


def action_target_contacts(message: str, rows: list, target_contact_id: int | None = None) -> list:
    if target_contact_id is not None:
        selected = [row for row in rows if int(row["id"]) == int(target_contact_id)]
        return selected[:1]

    matches = []
    for row in rows:
        score = contact_match_score(message, row)
        # For CRM actions, service-only matches are not enough. The user must
        # select a contact in the UI or mention a clear name/phone.
        if score >= 80:
            matches.append((score, row))
    matches.sort(key=lambda item: (item[0], row_value(item[1], "name")), reverse=True)
    return [row for _, row in matches[:5]]


def has_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def looks_like_action_request(message: str) -> bool:
    normalized = normalize(message)
    action_terms = (
        "marcar", "marca", "colocar", "coloca", "botar", "bota", "mudar", "muda", "trocar", "troca",
        "deixar", "deixa", "agendar", "agenda", "programar", "programa", "concluir", "conclui",
        "finalizar", "finaliza", "dar baixa", "baixa", "feito", "resolvido", "remover", "remove",
        "retirar", "retira", "tirar", "tira", "cancelar", "cancela", "classificar", "classifica",
        "categorizar", "categoriza", "categoria", "tag", "follow", "retorno", "lembrete", "lembrar",
        "oportunidade", "prioridade", "pausado", "ativo", "conversa", "crm",
    )
    return has_any(normalized, action_terms) or classify_service(message).id != "general"


def parse_follow_up_datetime(message: str) -> str:
    normalized = normalize(message)
    now = datetime.now()
    date_match = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", normalized)
    iso_match = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", normalized)
    time_match = re.search(r"\b(\d{1,2})(?:h|:)(\d{2})?\b", normalized)
    weekday_map = {
        "segunda": 0,
        "terca": 1,
        "terça": 1,
        "quarta": 2,
        "quinta": 3,
        "sexta": 4,
        "sabado": 5,
        "sábado": 5,
        "domingo": 6,
    }

    if "depois de amanha" in normalized:
        target = now + timedelta(days=2)
    elif "semana que vem" in normalized or "proxima semana" in normalized:
        target = now + timedelta(days=7)
    elif "amanha" in normalized:
        target = now + timedelta(days=1)
    elif "hoje" in normalized:
        target = now
    elif any(day in normalized for day in weekday_map):
        target_day = next(value for day, value in weekday_map.items() if day in normalized)
        days_ahead = (target_day - now.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        target = now + timedelta(days=days_ahead)
    elif date_match:
        day = int(date_match.group(1))
        month = int(date_match.group(2))
        year_raw = date_match.group(3)
        year = int(year_raw) if year_raw else now.year
        if year < 100:
            year += 2000
        target = now.replace(year=year, month=month, day=day)
    elif iso_match:
        target = now.replace(year=int(iso_match.group(1)), month=int(iso_match.group(2)), day=int(iso_match.group(3)))
    elif "proxima" in normalized or "proximo" in normalized:
        target = now + timedelta(days=7)
    else:
        target = now + timedelta(days=1)

    hour = int(time_match.group(1)) if time_match else 9
    minute = int(time_match.group(2) or 0) if time_match else 0
    return target.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat(timespec="minutes")


def follow_up_conflict(rows: list, next_follow_up: str, contact_id: int) -> str:
    slot = follow_up_slot(next_follow_up)
    for row in rows:
        if int(row["id"]) != int(contact_id) and follow_up_slot(row["next_follow_up_at"]) == slot:
            return row["name"]
    return ""


def build_action_suggestions(message: str, rows: list, target_contact_id: int | None = None) -> list[dict]:
    normalized = normalize(message)
    mentioned = action_target_contacts(message, rows, target_contact_id)
    if not mentioned:
        return []

    category = classify_service(message)
    category_request = has_any(normalized, ("categoria", "categorizar", "tag", "tags", "servico", "serviço", "classificar", "classifica", "coloca em", "como ")) or category.id != "general"
    follow_terms = ("follow", "retorno", "lembrete", "lembrar", "retomar", "cobrar", "acompanhar")
    complete_terms = ("concluir", "concluido", "conclui", "feito", "realizado", "finalizar", "finaliza", "dar baixa", "baixa", "baixar", "resolvido", "ja falei", "já falei")
    clear_terms = ("retirar", "retira", "remover", "remove", "limpar", "apagar", "cancelar", "cancela", "tirar", "tira", "desmarcar", "desmarca")
    schedule_terms = ("marcar", "marca", "agendar", "agenda", "remarcar", "remarca", "colocar", "coloca", "botar", "bota", "criar", "cria", "definir", "define", "programar", "programa", "lembrar", "retomar")
    date_terms = ("hoje", "amanha", "depois de amanha", "semana que vem", "proxima semana", "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo")
    complete_request = has_any(normalized, complete_terms) and (has_any(normalized, follow_terms) or "baixa" in normalized)
    clear_request = has_any(normalized, clear_terms) and has_any(normalized, follow_terms)
    has_date_or_time = has_any(normalized, date_terms) or bool(re.search(r"\b\d{1,2}(?:h|:\d{2}|/\d{1,2})", normalized))
    follow_up_request = (has_any(normalized, follow_terms) and has_any(normalized, schedule_terms)) or (has_any(normalized, schedule_terms) and has_date_or_time)
    crm_request = has_any(normalized, ("crm", "status", "prioridade", "oportunidade", "pausado", "pausar", "ativo", "conversa", "quente", "frio", "urgente"))

    status = ""
    if "oportunidade" in normalized:
        status = "Oportunidade"
    elif "follow" in normalized and not complete_request and not clear_request:
        status = "Follow-up"
    elif "pausado" in normalized or "pausar" in normalized:
        status = "Pausado"
    elif "ativo" in normalized or "quente" in normalized:
        status = "Ativo"
    elif "conversa" in normalized or "conversar" in normalized or "em andamento" in normalized:
        status = "Conversa iniciada"
    elif "novo" in normalized:
        status = "Novo"

    priority = ""
    if "prioridade alta" in normalized or "alta prioridade" in normalized:
        priority = "Alta"
    elif "prioridade baixa" in normalized or "baixa prioridade" in normalized:
        priority = "Baixa"
    elif "prioridade media" in normalized or "prioridade média" in message.lower() or "media prioridade" in normalized:
        priority = "Média"

    if "urgente" in normalized or "importante" in normalized:
        priority = "Alta"
    elif "frio" in normalized:
        priority = "Baixa"

    suggestions = []
    for row in mentioned:
        base = {
            "contact_id": row["id"],
            "name": row["name"],
            "current_service": row["service"],
            "suggested_service": row["service"],
            "category_id": row["category_id"],
            "category_label": row["category_label"],
            "reason": "Revise e aplique se estiver correto.",
        }

        if complete_request:
            suggestions.append({
                **base,
                "action": "complete_follow_up",
                "label": "Concluir follow-up",
                "last_contact_at": datetime.now().date().isoformat(),
                "next_follow_up_at": "",
                "crm_status": "Conversa iniciada" if row["crm_status"] == "Follow-up" else row["crm_status"],
                "crm_note": f"Follow-up concluido em {format_follow_up(datetime.now().date().isoformat())}.",
                "reason": f"Vou marcar o follow-up de {row['name']} como concluido e limpar a proxima data.",
            })
        elif clear_request:
            suggestions.append({
                **base,
                "action": "clear_follow_up",
                "label": "Remover follow-up",
                "next_follow_up_at": "",
                "crm_note": f"Follow-up removido em {format_follow_up(datetime.now().date().isoformat())}.",
                "reason": f"Vou retirar o proximo follow-up de {row['name']}.",
            })
        elif follow_up_request:
            next_follow_up = parse_follow_up_datetime(message)
            conflict_name = follow_up_conflict(rows, next_follow_up, row["id"])
            if conflict_name:
                suggestions.append({
                    **base,
                    "action": "conflict",
                    "label": "Horário indisponível",
                    "next_follow_up_at": next_follow_up,
                    "reason": f"Não marquei esse follow-up: {conflict_name} já está agendado em {format_follow_up(next_follow_up)}. Escolha outro horário para eu salvar.",
                })
                continue
            suggestions.append({
                **base,
                "action": "set_crm",
                "label": "Agendar follow-up",
                "crm_status": status or "Follow-up",
                "next_follow_up_at": next_follow_up,
                "reason": f"Combinado: vou deixar {row['name']} com follow-up em {format_follow_up(next_follow_up)}.",
            })
        elif crm_request and (status or priority):
            suggestions.append({
                **base,
                "action": "set_crm",
                "label": "Atualizar CRM",
                "crm_status": status,
                "crm_priority": priority,
                "reason": f"Vou atualizar o CRM de {row['name']}" + (f" para {status}" if status else "") + (f" com prioridade {priority}" if priority else "") + ".",
            })
        elif category_request and category.id != "general":
            suggestions.append({
                **base,
                "action": "categorize",
                "label": "Atualizar categoria",
                "suggested_service": category.label.lower(),
                "category_id": category.id,
                "category_label": category.label,
                "reason": f"Vou classificar {row['name']} em {category.label}.",
            })

    return suggestions


def action_clarification(message: str, rows: list, target_contact_id: int | None = None) -> str | None:
    if not looks_like_action_request(message):
        return None
    selected = action_target_contacts(message, rows, target_contact_id)
    if target_contact_id is not None and not selected:
        return "Não encontrei o contato selecionado. Escolha de novo no campo Contato alvo e me diga o que fazer."
    mentioned = selected or action_target_contacts(message, rows)
    if not mentioned:
        sample = ", ".join(row["name"] for row in rows[:5])
        return f"Entendi a ação, mas preciso que você escolha o contato. Selecione em Contato alvo ou escreva o nome claramente na mensagem. Exemplos: 'marcar Carlos como oportunidade' ou 'agendar follow-up da Aline amanhã 14h'. Contatos disponíveis: {sample}."
    if not build_action_suggestions(message, rows, target_contact_id):
        names = ", ".join(row["name"] for row in mentioned)
        return f"Estou com {names}. Me diga a ação: posso marcar status do CRM, prioridade, agendar/remover/concluir follow-up ou mudar categoria. Exemplo: 'colocar como prioridade alta' ou 'agendar amanhã 14h'."
    return None


def format_follow_up(value: str) -> str:
    if not value:
        return ""
    if "T" not in value:
        try:
            return datetime.strptime(value, "%Y-%m-%d").strftime("%d/%m/%Y")
        except ValueError:
            return value
    try:
        return datetime.strptime(value[:16], "%Y-%m-%dT%H:%M").strftime("%d/%m/%Y às %H:%M")
    except ValueError:
        return value


COMMAND_EXAMPLES = (
    ("agendar follow-up", "agendar Aline na próxima sexta 14h"),
    ("remarcar follow-up", "remarcar Carlos para amanhã 15h"),
    ("concluir follow-up", "concluir follow-up do Carlos"),
    ("remover follow-up", "remover follow-up da Aline"),
    ("marcar oportunidade", "marcar Mariana como oportunidade"),
    ("alterar prioridade", "colocar Renato como prioridade alta"),
    ("categorizar contato", "categorizar João como eletricista"),
    ("buscar contato", "quem pode ajudar com limpeza?"),
    ("listar follow-ups", "quais contatos precisam de follow-up?"),
)


def similar_command_examples(message: str) -> list[str]:
    normalized = normalize(message)
    terms = {term for term in re.split(r"\W+", normalized) if len(term) > 2}
    ranked = []
    for label, example in COMMAND_EXAMPLES:
        label_text = normalize(f"{label} {example}")
        label_terms = {term for term in re.split(r"\W+", label_text) if len(term) > 2}
        overlap = len(terms & label_terms) / max(len(terms), 1)
        score = SequenceMatcher(None, normalized, label_text).ratio() + overlap
        ranked.append((score, example))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [example for _, example in ranked[:3]]


def local_chat_answer(message: str, rows: list, suggestions: list[dict]) -> str:
    normalized = normalize(message)
    tagged_rows = [row for row in rows if row["category_id"] != "general" and not is_generic_service(row["service"])]
    untagged_rows = [row for row in rows if row["category_id"] == "general" or is_generic_service(row["service"])]

    if any(term in normalized for term in ("sem tag", "sem tags", "sem categoria", "sem categorias", "revisar", "pendente")):
        if not untagged_rows:
            return "Todos os contatos atuais já têm uma categoria útil. Não encontrei contatos sem tags para revisar."
        names = ", ".join(f"{row['name']} ({row['service']})" for row in untagged_rows[:8])
        extra = len(untagged_rows) - 8
        suffix = f" e mais {extra}" if extra > 0 else ""
        return f"Encontrei {len(untagged_rows)} contato(s) sem tags/categoria forte: {names}{suffix}. Abra a aba Sem tags no CRM para revisar todos."

    if any(term in normalized for term in ("com tag", "com tags", "tagueado", "tagueados", "categorizado", "categorizados")):
        names = ", ".join(f"{row['name']} ({row['category_label']})" for row in tagged_rows[:8])
        extra = len(tagged_rows) - 8
        suffix = f" e mais {extra}" if extra > 0 else ""
        return f"Há {len(tagged_rows)} contato(s) com tags/categorias úteis no CRM. Principais exemplos: {names}{suffix}."

    if any(term in normalized for term in ("follow", "retomar", "vencido", "vencidos", "hoje", "semana")):
        today = datetime.now().isoformat(timespec="minutes")
        due_rows = [row for row in rows if row["next_follow_up_at"] and row["next_follow_up_at"] <= today]
        upcoming_rows = [row for row in rows if row["next_follow_up_at"] and row["next_follow_up_at"] > today]
        upcoming_rows.sort(key=lambda row: row["next_follow_up_at"])
        if due_rows:
            names = ", ".join(f"{row['name']} ({format_follow_up(row['next_follow_up_at'])})" for row in due_rows)
            return f"Você tem {len(due_rows)} follow-up(s) vencido(s): {names}. Priorize estes antes de criar novos contatos."
        if upcoming_rows:
            names = ", ".join(f"{row['name']} ({format_follow_up(row['next_follow_up_at'])})" for row in upcoming_rows)
            return f"Não há follow-ups vencidos. Os próximos agendados são: {names}."
        return "Não encontrei follow-ups cadastrados. Abra contatos importantes e defina uma próxima data para o CRM ordenar sua rotina."

    if any(term in normalized for term in ("oportunidade", "oportunidades", "combina", "conectar", "conexoes")):
        by_category = {}
        for row in tagged_rows:
            by_category.setdefault(row["category_label"], []).append(row)
        clusters = sorted(by_category.items(), key=lambda item: len(item[1]), reverse=True)
        if clusters:
            parts = []
            for label, items in clusters[:4]:
                sample = ", ".join(row["name"] for row in items[:3])
                parts.append(f"{label}: {sample}")
            return "Possíveis oportunidades por concentração de rede: " + "; ".join(parts) + ". Use essas categorias para procurar complementaridades e pedir indicações."
        return "Ainda não há tags suficientes para sugerir oportunidades. Comece revisando a aba Sem tags."

    if suggestions and any(term in normalized for term in ("organizar", "arrumar", "categoria", "categorizar", "importado", "google")):
        return f"Encontrei {len(suggestions)} contato(s) que podem ser reorganizados. Revise as sugestões e aplique apenas as que fizerem sentido."

    stopwords = {
        "quem",
        "pode",
        "podem",
        "ajudar",
        "com",
        "para",
        "me",
        "meus",
        "minha",
        "minhas",
        "contato",
        "contatos",
        "encontrar",
        "preciso",
        "precisa",
        "tem",
        "algum",
        "alguma",
        "sobre",
        "quais",
        "qual",
        "crm",
    }
    terms = [term for term in normalized.replace("?", " ").replace(",", " ").split() if len(term) > 2 and term not in stopwords]
    query_category = classify_service(message)
    matches = []
    for row in rows:
        haystack = normalize(" ".join([row["name"], row["phone"], row["service"], row["note"], row["city"], row["source"], row["category_label"], row["crm_status"], row["crm_priority"], row["crm_note"], row["next_follow_up_at"]]))
        score = sum(1 for term in terms if term in haystack)
        if query_category.id != "general" and row["category_id"] == query_category.id:
            score += 1
        if score:
            matches.append((score, row))
    if matches:
        matches.sort(key=lambda item: item[0], reverse=True)
        names = ", ".join(f"{row['name']} ({row['service']})" for _, row in matches[:6])
        return f"Encontrei {len(matches)} contato(s) relacionado(s): {names}."

    examples = "; ".join(f'"{example}"' for example in similar_command_examples(message))
    if suggestions:
        return f"Não entendi esse comando. Talvez você quis dizer algo como: {examples}. Também posso revisar contatos importados se você pedir para organizar ou categorizar."
    return f"Não entendi esse comando. Tente algo parecido com: {examples}."


def extract_openai_text(data: dict) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"]
    chunks = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            text = content.get("text")
            if text:
                chunks.append(text)
    return "\n".join(chunks).strip()


def call_openai_chat(message: str, rows: list, suggestions: list[dict]) -> str | None:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None

    contacts_context = [
        {
            "name": row["name"],
            "service": row["service"],
            "city": row["city"],
            "source": row["source"],
            "category": row["category_label"],
            "crm_status": row["crm_status"],
            "crm_priority": row["crm_priority"],
            "last_contact_at": row["last_contact_at"],
            "next_follow_up_at": row["next_follow_up_at"],
            "crm_note": row["crm_note"],
        }
        for row in rows[:120]
    ]
    prompt = (
        "Você é um copiloto de CRM e networking em português do Brasil. "
        "Responda de forma curta, prática e orientada a próximos passos. "
        "Use status, prioridade, follow-up, tags/categorias e notas para priorizar. "
        "Não diga que alterou dados sozinho; as alterações precisam de confirmação do usuário.\n\n"
        f"Pedido do usuário: {message}\n\n"
        f"Contatos: {json.dumps(contacts_context, ensure_ascii=False)}\n\n"
        f"Sugestões determinísticas já calculadas: {json.dumps(suggestions[:10], ensure_ascii=False)}"
    )
    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "input": prompt,
        "max_output_tokens": 500,
    }
    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, json.JSONDecodeError):
        return None
    return extract_openai_text(data) or None


@app.post("/api/ai/chat", response_model=AiChatOut)
def ai_chat(payload: AiChatIn) -> dict:
    owner_id = str(payload.user_id or "demo-user")
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM contacts WHERE owner_id = ? ORDER BY datetime(created_at) DESC, id DESC",
            (owner_id,),
        ).fetchall()

    action_suggestions = build_action_suggestions(payload.message, rows, payload.target_contact_id)
    organization_suggestions = [] if looks_like_action_request(payload.message) else build_contact_suggestions(rows)
    suggestions = action_suggestions or organization_suggestions
    provider = "local"
    if action_suggestions:
        names = ", ".join(item["name"] for item in action_suggestions[:4])
        answer = f"Entendi. Preparei {len(action_suggestions)} ação(ões) para confirmar: {names}. Dá uma olhada na lateral e clique em Aplicar se estiver certo."
    else:
        clarification = action_clarification(payload.message, rows, payload.target_contact_id)
        answer = clarification or call_openai_chat(payload.message, rows, suggestions)
    if action_suggestions:
        if len(action_suggestions) == 1:
            item = action_suggestions[0]
            action_label = (item.get("label") or "Atualizar contato").lower()
            if item.get("action") == "conflict":
                answer = item["reason"]
            elif item.get("next_follow_up_at"):
                answer = f"Perfeito. Localizei a data: {format_follow_up(item['next_follow_up_at'])}. Preparei o follow-up de {item['name']} na lateral; clique em Aplicar para salvar."
            else:
                answer = f"Certo. Estou com {item['name']} e preparei: {action_label}. Confere a sugestão na lateral e clique em Aplicar para eu salvar."
        else:
            names = ", ".join(item["name"] for item in action_suggestions[:4])
            answer = f"Certo. Encontrei estes contatos no seu pedido: {names}. Confere as sugestões na lateral e aplique apenas as corretas."

    if answer and not action_suggestions and os.getenv("OPENAI_API_KEY", "").strip():
        provider = "openai"
    else:
        provider = "local"
        if not action_suggestions and not locals().get("clarification"):
            answer = local_chat_answer(payload.message, rows, suggestions)

    return {"answer": answer, "suggestions": suggestions, "provider": provider}
