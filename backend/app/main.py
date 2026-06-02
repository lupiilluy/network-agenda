from __future__ import annotations

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from .categories import normalize
from .database import (
    authenticate_user,
    get_connection,
    find_user_by_phone,
    init_db,
    insert_contact,
    list_categories,
    row_to_contact,
    row_to_public_profile,
    row_to_user,
    update_contact,
    upsert_google_user,
    upsert_user,
)
from .schemas import AddressLookupOut, CategoryOut, ContactCreate, ContactOut, GoogleLoginIn, LoginIn, PublicProfileOut, SearchOut, UserCreate, UserOut

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


@app.post("/api/contacts", response_model=ContactOut, status_code=201)
def create_contact(payload: ContactCreate) -> dict:
    with get_connection() as connection:
        data = payload.model_dump()
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


@app.post("/api/users", response_model=UserOut)
def save_user(payload: UserCreate) -> dict:
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
        options.append({"address": display_address, "city": city, "state": state, "cep": cep})

    return {"query": query, "results": options}


@app.get("/api/public-profiles", response_model=list[PublicProfileOut])
def public_profiles(query: str = Query(default="")) -> list[dict]:
    normalized_query = normalize(query)
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM public_profiles ORDER BY score DESC, people DESC").fetchall()

    results = []
    for row in rows:
        if not normalized_query or normalized_query in row["search_text"]:
            results.append(row_to_public_profile(row))

    return results


@app.get("/api/search", response_model=SearchOut)
def search(query: str = Query(default="")) -> dict:
    private_results = contacts(query=query, category="all", user_id="demo-user")
    public_results = public_profiles(query=query)
    return {
        "query": query,
        "private_results": private_results,
        "public_results": public_results,
        "has_private_results": len(private_results) > 0,
    }
