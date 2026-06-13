from __future__ import annotations

import json
import hashlib
import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from collections.abc import Iterator
from pathlib import Path
from typing import Any

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None

from .categories import CATEGORY_CATALOG, category_to_dict, classify_service, infer_service_from_contact, normalize

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


class DbConnection:
    def __init__(self, connection: Any, dialect: str):
        self.connection = connection
        self.dialect = dialect

    def execute(self, sql: str, params: tuple | list = ()):
        if self.dialect == "postgres":
            return self.connection.execute(to_postgres_sql(sql), params)
        return self.connection.execute(sql, params)

    def executescript(self, sql: str) -> None:
        if self.dialect == "postgres":
            for statement in split_sql_script(sql):
                self.execute(statement)
            return
        self.connection.executescript(sql)

    def commit(self) -> None:
        self.connection.commit()

    def rollback(self) -> None:
        self.connection.rollback()

    def close(self) -> None:
        self.connection.close()


def use_postgres() -> bool:
    database_url = os.getenv("DATABASE_URL", "").strip()
    return database_url.startswith(("postgres://", "postgresql://"))


def to_postgres_sql(sql: str) -> str:
    return sql.replace("datetime(created_at)", "created_at").replace("?", "%s")


def split_sql_script(sql: str) -> list[str]:
    return [statement.strip() for statement in sql.split(";") if statement.strip()]


def first_value(row) -> Any:
    if row is None:
        return None
    if isinstance(row, dict):
        return next(iter(row.values()))
    return row[0]


def row_text(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


@contextmanager
def get_connection() -> Iterator[DbConnection]:
    if use_postgres():
        if psycopg is None:
            raise RuntimeError("DATABASE_URL usa Postgres, mas psycopg nao esta instalado. Rode pip install -r requirements.txt.")
        raw_connection = psycopg.connect(os.getenv("DATABASE_URL", "").strip(), row_factory=dict_row)
        connection = DbConnection(raw_connection, "postgres")
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        raw_connection = sqlite3.connect(DB_PATH)
        raw_connection.row_factory = sqlite3.Row
        connection = DbConnection(raw_connection, "sqlite")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    with get_connection() as connection:
        if connection.dialect == "postgres":
            init_postgres_db(connection)
        else:
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
              description TEXT NOT NULL DEFAULT '',
              demand TEXT NOT NULL DEFAULT '',
              solves TEXT NOT NULL DEFAULT '',
              tags TEXT NOT NULL DEFAULT '',
              email TEXT NOT NULL DEFAULT '',
              whatsapp TEXT NOT NULL DEFAULT '',
              instagram TEXT NOT NULL DEFAULT '',
              linkedin TEXT NOT NULL DEFAULT '',
              custom_url TEXT NOT NULL DEFAULT '',
              custom_fields TEXT NOT NULL DEFAULT '[]',
              crm_status TEXT NOT NULL DEFAULT 'Novo',
              crm_priority TEXT NOT NULL DEFAULT 'Média',
              last_contact_at TEXT NOT NULL DEFAULT '',
              next_follow_up_at TEXT NOT NULL DEFAULT '',
              crm_note TEXT NOT NULL DEFAULT '',
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
              address_line TEXT NOT NULL DEFAULT '',
              address_number TEXT NOT NULL DEFAULT '',
              address_complement TEXT NOT NULL DEFAULT '',
              neighborhood TEXT NOT NULL DEFAULT '',
              city TEXT NOT NULL DEFAULT '',
              state TEXT NOT NULL DEFAULT '',
              address_visible INTEGER NOT NULL DEFAULT 0,
              interests TEXT NOT NULL DEFAULT '[]',
              is_collaborator INTEGER NOT NULL DEFAULT 0,
              offered_services TEXT NOT NULL DEFAULT '',
              use_different_service_address INTEGER NOT NULL DEFAULT 0,
              service_cep TEXT NOT NULL DEFAULT '',
              service_address TEXT NOT NULL DEFAULT '',
              service_address_line TEXT NOT NULL DEFAULT '',
              service_address_number TEXT NOT NULL DEFAULT '',
              service_address_complement TEXT NOT NULL DEFAULT '',
              service_neighborhood TEXT NOT NULL DEFAULT '',
              service_city TEXT NOT NULL DEFAULT '',
              service_state TEXT NOT NULL DEFAULT '',
              service_address_visible INTEGER NOT NULL DEFAULT 1,
              public_visible INTEGER NOT NULL DEFAULT 0,
              public_description TEXT NOT NULL DEFAULT '',
              public_demand TEXT NOT NULL DEFAULT '',
              public_solves TEXT NOT NULL DEFAULT '',
              public_tags TEXT NOT NULL DEFAULT '',
              public_whatsapp TEXT NOT NULL DEFAULT '',
              public_instagram TEXT NOT NULL DEFAULT '',
              public_linkedin TEXT NOT NULL DEFAULT '',
              public_url TEXT NOT NULL DEFAULT '',
              google_connected INTEGER NOT NULL DEFAULT 0,
              google_contacts_imported_at TEXT NOT NULL DEFAULT '',
              google_profile_synced_at TEXT NOT NULL DEFAULT '',
              role TEXT NOT NULL DEFAULT 'user',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS merge_suggestions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              owner_id TEXT NOT NULL,
              primary_contact_id INTEGER NOT NULL,
              duplicate_contact_id INTEGER NOT NULL,
              match_type TEXT NOT NULL,
              match_value TEXT NOT NULL,
              status TEXT NOT NULL DEFAULT 'pending',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(owner_id, primary_contact_id, duplicate_contact_id, match_type, match_value)
            );
            """
            )
            ensure_contact_columns(connection)
            ensure_user_columns(connection)
        seed_db(connection)
        assign_demo_contacts(connection)
        reclassify_contacts(connection)


def init_postgres_db(connection: DbConnection) -> None:
    schema_path = Path(__file__).resolve().parent / "postgres_schema.sql"
    connection.executescript(schema_path.read_text(encoding="utf-8"))


def ensure_contact_columns(connection: DbConnection) -> None:
    if connection.dialect == "postgres":
        return
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(contacts)").fetchall()}
    if "owner_id" not in columns:
        connection.execute("ALTER TABLE contacts ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'demo-user'")
    if "address" not in columns:
        connection.execute("ALTER TABLE contacts ADD COLUMN address TEXT NOT NULL DEFAULT ''")
        connection.execute("UPDATE contacts SET address = city WHERE address = ''")
    if "crm_status" not in columns:
        connection.execute("ALTER TABLE contacts ADD COLUMN crm_status TEXT NOT NULL DEFAULT 'Novo'")
    if "crm_priority" not in columns:
        connection.execute("ALTER TABLE contacts ADD COLUMN crm_priority TEXT NOT NULL DEFAULT 'Média'")
    if "last_contact_at" not in columns:
        connection.execute("ALTER TABLE contacts ADD COLUMN last_contact_at TEXT NOT NULL DEFAULT ''")
    if "next_follow_up_at" not in columns:
        connection.execute("ALTER TABLE contacts ADD COLUMN next_follow_up_at TEXT NOT NULL DEFAULT ''")
    if "crm_note" not in columns:
        connection.execute("ALTER TABLE contacts ADD COLUMN crm_note TEXT NOT NULL DEFAULT ''")
    for column, default in (
        ("description", ""),
        ("demand", ""),
        ("solves", ""),
        ("tags", ""),
        ("email", ""),
        ("whatsapp", ""),
        ("instagram", ""),
        ("linkedin", ""),
        ("custom_url", ""),
        ("custom_fields", "[]"),
    ):
        if column not in columns:
            connection.execute(f"ALTER TABLE contacts ADD COLUMN {column} TEXT NOT NULL DEFAULT '{default}'")
    connection.execute("UPDATE contacts SET crm_priority = 'Média' WHERE crm_priority = 'MÃ©dia'")


def ensure_user_columns(connection: DbConnection) -> None:
    if connection.dialect == "postgres":
        return
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(users)").fetchall()}
    if "password_hash" not in columns:
        connection.execute("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
    for column in (
        "address_line",
        "address_number",
        "address_complement",
        "neighborhood",
        "service_cep",
        "service_address_line",
        "service_address_number",
        "service_address_complement",
        "service_neighborhood",
        "service_city",
        "service_state",
    ):
        if column not in columns:
            connection.execute(f"ALTER TABLE users ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")
    if "use_different_service_address" not in columns:
        connection.execute("ALTER TABLE users ADD COLUMN use_different_service_address INTEGER NOT NULL DEFAULT 0")
    for column, column_type, default in (
        ("public_visible", "INTEGER", "0"),
        ("public_description", "TEXT", ""),
        ("public_demand", "TEXT", ""),
        ("public_solves", "TEXT", ""),
        ("public_tags", "TEXT", ""),
        ("public_whatsapp", "TEXT", ""),
        ("public_instagram", "TEXT", ""),
        ("public_linkedin", "TEXT", ""),
        ("public_url", "TEXT", ""),
        ("google_connected", "INTEGER", "0"),
        ("google_contacts_imported_at", "TEXT", ""),
        ("google_profile_synced_at", "TEXT", ""),
    ):
        if column not in columns:
            if column_type == "INTEGER":
                connection.execute(f"ALTER TABLE users ADD COLUMN {column} INTEGER NOT NULL DEFAULT {default}")
            else:
                connection.execute(f"ALTER TABLE users ADD COLUMN {column} TEXT NOT NULL DEFAULT '{default}'")
    default_hash = hash_password("123456")
    connection.execute("UPDATE users SET password_hash = ? WHERE password_hash = ''", (default_hash,))


def seed_db(connection: DbConnection) -> None:
    contact_count = first_value(connection.execute("SELECT COUNT(*) FROM contacts").fetchone())
    if contact_count == 0:
        for contact in CONTACTS_SEED:
            insert_contact(connection, contact)

    profile_count = first_value(connection.execute("SELECT COUNT(*) FROM public_profiles").fetchone())
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

    user_count = first_value(connection.execute("SELECT COUNT(*) FROM users").fetchone())
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
                "address_line": "Avenida Paulista",
                "address_number": "",
                "address_complement": "",
                "neighborhood": "Bela Vista",
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


def reclassify_contacts(connection: DbConnection) -> None:
    rows = connection.execute("SELECT * FROM contacts").fetchall()
    generated_services = {normalize(category.label) for category in CATEGORY_CATALOG}
    generated_services.add(normalize("contato para revisar"))
    generated_services.add(normalize("servicos gerais"))
    for row in rows:
        should_reinfer = row["source"] == "Google People API" and normalize(row["service"]) in generated_services
        if should_reinfer:
            service = infer_service_from_contact(row["name"], "", row["note"], "")
        else:
            service = infer_service_from_contact(row["name"], row["service"], row["note"], row["source"])
        category = classify_service(" ".join([service, row["name"], row["note"], row["source"]]))
        search_text = normalize(
            " ".join(
                [
                    row["name"],
                    row["phone"],
                    service,
                    row["note"],
                    row["city"],
                    row["address"],
                    row["trust"],
                    row["source"],
                    category.label,
                    category.group,
                ]
            )
        )
        connection.execute(
            """
            UPDATE contacts
            SET service = ?,
                category_id = ?,
                category_label = ?,
                category_group = ?,
                search_text = ?
            WHERE id = ?
            """,
            (service, category.id, category.label, category.group, search_text, row["id"]),
        )


def assign_demo_contacts(connection: DbConnection) -> None:
    first_user = connection.execute("SELECT id FROM users ORDER BY id LIMIT 1").fetchone()
    if first_user is not None:
        connection.execute("UPDATE contacts SET owner_id = ? WHERE owner_id = 'demo-user'", (str(first_user["id"]),))
    admin_exists = first_value(connection.execute("SELECT COUNT(*) FROM users WHERE email = ?", ("admin@network.local",)).fetchone())
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
                "address_line": "Avenida Paulista",
                "address_number": "",
                "address_complement": "",
                "neighborhood": "Bela Vista",
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


def extract_contact_emails(row) -> set[str]:
    text = " ".join([str(row["note"] or ""), str(row["search_text"] or "")])
    return {match.lower() for match in re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)}


def merge_key(primary_id: int, duplicate_id: int) -> tuple[int, int]:
    return (primary_id, duplicate_id) if primary_id < duplicate_id else (duplicate_id, primary_id)


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


def upsert_user(connection: DbConnection, payload: dict):
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
        payload.get("address_line") or "",
        payload.get("address_number") or "",
        payload.get("address_complement") or "",
        payload.get("neighborhood") or "",
        payload.get("city") or "",
        payload.get("state") or "",
        1 if payload.get("address_visible") else 0,
        interests,
        1 if payload.get("is_collaborator") else 0,
        payload.get("offered_services") or "",
        1 if payload.get("use_different_service_address") else 0,
        payload.get("service_cep") or "",
        payload.get("service_address") or "",
        payload.get("service_address_line") or "",
        payload.get("service_address_number") or "",
        payload.get("service_address_complement") or "",
        payload.get("service_neighborhood") or "",
        payload.get("service_city") or "",
        payload.get("service_state") or "",
        1 if payload.get("service_address_visible", True) else 0,
        1 if payload.get("public_visible") else 0,
        payload.get("public_description") or "",
        payload.get("public_demand") or "",
        payload.get("public_solves") or "",
        payload.get("public_tags") or "",
        payload.get("public_whatsapp") or "",
        payload.get("public_instagram") or "",
        payload.get("public_linkedin") or "",
        payload.get("public_url") or "",
        1 if payload.get("google_connected") else 0,
        payload.get("google_contacts_imported_at") or "",
        payload.get("google_profile_synced_at") or "",
        payload.get("role") or "user",
    )
    connection.execute(
        """
        INSERT INTO users (
          name, birth_date, email, password_hash, phone, phone_digits, cep, address,
          address_line, address_number, address_complement, neighborhood, city, state,
          address_visible, interests, is_collaborator, offered_services,
          use_different_service_address, service_cep, service_address,
          service_address_line, service_address_number, service_address_complement,
          service_neighborhood, service_city, service_state, service_address_visible,
          public_visible, public_description, public_demand,
          public_solves, public_tags, public_whatsapp, public_instagram, public_linkedin, public_url,
          google_connected, google_contacts_imported_at, google_profile_synced_at, role
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          name = excluded.name,
          birth_date = excluded.birth_date,
          password_hash = excluded.password_hash,
          phone = excluded.phone,
          phone_digits = excluded.phone_digits,
          cep = excluded.cep,
          address = excluded.address,
          address_line = excluded.address_line,
          address_number = excluded.address_number,
          address_complement = excluded.address_complement,
          neighborhood = excluded.neighborhood,
          city = excluded.city,
          state = excluded.state,
          address_visible = excluded.address_visible,
          interests = excluded.interests,
          is_collaborator = excluded.is_collaborator,
          offered_services = excluded.offered_services,
          use_different_service_address = excluded.use_different_service_address,
          service_cep = excluded.service_cep,
          service_address = excluded.service_address,
          service_address_line = excluded.service_address_line,
          service_address_number = excluded.service_address_number,
          service_address_complement = excluded.service_address_complement,
          service_neighborhood = excluded.service_neighborhood,
          service_city = excluded.service_city,
          service_state = excluded.service_state,
          service_address_visible = excluded.service_address_visible,
          public_visible = excluded.public_visible,
          public_description = excluded.public_description,
          public_demand = excluded.public_demand,
          public_solves = excluded.public_solves,
          public_tags = excluded.public_tags,
          public_whatsapp = excluded.public_whatsapp,
          public_instagram = excluded.public_instagram,
          public_linkedin = excluded.public_linkedin,
          public_url = excluded.public_url,
          google_connected = excluded.google_connected,
          google_contacts_imported_at = excluded.google_contacts_imported_at,
          google_profile_synced_at = excluded.google_profile_synced_at,
          role = excluded.role
        """,
        values,
    )
    return connection.execute("SELECT * FROM users WHERE email = ?", (payload["email"],)).fetchone()


def upsert_google_user(connection: DbConnection, payload: dict):
    existing = connection.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (payload["email"],)).fetchone()
    if existing is not None:
        connection.execute(
            """
            UPDATE users
            SET google_connected = 1,
                google_profile_synced_at = COALESCE(NULLIF(google_profile_synced_at, ''), CURRENT_TIMESTAMP)
            WHERE id = ?
            """,
            (existing["id"],),
        )
        return connection.execute("SELECT * FROM users WHERE id = ?", (existing["id"],)).fetchone()

    password_hash = hash_password(secrets.token_urlsafe(24))
    phone_digits_value = f"google:{payload['sub']}"
    connection.execute(
        """
        INSERT INTO users (
          name, birth_date, email, password_hash, phone, phone_digits, cep, address,
          city, state, address_visible, interests, is_collaborator, offered_services,
          service_address, service_address_visible, public_visible, public_description, public_demand,
          public_solves, public_tags, public_whatsapp, public_instagram, public_linkedin, public_url,
          google_connected, google_profile_synced_at, role
        )
        VALUES (?, '', ?, ?, '', ?, '', '', '', '', false, '[]', false, '', '', true, false, '', '', '', '', '', '', '', '', true, CURRENT_TIMESTAMP, 'user')
        """,
        (payload["name"], payload["email"], password_hash, phone_digits_value),
    )
    return connection.execute("SELECT * FROM users WHERE email = ?", (payload["email"],)).fetchone()


def find_user_by_phone(connection: DbConnection, phone: str):
    digits = phone_digits(phone)
    if not digits:
        return None
    return connection.execute("SELECT * FROM users WHERE phone_digits = ?", (digits,)).fetchone()


def authenticate_user(connection: DbConnection, email: str, password: str):
    row = connection.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (email,)).fetchone()
    if row is None or not verify_password(password, row["password_hash"]):
        return None
    return row


def row_to_user(row) -> dict:
    try:
        raw_interests = row["interests"] or "[]"
        interests = raw_interests if isinstance(raw_interests, list) else json.loads(raw_interests)
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
        "address_line": row["address_line"],
        "address_number": row["address_number"],
        "address_complement": row["address_complement"],
        "neighborhood": row["neighborhood"],
        "city": row["city"],
        "state": row["state"],
        "address_visible": bool(row["address_visible"]),
        "interests": interests,
        "is_collaborator": bool(row["is_collaborator"]),
        "offered_services": row["offered_services"],
        "use_different_service_address": bool(row["use_different_service_address"]),
        "service_cep": row["service_cep"],
        "service_address": row["service_address"],
        "service_address_line": row["service_address_line"],
        "service_address_number": row["service_address_number"],
        "service_address_complement": row["service_address_complement"],
        "service_neighborhood": row["service_neighborhood"],
        "service_city": row["service_city"],
        "service_state": row["service_state"],
        "service_address_visible": bool(row["service_address_visible"]),
        "public_visible": bool(row["public_visible"]),
        "public_description": row["public_description"],
        "public_demand": row["public_demand"],
        "public_solves": row["public_solves"],
        "public_tags": row["public_tags"],
        "public_whatsapp": row["public_whatsapp"],
        "public_instagram": row["public_instagram"],
        "public_linkedin": row["public_linkedin"],
        "public_url": row["public_url"],
        "google_connected": bool(row["google_connected"]),
        "google_contacts_imported_at": row["google_contacts_imported_at"],
        "google_profile_synced_at": row["google_profile_synced_at"],
        "role": row["role"],
    }


def insert_contact(connection: DbConnection, payload: dict):
    owner_id = str(payload.get("owner_id") or "demo-user")
    note = payload.get("note") or ""
    incoming_service = payload.get("service")
    generated_services = {normalize(category.label) for category in CATEGORY_CATALOG}
    generated_services.add(normalize("contato para revisar"))
    generated_services.add(normalize("servicos gerais"))
    if payload.get("source") == "Google People API" and normalize(incoming_service) in generated_services:
        service = infer_service_from_contact(payload["name"], "", note, "")
    else:
        service = infer_service_from_contact(payload["name"], incoming_service, note, payload.get("source"))
    category = classify_service(" ".join([service, payload["name"], note, payload.get("source") or ""]))
    city = payload.get("city") or "Minha regiao"
    address = payload.get("address") or city
    trust = payload.get("trust") or "Novo"
    source = payload.get("source") or "Manual"
    description = payload.get("description") or ""
    demand = payload.get("demand") or ""
    solves = payload.get("solves") or ""
    tags = payload.get("tags") or ""
    email = payload.get("email") or ""
    whatsapp = payload.get("whatsapp") or ""
    instagram = payload.get("instagram") or ""
    linkedin = payload.get("linkedin") or ""
    custom_url = payload.get("custom_url") or ""
    custom_fields = payload.get("custom_fields") or "[]"
    crm_status = payload.get("crm_status") or "Novo"
    crm_priority = payload.get("crm_priority") or "Média"
    last_contact_at = payload.get("last_contact_at") or ""
    next_follow_up_at = payload.get("next_follow_up_at") or ""
    crm_note = payload.get("crm_note") or ""
    search_text = normalize(" ".join([payload["name"], payload["phone"], service, note, city, address, trust, source, description, demand, solves, tags, email, whatsapp, instagram, linkedin, custom_url, custom_fields, crm_status, crm_priority, crm_note, category.label, category.group]))

    returning_clause = " RETURNING id" if connection.dialect == "postgres" else ""
    cursor = connection.execute(
        f"""
        INSERT INTO contacts (
            owner_id, name, phone, service, note, city, address, trust, source,
            description, demand, solves, tags, email, whatsapp, instagram, linkedin, custom_url, custom_fields,
            crm_status, crm_priority, last_contact_at, next_follow_up_at, crm_note,
            category_id, category_label, category_group, search_text
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        {returning_clause}
        """,
        (
            owner_id,
            payload["name"],
            payload["phone"],
            service,
            note,
            city,
            address,
            trust,
            source,
            description,
            demand,
            solves,
            tags,
            email,
            whatsapp,
            instagram,
            linkedin,
            custom_url,
            custom_fields,
            crm_status,
            crm_priority,
            last_contact_at,
            next_follow_up_at,
            crm_note,
            category.id,
            category.label,
            category.group,
            search_text,
        ),
    )
    contact_id = first_value(cursor.fetchone()) if connection.dialect == "postgres" else cursor.lastrowid
    return connection.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,)).fetchone()


def update_contact(connection: DbConnection, contact_id: int, payload: dict):
    owner_id = str(payload.get("owner_id") or "demo-user")
    note = payload.get("note") or ""
    service = infer_service_from_contact(payload["name"], payload.get("service"), note, payload.get("source"))
    category = classify_service(" ".join([service, payload["name"], note, payload.get("source") or ""]))
    city = payload.get("city") or "Minha regiao"
    address = payload.get("address") or city
    trust = payload.get("trust") or "Novo"
    source = payload.get("source") or "Manual"
    description = payload.get("description") or ""
    demand = payload.get("demand") or ""
    solves = payload.get("solves") or ""
    tags = payload.get("tags") or ""
    email = payload.get("email") or ""
    whatsapp = payload.get("whatsapp") or ""
    instagram = payload.get("instagram") or ""
    linkedin = payload.get("linkedin") or ""
    custom_url = payload.get("custom_url") or ""
    custom_fields = payload.get("custom_fields") or "[]"
    crm_status = payload.get("crm_status") or "Novo"
    crm_priority = payload.get("crm_priority") or "Média"
    last_contact_at = payload.get("last_contact_at") or ""
    next_follow_up_at = payload.get("next_follow_up_at") or ""
    crm_note = payload.get("crm_note") or ""
    search_text = normalize(" ".join([payload["name"], payload["phone"], service, note, city, address, trust, source, description, demand, solves, tags, email, whatsapp, instagram, linkedin, custom_url, custom_fields, crm_status, crm_priority, crm_note, category.label, category.group]))

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
            description = ?,
            demand = ?,
            solves = ?,
            tags = ?,
            email = ?,
            whatsapp = ?,
            instagram = ?,
            linkedin = ?,
            custom_url = ?,
            custom_fields = ?,
            crm_status = ?,
            crm_priority = ?,
            last_contact_at = ?,
            next_follow_up_at = ?,
            crm_note = ?,
            category_id = ?,
            category_label = ?,
            category_group = ?,
            search_text = ?
        WHERE id = ? AND owner_id = ?
        """,
        (
            payload["name"],
            payload["phone"],
            service,
            note,
            city,
            address,
            trust,
            source,
            description,
            demand,
            solves,
            tags,
            email,
            whatsapp,
            instagram,
            linkedin,
            custom_url,
            custom_fields,
            crm_status,
            crm_priority,
            last_contact_at,
            next_follow_up_at,
            crm_note,
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


def ignored_merge_pairs(connection: DbConnection, owner_id: str) -> set[tuple[int, int, str, str]]:
    rows = connection.execute(
        """
        SELECT primary_contact_id, duplicate_contact_id, match_type, match_value
        FROM merge_suggestions
        WHERE owner_id = ? AND status IN ('ignored', 'merged')
        """,
        (owner_id,),
    ).fetchall()
    return {
        (*merge_key(row["primary_contact_id"], row["duplicate_contact_id"]), row["match_type"], row["match_value"])
        for row in rows
    }


def list_merge_suggestions(connection: DbConnection, owner_id: str) -> list[dict]:
    rows = connection.execute(
        "SELECT * FROM contacts WHERE owner_id = ? ORDER BY datetime(created_at) ASC, id ASC",
        (owner_id,),
    ).fetchall()
    ignored = ignored_merge_pairs(connection, owner_id)
    suggestions: list[dict] = []
    seen: set[tuple[int, int, str, str]] = set()
    seen_pairs: set[tuple[int, int]] = set()

    by_phone: dict[str, list] = {}
    by_email: dict[str, list] = {}
    for row in rows:
        digits = phone_digits(row["phone"])
        if len(digits) >= 8:
            by_phone.setdefault(digits, []).append(row)
        for email in extract_contact_emails(row):
            by_email.setdefault(email, []).append(row)

    def add_pairs(groups: dict[str, list], match_type: str) -> None:
        for value, contacts in groups.items():
            if len(contacts) < 2:
                continue
            ordered = sorted(contacts, key=lambda item: item["id"])
            primary = ordered[0]
            for duplicate in ordered[1:]:
                primary_id, duplicate_id = merge_key(primary["id"], duplicate["id"])
                key = (primary_id, duplicate_id, match_type, value)
                pair_key = (primary_id, duplicate_id)
                if key in ignored or key in seen or pair_key in seen_pairs:
                    continue
                seen.add(key)
                seen_pairs.add(pair_key)
                suggestions.append(
                    {
                        "id": f"{match_type}:{value}:{primary_id}:{duplicate_id}",
                        "owner_id": owner_id,
                        "match_type": match_type,
                        "match_value": value,
                        "primary_contact": row_to_contact(primary if primary["id"] == primary_id else duplicate),
                        "duplicate_contact": row_to_contact(duplicate if duplicate["id"] == duplicate_id else primary),
                    }
                )

    add_pairs(by_phone, "phone")
    add_pairs(by_email, "email")
    return suggestions


def ignore_merge_suggestion(connection: DbConnection, owner_id: str, primary_id: int, duplicate_id: int) -> None:
    rows = connection.execute(
        "SELECT * FROM contacts WHERE owner_id = ? AND id IN (?, ?)",
        (owner_id, primary_id, duplicate_id),
    ).fetchall()
    if len(rows) != 2:
        raise ValueError("Sugestão de duplicidade não encontrada.")
    primary_id, duplicate_id = merge_key(primary_id, duplicate_id)
    for suggestion in list_merge_suggestions(connection, owner_id):
        if suggestion["primary_contact"]["id"] == primary_id and suggestion["duplicate_contact"]["id"] == duplicate_id:
            connection.execute(
                """
                INSERT INTO merge_suggestions (owner_id, primary_contact_id, duplicate_contact_id, match_type, match_value, status)
                VALUES (?, ?, ?, ?, ?, 'ignored')
                ON CONFLICT(owner_id, primary_contact_id, duplicate_contact_id, match_type, match_value)
                DO UPDATE SET status = 'ignored'
                """,
                (owner_id, primary_id, duplicate_id, suggestion["match_type"], suggestion["match_value"]),
            )


def merge_contacts(connection: DbConnection, owner_id: str, primary_id: int, duplicate_id: int):
    primary_id, duplicate_id = merge_key(primary_id, duplicate_id)
    primary = connection.execute("SELECT * FROM contacts WHERE owner_id = ? AND id = ?", (owner_id, primary_id)).fetchone()
    duplicate = connection.execute("SELECT * FROM contacts WHERE owner_id = ? AND id = ?", (owner_id, duplicate_id)).fetchone()
    if primary is None or duplicate is None:
        raise ValueError("Contatos duplicados não encontrados.")

    def choose(field: str) -> str:
        return primary[field] or duplicate[field] or ""

    notes = [primary["note"], duplicate["note"]]
    merged_note = " | ".join(dict.fromkeys(item for item in notes if item))[:500]
    merged_source = " + ".join(dict.fromkeys(item for item in [primary["source"], duplicate["source"]] if item))[:80]
    merged_tags = ", ".join(
        dict.fromkeys(
            tag.strip()
            for value in (primary["tags"], duplicate["tags"])
            for tag in str(value or "").split(",")
            if tag.strip()
        )
    )[:500]
    payload = {
        "owner_id": owner_id,
        "name": choose("name"),
        "phone": choose("phone"),
        "service": choose("service"),
        "note": merged_note,
        "city": choose("city"),
        "address": choose("address"),
        "trust": primary["trust"] if primary["trust"] != "Novo" else duplicate["trust"],
        "source": merged_source or "Merge",
        "description": choose("description"),
        "demand": choose("demand"),
        "solves": choose("solves"),
        "tags": merged_tags,
        "email": choose("email"),
        "whatsapp": choose("whatsapp"),
        "instagram": choose("instagram"),
        "linkedin": choose("linkedin"),
        "custom_url": choose("custom_url"),
        "custom_fields": choose("custom_fields") or "[]",
        "crm_status": choose("crm_status") or "Novo",
        "crm_priority": choose("crm_priority") or "Média",
        "last_contact_at": choose("last_contact_at"),
        "next_follow_up_at": choose("next_follow_up_at"),
        "crm_note": choose("crm_note"),
    }
    updated = update_contact(connection, primary_id, payload)
    if updated is None:
        raise ValueError("Não foi possível mesclar os contatos.")

    suggestions = list_merge_suggestions(connection, owner_id)
    for suggestion in suggestions:
        if suggestion["primary_contact"]["id"] == primary_id and suggestion["duplicate_contact"]["id"] == duplicate_id:
            connection.execute(
                """
                INSERT INTO merge_suggestions (owner_id, primary_contact_id, duplicate_contact_id, match_type, match_value, status)
                VALUES (?, ?, ?, ?, ?, 'merged')
                ON CONFLICT(owner_id, primary_contact_id, duplicate_contact_id, match_type, match_value)
                DO UPDATE SET status = 'merged'
                """,
                (owner_id, primary_id, duplicate_id, suggestion["match_type"], suggestion["match_value"]),
            )
    connection.execute("DELETE FROM contacts WHERE owner_id = ? AND id = ?", (owner_id, duplicate_id))
    return connection.execute("SELECT * FROM contacts WHERE id = ?", (primary_id,)).fetchone()


def row_to_contact(row) -> dict:
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
        "description": row["description"],
        "demand": row["demand"],
        "solves": row["solves"],
        "tags": row["tags"],
        "email": row["email"],
        "whatsapp": row["whatsapp"],
        "instagram": row["instagram"],
        "linkedin": row["linkedin"],
        "custom_url": row["custom_url"],
        "custom_fields": row["custom_fields"],
        "crm_status": row["crm_status"],
        "crm_priority": row["crm_priority"],
        "last_contact_at": row["last_contact_at"],
        "next_follow_up_at": row["next_follow_up_at"],
        "crm_note": row["crm_note"],
        "created_at": row_text(row["created_at"]),
        "category": {
            "id": row["category_id"],
            "label": row["category_label"],
            "group": row["category_group"],
            "keywords": [],
            "synonyms": [],
            "count": 0,
        },
    }


def row_to_public_profile(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "service": row["service"],
        "area": row["area"],
        "people": row["people"],
        "response": row["response"],
        "score": row["score"],
        "kind": "group",
        "description": "",
        "demand": "",
        "solves": "",
        "tags": "",
        "phone": "",
        "email": "",
        "whatsapp": "",
        "instagram": "",
        "linkedin": "",
        "custom_url": "",
        "source_user_id": None,
        "category": {
            "id": row["category_id"],
            "label": row["category_label"],
            "group": row["category_group"],
            "keywords": [],
            "synonyms": [],
            "count": 0,
        },
    }


def row_to_public_user_profile(row) -> dict:
    service = row["offered_services"] or row["public_solves"] or "Perfil público"
    try:
        raw_interests = row["interests"] or "[]"
        interests = raw_interests if isinstance(raw_interests, list) else json.loads(raw_interests)
    except json.JSONDecodeError:
        interests = []
    tags = row["public_tags"] or ", ".join(interests)
    category = classify_service(" ".join([service, tags, row["public_description"], row["public_solves"]]))
    area = row["city"] or row["state"] or "Rede pública"
    address = row["service_address"] if row["is_collaborator"] and row["service_address_visible"] else row["address"]
    if row["address_visible"] and address:
        area = address
    search_text = normalize(
        " ".join(
            [
                row["name"],
                service,
                area,
                row["public_description"],
                row["public_demand"],
                row["public_solves"],
                tags,
                row["email"],
                row["public_instagram"],
                row["public_linkedin"],
                category.label,
                category.group,
            ]
        )
    )
    return {
        "id": row["id"],
        "name": row["name"],
        "service": service,
        "area": area,
        "people": 1,
        "response": "perfil",
        "score": 5.0 if row["is_collaborator"] else 4.6,
        "kind": "person",
        "description": row["public_description"],
        "demand": row["public_demand"],
        "solves": row["public_solves"],
        "tags": tags,
        "phone": row["phone"],
        "email": row["email"],
        "whatsapp": row["public_whatsapp"] or row["phone"],
        "instagram": row["public_instagram"],
        "linkedin": row["public_linkedin"],
        "custom_url": row["public_url"],
        "source_user_id": row["id"],
        "search_text": search_text,
        "category": {
            "id": category.id,
            "label": category.label,
            "group": category.group,
            "keywords": [],
            "synonyms": [],
            "count": 0,
        },
    }


def category_counts(connection: DbConnection) -> dict[str, int]:
    rows = connection.execute("SELECT category_id, COUNT(*) as total FROM contacts GROUP BY category_id").fetchall()
    return {row["category_id"]: row["total"] for row in rows}


def list_categories(connection: DbConnection) -> list[dict]:
    counts = category_counts(connection)
    return [category_to_dict(category, counts.get(category.id, 0)) for category in CATEGORY_CATALOG]
