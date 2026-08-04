from __future__ import annotations

import json
import os
import sys
import base64
import hashlib
from contextvars import ContextVar
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import re

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

try:
    import jwt
    from jwt import PyJWKClient, PyJWTError
except ImportError:
    jwt = None
    PyJWKClient = None
    PyJWTError = Exception

try:
    from pywebpush import WebPushException, webpush
except ImportError:
    webpush = None

    class WebPushException(Exception):
        response = None

try:
    from cryptography.hazmat.primitives import serialization
except ImportError:
    serialization = None

from .categories import classify_service, infer_service_from_contact, is_generic_service, normalize
from .database import (
    auth_storage_readiness,
    authenticate_user,
    find_user_by_email,
    find_user_by_id,
    find_group_by_id,
    find_chat_thread_by_id,
    get_connection,
    find_user_by_phone,
    init_db,
    ignore_merge_suggestion,
    insert_contact,
    add_group_contact,
    add_group_member,
    can_access_group,
    can_manage_group,
    create_group,
    create_group_message,
    create_chat_message,
    create_chat_thread,
    create_import_job,
    clear_group_messages,
    delete_push_subscription,
    get_push_dispatch_event,
    list_merge_suggestions,
    list_categories,
    list_chat_messages,
    list_chat_threads,
    list_group_contacts,
    list_group_messages,
    list_groups_for_user,
    list_import_jobs,
    list_push_subscriptions,
    merge_contacts,
    list_custom_fields,
    remove_group_contact,
    remove_group_member,
    row_to_contact,
    row_to_custom_field,
    row_to_public_profile,
    row_to_public_user_profile,
    row_to_user,
    save_custom_field_definition,
    sync_owner_contact_platform_links,
    upsert_push_dispatch_event,
    upsert_push_subscription,
    update_group,
    update_group_contact_custom_fields,
    update_contact,
    upsert_auth_user,
    upsert_google_user,
    upsert_user,
    delete_custom_field_definition,
    get_custom_field,
)
from .schemas import AddressLookupOut, AiChatIn, AiChatOut, AuthSessionIn, AuthStatusOut, CategoryOut, ChatMessageCreate, ChatMessageOut, ChatThreadCreate, ChatThreadOut, ContactCreate, ContactOut, CustomFieldDefinitionIn, CustomFieldDefinitionOut, GoogleLoginIn, GraphOut, GroupContactCustomFieldsIn, GroupContactLinkIn, GroupCreate, GroupMemberCreate, GroupMemberOut, GroupMessageCreate, GroupMessageOut, GroupOut, ImportIntegrationOut, ImportJobCreate, ImportJobOut, LoginIn, MergeDecisionIn, MergeSuggestionOut, PublicProfileOut, PushDispatchIn, PushDispatchOut, PushSubscriptionCreate, PushSubscriptionOut, PushTestNotificationIn, SearchOut, UserCreate, UserOut

BASE_DIR = Path(__file__).resolve().parent.parent


def load_local_env() -> None:
    if "unittest" in sys.modules and os.getenv("NETWORK_AGENDA_FORCE_LOCAL_ENV", "").strip().lower() not in {"1", "true", "yes", "on"}:
        return
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

app = FastAPI(title="Network Intelligence CRM API", version="0.1.0")
AUTH_CONTEXT: ContextVar[dict | None] = ContextVar("AUTH_CONTEXT", default=None)


def cors_allowed_origins() -> list[str]:
    defaults = ["http://127.0.0.1:5174", "http://localhost:5174"]
    configured = [
        origin.strip().rstrip("/")
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    return list(dict.fromkeys([*defaults, *configured]))


app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def decode_supabase_token(token: str) -> dict | None:
    if not token or jwt is None:
        return None
    claims = decode_supabase_hs256_claims(token)
    if claims is None:
        issuer_hint = ""
        unverified_claims = supabase_unverified_claims(token)
        if unverified_claims is not None:
            issuer_hint = str(unverified_claims.get("iss") or "").strip().rstrip("/")
        claims = decode_supabase_jwks_claims(token, issuer_hint or configured_supabase_url())
    if claims is None:
        return None
    email = str(claims.get("email") or "").strip()
    subject = str(claims.get("sub") or "").strip()
    if not email or not subject:
        return None
    provider = auth_provider_from_claims(claims)
    result = {"sub": subject, "email": email}
    if provider:
        result["provider"] = provider
    return result


def auth_provider_from_claims(claims: dict | None) -> str:
    if not isinstance(claims, dict):
        return ""
    provider = claims.get("provider")
    if not provider and isinstance(claims.get("app_metadata"), dict):
        provider = claims["app_metadata"].get("provider")
    if not provider and isinstance(claims.get("user_metadata"), dict):
        provider = claims["user_metadata"].get("provider")
    return str(provider or "").strip().lower()


def configured_supabase_url() -> str:
    for key in ("SUPABASE_URL", "VITE_SUPABASE_URL"):
        value = os.getenv(key, "").strip().rstrip("/")
        if value:
            return value
    return ""


def decode_supabase_hs256_claims(token: str) -> dict | None:
    jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "").strip()
    if not token or not jwt_secret or jwt is None:
        return None
    try:
        return jwt.decode(token, jwt_secret, algorithms=["HS256"], options={"verify_aud": False})
    except PyJWTError:
        return None


def supabase_unverified_claims(token: str) -> dict | None:
    if not token or jwt is None:
        return None
    try:
        return jwt.decode(
            token,
            options={
                "verify_signature": False,
                "verify_aud": False,
                "verify_exp": False,
                "verify_nbf": False,
                "verify_iat": False,
            },
            algorithms=["HS256", "RS256", "ES256"],
        )
    except PyJWTError:
        return None


def supabase_jwks_url(base_or_issuer: str) -> str:
    normalized = str(base_or_issuer or "").strip().rstrip("/")
    if not normalized:
        return ""
    if normalized.endswith("/auth/v1"):
        return f"{normalized}/.well-known/jwks.json"
    return f"{normalized}/auth/v1/.well-known/jwks.json"


@lru_cache(maxsize=8)
def supabase_jwks_client(jwks_url: str):
    if not jwks_url or PyJWKClient is None:
        return None
    return PyJWKClient(jwks_url)


def decode_supabase_jwks_claims(token: str, issuer_or_url: str) -> dict | None:
    jwks_url = supabase_jwks_url(issuer_or_url)
    if not token or not jwks_url or jwt is None:
        return None
    try:
        client = supabase_jwks_client(jwks_url)
        if client is None:
            return None
        signing_key = client.get_signing_key_from_jwt(token)
        return jwt.decode(token, signing_key.key, algorithms=["ES256", "RS256"], options={"verify_aud": False})
    except Exception:
        return None


def auth_context_from_header(authorization: str) -> dict | None:
    if not authorization.lower().startswith("bearer "):
        return None
    claims = decode_supabase_token(authorization.split(" ", 1)[1].strip())
    if claims is None:
        return None
    owner_id = ""
    with get_connection() as connection:
        row = find_user_by_email(connection, claims["email"])
        if row is None:
            row = upsert_auth_user(
                connection,
                {
                    "sub": claims["sub"],
                    "email": claims["email"],
                    "name": claims["email"].split("@", 1)[0],
                    "auth_provider": claims.get("provider") or "",
                },
            )
            connection.commit()
        if row is not None:
            owner_id = str(row["id"])
    return {**claims, "owner_id": owner_id}


def local_auth_context_from_headers(headers) -> dict | None:
    if not legacy_password_login_enabled():
        return None
    email = str(headers.get("x-local-auth-email") or "").strip()
    owner_id = str(headers.get("x-local-auth-owner-id") or "").strip()
    if not email:
        return None
    if not owner_id:
        owner_id = email
    return {
        "email": email,
        "owner_id": owner_id,
        "provider": "local",
    }


def supabase_auth_required() -> bool:
    return (production_auth_enforced() or bool(os.getenv("SUPABASE_JWT_SECRET", "").strip() or configured_supabase_url())) and jwt is not None


def production_auth_enforced() -> bool:
    environment = os.getenv("APP_ENV", os.getenv("ENV", "")).strip().lower()
    return environment in {"production", "prod"}


def demo_fallback_enabled() -> bool:
    return not production_auth_enforced() and not bool(os.getenv("SUPABASE_JWT_SECRET", "").strip() or configured_supabase_url())


def legacy_password_login_enabled() -> bool:
    return os.getenv("ALLOW_LEGACY_PASSWORD_LOGIN", "").strip().lower() in {"1", "true", "yes", "on"}


def jwt_validation_mode() -> str:
    if os.getenv("SUPABASE_JWT_SECRET", "").strip():
        return "hs256"
    if configured_supabase_url():
        return "jwks"
    return "disabled"


def production_auth_blocker() -> None:
    if production_auth_enforced() and not (configured_supabase_url() or os.getenv("SUPABASE_JWT_SECRET", "").strip()):
        raise HTTPException(status_code=503, detail="APP_ENV=production exige SUPABASE_URL ou SUPABASE_JWT_SECRET.")


def auth_context_or_unauthorized() -> dict | None:
    production_auth_blocker()
    context = AUTH_CONTEXT.get()
    if context and context.get("owner_id") and context.get("email"):
        return context
    if supabase_auth_required():
        raise HTTPException(status_code=401, detail="Autenticação Supabase obrigatória.")
    return None


def authenticated_owner_id(fallback: str | None = "demo-user") -> str:
    production_auth_blocker()
    context = AUTH_CONTEXT.get()
    if context and context.get("owner_id"):
        return str(context["owner_id"])
    if supabase_auth_required():
        raise HTTPException(status_code=401, detail="Autenticação Supabase obrigatória.")
    return str(fallback or "demo-user")


def ai_thread_title_from_message(message: str) -> str:
    cleaned = " ".join(str(message or "").strip().split())
    if not cleaned:
        return "Nova conversa"
    return cleaned[:160]


def assert_thread_access(connection, thread_id: int, owner_id: str):
    thread = find_chat_thread_by_id(connection, thread_id)
    if thread is None or str(thread["owner_id"]) != str(owner_id):
        raise HTTPException(status_code=404, detail="Thread nÃ£o encontrada.")
    return thread


def resolve_custom_field_scope_owner(connection, requester_id: str, scope_type: str, scope_id: str) -> str:
    normalized_scope = str(scope_type or "user").strip().lower() or "user"
    normalized_scope_id = str(scope_id or "").strip()
    if normalized_scope == "group":
        if not normalized_scope_id.isdigit():
            raise HTTPException(status_code=422, detail="Grupo inválido para campos personalizados.")
        group = find_group_by_id(connection, int(normalized_scope_id))
        if group is None:
            raise HTTPException(status_code=404, detail="Grupo não encontrado.")
        if not can_manage_group(connection, int(normalized_scope_id), requester_id):
            raise HTTPException(status_code=403, detail="Você não pode gerenciar campos deste grupo.")
        return str(group["owner_id"])
    return str(requester_id)


@app.middleware("http")
async def load_auth_context(request, call_next):
    context = auth_context_from_header(request.headers.get("authorization", ""))
    if context is None:
        context = local_auth_context_from_headers(request.headers)
    token = AUTH_CONTEXT.set(context)
    try:
        return await call_next(request)
    finally:
        AUTH_CONTEXT.reset(token)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "network-agenda-api"}


@app.get("/api/auth/status", response_model=AuthStatusOut)
def auth_status() -> dict:
    context = AUTH_CONTEXT.get() or {}
    has_supabase_url = bool(configured_supabase_url())
    has_supabase_jwt_secret = bool(os.getenv("SUPABASE_JWT_SECRET", "").strip())
    jwt_library_available = jwt is not None
    with get_connection() as connection:
        storage = auth_storage_readiness(connection)
    warnings = list(storage.get("warnings") or [])
    if not has_supabase_url and not has_supabase_jwt_secret:
        warnings.append("Backend sem SUPABASE_URL/SUPABASE_JWT_SECRET. Tokens do Supabase não serão validados.")
    if not jwt_library_available:
        warnings.append("PyJWT não está disponível no runtime do backend.")
    if legacy_password_login_enabled():
        warnings.append("Login legado por senha ainda está habilitado.")
    if production_auth_enforced() and not (has_supabase_url or has_supabase_jwt_secret):
        warnings.append("APP_ENV=production ativo sem SUPABASE_URL/SUPABASE_JWT_SECRET; rotas privadas serao bloqueadas.")
    if demo_fallback_enabled():
        warnings.append("Fallback demo-user ativo apenas para desenvolvimento local.")
    production_auth_ready = bool(
        jwt_library_available
        and not legacy_password_login_enabled()
        and storage.get("database_dialect") == "postgres"
        and storage.get("rls_ready")
        and (has_supabase_url or has_supabase_jwt_secret)
    )
    return {
        "supabase_auth_required": supabase_auth_required(),
        "production_auth_enforced": production_auth_enforced(),
        "demo_fallback_enabled": demo_fallback_enabled(),
        "configured_supabase_url": has_supabase_url,
        "configured_supabase_jwt_secret": has_supabase_jwt_secret,
        "configured_web_push_vapid": bool(push_vapid_config()),
        "jwt_library_available": jwt_library_available,
        "legacy_password_login_enabled": legacy_password_login_enabled(),
        "jwt_validation_mode": jwt_validation_mode(),
        "database_dialect": str(storage.get("database_dialect") or ""),
        "rls_supported": bool(storage.get("rls_supported")),
        "rls_ready": bool(storage.get("rls_ready")),
        "rls_enabled_tables": int(storage.get("rls_enabled_tables") or 0),
        "rls_total_tables": int(storage.get("rls_total_tables") or 0),
        "production_auth_ready": production_auth_ready,
        "warnings": warnings,
        "authenticated": bool(context.get("email") and context.get("owner_id")),
        "current_user_email": str(context.get("email") or ""),
        "current_owner_id": str(context.get("owner_id") or ""),
        "current_provider": str(context.get("provider") or ""),
    }


@app.get("/api/categories", response_model=list[CategoryOut])
def categories() -> list[dict]:
    with get_connection() as connection:
        return list_categories(connection)


def normalized_terms(value: str) -> list[str]:
    normalized_value = normalize(value)
    return [term for term in re.split(r"\W+", normalized_value) if len(term) >= 2]


def expanded_search_terms(query: str) -> list[str]:
    base_terms = normalized_terms(query)
    category = classify_service(query)
    expanded = list(base_terms)
    if category.id != "general":
        expanded.extend(normalized_terms(" ".join([category.label, category.group, *category.keywords[:6], *category.synonyms[:4]])))
    seen: set[str] = set()
    ordered: list[str] = []
    for term in expanded:
        key = normalize(term)
        if not key or key in seen:
            continue
        seen.add(key)
        ordered.append(key)
    return ordered


def search_intent(query: str) -> str:
    normalized = normalize(query)
    if any(term in normalized for term in ("busca", "procura", "precisa", "demanda", "quer")):
        return "demand"
    if any(term in normalized for term in ("resolve", "faz", "oferece", "presta", "entrega", "servico", "servico", "ajuda com")):
        return "solve"
    if any(term in normalized for term in ("conecta", "introducao", "introduzir", "complementar", "complementaridade", "match")):
        return "match"
    return "generic"


def semantic_query_terms(query: str) -> set[str]:
    terms = set(expanded_search_terms(query))
    category = classify_service(query)
    terms.update(normalized_terms(category.label))
    terms.update(normalized_terms(category.group))
    terms.update(normalized_terms(" ".join(category.keywords[:10])))
    terms.update(normalized_terms(" ".join(category.synonyms[:8])))
    return {term for term in terms if len(term) >= 3}


def semantic_overlap_score(query_terms: set[str], normalized_values: dict[str, str], fields: tuple[str, ...]) -> int:
    if not query_terms:
        return 0
    score = 0
    for field in fields:
        value = normalized_values.get(field, "")
        if not value:
            continue
        field_terms = {term for term in re.split(r"\W+", value) if len(term) >= 3}
        overlap = query_terms & field_terms
        score += len(overlap) * 7
        if overlap and any(term in value for term in query_terms):
            score += 4
    return score


def contact_search_score(contact: dict, query: str) -> int:
    normalized_query = normalize(query)
    if not normalized_query:
        return 0

    terms = expanded_search_terms(query) or [normalized_query]
    semantic_terms = semantic_query_terms(query)
    intent = search_intent(query)
    searchable_values = {
        "name": str(contact.get("name") or ""),
        "service": str(contact.get("service") or ""),
        "description": str(contact.get("description") or ""),
        "demand": str(contact.get("demand") or ""),
        "demand_tags": str(contact.get("demand_tags") or ""),
        "solves": str(contact.get("solves") or ""),
        "tags": str(contact.get("tags") or ""),
        "note": str(contact.get("note") or ""),
        "city": str(contact.get("city") or ""),
        "address": str(contact.get("address") or ""),
        "source": str(contact.get("source") or ""),
        "organization": str(contact.get("organization") or ""),
        "email": str(contact.get("email") or ""),
        "instagram": str(contact.get("instagram") or ""),
        "linkedin": str(contact.get("linkedin") or ""),
        "custom_url": str(contact.get("custom_url") or ""),
        "crm_status": str(contact.get("crm_status") or ""),
        "crm_priority": str(contact.get("crm_priority") or ""),
        "crm_note": str(contact.get("crm_note") or ""),
        "ddd": str(contact.get("ddd") or ""),
        "category": " ".join([str(contact.get("category", {}).get("label") or ""), str(contact.get("category", {}).get("group") or "")]),
        "phones": " ".join(str(item.get("phone") or "") for item in contact.get("phones") or []),
        "emails": " ".join(str(item.get("email") or "") for item in contact.get("emails") or []),
        "tag_items": " ".join(str(item) for item in contact.get("tag_items") or []),
        "custom_fields": " ".join(
            " ".join(
                [
                    str(item.get("name") or ""),
                    str(item.get("key") or ""),
                    str(item.get("value") or ""),
                ]
            )
            for item in contact.get("custom_field_values") or []
        ),
    }
    normalized_values = {key: normalize(value) for key, value in searchable_values.items() if value}

    score = 0
    if normalized_query in normalized_values.get("name", ""):
        score += 160
    if normalized_query in normalized_values.get("service", ""):
        score += 120
    if normalized_query in normalized_values.get("solves", ""):
        score += 120
    if normalized_query in normalized_values.get("demand", ""):
        score += 110
    if normalized_query in normalized_values.get("tags", "") or normalized_query in normalized_values.get("tag_items", ""):
        score += 100
    if normalized_query in normalized_values.get("custom_fields", ""):
        score += 95
    if normalized_query in normalized_values.get("organization", ""):
        score += 85
    if normalized_query in normalized_values.get("ddd", ""):
        score += 80
    if normalized_query in normalized_values.get("source", ""):
        score += 70
    if normalized_query in normalized_values.get("emails", "") or normalized_query in normalized_values.get("email", ""):
        score += 70
    if normalized_query in normalized_values.get("phones", ""):
        score += 65
    if normalized_query in normalized_values.get("instagram", "") or normalized_query in normalized_values.get("linkedin", ""):
        score += 60
    if normalized_query in normalized_values.get("description", "") or normalized_query in normalized_values.get("note", ""):
        score += 55
    if normalized_query in normalized_values.get("city", "") or normalized_query in normalized_values.get("address", ""):
        score += 40
    if normalized_query in normalized_values.get("crm_status", "") or normalized_query in normalized_values.get("crm_priority", ""):
        score += 35
    if normalized_query in normalized_values.get("category", ""):
        score += 30
    if intent == "demand" and normalized_query in normalized_values.get("demand", ""):
        score += 45
    if intent == "solve" and (normalized_query in normalized_values.get("service", "") or normalized_query in normalized_values.get("solves", "")):
        score += 45
    if intent == "match" and contact.get("potential_matches"):
        score += 28
    if contact.get("platform_match"):
        score += 12
    if contact.get("public_profile_match"):
        score += 8
    score += semantic_overlap_score(
        semantic_terms,
        normalized_values,
        ("service", "solves", "demand", "demand_tags", "tags", "tag_items", "description", "custom_fields", "organization", "category"),
    )

    for term in terms:
        if term in normalized_values.get("name", ""):
            score += 14
        if term in normalized_values.get("service", "") or term in normalized_values.get("solves", ""):
            score += 10
        if term in normalized_values.get("demand", "") or term in normalized_values.get("demand_tags", ""):
            score += 9
        if term in normalized_values.get("tags", "") or term in normalized_values.get("tag_items", ""):
            score += 8
        if term in normalized_values.get("custom_fields", ""):
            score += 8
        if term in normalized_values.get("organization", ""):
            score += 6
        if term in normalized_values.get("phones", "") or term in normalized_values.get("emails", ""):
            score += 6
        if intent == "demand" and term in normalized_values.get("demand", ""):
            score += 10
        if intent == "solve" and (term in normalized_values.get("service", "") or term in normalized_values.get("solves", "")):
            score += 10
        if intent == "match":
            for candidate in contact.get("potential_matches") or []:
                haystack = normalize(" ".join([candidate.get("name") or "", candidate.get("service") or "", " ".join(candidate.get("overlap") or [])]))
                if term in haystack:
                    score += 12
    return score


def public_profile_search_score(profile: dict, query: str) -> int:
    normalized_query = normalize(query)
    if not normalized_query:
        return 0
    intent = search_intent(query)
    search_text = normalize(
        " ".join(
            [
                str(profile.get("name") or ""),
                str(profile.get("service") or ""),
                str(profile.get("description") or ""),
                str(profile.get("demand") or ""),
                str(profile.get("solves") or ""),
                str(profile.get("tags") or ""),
                str(profile.get("area") or ""),
                str(profile.get("email") or ""),
                str(profile.get("phone") or ""),
                str(profile.get("whatsapp") or ""),
                str(profile.get("instagram") or ""),
                str(profile.get("linkedin") or ""),
                str(profile.get("custom_url") or ""),
                str(profile.get("category", {}).get("label") or ""),
                str(profile.get("category", {}).get("group") or ""),
            ]
        )
    )
    score = 0
    normalized_name = normalize(profile.get("name") or "")
    normalized_service = normalize(profile.get("service") or "")
    normalized_solves = normalize(profile.get("solves") or "")
    normalized_demand = normalize(profile.get("demand") or "")
    normalized_tags = normalize(profile.get("tags") or "")
    normalized_area = normalize(profile.get("area") or "")
    normalized_email = normalize(profile.get("email") or "")
    normalized_phone = normalize(profile.get("phone") or "")
    normalized_instagram = normalize(profile.get("instagram") or "")
    normalized_linkedin = normalize(profile.get("linkedin") or "")
    normalized_description = normalize(profile.get("description") or "")
    semantic_terms = semantic_query_terms(query)
    if normalized_query in normalized_name:
        score += 140
    if normalized_query in normalized_service or normalized_query in normalized_solves:
        score += 120
    if normalized_query in normalized_demand:
        score += 105
    if normalized_query in normalized_tags:
        score += 95
    if normalized_query in normalized_area:
        score += 65
    score += semantic_overlap_score(
        semantic_terms,
        {
            "name": normalized_name,
            "service": normalized_service,
            "solves": normalized_solves,
            "demand": normalized_demand,
            "tags": normalized_tags,
            "area": normalized_area,
            "description": normalized_description,
            "search_text": search_text,
        },
        ("service", "solves", "demand", "tags", "area", "description", "search_text"),
    )
    if normalized_query in normalized_email or normalized_query in normalized_phone:
        score += 60
    if normalized_query in normalized_instagram or normalized_query in normalized_linkedin:
        score += 55
    if normalized_query in normalized_description:
        score += 50
    if intent == "demand" and normalized_query in normalized_demand:
        score += 42
    if intent == "solve" and (normalized_query in normalized_service or normalized_query in normalized_solves):
        score += 42
    for term in expanded_search_terms(query):
        if term in search_text:
            score += 10
        if term in normalized_name:
            score += 14
        if term in normalized_service or term in normalized_solves:
            score += 10
        if term in normalized_demand or term in normalized_tags:
            score += 8
    return score


def push_vapid_config() -> dict | None:
    private_key = os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY", "").strip()
    subject = os.getenv("WEB_PUSH_VAPID_SUBJECT", "").strip()
    if not private_key or not subject:
        return None
    return {"private_key": private_key, "subject": subject}


def pad_base64url(value: str) -> str:
    return value + ("=" * ((4 - len(value) % 4) % 4))


def resolve_vapid_private_key(value: str) -> str:
    candidate = str(value or "").strip()
    if not candidate:
        raise HTTPException(status_code=503, detail="WEB_PUSH_VAPID_PRIVATE_KEY nÃ£o foi configurada.")
    if "BEGIN PRIVATE KEY" in candidate or "BEGIN EC PRIVATE KEY" in candidate:
        return candidate
    possible_path = Path(candidate)
    if possible_path.exists():
        return possible_path.read_text(encoding="utf-8")
    if serialization is None:
        raise HTTPException(status_code=503, detail="cryptography nÃ£o estÃ¡ instalada para decodificar WEB_PUSH_VAPID_PRIVATE_KEY.")
    try:
        decoded = base64.urlsafe_b64decode(pad_base64url(candidate).encode("utf-8"))
        private_key = serialization.load_der_private_key(decoded, password=None)
        pem_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        return pem_bytes.decode("utf-8")
    except Exception as exc:
        raise HTTPException(status_code=503, detail="WEB_PUSH_VAPID_PRIVATE_KEY invÃ¡lida. Use PEM, caminho para PEM ou PKCS8 DER em base64url.") from exc


def send_push_payload(subscription: dict, payload: dict) -> None:
    config = push_vapid_config()
    if webpush is None:
        raise HTTPException(status_code=503, detail="pywebpush nÃ£o estÃ¡ instalado no backend.")
    if config is None:
        raise HTTPException(status_code=503, detail="WEB_PUSH_VAPID_PRIVATE_KEY e WEB_PUSH_VAPID_SUBJECT sÃ£o obrigatÃ³rios para envio de push.")
    webpush(
        subscription_info={
            "endpoint": subscription["endpoint"],
            "keys": {
                "p256dh": subscription.get("p256dh_key") or "",
                "auth": subscription.get("auth_key") or "",
            },
        },
        data=json.dumps(payload, ensure_ascii=False),
        vapid_private_key=resolve_vapid_private_key(config["private_key"]),
        vapid_claims={"sub": config["subject"]},
    )


def user_allows_external_push(connection, owner_id: str) -> bool:
    row = find_user_by_id(connection, owner_id)
    if row is None:
        return True
    preference = str(row["notification_preference"] or "relevant").strip().lower()
    return preference == "relevant"


def push_dispatch_fingerprint(*parts) -> str:
    payload = json.dumps([str(part or "").strip() for part in parts], ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def parse_dispatch_timestamp(value: str | None) -> float | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    candidates = [raw]
    if raw.endswith("Z"):
        candidates.append(f"{raw[:-1]}+00:00")
    for candidate in candidates:
        try:
            return datetime.fromisoformat(candidate).timestamp()
        except ValueError:
            continue
    return None


def merge_suggestions_fingerprint(suggestions: list[dict]) -> str:
    pairs = [
        f"{item['primary_contact']['id']}:{item['duplicate_contact']['id']}"
        for item in suggestions[:8]
        if item.get("primary_contact") and item.get("duplicate_contact")
    ]
    return push_dispatch_fingerprint("duplicates", len(suggestions), *pairs)


def dispatch_owner_push(
    connection,
    owner_id: str,
    title: str,
    body: str,
    route: str,
    tag: str,
    *,
    event_key: str | None = None,
    fingerprint: str | None = None,
    cooldown_minutes: int = 240,
) -> dict:
    normalized_event_key = normalize(event_key or tag or route)
    normalized_fingerprint = str(fingerprint or push_dispatch_fingerprint(tag, title, body, route)).strip()[:120]
    if normalized_event_key and cooldown_minutes > 0:
        existing_event = get_push_dispatch_event(connection, owner_id, normalized_event_key)
        if existing_event and existing_event.get("fingerprint") == normalized_fingerprint:
            last_sent_at = parse_dispatch_timestamp(existing_event.get("last_sent_at"))
            if last_sent_at is not None and (datetime.now().timestamp() - last_sent_at) < cooldown_minutes * 60:
                return {"sent": 0, "failed": 0, "removed": 0}
    if not user_allows_external_push(connection, owner_id):
        return {"sent": 0, "failed": 0, "removed": 0}
    if push_vapid_config() is None or webpush is None:
        return {"sent": 0, "failed": 0, "removed": 0}
    subscriptions = list_push_subscriptions(connection, owner_id)
    if not subscriptions:
        return {"sent": 0, "failed": 0, "removed": 0}

    sent = 0
    failed = 0
    removed = 0
    payload = {
        "title": title[:120],
        "body": body[:500],
        "tag": tag[:120],
        "data": {"route": route[:240]},
    }
    for subscription in subscriptions:
        try:
            send_push_payload(subscription, payload)
            sent += 1
        except HTTPException:
            raise
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None) or getattr(getattr(exc, "response", None), "status", None)
            if status_code in {404, 410}:
                delete_push_subscription(connection, int(subscription["id"]), owner_id)
                removed += 1
            else:
                failed += 1
        except Exception:
            failed += 1
    if sent > 0 and normalized_event_key:
        upsert_push_dispatch_event(connection, owner_id, normalized_event_key, normalized_fingerprint, sent)
    return {"sent": sent, "failed": failed, "removed": removed}


def due_follow_up_contacts(rows: list[dict], horizon_hours: int = 24) -> list[dict]:
    now = datetime.now()
    horizon = now + timedelta(hours=horizon_hours)
    due: list[dict] = []
    for contact in rows:
        raw = str(contact.get("next_follow_up_at") or "").strip()
        if not raw:
            continue
        try:
            target = datetime.fromisoformat(raw[:16])
        except ValueError:
            continue
        if now <= target <= horizon:
            due.append(contact)
    due.sort(key=lambda item: item.get("next_follow_up_at") or "")
    return due


def build_search_insights(query: str, private_results: list[dict], public_results: list[dict]) -> list[str]:
    insights: list[str] = []
    if private_results:
        top_private = private_results[0]
        top_private_bits = [str(top_private.get("service") or "").strip()]
        if str(top_private.get("demand") or "").strip():
            top_private_bits.append(f"demanda: {str(top_private.get('demand') or '').strip()[:96]}")
        elif str(top_private.get("solves") or "").strip():
            top_private_bits.append(f"resolve: {str(top_private.get('solves') or '').strip()[:96]}")
        elif str(top_private.get("tags") or "").strip():
            top_private_bits.append(f"tags: {str(top_private.get('tags') or '').strip()[:96]}")
        top_private_preview = " · ".join(bit for bit in top_private_bits if bit)
        if top_private_preview:
            insights.append(f"Melhor resultado privado: {top_private['name']} · {top_private_preview}.")
        linked = [item for item in private_results if item.get("platform_match") or item.get("public_profile_match")]
        if linked:
            insights.append(f"{len(linked)} contato(s) privado(s) têm vínculo provável com usuários ou perfis públicos.")
        complementary = [item for item in private_results if item.get("potential_matches")]
        if complementary:
            top = complementary[0]
            preview = ", ".join(match["name"] for match in (top.get("potential_matches") or [])[:2])
            if preview:
                insights.append(f"Melhor complementaridade agora: {top['name']} pode se conectar com {preview}.")
    if public_results:
        top_public = public_results[0]
        top_public_bits = [str(top_public.get("service") or "").strip()]
        if str(top_public.get("solves") or "").strip():
            top_public_bits.append(f"resolve: {str(top_public.get('solves') or '').strip()[:96]}")
        elif str(top_public.get("demand") or "").strip():
            top_public_bits.append(f"demanda: {str(top_public.get('demand') or '').strip()[:96]}")
        top_public_preview = " · ".join(bit for bit in top_public_bits if bit)
        if top_public_preview:
            insights.append(f"Melhor resultado público: {top_public['name']} · {top_public_preview}.")
        people = [item for item in public_results if (item.get("kind") or "group") == "person"]
        if people:
            insights.append(f"{len(people)} perfil(is) público(s) pessoal(is) apareceram para \"{query}\".")
    return insights[:4]


def import_integrations_catalog() -> list[dict]:
    def blocked_integration(
        *,
        provider: str,
        label: str,
        mode: str,
        description: str,
        supported_formats: list[str],
        requirements: list[str],
        setup_hint: str,
    ) -> dict:
        return {
            "provider": provider,
            "label": label,
            "status": "blocked_by_credentials",
            "mode": mode,
            "description": description,
            "supported_formats": supported_formats,
            "credential_requirements": requirements,
            "blocked_reason": "Integração preparada no produto, mas ainda depende de credenciais do provedor para ser ativada.",
            "setup_hint": setup_hint,
            "available": False,
            "action_label": "Ver requisitos",
        }

    return [
        {
            "provider": "google_contacts",
            "label": "Google Contacts",
            "status": "implemented",
            "mode": "oauth",
            "description": "Importação real já disponível via conta Google conectada.",
            "supported_formats": ["oauth"],
            "credential_requirements": ["VITE_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID"],
            "blocked_reason": "",
            "setup_hint": "Conecte a conta Google no onboarding ou na central de importação.",
            "available": True,
            "action_label": "Importar agora",
        },
        blocked_integration(
            provider="apple_contacts_native",
            label="Apple Contacts",
            mode="native_oauth",
            description="A camada nativa fica pronta para ativação quando o app receber credenciais Apple e o fluxo OAuth for liberado.",
            supported_formats=["oauth", "vcf"],
            requirements=["APPLE_OAUTH_CLIENT_ID", "APPLE_OAUTH_TEAM_ID", "APPLE_OAUTH_KEY_ID"],
            setup_hint="Enquanto isso, use VCF exportado do app Contatos ou do iCloud.",
        ),
        blocked_integration(
            provider="outlook_native",
            label="Outlook",
            mode="native_oauth",
            description="A integração nativa com Microsoft entra aqui assim que as credenciais OAuth estiverem disponíveis.",
            supported_formats=["oauth", "csv"],
            requirements=["MICROSOFT_CLIENT_ID", "MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_SECRET"],
            setup_hint="Enquanto isso, o parser já aceita CSV compatível do Outlook.",
        ),
        blocked_integration(
            provider="linkedin_native",
            label="LinkedIn",
            mode="native_connector",
            description="O fluxo guiado fica preparado para quando houver credenciais e liberação do provedor.",
            supported_formats=["csv"],
            requirements=["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
            setup_hint="Enquanto isso, continue com exportações CSV compatíveis do LinkedIn.",
        ),
    ]


def dispatch_priority_pushes(connection, owner_id: str, kinds: list[str] | None = None) -> dict:
    normalized_kinds = {normalize(item) for item in (kinds or ["follow_up", "duplicates", "matches"])}
    events: list[str] = []
    sent = 0
    failed = 0
    removed = 0

    sync_owner_contact_platform_links(connection, owner_id)
    private_rows = connection.execute(
        "SELECT * FROM contacts WHERE owner_id = ? ORDER BY datetime(created_at) DESC, id DESC",
        (owner_id,),
    ).fetchall()
    private_contacts = [row_to_contact(row, connection) for row in private_rows]
    if "follow_up" in normalized_kinds:
        due = due_follow_up_contacts(private_contacts)
        if due:
            first_due = due[0]
            result = dispatch_owner_push(
                connection,
                owner_id,
                "Follow-up próximo",
                f"{first_due['name']} precisa de atenção até {format_follow_up(first_due['next_follow_up_at'])}.",
                "/crm",
                "follow-up-due",
            )
            events.append("follow_up")
            sent += result["sent"]
            failed += result["failed"]
            removed += result["removed"]

    if "duplicates" in normalized_kinds:
        duplicates = list_merge_suggestions(connection, owner_id)
        if duplicates:
            result = dispatch_owner_push(
                connection,
                owner_id,
                "Duplicados para revisar",
                f"Há {len(duplicates)} sugestão(ões) de merge pendentes na sua agenda.",
                "/duplicados",
                "duplicates-pending",
            )
            events.append("duplicates")
            sent += result["sent"]
            failed += result["failed"]
            removed += result["removed"]

    if "matches" in normalized_kinds:
        matched = [item for item in private_contacts if item.get("potential_matches")]
        if matched:
            top = matched[0]
            candidate = (top.get("potential_matches") or [{}])[0]
            if candidate.get("name"):
                result = dispatch_owner_push(
                    connection,
                    owner_id,
                    "Nova complementaridade",
                    f"{top['name']} combina com {candidate['name']} pela leitura atual da rede.",
                    "/grafo",
                    "network-match",
                )
                events.append("matches")
                sent += result["sent"]
                failed += result["failed"]
                removed += result["removed"]

    return {"sent": sent, "failed": failed, "removed": removed, "events": events}


def dispatch_priority_pushes(connection, owner_id: str, kinds: list[str] | None = None) -> dict:
    normalized_kinds = {normalize(item) for item in (kinds or ["follow_up", "duplicates", "matches"])}
    events: list[str] = []
    sent = 0
    failed = 0
    removed = 0

    sync_owner_contact_platform_links(connection, owner_id)
    private_rows = connection.execute(
        "SELECT * FROM contacts WHERE owner_id = ? ORDER BY datetime(created_at) DESC, id DESC",
        (owner_id,),
    ).fetchall()
    private_contacts = [row_to_contact(row, connection) for row in private_rows]

    if "follow_up" in normalized_kinds:
        due = due_follow_up_contacts(private_contacts)
        if due:
            first_due = due[0]
            result = dispatch_owner_push(
                connection,
                owner_id,
                "Follow-up prÃ³ximo",
                f"{first_due['name']} precisa de atenÃ§Ã£o atÃ© {format_follow_up(first_due['next_follow_up_at'])}.",
                "/crm",
                "follow-up-due",
                event_key="follow_up",
                fingerprint=push_dispatch_fingerprint("follow_up", first_due["id"], follow_up_slot(first_due.get("next_follow_up_at"))),
                cooldown_minutes=180,
            )
            if result["sent"] > 0:
                events.append("follow_up")
            sent += result["sent"]
            failed += result["failed"]
            removed += result["removed"]

    if "duplicates" in normalized_kinds:
        duplicates = list_merge_suggestions(connection, owner_id)
        if duplicates:
            result = dispatch_owner_push(
                connection,
                owner_id,
                "Duplicados para revisar",
                f"HÃ¡ {len(duplicates)} sugestÃ£o(Ãµes) de merge pendentes na sua agenda.",
                "/duplicados",
                "duplicates-pending",
                event_key="duplicates",
                fingerprint=merge_suggestions_fingerprint(duplicates),
                cooldown_minutes=360,
            )
            if result["sent"] > 0:
                events.append("duplicates")
            sent += result["sent"]
            failed += result["failed"]
            removed += result["removed"]

    if "matches" in normalized_kinds:
        matched = [item for item in private_contacts if item.get("potential_matches")]
        if matched:
            top = matched[0]
            candidate = (top.get("potential_matches") or [{}])[0]
            if candidate.get("name"):
                result = dispatch_owner_push(
                    connection,
                    owner_id,
                    "Nova complementaridade",
                    f"{top['name']} combina com {candidate['name']} pela leitura atual da rede.",
                    "/grafo",
                    "network-match",
                    event_key="matches",
                    fingerprint=push_dispatch_fingerprint("matches", top["id"], candidate.get("id") or candidate.get("name"), candidate.get("service")),
                    cooldown_minutes=240,
                )
                if result["sent"] > 0:
                    events.append("matches")
                sent += result["sent"]
                failed += result["failed"]
                removed += result["removed"]

    return {"sent": sent, "failed": failed, "removed": removed, "events": events}


@app.get("/api/contacts", response_model=list[ContactOut])
def contacts(
    query: str = Query(default=""),
    category: str = Query(default="all"),
    user_id: str = Query(default="demo-user"),
) -> list[dict]:
    normalized_query = normalize(query)
    owner_id = authenticated_owner_id(user_id)
    with get_connection() as connection:
        sync_owner_contact_platform_links(connection, owner_id)
        rows = connection.execute(
            "SELECT * FROM contacts WHERE owner_id = ? ORDER BY datetime(created_at) DESC, id DESC",
            (owner_id,),
        ).fetchall()
        results: list[tuple[int, dict]] = []
        for row in rows:
            category_match = category == "all" or row["category_id"] == category
            if not category_match:
                continue
            contact = row_to_contact(row, connection)
            if not normalized_query:
                results.append((0, contact))
                continue
            score = contact_search_score(contact, query)
            if score > 0:
                results.append((score, contact))

    return [contact for _, contact in sorted(results, key=lambda item: (item[0], item[1]["created_at"], item[1]["id"]), reverse=True)]


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
        owner_id = authenticated_owner_id(data.get("owner_id"))
        data["owner_id"] = owner_id
        ensure_follow_up_slot_available(connection, owner_id, data.get("next_follow_up_at"))
        registered_user = find_user_by_phone(connection, data["phone"])
        if registered_user is not None:
            user = row_to_user(registered_user)
            data["name"] = data["name"] or user["name"]
            data["city"] = user["city"] or data.get("city")
            data["address"] = user["address"] or data.get("address")
            data["source"] = "Perfil cadastrado"
        row = insert_contact(connection, data)
        if row is None:
            raise HTTPException(status_code=404, detail="Contato não encontrado.")
        saved_contact = row_to_contact(row, connection)
        if due_follow_up_contacts([saved_contact], horizon_hours=48):
            dispatch_owner_push(
                connection,
                owner_id,
                "Follow-up agendado",
                f"{saved_contact['name']} entrou na fila de follow-up para {format_follow_up(saved_contact['next_follow_up_at'])}.",
                "/crm",
                "follow-up-scheduled",
            )
        if list_merge_suggestions(connection, owner_id):
            dispatch_owner_push(
                connection,
                owner_id,
                "Duplicados sugeridos",
                "A agenda encontrou possíveis duplicados para revisão manual.",
                "/duplicados",
                "duplicates-detected",
            )
        connection.commit()
        return saved_contact


@app.post("/api/contacts/import", response_model=list[ContactOut], status_code=201)
def import_contacts(payloads: list[ContactCreate]) -> list[dict]:
    """Persist a Google/CSV import in one authenticated database transaction."""
    if not payloads:
        return []
    with get_connection() as connection:
        owner_id = authenticated_owner_id(payloads[0].owner_id)
        saved_contacts: list[dict] = []
        for payload in payloads:
            data = payload.model_dump()
            data["owner_id"] = owner_id
            row = insert_contact(connection, data)
            if row is None:
                raise HTTPException(status_code=500, detail="Não foi possível salvar um contato importado.")
            # Building match metadata compares every contact against the whole
            # agenda. During a bulk import that becomes quadratic and can make
            # the HTTP request appear stuck, so return the lightweight row.
            saved_contacts.append(row_to_contact(row))
        connection.commit()
        return saved_contacts


@app.put("/api/contacts/{contact_id}", response_model=ContactOut)
def edit_contact(contact_id: int, payload: ContactCreate) -> dict:
    with get_connection() as connection:
        data = payload.model_dump()
        owner_id = authenticated_owner_id(data.get("owner_id"))
        data["owner_id"] = owner_id
        ensure_follow_up_slot_available(connection, owner_id, data.get("next_follow_up_at"), contact_id)
        registered_user = find_user_by_phone(connection, data["phone"])
        if registered_user is not None:
            user = row_to_user(registered_user)
            data["city"] = user["city"] or data.get("city")
            data["address"] = user["address"] or data.get("address")
            data["source"] = "Perfil cadastrado"
        row = update_contact(connection, contact_id, data)
        saved_contact = row_to_contact(row, connection) if row is not None else None
        if row is None:
            raise HTTPException(status_code=404, detail="Contato não encontrado.")
        if due_follow_up_contacts([saved_contact], horizon_hours=48):
            dispatch_owner_push(
                connection,
                owner_id,
                "Follow-up atualizado",
                f"{saved_contact['name']} ficou com follow-up em {format_follow_up(saved_contact['next_follow_up_at'])}.",
                "/crm",
                "follow-up-updated",
            )
        if list_merge_suggestions(connection, owner_id):
            dispatch_owner_push(
                connection,
                owner_id,
                "Duplicados sugeridos",
                "A agenda ainda tem possíveis duplicados para revisão manual.",
                "/duplicados",
                "duplicates-detected",
            )
        connection.commit()
        return saved_contact


@app.delete("/api/contacts/{contact_id}", status_code=204, response_class=Response)
def delete_contact(contact_id: int, user_id: str = Query(default="demo-user")) -> Response:
    with get_connection() as connection:
        owner_id = authenticated_owner_id(user_id)
        connection.execute("DELETE FROM contact_phones WHERE contact_id = ? AND owner_id = ?", (contact_id, owner_id))
        connection.execute("DELETE FROM contact_emails WHERE contact_id = ? AND owner_id = ?", (contact_id, owner_id))
        connection.execute("DELETE FROM contact_tags WHERE contact_id = ? AND owner_id = ?", (contact_id, owner_id))
        connection.execute("DELETE FROM custom_field_values WHERE contact_id = ? AND owner_id = ?", (contact_id, owner_id))
        cursor = connection.execute("DELETE FROM contacts WHERE id = ? AND owner_id = ?", (contact_id, owner_id))
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Contato não encontrado.")
    return Response(status_code=204)


@app.get("/api/merge-suggestions", response_model=list[MergeSuggestionOut])
def merge_suggestions(user_id: str = Query(default="demo-user")) -> list[dict]:
    with get_connection() as connection:
        return list_merge_suggestions(connection, authenticated_owner_id(user_id))


@app.post("/api/merge-suggestions/ignore", status_code=204, response_class=Response)
def ignore_duplicate(payload: MergeDecisionIn) -> Response:
    with get_connection() as connection:
        try:
            ignore_merge_suggestion(connection, authenticated_owner_id(payload.owner_id), payload.primary_contact_id, payload.duplicate_contact_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        connection.commit()
    return Response(status_code=204)


@app.post("/api/merge-suggestions/merge", response_model=ContactOut)
def merge_duplicate(payload: MergeDecisionIn) -> dict:
    with get_connection() as connection:
        try:
            row = merge_contacts(connection, authenticated_owner_id(payload.owner_id), payload.primary_contact_id, payload.duplicate_contact_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        connection.commit()
        return row_to_contact(row, connection)


@app.get("/api/custom-fields", response_model=list[CustomFieldDefinitionOut])
def custom_fields(
    user_id: str = Query(default="demo-user"),
    scope_type: str = Query(default="user"),
    scope_id: str = Query(default=""),
) -> list[dict]:
    requester_id = authenticated_owner_id(user_id)
    normalized_scope = str(scope_type or "user").strip().lower() or "user"
    normalized_scope_id = str(scope_id or "").strip()
    with get_connection() as connection:
        owner_id = requester_id
        if normalized_scope == "group":
            if not normalized_scope_id.isdigit():
                raise HTTPException(status_code=422, detail="Grupo inválido para campos personalizados.")
            if not can_access_group(connection, int(normalized_scope_id), requester_id):
                raise HTTPException(status_code=403, detail="Você não pode acessar os campos deste grupo.")
            group = find_group_by_id(connection, int(normalized_scope_id))
            if group is None:
                raise HTTPException(status_code=404, detail="Grupo não encontrado.")
            owner_id = str(group["owner_id"])
        return list_custom_fields(connection, owner_id, normalized_scope, normalized_scope_id)


@app.post("/api/custom-fields", response_model=CustomFieldDefinitionOut, status_code=201)
def create_custom_field(payload: CustomFieldDefinitionIn) -> dict:
    requester_id = authenticated_owner_id(payload.owner_id)
    with get_connection() as connection:
        owner_id = resolve_custom_field_scope_owner(connection, requester_id, payload.scope_type, payload.scope_id or "")
        try:
            field = save_custom_field_definition(connection, owner_id, payload.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        connection.commit()
        return field


@app.put("/api/custom-fields/{field_id}", response_model=CustomFieldDefinitionOut)
def edit_custom_field(field_id: int, payload: CustomFieldDefinitionIn) -> dict:
    requester_id = authenticated_owner_id(payload.owner_id)
    with get_connection() as connection:
        owner_id = resolve_custom_field_scope_owner(connection, requester_id, payload.scope_type, payload.scope_id or "")
        existing = get_custom_field(connection, field_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Campo personalizado não encontrado.")
        if str(existing["owner_id"]) != owner_id:
            raise HTTPException(status_code=403, detail="Você não pode editar este campo.")
        try:
            field = save_custom_field_definition(connection, owner_id, payload.model_dump(), field_id=field_id)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        connection.commit()
        return field


@app.delete("/api/custom-fields/{field_id}", status_code=204, response_class=Response)
def remove_custom_field(field_id: int, requester_id: str = Query(default="demo-user")) -> Response:
    resolved_requester_id = authenticated_owner_id(requester_id)
    with get_connection() as connection:
        existing = get_custom_field(connection, field_id)
        if existing is None:
            raise HTTPException(status_code=404, detail="Campo personalizado não encontrado.")
        if existing["scope_type"] == "group":
            if not existing["scope_id"].isdigit() or not can_manage_group(connection, int(existing["scope_id"]), resolved_requester_id):
                raise HTTPException(status_code=403, detail="Você não pode remover este campo.")
        elif str(existing["owner_id"]) != resolved_requester_id:
            raise HTTPException(status_code=403, detail="Você não pode remover este campo.")
        if not delete_custom_field_definition(connection, str(existing["owner_id"]), field_id):
            raise HTTPException(status_code=404, detail="Campo personalizado não encontrado.")
        connection.commit()
    return Response(status_code=204)


@app.get("/api/groups", response_model=list[GroupOut])
def groups(user_id: str = Query(default="demo-user")) -> list[dict]:
    with get_connection() as connection:
        return list_groups_for_user(connection, authenticated_owner_id(user_id))


@app.post("/api/groups", response_model=GroupOut, status_code=201)
def create_shared_group(payload: GroupCreate) -> dict:
    owner_id = authenticated_owner_id(payload.owner_id)
    with get_connection() as connection:
        try:
            group = create_group(connection, {**payload.model_dump(), "owner_id": owner_id})
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        connection.commit()
        return group


@app.put("/api/groups/{group_id}", response_model=GroupOut)
def edit_shared_group(group_id: int, payload: GroupCreate) -> dict:
    requester_id = authenticated_owner_id(payload.owner_id)
    with get_connection() as connection:
        if not can_manage_group(connection, group_id, requester_id):
            raise HTTPException(status_code=403, detail="Você não pode editar este grupo.")
        try:
            group = update_group(connection, group_id, payload.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if group is None:
            raise HTTPException(status_code=404, detail="Grupo não encontrado.")
        connection.commit()
        return group


@app.post("/api/groups/{group_id}/members", response_model=GroupMemberOut, status_code=201)
def create_group_member(group_id: int, payload: GroupMemberCreate) -> dict:
    requester_id = authenticated_owner_id(payload.requester_id)
    with get_connection() as connection:
        if not can_manage_group(connection, group_id, requester_id):
            raise HTTPException(status_code=403, detail="Você não pode gerenciar membros deste grupo.")
        try:
            member = add_group_member(connection, group_id, payload.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        connection.commit()
        return member


@app.delete("/api/groups/{group_id}/members/{member_id}", status_code=204, response_class=Response)
def delete_group_member(group_id: int, member_id: int, requester_id: str = Query(default="demo-user")) -> Response:
    requester_owner_id = authenticated_owner_id(requester_id)
    with get_connection() as connection:
        if not can_manage_group(connection, group_id, requester_owner_id):
            raise HTTPException(status_code=403, detail="Você não pode gerenciar membros deste grupo.")
        if not remove_group_member(connection, group_id, member_id):
            raise HTTPException(status_code=404, detail="Membro não encontrado.")
        connection.commit()
    return Response(status_code=204)


@app.get("/api/groups/{group_id}/contacts", response_model=list[ContactOut])
def group_contacts(group_id: int, user_id: str = Query(default="demo-user")) -> list[dict]:
    requester_id = authenticated_owner_id(user_id)
    with get_connection() as connection:
        if not can_access_group(connection, group_id, requester_id):
            raise HTTPException(status_code=403, detail="Você não pode acessar este grupo.")
        return list_group_contacts(connection, group_id)


@app.post("/api/groups/{group_id}/contacts", response_model=ContactOut, status_code=201)
def create_group_contact(group_id: int, payload: GroupContactLinkIn) -> dict:
    requester_id = authenticated_owner_id(payload.requester_id)
    with get_connection() as connection:
        if not can_manage_group(connection, group_id, requester_id):
            raise HTTPException(status_code=403, detail="Você não pode adicionar contatos neste grupo.")
        try:
            contact = add_group_contact(
                connection,
                group_id,
                {
                    "contact_id": payload.contact_id,
                    "owner_id": authenticated_owner_id(payload.owner_id),
                    "added_by": requester_id,
                },
            )
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        connection.commit()
        return contact


@app.get("/api/groups/{group_id}/messages", response_model=list[GroupMessageOut])
def group_messages(group_id: int, user_id: str = Query(default="demo-user")) -> list[dict]:
    requester_id = authenticated_owner_id(user_id)
    with get_connection() as connection:
        if not can_access_group(connection, group_id, requester_id):
            raise HTTPException(status_code=403, detail="VocÃª nÃ£o pode acessar este grupo.")
        return list_group_messages(connection, group_id)


@app.post("/api/groups/{group_id}/messages", response_model=GroupMessageOut, status_code=201)
def create_shared_group_message(group_id: int, payload: GroupMessageCreate) -> dict:
    requester_id = authenticated_owner_id(payload.requester_id)
    with get_connection() as connection:
        if not can_access_group(connection, group_id, requester_id):
            raise HTTPException(status_code=403, detail="VocÃª nÃ£o pode conversar neste grupo.")
        try:
            message = create_group_message(connection, group_id, {**payload.model_dump(), "requester_id": requester_id})
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        connection.commit()
        return message


@app.delete("/api/groups/{group_id}/messages", status_code=204, response_class=Response)
def clear_shared_group_messages(group_id: int, requester_id: str = Query(default="demo-user")) -> Response:
    requester_owner_id = authenticated_owner_id(requester_id)
    with get_connection() as connection:
        if not can_manage_group(connection, group_id, requester_owner_id):
            raise HTTPException(status_code=403, detail="VocÃª nÃ£o pode limpar a conversa deste grupo.")
        clear_group_messages(connection, group_id)
        connection.commit()
    return Response(status_code=204)


@app.delete("/api/groups/{group_id}/contacts/{contact_id}", status_code=204, response_class=Response)
def delete_group_contact(group_id: int, contact_id: int, requester_id: str = Query(default="demo-user")) -> Response:
    requester_owner_id = authenticated_owner_id(requester_id)
    with get_connection() as connection:
        if not can_manage_group(connection, group_id, requester_owner_id):
            raise HTTPException(status_code=403, detail="Você não pode remover contatos deste grupo.")
        if not remove_group_contact(connection, group_id, contact_id):
            raise HTTPException(status_code=404, detail="Contato não encontrado no grupo.")
        connection.commit()
    return Response(status_code=204)


@app.put("/api/groups/{group_id}/contacts/{contact_id}/custom-fields", response_model=ContactOut)
def edit_group_contact_custom_fields(group_id: int, contact_id: int, payload: GroupContactCustomFieldsIn) -> dict:
    requester_id = authenticated_owner_id(payload.requester_id)
    with get_connection() as connection:
        if not can_manage_group(connection, group_id, requester_id):
            raise HTTPException(status_code=403, detail="VocÃª nÃ£o pode editar campos deste contato no grupo.")
        try:
            contact = update_group_contact_custom_fields(connection, group_id, contact_id, payload.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        connection.commit()
        return contact


@app.get("/api/chat/threads", response_model=list[ChatThreadOut])
def chat_threads(user_id: str = Query(default="demo-user")) -> list[dict]:
    with get_connection() as connection:
        return list_chat_threads(connection, authenticated_owner_id(user_id))


@app.post("/api/chat/threads", response_model=ChatThreadOut, status_code=201)
def create_private_chat_thread(payload: ChatThreadCreate) -> dict:
    owner_id = authenticated_owner_id(payload.user_id)
    with get_connection() as connection:
        thread = create_chat_thread(connection, owner_id, payload.model_dump())
        connection.commit()
        return thread


@app.get("/api/chat/threads/{thread_id}/messages", response_model=list[ChatMessageOut])
def chat_thread_messages(thread_id: int, user_id: str = Query(default="demo-user")) -> list[dict]:
    owner_id = authenticated_owner_id(user_id)
    with get_connection() as connection:
        assert_thread_access(connection, thread_id, owner_id)
        return list_chat_messages(connection, thread_id, owner_id)


@app.post("/api/chat/threads/{thread_id}/messages", response_model=ChatMessageOut, status_code=201)
def create_private_chat_message(thread_id: int, payload: ChatMessageCreate) -> dict:
    owner_id = authenticated_owner_id(payload.user_id)
    with get_connection() as connection:
        assert_thread_access(connection, thread_id, owner_id)
        try:
            message = create_chat_message(connection, thread_id, owner_id, payload.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        connection.commit()
        return message


@app.get("/api/import-jobs", response_model=list[ImportJobOut])
def import_jobs(user_id: str = Query(default="demo-user")) -> list[dict]:
    with get_connection() as connection:
        return list_import_jobs(connection, authenticated_owner_id(user_id))


@app.post("/api/import-jobs", response_model=ImportJobOut, status_code=201)
def create_contact_import_job(payload: ImportJobCreate) -> dict:
    owner_id = authenticated_owner_id(payload.user_id)
    with get_connection() as connection:
        try:
            job = create_import_job(connection, owner_id, payload.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if int(job.get("imported_count") or 0) > 0:
            dispatch_owner_push(
                connection,
                owner_id,
                "Importação concluída",
                f"{job['imported_count']} contato(s) entraram na sua agenda via {job['source']}.",
                "/importar",
                "import-complete",
            )
        connection.commit()
        return job


@app.get("/api/import-integrations", response_model=list[ImportIntegrationOut])
def import_integrations() -> list[dict]:
    return import_integrations_catalog()


@app.get("/api/push-subscriptions", response_model=list[PushSubscriptionOut])
def push_subscriptions(user_id: str = Query(default="demo-user")) -> list[dict]:
    with get_connection() as connection:
        return list_push_subscriptions(connection, authenticated_owner_id(user_id))


@app.post("/api/push-subscriptions", response_model=PushSubscriptionOut, status_code=201)
def create_push_subscription(payload: PushSubscriptionCreate) -> dict:
    owner_id = authenticated_owner_id(payload.user_id)
    with get_connection() as connection:
        try:
            subscription = upsert_push_subscription(connection, owner_id, payload.model_dump())
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        connection.commit()
        return subscription


@app.delete("/api/push-subscriptions/{subscription_id}", status_code=204, response_class=Response)
def delete_push_subscription_entry(subscription_id: int, user_id: str = Query(default="demo-user")) -> Response:
    owner_id = authenticated_owner_id(user_id)
    with get_connection() as connection:
        if not delete_push_subscription(connection, subscription_id, owner_id):
            raise HTTPException(status_code=404, detail="InscriÃƒÂ§ÃƒÂ£o de push nÃƒÂ£o encontrada.")
        connection.commit()
    return Response(status_code=204)


@app.post("/api/push-subscriptions/test")
def send_test_push_notification(payload: PushTestNotificationIn) -> dict:
    owner_id = authenticated_owner_id(payload.user_id)
    with get_connection() as connection:
        subscriptions = list_push_subscriptions(connection, owner_id)
        if payload.subscription_id is not None:
            subscriptions = [item for item in subscriptions if int(item["id"]) == int(payload.subscription_id)]
        if not subscriptions:
            raise HTTPException(status_code=404, detail="Nenhum dispositivo inscrito para este usuÃ¡rio.")

        sent = 0
        failed = 0
        removed = 0
        last_error = ""
        push_payload = {
            "title": str(payload.title or "Network Intelligence CRM")[:120],
            "body": str(payload.body or "Seu dispositivo estÃ¡ pronto para receber alertas.")[:500],
            "tag": "network-intelligence-test",
            "data": {"route": str(payload.route or "/configuracoes")[:240]},
        }

        for subscription in subscriptions:
            try:
                send_push_payload(subscription, push_payload)
                sent += 1
            except HTTPException:
                raise
            except WebPushException as exc:
                status_code = getattr(getattr(exc, "response", None), "status_code", None) or getattr(getattr(exc, "response", None), "status", None)
                if status_code in {404, 410}:
                    delete_push_subscription(connection, int(subscription["id"]), owner_id)
                    removed += 1
                else:
                    failed += 1
                    last_error = str(exc)
            except Exception as exc:
                failed += 1
                last_error = str(exc)

        connection.commit()
        if sent == 0 and failed > 0:
            raise HTTPException(status_code=502, detail=f"NÃ£o foi possÃ­vel enviar o push de teste. {last_error}".strip())
        return {"sent": sent, "failed": failed, "removed": removed}


@app.post("/api/push-subscriptions/dispatch", response_model=PushDispatchOut)
def dispatch_push_notifications(payload: PushDispatchIn) -> dict:
    owner_id = authenticated_owner_id(payload.user_id)
    with get_connection() as connection:
        result = dispatch_priority_pushes(connection, owner_id, payload.kinds or None)
        connection.commit()
        return result


@app.post("/api/users", response_model=UserOut)
def save_user(payload: UserCreate) -> dict:
    context = auth_context_or_unauthorized()
    if not supabase_auth_required() and not (payload.google_connected or payload.google_contacts_imported_at or payload.google_profile_synced_at):
        raise HTTPException(status_code=422, detail="Conta Google obrigatória para salvar o perfil.")
    data = payload.model_dump()
    if context:
        data["email"] = context["email"]
        if not data.get("name"):
            data["name"] = context["email"].split("@", 1)[0]
        if context.get("provider") == "google":
            data["google_connected"] = True
    with get_connection() as connection:
        try:
            row = upsert_user(connection, data)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        connection.commit()
        return row_to_user(row)


@app.post("/api/auth/session", response_model=UserOut)
def sync_auth_session(payload: AuthSessionIn) -> dict:
    context = auth_context_or_unauthorized()
    data = payload.model_dump()
    if context:
        if normalize(data["email"]) != normalize(context["email"]):
            raise HTTPException(status_code=401, detail="Token Supabase nÃ£o corresponde ao email informado.")
        data["sub"] = context["sub"]
        data["email"] = context["email"]
        data["auth_provider"] = context.get("provider") or data.get("auth_provider") or ""
        if not data.get("name"):
            data["name"] = context["email"].split("@", 1)[0]
    with get_connection() as connection:
        row = upsert_auth_user(connection, data)
        connection.commit()
        return row_to_user(row)


@app.post("/api/login", response_model=UserOut)
def login(payload: LoginIn) -> dict:
    if not legacy_password_login_enabled():
        raise HTTPException(status_code=403, detail="Login por senha legado desabilitado. Use Google ou magic link via Supabase.")
    with get_connection() as connection:
        row = authenticate_user(connection, payload.email, payload.password)
        if row is None:
            raise HTTPException(status_code=401, detail="Email ou senha inválidos.")
        return row_to_user(row)


@app.post("/api/google-login", response_model=UserOut)
def google_login(payload: GoogleLoginIn) -> dict:
    context = auth_context_or_unauthorized()
    data = payload.model_dump()
    if context:
        if normalize(data["email"]) != normalize(context["email"]):
            raise HTTPException(status_code=401, detail="Token Supabase não corresponde ao email informado.")
        data["sub"] = context["sub"]
        data["email"] = context["email"]
        if not data.get("name"):
            data["name"] = context["email"].split("@", 1)[0]
    with get_connection() as connection:
        row = upsert_google_user(connection, data)
        connection.commit()
        return row_to_user(row)


@app.get("/api/users", response_model=list[UserOut])
def users() -> list[dict]:
    auth_context_or_unauthorized()
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM users ORDER BY datetime(created_at) DESC, id DESC").fetchall()
        return [row_to_user(row) for row in rows]


@app.get("/api/users/lookup", response_model=UserOut | None)
def lookup_user(phone: str = Query(default="")) -> dict | None:
    auth_context_or_unauthorized()
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
            "SELECT * FROM users WHERE public_visible = true ORDER BY datetime(created_at) DESC, id DESC"
        ).fetchall()

    results: list[tuple[int, dict]] = []
    for row in rows:
        profile = row_to_public_profile(row)
        if not normalized_query:
            results.append((0, profile))
            continue
        score = public_profile_search_score(profile, query)
        if score > 0:
            results.append((score, profile))
    for row in user_rows:
        profile = row_to_public_user_profile(row)
        if not normalized_query:
            results.append((0, profile))
            continue
        score = public_profile_search_score(profile, query)
        if score > 0:
            results.append((score, profile))

    return [profile for _, profile in sorted(results, key=lambda item: (item[0], item[1].get("score", 0), item[1].get("people", 0), item[1]["id"]), reverse=True)]


@app.get("/api/search", response_model=SearchOut)
def search(query: str = Query(default=""), user_id: str = Query(default="demo-user")) -> dict:
    private_results = contacts(query=query, category="all", user_id=authenticated_owner_id(user_id))
    public_results = public_profiles(query=query)
    return {
        "query": query,
        "private_results": private_results,
        "public_results": public_results,
        "has_private_results": len(private_results) > 0,
        "insights": build_search_insights(query, private_results, public_results),
    }


def graph_text_items(value: str | list | None, limit: int = 8) -> list[str]:
    if isinstance(value, list):
        raw_items = value
    else:
        raw_items = re.split(r"[,;|\n]+", str(value or ""))
    items: list[str] = []
    seen: set[str] = set()
    for raw_item in raw_items:
        item = str(raw_item or "").strip()
        key = normalize(item)
        if not item or not key or key in seen:
            continue
        seen.add(key)
        items.append(item[:80])
        if len(items) >= limit:
            break
    return items


def graph_token_items(value: str | None, limit: int = 6) -> list[str]:
    blocked = {"precisa", "busca", "para", "com", "uma", "uns", "das", "dos", "que", "atual", "atualmente"}
    tokens = [token for token in re.split(r"[^a-z0-9]+", normalize(value or "")) if len(token) >= 4 and token not in blocked]
    ordered: list[str] = []
    seen: set[str] = set()
    for token in tokens:
        if token in seen:
            continue
        seen.add(token)
        ordered.append(token)
        if len(ordered) >= limit:
            break
    return ordered


def add_graph_node(nodes: dict[str, dict], node_id: str, label: str, node_type: str, scope: str, weight: float = 1, meta: dict | None = None) -> None:
    if node_id in nodes:
        nodes[node_id]["weight"] = max(float(nodes[node_id].get("weight") or 1), float(weight or 1))
        nodes[node_id]["meta"] = {**nodes[node_id].get("meta", {}), **(meta or {})}
        return
    nodes[node_id] = {
        "id": node_id,
        "label": label,
        "type": node_type,
        "scope": scope,
        "weight": weight,
        "meta": meta or {},
    }


def add_graph_edge(edges: dict[str, dict], source: str, target: str, edge_type: str, weight: float = 1, meta: dict | None = None) -> None:
    edge_id = f"{edge_type}:{source}:{target}"
    if edge_id in edges:
        edges[edge_id]["weight"] = max(float(edges[edge_id].get("weight") or 1), float(weight or 1))
        return
    edges[edge_id] = {
        "id": edge_id,
        "source": source,
        "target": target,
        "type": edge_type,
        "weight": weight,
        "meta": meta or {},
    }


def add_contact_to_graph(nodes: dict[str, dict], edges: dict[str, dict], contact: dict, scope: str, hub_id: str = "user:me") -> None:
    contact_id = f"contact:{contact['id']}"
    add_graph_node(
        nodes,
        contact_id,
        contact["name"],
        "contact",
        scope,
        2.5 + len(contact.get("potential_matches") or []),
        {
            "contact_id": contact["id"],
            "ddd": contact.get("ddd") or "",
            "source": contact.get("source") or "",
            "platform_match": bool(contact.get("platform_match")),
            "public_profile_match": bool(contact.get("public_profile_match")),
        },
    )
    add_graph_edge(edges, hub_id, contact_id, "owns_contact" if scope == "private" else "contains_contact", 1)
    for tag in graph_text_items(contact.get("tag_items") or contact.get("tags")):
        node_id = f"tag:{normalize(tag)}"
        add_graph_node(nodes, node_id, tag, "tag", scope, 1.8)
        add_graph_edge(edges, contact_id, node_id, "has_tag", 1.4)
    if contact.get("source"):
        node_id = f"source:{normalize(contact['source'])}"
        add_graph_node(nodes, node_id, contact["source"], "source", scope, 1.2)
        add_graph_edge(edges, contact_id, node_id, "imported_from", 1)
    if contact.get("ddd"):
        node_id = f"ddd:{contact['ddd']}"
        add_graph_node(nodes, node_id, f"DDD {contact['ddd']}", "ddd", scope, 1.3)
        add_graph_edge(edges, contact_id, node_id, "has_ddd", 1)
    if contact.get("organization"):
        node_id = f"org:{normalize(contact['organization'])}"
        add_graph_node(nodes, node_id, contact["organization"], "organization", scope, 1.4)
        add_graph_edge(edges, contact_id, node_id, "linked_to_organization", 1.2)
    for token in graph_token_items(" ".join([contact.get("demand") or "", contact.get("demand_tags") or ""])):
        node_id = f"demand:{token}"
        add_graph_node(nodes, node_id, token, "demand", scope, 1.2)
        add_graph_edge(edges, contact_id, node_id, "demands", 1.2)
    for token in graph_token_items(" ".join([contact.get("solves") or "", contact.get("service") or ""])):
        node_id = f"solve:{token}"
        add_graph_node(nodes, node_id, token, "solution", scope, 1.2)
        add_graph_edge(edges, contact_id, node_id, "solves", 1.2)
    if contact.get("platform_match"):
        match = contact["platform_match"]
        node_id = f"user:{match['user_id']}"
        add_graph_node(nodes, node_id, match.get("name") or "UsuÃ¡rio da plataforma", "platform_user", "public", 2, match)
        add_graph_edge(edges, contact_id, node_id, "linked_to_platform_user", 2, {"confidence": match.get("confidence")})
    if contact.get("public_profile_match"):
        match = contact["public_profile_match"]
        node_id = f"public_profile:{match['profile_id']}"
        add_graph_node(nodes, node_id, match.get("name") or "Perfil pÃºblico", "public_profile", "public", 1.8, match)
        add_graph_edge(edges, contact_id, node_id, "matches_public_profile", 1.8, {"confidence": match.get("confidence")})
    for match in contact.get("potential_matches") or []:
        target_id = f"contact:{match.get('contact_id')}" if match.get("contact_id") else f"match:{normalize(match.get('name') or '')}"
        if target_id not in nodes:
            add_graph_node(nodes, target_id, match.get("name") or "Match potencial", match.get("kind") or "potential_match", scope, 1.5, match)
        add_graph_edge(edges, contact_id, target_id, "potential_match", max(1, float(match.get("score") or 1) / 30), {"reason": match.get("reason"), "overlap": match.get("overlap")})


@app.get("/api/graph", response_model=GraphOut)
def graph(
    scope: str = Query(default="private"),
    user_id: str = Query(default="demo-user"),
    group_id: int | None = Query(default=None),
) -> dict:
    normalized_scope = normalize(scope or "private") or "private"
    owner_id = "" if normalized_scope == "public" else authenticated_owner_id(user_id)
    nodes: dict[str, dict] = {}
    edges: dict[str, dict] = {}
    filters = {
        "node_types": ["contact", "tag", "source", "ddd", "demand", "solution", "organization", "platform_user", "public_profile", "group"],
        "edge_types": ["owns_contact", "contains_contact", "has_tag", "imported_from", "has_ddd", "demands", "solves", "linked_to_platform_user", "matches_public_profile", "potential_match", "belongs_to_group"],
    }

    with get_connection() as connection:
        sync_owner_contact_platform_links(connection, owner_id)
        if normalized_scope == "group":
            if group_id is None or not can_access_group(connection, int(group_id), owner_id):
                raise HTTPException(status_code=403, detail="VocÃª nÃ£o pode acessar este grupo.")
            group = find_group_by_id(connection, int(group_id))
            if group is None:
                raise HTTPException(status_code=404, detail="Grupo nÃ£o encontrado.")
            hub_id = f"group:{group_id}"
            add_graph_node(nodes, hub_id, group["name"], "group", "group", 3, {"area": group["area"], "description": group["description"]})
            contact_rows = list_group_contacts(connection, int(group_id), owner_id)
            for contact in contact_rows:
                add_contact_to_graph(nodes, edges, contact, "group", hub_id)
                add_graph_edge(edges, f"contact:{contact['id']}", hub_id, "belongs_to_group", 1.6)
        elif normalized_scope == "public":
            hub_id = "public:network"
            add_graph_node(nodes, hub_id, "Rede pÃºblica", "public_network", "public", 3)
            for profile in public_profiles():
                node_id = f"public_profile:{profile['id']}"
                add_graph_node(nodes, node_id, profile["name"], profile.get("kind") or "public_profile", "public", 1 + float(profile.get("score") or 0), profile)
                add_graph_edge(edges, hub_id, node_id, "publicly_visible", 1)
                for tag in graph_text_items(profile.get("tags") or profile.get("service")):
                    tag_id = f"tag:{normalize(tag)}"
                    add_graph_node(nodes, tag_id, tag, "tag", "public", 1.4)
                    add_graph_edge(edges, node_id, tag_id, "has_tag", 1)
        else:
            hub_id = "user:me"
            add_graph_node(nodes, hub_id, "Minha rede", "private_network", "private", 3)
            rows = connection.execute(
                "SELECT * FROM contacts WHERE owner_id = ? ORDER BY datetime(created_at) DESC, id DESC",
                (owner_id,),
            ).fetchall()
            for row in rows:
                add_contact_to_graph(nodes, edges, row_to_contact(row, connection), "private", hub_id)
            for group in list_groups_for_user(connection, owner_id):
                group_node_id = f"group:{group['id']}"
                add_graph_node(nodes, group_node_id, group["name"], "group", "group", 2, {"area": group.get("area"), "member_count": group.get("member_count")})
                for contact in list_group_contacts(connection, int(group["id"]), owner_id):
                    contact_node_id = f"contact:{contact['id']}"
                    if contact_node_id in nodes:
                        add_graph_edge(edges, contact_node_id, group_node_id, "belongs_to_group", 1.5)

    return {
        "scope": normalized_scope,
        "nodes": list(nodes.values()),
        "edges": list(edges.values()),
        "filters": filters,
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
                "crm_note": f"Follow-up concluído em {format_follow_up(datetime.now().date().isoformat())}.",
                "reason": f"Vou marcar o follow-up de {row['name']} como concluído e limpar a próxima data.",
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


def load_ai_chat_rows(connection, owner_id: str, group_id: int | None = None) -> list:
    if group_id is None:
        return connection.execute(
            "SELECT * FROM contacts WHERE owner_id = ? ORDER BY datetime(created_at) DESC, id DESC",
            (owner_id,),
        ).fetchall()
    if not can_access_group(connection, int(group_id), owner_id):
        raise HTTPException(status_code=403, detail="VocÃª nÃ£o pode acessar este grupo.")
    return connection.execute(
        """
        SELECT contacts.*
        FROM group_contacts
        JOIN contacts ON contacts.id = group_contacts.contact_id
        WHERE group_contacts.group_id = ?
        ORDER BY datetime(group_contacts.created_at) DESC, contacts.id DESC
        """,
        (int(group_id),),
    ).fetchall()


@app.post("/api/ai/chat", response_model=AiChatOut)
def ai_chat(payload: AiChatIn) -> dict:
    owner_id = authenticated_owner_id(payload.user_id)
    with get_connection() as connection:
        thread_id = payload.thread_id
        if payload.group_id is None:
            if thread_id is None:
                thread = create_chat_thread(connection, owner_id, {"title": ai_thread_title_from_message(payload.message)})
                thread_id = int(thread["id"])
            else:
                assert_thread_access(connection, thread_id, owner_id)
        rows = load_ai_chat_rows(connection, owner_id, payload.group_id)

    if payload.group_id is not None and not rows:
        return {
            "answer": "Esse grupo ainda nÃ£o tem contatos compartilhados para eu analisar.",
            "suggestions": [],
            "provider": "local",
            "thread_id": None,
        }

    action_suggestions = build_action_suggestions(payload.message, rows, payload.target_contact_id)
    organization_suggestions = [] if looks_like_action_request(payload.message) else build_contact_suggestions(rows)
    suggestions = action_suggestions or organization_suggestions
    provider = "local"
    if action_suggestions:
        names = ", ".join(item["name"] for item in action_suggestions[:4])
        answer = f"Entendi. Preparei {len(action_suggestions)} ação(ões) para confirmar: {names}. Dá uma olhada na lateral e clique em Revisar se estiver certo."
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
                answer = f"Perfeito. Localizei a data: {format_follow_up(item['next_follow_up_at'])}. Preparei o follow-up de {item['name']} na lateral; clique em Revisar para salvar."
            else:
                answer = f"Certo. Estou com {item['name']} e preparei: {action_label}. Confere a sugestão na lateral e clique em Revisar para eu salvar."
        else:
            names = ", ".join(item["name"] for item in action_suggestions[:4])
            answer = f"Certo. Encontrei estes contatos no seu pedido: {names}. Confere as sugestões na lateral e confirme apenas as corretas."

    if answer and not action_suggestions and os.getenv("OPENAI_API_KEY", "").strip():
        provider = "openai"
    else:
        provider = "local"
        if not action_suggestions and not locals().get("clarification"):
            answer = local_chat_answer(payload.message, rows, suggestions)

    if payload.group_id is None and thread_id is not None:
        with get_connection() as connection:
            assert_thread_access(connection, int(thread_id), owner_id)
            create_chat_message(
                connection,
                int(thread_id),
                owner_id,
                {
                    "role": "user",
                    "text": payload.message,
                },
            )
            create_chat_message(
                connection,
                int(thread_id),
                owner_id,
                {
                    "role": "assistant",
                    "text": answer,
                    "provider": provider,
                    "suggestions": suggestions,
                },
            )
            connection.commit()

    return {
        "answer": answer,
        "suggestions": suggestions,
        "provider": provider,
        "thread_id": int(thread_id) if payload.group_id is None and thread_id is not None else None,
    }
