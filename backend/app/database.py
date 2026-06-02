from __future__ import annotations

import sqlite3
import json
import hashlib
import secrets
from pathlib import Path

from .categories import CATEGORY_CATALOG, category_to_dict, classify_service, normalize

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "network_agenda.sqlite3"


CONTACTS_SEED = (
    {
        "name": "Joao Martins",
        "phone": "11 99418-2300",
        "service": "eletricista residencial",
        "note": "Atende emergencia e instalacao de chuveiro",
        "city": "Sao Paulo",
        "address": "Avenida Paulista, Sao Paulo, SP",
        "trust": "Recomendado",
        "source": "Google Contacts",
    },
    {
        "name": "Mariana Costa",
        "phone": "11 98842-1204",
        "service": "advogada trabalhista",
        "note": "Contratos, rescisao e pequenas empresas",
        "city": "Santo Andre",
        "address": "Centro, Santo Andre, SP",
        "trust": "Favorito",
        "source": "Manual",
    },
    {
        "name": "Renato Lima",
        "phone": "21 99710-4331",
        "service": "contador para MEI",
        "note": "Abertura de empresa e imposto mensal",
        "city": "Rio de Janeiro",
        "address": "Centro, Rio de Janeiro, RJ",
        "trust": "Confiavel",
        "source": "Importado",
    },
    {
        "name": "Aline Prado",
        "phone": "11 97340-8932",
        "service": "designer de site",
        "note": "Landing pages e identidade simples",
        "city": "Sao Paulo",
        "address": "Pinheiros, Sao Paulo, SP",
        "trust": "Novo",
        "source": "Indicacao",
    },
    {
        "name": "Carlos Nogueira",
        "phone": "11 94420-6651",
        "service": "pintor e pequenas reformas",
        "note": "Apartamento, escritorio e acabamento",
        "city": "Osasco",
        "address": "Centro, Osasco, SP",
        "trust": "Recomendado",
        "source": "iCloud",
    },
)

PUBLIC_PROFILES_SEED = (
    {
        "name": "Grupo de eletricistas verificados",
        "service": "eletricista, manutenção residencial, instalação",
        "area": "Sao Paulo e ABC",
        "people": 42,
        "response": "18 min",
        "score": 4.8,
    },
    {
        "name": "Rede jurídica para pequenos negócios",
        "service": "jurídico, contratos, trabalhista, societário",
        "area": "Online e presencial",
        "people": 28,
        "response": "1 h",
        "score": 4.7,
    },
    {
        "name": "Profissionais de casa e reforma",
        "service": "pintura, reforma, encanador, marceneiro",
        "area": "Grande Sao Paulo",
        "people": 67,
        "response": "25 min",
        "score": 4.6,
    },
    {
        "name": "Tecnologia para negócios locais",
        "service": "site, suporte, software, automação, design",
        "area": "Brasil",
        "people": 35,
        "response": "45 min",
        "score": 4.9,
    },
)


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS contacts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              owner_id TEXT NOT NULL DEFAULT 'demo-user',
              name TEXT NOT NULL,
              phone TEXT NOT NULL,
              service TEXT NOT NULL,
              note TEXT NOT NULL DEFAULT '',
              city TEXT NOT NULL DEFAULT '',
              address TEXT NOT NULL DEFAULT '',
              trust TEXT NOT NULL DEFAULT 'Novo',
              source TEXT NOT NULL DEFAULT 'Manual',
              category_id TEXT NOT NULL,
              category_label TEXT NOT NULL,
              category_group TEXT NOT NULL,
              search_text TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS public_profiles (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              service TEXT NOT NULL,
              area TEXT NOT NULL,
              people INTEGER NOT NULL,
              response TEXT NOT NULL,
              score REAL NOT NULL,
              category_id TEXT NOT NULL,
              category_label TEXT NOT NULL,
              category_group TEXT NOT NULL,
              search_text TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              birth_date TEXT NOT NULL DEFAULT '',
              email TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL DEFAULT '',
              phone TEXT NOT NULL,
              phone_digits TEXT NOT NULL UNIQUE,
              cep TEXT NOT NULL DEFAULT '',
              address TEXT NOT NULL DEFAULT '',
              city TEXT NOT NULL DEFAULT '',
              state TEXT NOT NULL DEFAULT '',
              address_visible INTEGER NOT NULL DEFAULT 0,
              interests TEXT NOT NULL DEFAULT '[]',
              is_collaborator INTEGER NOT NULL DEFAULT 0,
              offered_services TEXT NOT NULL DEFAULT '',
              service_address TEXT NOT NULL DEFAULT '',
              service_address_visible INTEGER NOT NULL DEFAULT 1,
              role TEXT NOT NULL DEFAULT 'user',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        ensure_contact_columns(connection)
        ensure_user_columns(connection)
        seed_db(connection)
        assign_demo_contacts(connection)


def ensure_contact_columns(connection: sqlite3.Connection) -> None:
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(contacts)").fetchall()}
    if "owner_id" not in columns:
        connection.execute("ALTER TABLE contacts ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'demo-user'")
    if "address" not in columns:
        connection.execute("ALTER TABLE contacts ADD COLUMN address TEXT NOT NULL DEFAULT ''")
        connection.execute("UPDATE contacts SET address = city WHERE address = ''")
    connection.execute("UPDATE contacts SET note = '' WHERE note <> ''")


def ensure_user_columns(connection: sqlite3.Connection) -> None:
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(users)").fetchall()}
    if "password_hash" not in columns:
        connection.execute("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
    default_hash = hash_password("123456")
    connection.execute("UPDATE users SET password_hash = ? WHERE password_hash = ''", (default_hash,))


def seed_db(connection: sqlite3.Connection) -> None:
    contact_count = connection.execute("SELECT COUNT(*) FROM contacts").fetchone()[0]
    if contact_count == 0:
        for contact in CONTACTS_SEED:
            insert_contact(connection, contact)

    profile_count = connection.execute("SELECT COUNT(*) FROM public_profiles").fetchone()[0]
    if profile_count == 0:
        for profile in PUBLIC_PROFILES_SEED:
            category = classify_service(profile["service"])
            search_text = normalize(" ".join([profile["name"], profile["service"], profile["area"], category.label, category.group]))
            connection.execute(
                """
                INSERT INTO public_profiles (name, service, area, people, response, score, category_id, category_label, category_group, search_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    profile["name"],
                    profile["service"],
                    profile["area"],
                    profile["people"],
                    profile["response"],
                    profile["score"],
                    category.id,
                    category.label,
                    category.group,
                    search_text,
                ),
            )

    user_count = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if user_count == 0:
        upsert_user(
            connection,
            {
                "name": "Ana",
                "birth_date": "1995-01-01",
                "email": "ana@network.local",
                "password": "123456",
                "phone": "11 99999-0000",
                "cep": "01311-000",
                "address": "Avenida Paulista, Bela Vista, Sao Paulo - SP",
                "city": "Sao Paulo",
                "state": "SP",
                "address_visible": False,
                "interests": ["home", "tech"],
                "is_collaborator": False,
                "offered_services": "",
                "service_address": "",
                "service_address_visible": True,
                "role": "user",
            },
        )


def assign_demo_contacts(connection: sqlite3.Connection) -> None:
    first_user = connection.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()
    if first_user is not None:
        connection.execute("UPDATE contacts SET owner_id = ? WHERE owner_id = 'demo-user'", (str(first_user["id"]),))
    admin_exists = connection.execute("SELECT COUNT(*) FROM users WHERE email = ?", ("admin@network.local",)).fetchone()[0]
    if admin_exists == 0:
        upsert_user(
            connection,
            {
                "name": "Admin",
                "birth_date": "1990-01-01",
                "email": "admin@network.local",
                "password": "admin123",
                "phone": "11 90000-0000",
                "cep": "01311-000",
                "address": "Avenida Paulista, Bela Vista, São Paulo - SP",
                "city": "São Paulo",
                "state": "SP",
                "address_visible": False,
                "interests": ["home", "business", "tech"],
                "is_collaborator": True,
                "offered_services": "gestão da rede, curadoria, suporte",
                "service_address": "",
                "service_address_visible": True,
                "role": "admin",
            },
        )


def phone_digits(value: str) -> str:
    return "".join(char for char in str(value or "") if char.isdigit())


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return f"sha256${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, digest = stored_hash.split("$", 2)
    except ValueError:
        return False
    if algorithm != "sha256":
        return False
    candidate = hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()
    return secrets.compare_digest(candidate, digest)


def upsert_user(connection: sqlite3.Connection, payload: dict) -> sqlite3.Row:
    digits = phone_digits(payload["phone"])
    interests = json.dumps(payload.get("interests") or [], ensure_ascii=False)
    existing = connection.execute("SELECT * FROM users WHERE email = ?", (payload["email"],)).fetchone()
    password = str(payload.get("password") or "")
    if existing is None and not password:
        raise ValueError("Senha obrigatória.")
    password_hash = hash_password(password) if password else existing["password_hash"]
    values = (
        payload["name"],
        payload.get("birth_date") or "",
        payload["email"],
        password_hash,
        payload["phone"],
        digits,
        payload.get("cep") or "",
        payload.get("address") or "",
        payload.get("city") or "",
        payload.get("state") or "",
        1 if payload.get("address_visible") else 0,
        interests,
        1 if payload.get("is_collaborator") else 0,
        payload.get("offered_services") or "",
        payload.get("service_address") or "",
        1 if payload.get("service_address_visible", True) else 0,
        payload.get("role") or "user",
    )
    connection.execute(
        """
        INSERT INTO users (
          name, birth_date, email, password_hash, phone, phone_digits, cep, address, city, state,
          address_visible, interests, is_collaborator, offered_services,
          service_address, service_address_visible, role
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          name = excluded.name,
          birth_date = excluded.birth_date,
          password_hash = excluded.password_hash,
          phone = excluded.phone,
          phone_digits = excluded.phone_digits,
          cep = excluded.cep,
          address = excluded.address,
          city = excluded.city,
          state = excluded.state,
          address_visible = excluded.address_visible,
          interests = excluded.interests,
          is_collaborator = excluded.is_collaborator,
          offered_services = excluded.offered_services,
          service_address = excluded.service_address,
          service_address_visible = excluded.service_address_visible,
          role = excluded.role
        """,
        values,
    )
    return connection.execute("SELECT * FROM users WHERE email = ?", (payload["email"],)).fetchone()


def upsert_google_user(connection: sqlite3.Connection, payload: dict) -> sqlite3.Row:
    existing = connection.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (payload["email"],)).fetchone()
    if existing is not None:
        return existing

    password_hash = hash_password(secrets.token_urlsafe(24))
    phone_digits_value = f"google:{payload['sub']}"
    connection.execute(
        """
        INSERT INTO users (
          name, birth_date, email, password_hash, phone, phone_digits, cep, address,
          city, state, address_visible, interests, is_collaborator, offered_services,
          service_address, service_address_visible, role
        )
        VALUES (?, '', ?, ?, '', ?, '', '', '', '', 0, '[]', 0, '', '', 1, 'user')
        """,
        (payload["name"], payload["email"], password_hash, phone_digits_value),
    )
    return connection.execute("SELECT * FROM users WHERE email = ?", (payload["email"],)).fetchone()


def find_user_by_phone(connection: sqlite3.Connection, phone: str) -> sqlite3.Row | None:
    digits = phone_digits(phone)
    if not digits:
        return None
    return connection.execute("SELECT * FROM users WHERE phone_digits = ?", (digits,)).fetchone()


def authenticate_user(connection: sqlite3.Connection, email: str, password: str) -> sqlite3.Row | None:
    row = connection.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (email,)).fetchone()
    if row is None or not verify_password(password, row["password_hash"]):
        return None
    return row


def row_to_user(row: sqlite3.Row) -> dict:
    try:
        interests = json.loads(row["interests"] or "[]")
    except json.JSONDecodeError:
        interests = []
    return {
        "id": row["id"],
        "name": row["name"],
        "birth_date": row["birth_date"],
        "email": row["email"],
        "password": "",
        "phone": row["phone"],
        "cep": row["cep"],
        "address": row["address"],
        "city": row["city"],
        "state": row["state"],
        "address_visible": bool(row["address_visible"]),
        "interests": interests,
        "is_collaborator": bool(row["is_collaborator"]),
        "offered_services": row["offered_services"],
        "service_address": row["service_address"],
        "service_address_visible": bool(row["service_address_visible"]),
        "role": row["role"],
    }


def insert_contact(connection: sqlite3.Connection, payload: dict) -> sqlite3.Row:
    owner_id = str(payload.get("owner_id") or "demo-user")
    category = classify_service(payload["service"])
    note = ""
    city = payload.get("city") or "Minha regiao"
    address = payload.get("address") or city
    trust = payload.get("trust") or "Novo"
    source = payload.get("source") or "Manual"
    search_text = normalize(" ".join([payload["name"], payload["phone"], payload["service"], note, city, address, trust, source, category.label, category.group]))

    cursor = connection.execute(
        """
        INSERT INTO contacts (owner_id, name, phone, service, note, city, address, trust, source, category_id, category_label, category_group, search_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            owner_id,
            payload["name"],
            payload["phone"],
            payload["service"],
            note,
            city,
            address,
            trust,
            source,
            category.id,
            category.label,
            category.group,
            search_text,
        ),
    )
    return connection.execute("SELECT * FROM contacts WHERE id = ?", (cursor.lastrowid,)).fetchone()


def update_contact(connection: sqlite3.Connection, contact_id: int, payload: dict) -> sqlite3.Row | None:
    owner_id = str(payload.get("owner_id") or "demo-user")
    category = classify_service(payload["service"])
    note = ""
    city = payload.get("city") or "Minha regiao"
    address = payload.get("address") or city
    trust = payload.get("trust") or "Novo"
    source = payload.get("source") or "Manual"
    search_text = normalize(" ".join([payload["name"], payload["phone"], payload["service"], note, city, address, trust, source, category.label, category.group]))

    cursor = connection.execute(
        """
        UPDATE contacts
        SET name = ?,
            phone = ?,
            service = ?,
            note = ?,
            city = ?,
            address = ?,
            trust = ?,
            source = ?,
            category_id = ?,
            category_label = ?,
            category_group = ?,
            search_text = ?
        WHERE id = ? AND owner_id = ?
        """,
        (
            payload["name"],
            payload["phone"],
            payload["service"],
            note,
            city,
            address,
            trust,
            source,
            category.id,
            category.label,
            category.group,
            search_text,
            contact_id,
            owner_id,
        ),
    )
    if cursor.rowcount == 0:
        return None
    return connection.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,)).fetchone()


def row_to_contact(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "name": row["name"],
        "phone": row["phone"],
        "service": row["service"],
        "note": row["note"],
        "city": row["city"],
        "address": row["address"],
        "trust": row["trust"],
        "source": row["source"],
        "created_at": row["created_at"],
        "category": {
            "id": row["category_id"],
            "label": row["category_label"],
            "group": row["category_group"],
            "keywords": [],
            "synonyms": [],
            "count": 0,
        },
    }


def row_to_public_profile(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "service": row["service"],
        "area": row["area"],
        "people": row["people"],
        "response": row["response"],
        "score": row["score"],
        "category": {
            "id": row["category_id"],
            "label": row["category_label"],
            "group": row["category_group"],
            "keywords": [],
            "synonyms": [],
            "count": 0,
        },
    }


def category_counts(connection: sqlite3.Connection) -> dict[str, int]:
    rows = connection.execute("SELECT category_id, COUNT(*) as total FROM contacts GROUP BY category_id").fetchall()
    return {row["category_id"]: row["total"] for row in rows}


def list_categories(connection: sqlite3.Connection) -> list[dict]:
    counts = category_counts(connection)
    return [category_to_dict(category, counts.get(category.id, 0)) for category in CATEGORY_CATALOG]
