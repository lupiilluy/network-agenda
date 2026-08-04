from __future__ import annotations

import json
import hashlib
import os
import re
import secrets
import sqlite3
from contextlib import contextmanager
from collections.abc import Iterator
from difflib import SequenceMatcher
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
DEFAULT_DATA_DIR = Path("/tmp/network-agenda") if os.getenv("VERCEL") else BASE_DIR / "data"
DATA_DIR = Path(os.getenv("NETWORK_AGENDA_DATA_DIR", str(DEFAULT_DATA_DIR)))
DB_PATH = DATA_DIR / "network_agenda.sqlite3"
AUTH_RLS_REQUIRED_TABLES = (
    "users",
    "contacts",
    "public_profiles",
    "merge_suggestions",
    "contact_phones",
    "contact_emails",
    "tags",
    "contact_tags",
    "custom_fields",
    "custom_field_values",
    "groups",
    "group_members",
    "group_contacts",
    "group_messages",
    "chat_threads",
    "chat_messages",
    "import_jobs",
    "push_subscriptions",
    "push_dispatch_events",
)


CONTACTS_SEED = (
    {
        "name": "Joao Martins",
        "phone": "11 99418-2300",
        "service": "eletricista residencial",
        "note": "Atende emergencia e instalacao de chuveiro",
        "city": "São Paulo",
        "address": "Avenida Paulista, São Paulo, SP",
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
        "city": "São Paulo",
        "address": "Pinheiros, São Paulo, SP",
        "trust": "Novo",
        "source": "Indicação",
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
        "area": "São Paulo e ABC",
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
        "area": "Grande São Paulo",
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
            # PostgreSQL can execute the full schema script directly, including
            # dollar-quoted function bodies that would be broken by naive splitting.
            self.connection.execute(sql)
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
    return (
        sql.replace("datetime(created_at)", "created_at")
        .replace("datetime(updated_at)", "updated_at")
        .replace("datetime(groups.created_at)", "groups.created_at")
        .replace("datetime(group_contacts.created_at)", "group_contacts.created_at")
        .replace("datetime(group_messages.created_at)", "group_messages.created_at")
        .replace("?", "%s")
    )


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


def db_bool(connection: "DbConnection", value: Any) -> bool | int:
    normalized = bool(value)
    if connection.dialect == "postgres":
        return normalized
    return 1 if normalized else 0


@contextmanager
def get_connection() -> Iterator[DbConnection]:
    if use_postgres():
        if psycopg is None:
            raise RuntimeError("DATABASE_URL usa Postgres, mas psycopg nao esta instalado. Rode pip install -r requirements.txt.")
        # Supabase uses PgBouncer transaction pooling in production. Automatic
        # prepared statements leak across pooled sessions and cause duplicate
        # statement errors, so keep psycopg in simple-query mode.
        raw_connection = psycopg.connect(
            os.getenv("DATABASE_URL", "").strip(),
            row_factory=dict_row,
            prepare_threshold=None,
        )
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
              linked_user_id TEXT NOT NULL DEFAULT '',
              linked_user_name TEXT NOT NULL DEFAULT '',
              linked_user_email TEXT NOT NULL DEFAULT '',
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
              demand_tags TEXT NOT NULL DEFAULT '',
              solves TEXT NOT NULL DEFAULT '',
              tags TEXT NOT NULL DEFAULT '',
              email TEXT NOT NULL DEFAULT '',
              whatsapp TEXT NOT NULL DEFAULT '',
              instagram TEXT NOT NULL DEFAULT '',
              linkedin TEXT NOT NULL DEFAULT '',
              organization TEXT NOT NULL DEFAULT '',
              custom_url TEXT NOT NULL DEFAULT '',
              avatar_url TEXT NOT NULL DEFAULT '',
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
              avatar_url TEXT NOT NULL DEFAULT '',
              google_connected INTEGER NOT NULL DEFAULT 0,
              google_contacts_imported_at TEXT NOT NULL DEFAULT '',
              google_profile_synced_at TEXT NOT NULL DEFAULT '',
              notification_preference TEXT NOT NULL DEFAULT 'relevant',
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

            CREATE TABLE IF NOT EXISTS contact_phones (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              contact_id INTEGER NOT NULL,
              owner_id TEXT NOT NULL,
              phone TEXT NOT NULL,
              phone_digits TEXT NOT NULL,
              ddd TEXT NOT NULL DEFAULT '',
              label TEXT NOT NULL DEFAULT 'Principal',
              is_primary INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(contact_id, phone_digits)
            );

            CREATE TABLE IF NOT EXISTS contact_emails (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              contact_id INTEGER NOT NULL,
              owner_id TEXT NOT NULL,
              email TEXT NOT NULL,
              normalized_email TEXT NOT NULL,
              label TEXT NOT NULL DEFAULT 'Principal',
              is_primary INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(contact_id, normalized_email)
            );

            CREATE TABLE IF NOT EXISTS tags (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              owner_id TEXT NOT NULL,
              name TEXT NOT NULL,
              normalized_name TEXT NOT NULL,
              usage_count INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(owner_id, normalized_name)
            );

            CREATE TABLE IF NOT EXISTS contact_tags (
              contact_id INTEGER NOT NULL,
              tag_id INTEGER NOT NULL,
              owner_id TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(contact_id, tag_id)
            );

            CREATE TABLE IF NOT EXISTS custom_fields (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              owner_id TEXT NOT NULL,
              scope_type TEXT NOT NULL DEFAULT 'user',
              scope_id TEXT NOT NULL DEFAULT '',
              name TEXT NOT NULL,
              field_key TEXT NOT NULL,
              field_type TEXT NOT NULL DEFAULT 'text_short',
              options TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(owner_id, scope_type, scope_id, field_key)
            );

            CREATE TABLE IF NOT EXISTS custom_field_values (
              contact_id INTEGER NOT NULL,
              field_id INTEGER NOT NULL,
              owner_id TEXT NOT NULL,
              value TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(contact_id, field_id)
            );

            CREATE TABLE IF NOT EXISTS groups (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              owner_id TEXT NOT NULL,
              name TEXT NOT NULL,
              area TEXT NOT NULL DEFAULT '',
              people_goal INTEGER NOT NULL DEFAULT 3,
              description TEXT NOT NULL DEFAULT '',
              created_by_email TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS group_members (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              group_id INTEGER NOT NULL,
              user_id TEXT NOT NULL DEFAULT '',
              email TEXT NOT NULL DEFAULT '',
              role TEXT NOT NULL DEFAULT 'member',
              status TEXT NOT NULL DEFAULT 'active',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(group_id, email)
            );

            CREATE TABLE IF NOT EXISTS group_contacts (
              group_id INTEGER NOT NULL,
              contact_id INTEGER NOT NULL,
              owner_id TEXT NOT NULL,
              added_by TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(group_id, contact_id)
            );

            CREATE TABLE IF NOT EXISTS group_messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              group_id INTEGER NOT NULL,
              sender_id TEXT NOT NULL,
              sender_name TEXT NOT NULL DEFAULT '',
              sender_email TEXT NOT NULL DEFAULT '',
              message TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chat_threads (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              owner_id TEXT NOT NULL,
              title TEXT NOT NULL DEFAULT '',
              last_message_preview TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              thread_id INTEGER NOT NULL,
              owner_id TEXT NOT NULL,
              role TEXT NOT NULL,
              text TEXT NOT NULL,
              provider TEXT NOT NULL DEFAULT '',
              suggestions TEXT NOT NULL DEFAULT '[]',
              cta_label TEXT NOT NULL DEFAULT '',
              cta_route TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS import_jobs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              owner_id TEXT NOT NULL,
              source TEXT NOT NULL,
              filename TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'completed',
              total_count INTEGER NOT NULL DEFAULT 0,
              imported_count INTEGER NOT NULL DEFAULT 0,
              skipped_count INTEGER NOT NULL DEFAULT 0,
              failed_count INTEGER NOT NULL DEFAULT 0,
              details TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
            )
            ensure_contact_columns(connection)
            ensure_user_columns(connection)
            ensure_normalized_contact_tables(connection)
            ensure_group_tables(connection)
            ensure_chat_and_import_tables(connection)
            repair_text_encoding(connection)
        seed_db(connection)
        assign_demo_contacts(connection)
        reclassify_contacts(connection)
        repair_text_encoding(connection)
        sync_all_contact_structures(connection)


def auth_storage_readiness(connection: DbConnection) -> dict[str, Any]:
    warnings: list[str] = []
    result: dict[str, Any] = {
        "database_dialect": connection.dialect,
        "rls_supported": connection.dialect == "postgres",
        "rls_ready": False,
        "rls_enabled_tables": 0,
        "rls_total_tables": len(AUTH_RLS_REQUIRED_TABLES),
        "rls_missing_tables": list(AUTH_RLS_REQUIRED_TABLES),
        "rls_tables_without_policy": list(AUTH_RLS_REQUIRED_TABLES),
        "warnings": warnings,
    }

    if connection.dialect != "postgres":
        warnings.append("Banco atual em SQLite. Auth de produção deve usar Postgres/Supabase com RLS.")
        return result

    try:
        table_rows = connection.connection.execute(
            """
            SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = ANY(%s)
            """,
            (list(AUTH_RLS_REQUIRED_TABLES),),
        ).fetchall()
        policy_rows = connection.connection.execute(
            """
            SELECT tablename AS table_name, COUNT(*)::int AS policy_count
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = ANY(%s)
            GROUP BY tablename
            """,
            (list(AUTH_RLS_REQUIRED_TABLES),),
        ).fetchall()
    except Exception as exc:
        warnings.append(f"Não foi possível inspecionar RLS no Postgres atual: {exc}")
        return result

    table_status = {
        str(row["table_name"]): bool(row["rls_enabled"])
        for row in table_rows
    }
    policy_status = {
        str(row["table_name"]): int(row["policy_count"] or 0)
        for row in policy_rows
    }

    missing_tables = [table for table in AUTH_RLS_REQUIRED_TABLES if table not in table_status]
    tables_without_policy = [table for table in AUTH_RLS_REQUIRED_TABLES if policy_status.get(table, 0) <= 0]
    rls_enabled_tables = sum(1 for table in AUTH_RLS_REQUIRED_TABLES if table_status.get(table))
    all_rls_enabled = rls_enabled_tables == len(AUTH_RLS_REQUIRED_TABLES)
    rls_ready = all_rls_enabled and not missing_tables and not tables_without_policy

    if missing_tables:
        warnings.append(f"Tabelas ausentes no schema protegido: {', '.join(missing_tables[:6])}.")
    if not all_rls_enabled:
        disabled_tables = [table for table in AUTH_RLS_REQUIRED_TABLES if not table_status.get(table)]
        warnings.append(f"RLS não está ativo em todas as tabelas obrigatórias: {', '.join(disabled_tables[:6])}.")
    if tables_without_policy:
        warnings.append(f"Faltam políticas RLS em: {', '.join(tables_without_policy[:6])}.")

    result.update(
        {
            "rls_ready": rls_ready,
            "rls_enabled_tables": rls_enabled_tables,
            "rls_missing_tables": missing_tables,
            "rls_tables_without_policy": tables_without_policy,
        }
    )
    return result


def init_postgres_db(connection: DbConnection) -> None:
    schema_path = Path(__file__).resolve().parent / "postgres_schema.sql"
    connection.executescript(schema_path.read_text(encoding="utf-8"))
    ensure_contact_columns(connection)
    ensure_user_columns(connection)
    ensure_normalized_contact_tables(connection)
    ensure_group_tables(connection)
    ensure_chat_and_import_tables(connection)
    repair_text_encoding(connection)


def ensure_contact_columns(connection: DbConnection) -> None:
    if connection.dialect == "postgres":
        connection.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS organization TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linked_user_id TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linked_user_name TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linked_user_email TEXT NOT NULL DEFAULT ''")
        return
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(contacts)").fetchall()}
    if "owner_id" not in columns:
        connection.execute("ALTER TABLE contacts ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'demo-user'")
    for column in ("linked_user_id", "linked_user_name", "linked_user_email"):
        if column not in columns:
            connection.execute(f"ALTER TABLE contacts ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")
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
        ("demand_tags", ""),
        ("solves", ""),
        ("tags", ""),
        ("email", ""),
        ("whatsapp", ""),
        ("instagram", ""),
        ("linkedin", ""),
        ("organization", ""),
        ("custom_url", ""),
        ("avatar_url", ""),
        ("custom_fields", "[]"),
    ):
        if column not in columns:
            connection.execute(f"ALTER TABLE contacts ADD COLUMN {column} TEXT NOT NULL DEFAULT '{default}'")
    connection.execute("UPDATE contacts SET crm_priority = 'Média' WHERE crm_priority LIKE 'M%dia' AND crm_priority != 'Média'")
    standardize_display_text(connection)


def ensure_user_columns(connection: DbConnection) -> None:
    if connection.dialect == "postgres":
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preference TEXT NOT NULL DEFAULT 'relevant'")
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
        ("avatar_url", "TEXT", ""),
        ("google_connected", "INTEGER", "0"),
        ("google_contacts_imported_at", "TEXT", ""),
        ("google_profile_synced_at", "TEXT", ""),
        ("notification_preference", "TEXT", "relevant"),
    ):
        if column not in columns:
            if column_type == "INTEGER":
                connection.execute(f"ALTER TABLE users ADD COLUMN {column} INTEGER NOT NULL DEFAULT {default}")
            else:
                connection.execute(f"ALTER TABLE users ADD COLUMN {column} TEXT NOT NULL DEFAULT '{default}'")
    default_hash = hash_password("123456")
    connection.execute("UPDATE users SET password_hash = ? WHERE password_hash = ''", (default_hash,))


def ensure_normalized_contact_tables(connection: DbConnection) -> None:
    statements = (
        """
        CREATE TABLE IF NOT EXISTS contact_phones (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          contact_id BIGINT NOT NULL,
          owner_id TEXT NOT NULL,
          phone TEXT NOT NULL,
          phone_digits TEXT NOT NULL,
          ddd TEXT NOT NULL DEFAULT '',
          label TEXT NOT NULL DEFAULT 'Principal',
          is_primary BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(contact_id, phone_digits)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS contact_emails (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          contact_id BIGINT NOT NULL,
          owner_id TEXT NOT NULL,
          email TEXT NOT NULL,
          normalized_email TEXT NOT NULL,
          label TEXT NOT NULL DEFAULT 'Principal',
          is_primary BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(contact_id, normalized_email)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS tags (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          owner_id TEXT NOT NULL,
          name TEXT NOT NULL,
          normalized_name TEXT NOT NULL,
          usage_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(owner_id, normalized_name)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS contact_tags (
          contact_id BIGINT NOT NULL,
          tag_id BIGINT NOT NULL,
          owner_id TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(contact_id, tag_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS custom_fields (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          owner_id TEXT NOT NULL,
          scope_type TEXT NOT NULL DEFAULT 'user',
          scope_id TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL,
          field_key TEXT NOT NULL,
          field_type TEXT NOT NULL DEFAULT 'text_short',
          options TEXT NOT NULL DEFAULT '[]',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(owner_id, scope_type, scope_id, field_key)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS custom_field_values (
          contact_id BIGINT NOT NULL,
          field_id BIGINT NOT NULL,
          owner_id TEXT NOT NULL,
          value TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(contact_id, field_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS contact_phones_owner_ddd_idx ON contact_phones(owner_id, ddd)",
        "CREATE INDEX IF NOT EXISTS contact_phones_digits_idx ON contact_phones(owner_id, phone_digits)",
        "CREATE INDEX IF NOT EXISTS contact_emails_normalized_idx ON contact_emails(owner_id, normalized_email)",
        "CREATE INDEX IF NOT EXISTS tags_owner_name_idx ON tags(owner_id, normalized_name)",
        "CREATE INDEX IF NOT EXISTS contact_tags_owner_idx ON contact_tags(owner_id, tag_id)",
        "CREATE INDEX IF NOT EXISTS custom_field_values_owner_idx ON custom_field_values(owner_id, field_id)",
    )
    if connection.dialect == "postgres":
        for statement in statements:
            connection.execute(statement)
        connection.execute("ALTER TABLE groups ADD COLUMN IF NOT EXISTS area TEXT NOT NULL DEFAULT ''")
        connection.execute("ALTER TABLE groups ADD COLUMN IF NOT EXISTS people_goal INTEGER NOT NULL DEFAULT 3")
        return

    # SQLite tables are created in the main script. Add indexes here so old DBs get them too.
    for statement in statements[-6:]:
        connection.execute(statement)


def ensure_group_tables(connection: DbConnection) -> None:
    statements = (
        """
        CREATE TABLE IF NOT EXISTS groups (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          owner_id TEXT NOT NULL,
          name TEXT NOT NULL,
          area TEXT NOT NULL DEFAULT '',
          people_goal INTEGER NOT NULL DEFAULT 3,
          description TEXT NOT NULL DEFAULT '',
          created_by_email TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS group_members (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          group_id BIGINT NOT NULL,
          user_id TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          role TEXT NOT NULL DEFAULT 'member',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(group_id, email)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS group_contacts (
          group_id BIGINT NOT NULL,
          contact_id BIGINT NOT NULL,
          owner_id TEXT NOT NULL,
          added_by TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(group_id, contact_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS group_messages (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          group_id BIGINT NOT NULL,
          sender_id TEXT NOT NULL,
          sender_name TEXT NOT NULL DEFAULT '',
          sender_email TEXT NOT NULL DEFAULT '',
          message TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS groups_owner_idx ON groups(owner_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS group_members_group_idx ON group_members(group_id, status)",
        "CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members(user_id, email)",
        "CREATE INDEX IF NOT EXISTS group_contacts_group_idx ON group_contacts(group_id, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS group_contacts_contact_idx ON group_contacts(contact_id)",
        "CREATE INDEX IF NOT EXISTS group_messages_group_idx ON group_messages(group_id, created_at ASC)",
    )
    if connection.dialect == "postgres":
        for statement in statements:
            connection.execute(statement)
        return
    for statement in statements[-6:-1]:
        connection.execute(statement)
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(groups)").fetchall()}
    if "area" not in columns:
        connection.execute("ALTER TABLE groups ADD COLUMN area TEXT NOT NULL DEFAULT ''")
    if "people_goal" not in columns:
        connection.execute("ALTER TABLE groups ADD COLUMN people_goal INTEGER NOT NULL DEFAULT 3")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS group_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          sender_id TEXT NOT NULL,
          sender_name TEXT NOT NULL DEFAULT '',
          sender_email TEXT NOT NULL DEFAULT '',
          message TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    connection.execute(statements[-1])


def ensure_chat_and_import_tables(connection: DbConnection) -> None:
    postgres_statements = (
        """
        CREATE TABLE IF NOT EXISTS chat_threads (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          owner_id TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          last_message_preview TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          thread_id BIGINT NOT NULL,
          owner_id TEXT NOT NULL,
          role TEXT NOT NULL,
          text TEXT NOT NULL,
          provider TEXT NOT NULL DEFAULT '',
          suggestions TEXT NOT NULL DEFAULT '[]',
          cta_label TEXT NOT NULL DEFAULT '',
          cta_route TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS import_jobs (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          owner_id TEXT NOT NULL,
          source TEXT NOT NULL,
          filename TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'completed',
          total_count INTEGER NOT NULL DEFAULT 0,
          imported_count INTEGER NOT NULL DEFAULT 0,
          skipped_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0,
          details TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          owner_id TEXT NOT NULL,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh_key TEXT NOT NULL DEFAULT '',
          auth_key TEXT NOT NULL DEFAULT '',
          expiration_time BIGINT,
          user_agent TEXT NOT NULL DEFAULT '',
          device_label TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS push_dispatch_events (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          owner_id TEXT NOT NULL,
          event_key TEXT NOT NULL,
          fingerprint TEXT NOT NULL DEFAULT '',
          send_count INTEGER NOT NULL DEFAULT 0,
          last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(owner_id, event_key)
        )
        """,
        "CREATE INDEX IF NOT EXISTS chat_threads_owner_updated_idx ON chat_threads(owner_id, updated_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx ON chat_messages(thread_id, created_at ASC, id ASC)",
        "CREATE INDEX IF NOT EXISTS import_jobs_owner_created_idx ON import_jobs(owner_id, created_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS push_subscriptions_owner_updated_idx ON push_subscriptions(owner_id, updated_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS push_dispatch_events_owner_sent_idx ON push_dispatch_events(owner_id, last_sent_at DESC, id DESC)",
    )
    if connection.dialect == "postgres":
        for statement in postgres_statements:
            connection.execute(statement)
        return
    sqlite_statements = (
        """
        CREATE TABLE IF NOT EXISTS chat_threads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          last_message_preview TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          thread_id INTEGER NOT NULL,
          owner_id TEXT NOT NULL,
          role TEXT NOT NULL,
          text TEXT NOT NULL,
          provider TEXT NOT NULL DEFAULT '',
          suggestions TEXT NOT NULL DEFAULT '[]',
          cta_label TEXT NOT NULL DEFAULT '',
          cta_route TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS import_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id TEXT NOT NULL,
          source TEXT NOT NULL,
          filename TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'completed',
          total_count INTEGER NOT NULL DEFAULT 0,
          imported_count INTEGER NOT NULL DEFAULT 0,
          skipped_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0,
          details TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id TEXT NOT NULL,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh_key TEXT NOT NULL DEFAULT '',
          auth_key TEXT NOT NULL DEFAULT '',
          expiration_time INTEGER,
          user_agent TEXT NOT NULL DEFAULT '',
          device_label TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS push_dispatch_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id TEXT NOT NULL,
          event_key TEXT NOT NULL,
          fingerprint TEXT NOT NULL DEFAULT '',
          send_count INTEGER NOT NULL DEFAULT 0,
          last_sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(owner_id, event_key)
        )
        """,
        "CREATE INDEX IF NOT EXISTS chat_threads_owner_updated_idx ON chat_threads(owner_id, updated_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx ON chat_messages(thread_id, created_at ASC, id ASC)",
        "CREATE INDEX IF NOT EXISTS import_jobs_owner_created_idx ON import_jobs(owner_id, created_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS push_subscriptions_owner_updated_idx ON push_subscriptions(owner_id, updated_at DESC, id DESC)",
        "CREATE INDEX IF NOT EXISTS push_dispatch_events_owner_sent_idx ON push_dispatch_events(owner_id, last_sent_at DESC, id DESC)",
    )
    for statement in sqlite_statements:
        connection.execute(statement)


def looks_mojibake(value: str) -> bool:
    return any(marker in value for marker in ("Ã", "Â", "Ă", "Ä", "Ĺ", "Ľ", "�"))


def mojibake_score(value: str) -> int:
    return sum(value.count(marker) for marker in ("Ã", "Â", "Ă", "Ä", "Ĺ", "Ľ", "�"))


def repair_mojibake(value: str) -> str:
    if not value or not looks_mojibake(value):
        return value
    current = value
    for _ in range(5):
        try:
            decoded = current.encode("latin1").decode("utf-8")
        except UnicodeError:
            break
        if decoded == current:
            break
        if mojibake_score(decoded) > mojibake_score(current):
            break
        current = decoded
        if not looks_mojibake(current):
            break
    return current


def repair_text_encoding(connection: DbConnection) -> None:
    text_columns = {
        "contacts": (
            "name", "phone", "service", "note", "city", "address", "trust", "source",
            "description", "demand", "demand_tags", "solves", "tags", "email", "whatsapp", "instagram",
            "linkedin", "organization", "custom_url", "avatar_url", "custom_fields", "crm_status", "crm_priority",
            "last_contact_at", "next_follow_up_at", "crm_note", "category_id",
            "category_label", "category_group", "search_text",
        ),
        "users": (
            "name", "birth_date", "email", "phone", "cep", "address", "address_line",
            "address_number", "address_complement", "neighborhood", "city", "state",
            "interests", "offered_services", "service_cep", "service_address",
            "service_address_line", "service_address_number", "service_address_complement",
            "service_neighborhood", "service_city", "service_state", "public_description",
            "public_demand", "public_solves", "public_tags", "public_whatsapp",
            "public_instagram", "public_linkedin", "public_url", "avatar_url", "google_contacts_imported_at",
            "google_profile_synced_at", "notification_preference", "role",
        ),
        "public_profiles": ("name", "service", "area", "response", "category_id", "category_label", "category_group", "search_text"),
        "tags": ("name", "normalized_name"),
        "custom_fields": ("name", "field_key", "field_type", "options"),
        "groups": ("name", "area", "description", "created_by_email"),
        "group_messages": ("sender_id", "sender_name", "sender_email", "message"),
        "custom_field_values": ("value",),
        "contact_phones": ("phone", "phone_digits", "ddd", "label"),
        "contact_emails": ("email", "normalized_email", "label"),
    }
    key_columns = {
        "custom_field_values": ("contact_id", "field_id"),
    }

    for table, columns in text_columns.items():
        try:
            if connection.dialect == "postgres" and table in key_columns:
                rows = connection.execute(f"SELECT * FROM {table}").fetchall()
            else:
                selector = "id, *" if connection.dialect == "postgres" else "rowid, *"
                rows = connection.execute(f"SELECT {selector} FROM {table}").fetchall()
        except Exception:
            continue
        for row in rows:
            changes = {}
            for column in columns:
                try:
                    value = row[column]
                except (KeyError, IndexError):
                    continue
                if isinstance(value, str):
                    repaired = repair_mojibake(value)
                    if repaired != value:
                        changes[column] = repaired
            if changes:
                assignments = ", ".join(f"{column} = ?" for column in changes)
                if table in key_columns and connection.dialect == "postgres":
                    params = tuple(changes.values()) + tuple(row[column] for column in key_columns[table])
                    where_clause = " AND ".join(f"{column} = ?" for column in key_columns[table])
                else:
                    key_column = "id" if "id" in row.keys() else "rowid"
                    params = tuple(changes.values()) + (row[key_column],)
                    where_clause = f"{key_column} = ?"
                connection.execute(f"UPDATE {table} SET {assignments} WHERE {where_clause}", params)


DISPLAY_TEXT_REPLACEMENTS = (
    ("Sao Paulo", "São Paulo"),
    ("Minha regiao", "Minha região"),
    ("Indicacao", "Indicação"),
    ("Casa e manutencao", "Casa e manutenção"),
    ("Servicos domesticos", "Serviços domésticos"),
    ("Juridico", "Jurídico"),
    ("Servicos profissionais", "Serviços profissionais"),
    ("Saude", "Saúde"),
    ("Empresas e negocios", "Empresas e negócios"),
    ("Operacao", "Operação"),
    ("Educacao", "Educação"),
    ("Veiculos", "Veículos"),
    ("Beleza e estetica", "Beleza e estética"),
    ("Alimentacao e eventos", "Alimentação e eventos"),
    ("Experiencias", "Experiências"),
    ("Imoveis", "Imóveis"),
    ("Moradia e patrimonio", "Moradia e patrimônio"),
    ("Financas e seguros", "Finanças e seguros"),
    ("Comunicacao e conteudo", "Comunicação e conteúdo"),
    ("Servicos gerais", "Serviços gerais"),
    ("Rede util", "Rede útil"),
    ("Rede juridica", "Rede jurídica"),
    ("pequenos negocios", "pequenos negócios"),
    ("Tecnologia para negocios", "Tecnologia para negócios"),
    ("automacao", "automação"),
    ("manutencao", "manutenção"),
    ("instalacao", "instalação"),
    ("juridico", "jurídico"),
    ("societario", "societário"),
    ("Follow-up concluido", "Follow-up concluído"),
    ("Follow-up removido", "Follow-up removido"),
)


def standardize_display_text(connection: DbConnection) -> None:
    columns_by_table = {
        "contacts": (
            "city", "address", "source", "description", "demand", "solves", "tags",
            "crm_status", "crm_priority", "crm_note", "category_label", "category_group",
        ),
        "users": (
            "address", "address_line", "address_complement", "neighborhood", "city",
            "service_address", "service_address_line", "service_address_complement",
            "service_neighborhood", "service_city", "public_description", "public_demand",
            "public_solves", "public_tags", "offered_services",
        ),
        "public_profiles": ("name", "service", "area", "category_label", "category_group"),
        "tags": ("name",),
        "custom_fields": ("name",),
        "custom_field_values": ("value",),
    }
    for table, columns in columns_by_table.items():
        try:
            rows = connection.execute(f"SELECT id, * FROM {table}" if connection.dialect == "postgres" else f"SELECT rowid, * FROM {table}").fetchall()
        except Exception:
            continue
        for row in rows:
            changes = {}
            for column in columns:
                try:
                    value = row[column]
                except (KeyError, IndexError):
                    continue
                if not isinstance(value, str) or not value:
                    continue
                next_value = value
                for source, target in DISPLAY_TEXT_REPLACEMENTS:
                    next_value = next_value.replace(source, target)
                if next_value != value:
                    changes[column] = next_value
            if changes:
                assignments = ", ".join(f"{column} = ?" for column in changes)
                key_column = "id" if "id" in row.keys() else "rowid"
                params = tuple(changes.values()) + (row[key_column],)
                connection.execute(f"UPDATE {table} SET {assignments} WHERE {key_column} = ?", params)


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
                "address": "Avenida Paulista, Bela Vista, São Paulo - SP",
                "city": "São Paulo",
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
    generated_services.add(normalize("serviços gerais"))
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


def extract_ddd(value: str) -> str:
    digits = phone_digits(value)
    if digits.startswith("55") and len(digits) >= 12:
        digits = digits[2:]
    if len(digits) >= 10:
        return digits[:2]
    return ""


def split_multi_value(value: Any) -> list[str]:
    if isinstance(value, list):
        raw_values = value
    else:
        raw_values = re.split(r"[,;\n|]+", str(value or ""))
    results: list[str] = []
    seen: set[str] = set()
    for raw in raw_values:
        item = str(raw or "").strip()
        key = normalize(item)
        if item and key and key not in seen:
            seen.add(key)
            results.append(item)
    return results


def field_key(value: str) -> str:
    normalized = normalize(value)
    key = re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")
    return key or "campo"


def normalized_email(value: str) -> str:
    return str(value or "").strip().lower()


def payload_phone_items(payload: dict) -> list[dict]:
    candidates: list[tuple[str, str]] = []
    phones = payload.get("phones") or []
    if isinstance(phones, list):
        for item in phones:
            if isinstance(item, dict):
                candidates.append((item.get("phone") or item.get("value") or "", item.get("label") or "Telefone"))
            else:
                candidates.append((str(item), "Telefone"))
    candidates.insert(0, (payload.get("phone") or "", "Principal"))
    if payload.get("whatsapp"):
        candidates.append((payload.get("whatsapp") or "", "WhatsApp"))

    results: list[dict] = []
    seen: set[str] = set()
    for phone, label in candidates:
        digits = phone_digits(phone)
        if len(digits) < 4 or digits in seen:
            continue
        seen.add(digits)
        results.append({"phone": str(phone).strip(), "phone_digits": digits, "ddd": extract_ddd(phone), "label": label or "Telefone"})
    return results


def payload_email_items(payload: dict) -> list[dict]:
    candidates: list[tuple[str, str]] = []
    emails = payload.get("emails") or []
    if isinstance(emails, list):
        for item in emails:
            if isinstance(item, dict):
                candidates.append((item.get("email") or item.get("value") or "", item.get("label") or "Email"))
            else:
                candidates.append((str(item), "Email"))
    candidates.insert(0, (payload.get("email") or "", "Principal"))

    results: list[dict] = []
    seen: set[str] = set()
    for email, label in candidates:
        normalized = normalized_email(email)
        if "@" not in normalized or normalized in seen:
            continue
        seen.add(normalized)
        results.append({"email": str(email).strip(), "normalized_email": normalized, "label": label or "Email"})
    return results


def contact_identity_candidates(connection: DbConnection, contact_id: int, owner_id: str, payload: dict | None = None) -> tuple[set[str], set[str]]:
    emails = set()
    phones = set()
    if payload is not None:
        emails.update(item["normalized_email"] for item in payload_email_items(payload) if item["normalized_email"])
        phones.update(item["phone_digits"] for item in payload_phone_items(payload) if item["phone_digits"])

    for row in connection.execute(
        "SELECT normalized_email FROM contact_emails WHERE contact_id = ? AND owner_id = ?",
        (contact_id, owner_id),
    ).fetchall():
        if row["normalized_email"]:
            emails.add(str(row["normalized_email"]).strip().lower())

    for row in connection.execute(
        "SELECT phone_digits FROM contact_phones WHERE contact_id = ? AND owner_id = ?",
        (contact_id, owner_id),
    ).fetchall():
        digits = str(row["phone_digits"] or "").strip()
        if digits:
            phones.add(digits)

    return emails, phones


def resolve_contact_platform_user(connection: DbConnection, owner_id: str, contact_id: int, payload: dict | None = None):
    emails, phones = contact_identity_candidates(connection, contact_id, owner_id, payload)

    for email in sorted(emails):
        user = find_user_by_email(connection, email)
        if user is not None and str(user["id"]) != str(owner_id):
            return user

    for digits in sorted(phones):
        user = connection.execute("SELECT * FROM users WHERE phone_digits = ?", (digits,)).fetchone()
        if user is not None and str(user["id"]) != str(owner_id):
            return user

    return None


def sync_contact_platform_link(connection: DbConnection, contact_id: int, owner_id: str, payload: dict | None = None) -> None:
    linked_user = resolve_contact_platform_user(connection, owner_id, contact_id, payload)
    connection.execute(
        """
        UPDATE contacts
        SET linked_user_id = ?,
            linked_user_name = ?,
            linked_user_email = ?
        WHERE id = ? AND owner_id = ?
        """,
        (
            str(linked_user["id"]) if linked_user is not None else "",
            str(linked_user["name"]) if linked_user is not None else "",
            str(linked_user["email"]) if linked_user is not None else "",
            contact_id,
            owner_id,
        ),
    )


def payload_tag_items(payload: dict) -> list[str]:
    values = split_multi_value(payload.get("tags") or "")
    for item in payload.get("tag_items") or []:
        values.extend(split_multi_value(item.get("name") if isinstance(item, dict) else item))
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        key = normalize(value)
        if key and key not in seen:
            seen.add(key)
            deduped.append(value)
    return deduped


def payload_custom_field_items(payload: dict) -> list[dict]:
    values: list[dict] = []
    incoming = payload.get("custom_field_values") or []
    if isinstance(incoming, list):
        values.extend(item for item in incoming if isinstance(item, dict))

    try:
        legacy = json.loads(payload.get("custom_fields") or "[]")
    except (TypeError, json.JSONDecodeError):
        legacy = []
    if isinstance(legacy, list):
        values.extend(item for item in legacy if isinstance(item, dict))

    results: list[dict] = []
    seen: set[str] = set()
    for item in values:
        name = str(item.get("name") or item.get("label") or item.get("key") or "").strip()
        raw_value = item.get("value", "")
        if isinstance(raw_value, list):
            value = json.dumps([str(entry).strip() for entry in raw_value if str(entry).strip()], ensure_ascii=False)
        elif isinstance(raw_value, bool):
            value = "true" if raw_value else "false"
        elif raw_value is None:
            value = ""
        else:
            value = str(raw_value).strip()
        if not name or value == "" or value == "[]":
            continue
        key = field_key(str(item.get("key") or name))
        scope_type = str(item.get("scope_type") or "user").strip().lower() or "user"
        scope_id = str(item.get("scope_id") or "").strip()
        unique_key = f"{scope_type}:{scope_id}:{key}"
        if unique_key in seen:
            continue
        seen.add(unique_key)
        field_type = str(item.get("field_type") or item.get("type") or "text_short")
        options = item.get("options") if isinstance(item.get("options"), list) else []
        results.append(
            {
                "name": name,
                "field_key": key,
                "field_type": field_type,
                "options": options,
                "value": value,
                "scope_type": scope_type,
                "scope_id": scope_id,
            }
        )
    return results


def custom_field_search_blob(payload: dict) -> str:
    parts: list[str] = []
    for item in payload_custom_field_items(payload):
        name = str(item.get("name") or item.get("label") or item.get("key") or "").strip()
        key = str(item.get("key") or "").strip()
        value = str(item.get("value") or "").strip()
        if name:
            parts.append(name)
        if key and key != name:
            parts.append(key)
        if value:
            parts.append(value)
    return " ".join(parts)


def upsert_tag(connection: DbConnection, owner_id: str, name: str) -> int:
    normalized_name = normalize(name)
    connection.execute(
        """
        INSERT INTO tags (owner_id, name, normalized_name)
        VALUES (?, ?, ?)
        ON CONFLICT(owner_id, normalized_name) DO UPDATE SET name = excluded.name
        """,
        (owner_id, name, normalized_name),
    )
    row = connection.execute("SELECT id FROM tags WHERE owner_id = ? AND normalized_name = ?", (owner_id, normalized_name)).fetchone()
    return int(first_value(row))


def upsert_custom_field(connection: DbConnection, owner_id: str, item: dict) -> int:
    options = json.dumps(item.get("options") or [], ensure_ascii=False)
    scope_type = str(item.get("scope_type") or "user").strip().lower() or "user"
    scope_id = str(item.get("scope_id") or "").strip()
    connection.execute(
        """
        INSERT INTO custom_fields (owner_id, scope_type, scope_id, name, field_key, field_type, options)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_id, scope_type, scope_id, field_key)
        DO UPDATE SET name = excluded.name, field_type = excluded.field_type, options = excluded.options
        """,
        (owner_id, scope_type, scope_id, item["name"], item["field_key"], item["field_type"], options),
    )
    row = connection.execute(
        "SELECT id FROM custom_fields WHERE owner_id = ? AND scope_type = ? AND scope_id = ? AND field_key = ?",
        (owner_id, scope_type, scope_id, item["field_key"]),
    ).fetchone()
    return int(first_value(row))


def row_to_custom_field(row) -> dict:
    return {
        "id": int(row["id"]),
        "owner_id": str(row["owner_id"]),
        "scope_type": str(row["scope_type"] or "user"),
        "scope_id": str(row["scope_id"] or ""),
        "name": str(row["name"]),
        "field_key": str(row["field_key"]),
        "field_type": str(row["field_type"] or "text_short"),
        "options": json.loads(row["options"] or "[]"),
        "created_at": row_text(row["created_at"]),
    }


def list_custom_fields(connection: DbConnection, owner_id: str, scope_type: str = "user", scope_id: str = "") -> list[dict]:
    rows = connection.execute(
        """
        SELECT * FROM custom_fields
        WHERE owner_id = ? AND scope_type = ? AND scope_id = ?
        ORDER BY datetime(created_at) ASC, id ASC
        """,
        (str(owner_id), str(scope_type or "user"), str(scope_id or "")),
    ).fetchall()
    return [row_to_custom_field(row) for row in rows]


def get_custom_field(connection: DbConnection, field_id: int) -> dict | None:
    row = connection.execute("SELECT * FROM custom_fields WHERE id = ?", (field_id,)).fetchone()
    return row_to_custom_field(row) if row is not None else None


def save_custom_field_definition(connection: DbConnection, owner_id: str, payload: dict, field_id: int | None = None) -> dict:
    scope_type = str(payload.get("scope_type") or "user").strip().lower() or "user"
    scope_id = str(payload.get("scope_id") or "").strip()
    name = str(payload.get("name") or "").strip()
    if not name:
        raise ValueError("Informe o nome do campo.")
    field_type = str(payload.get("field_type") or "text_short").strip() or "text_short"
    options = [str(item).strip() for item in (payload.get("options") or []) if str(item).strip()]
    key = field_key(str(payload.get("field_key") or name))
    if field_id is None:
        upsert_custom_field(
            connection,
            owner_id,
            {
                "name": name,
                "field_key": key,
                "field_type": field_type,
                "options": options,
                "scope_type": scope_type,
                "scope_id": scope_id,
            },
        )
        row = connection.execute(
            "SELECT * FROM custom_fields WHERE owner_id = ? AND scope_type = ? AND scope_id = ? AND field_key = ?",
            (owner_id, scope_type, scope_id, key),
        ).fetchone()
    else:
        cursor = connection.execute(
            """
            UPDATE custom_fields
            SET name = ?, field_key = ?, field_type = ?, options = ?, scope_type = ?, scope_id = ?
            WHERE id = ? AND owner_id = ?
            """,
            (name, key, field_type, json.dumps(options, ensure_ascii=False), scope_type, scope_id, field_id, owner_id),
        )
        if cursor.rowcount == 0:
            raise ValueError("Campo personalizado não encontrado.")
        row = connection.execute("SELECT * FROM custom_fields WHERE id = ?", (field_id,)).fetchone()
    return row_to_custom_field(row)


def delete_custom_field_definition(connection: DbConnection, owner_id: str, field_id: int) -> bool:
    connection.execute(
        "DELETE FROM custom_field_values WHERE field_id IN (SELECT id FROM custom_fields WHERE id = ? AND owner_id = ?)",
        (field_id, owner_id),
    )
    cursor = connection.execute("DELETE FROM custom_fields WHERE id = ? AND owner_id = ?", (field_id, owner_id))
    return cursor.rowcount > 0


def sync_custom_field_values_for_scope(
    connection: DbConnection,
    *,
    contact_id: int,
    contact_owner_id: str,
    field_owner_id: str,
    scope_type: str,
    scope_id: str,
    items: list[dict],
) -> None:
    definition_rows = connection.execute(
        """
        SELECT id FROM custom_fields
        WHERE owner_id = ? AND scope_type = ? AND scope_id = ?
        """,
        (field_owner_id, scope_type, scope_id),
    ).fetchall()
    definition_ids = [int(row["id"]) for row in definition_rows]
    if definition_ids:
        placeholders = ",".join("?" for _ in definition_ids)
        connection.execute(
            f"DELETE FROM custom_field_values WHERE contact_id = ? AND owner_id = ? AND field_id IN ({placeholders})",
            (contact_id, contact_owner_id, *definition_ids),
        )

    for item in items:
        field_id = upsert_custom_field(connection, field_owner_id, item)
        connection.execute(
            """
            INSERT INTO custom_field_values (contact_id, field_id, owner_id, value)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(contact_id, field_id) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            """,
            (contact_id, field_id, contact_owner_id, item["value"]),
        )


def sync_contact_structures(connection: DbConnection, contact_id: int, payload: dict, refresh_tag_counts: bool = True) -> None:
    owner_id = str(payload.get("owner_id") or "demo-user")
    connection.execute("DELETE FROM contact_phones WHERE contact_id = ? AND owner_id = ?", (contact_id, owner_id))
    connection.execute("DELETE FROM contact_emails WHERE contact_id = ? AND owner_id = ?", (contact_id, owner_id))
    connection.execute("DELETE FROM contact_tags WHERE contact_id = ? AND owner_id = ?", (contact_id, owner_id))

    for index, item in enumerate(payload_phone_items(payload)):
        connection.execute(
            """
            INSERT INTO contact_phones (contact_id, owner_id, phone, phone_digits, ddd, label, is_primary)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(contact_id, phone_digits) DO UPDATE
            SET phone = excluded.phone, ddd = excluded.ddd, label = excluded.label, is_primary = excluded.is_primary
            """,
            (contact_id, owner_id, item["phone"], item["phone_digits"], item["ddd"], item["label"], db_bool(connection, index == 0)),
        )

    for index, item in enumerate(payload_email_items(payload)):
        connection.execute(
            """
            INSERT INTO contact_emails (contact_id, owner_id, email, normalized_email, label, is_primary)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(contact_id, normalized_email) DO UPDATE
            SET email = excluded.email, label = excluded.label, is_primary = excluded.is_primary
            """,
            (contact_id, owner_id, item["email"], item["normalized_email"], item["label"], db_bool(connection, index == 0)),
        )

    for tag in payload_tag_items(payload):
        tag_id = upsert_tag(connection, owner_id, tag)
        connection.execute(
            """
            INSERT INTO contact_tags (contact_id, tag_id, owner_id)
            VALUES (?, ?, ?)
            ON CONFLICT(contact_id, tag_id) DO NOTHING
            """,
            (contact_id, tag_id, owner_id),
        )

    user_scope_fields = [
        item
        for item in payload_custom_field_items(payload)
        if str(item.get("scope_type") or "user") == "user" and str(item.get("scope_id") or "") == ""
    ]
    sync_custom_field_values_for_scope(
        connection,
        contact_id=contact_id,
        contact_owner_id=owner_id,
        field_owner_id=owner_id,
        scope_type="user",
        scope_id="",
        items=user_scope_fields,
    )

    sync_contact_platform_link(connection, contact_id, owner_id, payload)
    if refresh_tag_counts:
        refresh_tag_usage(connection, owner_id)


def sync_owner_contact_platform_links(connection: DbConnection, owner_id: str) -> None:
    rows = connection.execute("SELECT id, owner_id FROM contacts WHERE owner_id = ?", (owner_id,)).fetchall()
    for row in rows:
        sync_contact_platform_link(connection, int(row["id"]), str(row["owner_id"]))


def refresh_tag_usage(connection: DbConnection, owner_id: str) -> None:
    rows = connection.execute("SELECT id FROM tags WHERE owner_id = ?", (owner_id,)).fetchall()
    for row in rows:
        tag_id = int(row["id"])
        count = first_value(connection.execute("SELECT COUNT(*) FROM contact_tags WHERE owner_id = ? AND tag_id = ?", (owner_id, tag_id)).fetchone()) or 0
        connection.execute("UPDATE tags SET usage_count = ? WHERE id = ?", (count, tag_id))


def sync_all_contact_structures(connection: DbConnection) -> None:
    rows = connection.execute("SELECT * FROM contacts").fetchall()
    for row in rows:
        sync_contact_structures(connection, int(row["id"]), row_to_payload(row))


def row_to_payload(row) -> dict:
    return {
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
        "demand_tags": row["demand_tags"] or "",
        "solves": row["solves"],
        "tags": row["tags"],
        "email": row["email"],
        "whatsapp": row["whatsapp"],
        "instagram": row["instagram"],
        "linkedin": row["linkedin"],
        "organization": row["organization"] or "",
        "custom_url": row["custom_url"],
        "avatar_url": row["avatar_url"],
        "custom_fields": row["custom_fields"],
        "crm_status": row["crm_status"],
        "crm_priority": row["crm_priority"],
        "last_contact_at": row["last_contact_at"],
        "next_follow_up_at": row["next_follow_up_at"],
        "crm_note": row["crm_note"],
    }


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
    notification_preference = str(payload.get("notification_preference") or "relevant")
    if notification_preference not in {"relevant", "low_in_app", "irrelevant"}:
        notification_preference = "relevant"
    avatar_url = str(payload.get("avatar_url") or payload.get("picture") or "").strip()
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
        db_bool(connection, payload.get("address_visible")),
        interests,
        db_bool(connection, payload.get("is_collaborator")),
        payload.get("offered_services") or "",
        db_bool(connection, payload.get("use_different_service_address")),
        payload.get("service_cep") or "",
        payload.get("service_address") or "",
        payload.get("service_address_line") or "",
        payload.get("service_address_number") or "",
        payload.get("service_address_complement") or "",
        payload.get("service_neighborhood") or "",
        payload.get("service_city") or "",
        payload.get("service_state") or "",
        db_bool(connection, payload.get("service_address_visible", True)),
        db_bool(connection, payload.get("public_visible")),
        payload.get("public_description") or "",
        payload.get("public_demand") or "",
        payload.get("public_solves") or "",
        payload.get("public_tags") or "",
        payload.get("public_whatsapp") or "",
        payload.get("public_instagram") or "",
        payload.get("public_linkedin") or "",
        payload.get("public_url") or "",
        avatar_url,
        db_bool(connection, payload.get("google_connected")),
        payload.get("google_contacts_imported_at") or "",
        payload.get("google_profile_synced_at") or "",
        notification_preference,
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
          public_solves, public_tags, public_whatsapp, public_instagram, public_linkedin, public_url, avatar_url,
          google_connected, google_contacts_imported_at, google_profile_synced_at, notification_preference, role
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          avatar_url = excluded.avatar_url,
          google_connected = excluded.google_connected,
          google_contacts_imported_at = excluded.google_contacts_imported_at,
          google_profile_synced_at = excluded.google_profile_synced_at,
          notification_preference = excluded.notification_preference,
          role = excluded.role
        """,
        values,
    )
    return connection.execute("SELECT * FROM users WHERE email = ?", (payload["email"],)).fetchone()


def upsert_google_user(connection: DbConnection, payload: dict):
    existing = connection.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (payload["email"],)).fetchone()
    avatar_url = str(payload.get("picture") or payload.get("avatar_url") or "").strip()
    if existing is not None:
        connection.execute(
            """
            UPDATE users
            SET google_connected = true,
                google_profile_synced_at = COALESCE(NULLIF(google_profile_synced_at, ''), CURRENT_TIMESTAMP),
                avatar_url = COALESCE(NULLIF(?, ''), avatar_url)
            WHERE id = ?
            """,
            (avatar_url, existing["id"]),
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
          public_solves, public_tags, public_whatsapp, public_instagram, public_linkedin, public_url, avatar_url,
          google_connected, google_profile_synced_at, notification_preference, role
        )
        VALUES (?, '', ?, ?, '', ?, '', '', '', '', false, '[]', false, '', '', true, false, '', '', '', '', '', '', '', '', ?, true, CURRENT_TIMESTAMP, 'relevant', 'user')
        """,
        (payload["name"], payload["email"], password_hash, phone_digits_value, avatar_url),
    )
    return connection.execute("SELECT * FROM users WHERE email = ?", (payload["email"],)).fetchone()


def upsert_auth_user(connection: DbConnection, payload: dict):
    provider = str(payload.get("auth_provider") or payload.get("provider") or "").strip().lower()
    existing = connection.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (payload["email"],)).fetchone()
    avatar_url = str(payload.get("picture") or payload.get("avatar_url") or "").strip()
    google_connected = provider == "google"
    if existing is not None:
        values = [db_bool(connection, google_connected), avatar_url, existing["id"]]
        connection.execute(
            """
            UPDATE users
            SET google_connected = CASE
                    WHEN ? THEN true
                    ELSE google_connected
                END,
                avatar_url = COALESCE(NULLIF(?, ''), avatar_url)
            WHERE id = ?
            """,
            tuple(values),
        )
        return connection.execute("SELECT * FROM users WHERE id = ?", (existing["id"],)).fetchone()

    password_hash = hash_password(secrets.token_urlsafe(24))
    raw_sub = str(payload.get("sub") or "").strip()
    phone_digits_value = f"auth:{raw_sub}" if raw_sub else f"auth:{secrets.token_urlsafe(12)}"
    display_name = str(payload.get("name") or payload["email"].split("@", 1)[0]).strip() or payload["email"]
    connection.execute(
        """
        INSERT INTO users (
          name, birth_date, email, password_hash, phone, phone_digits, cep, address,
          city, state, address_visible, interests, is_collaborator, offered_services,
          service_address, service_address_visible, public_visible, public_description, public_demand,
          public_solves, public_tags, public_whatsapp, public_instagram, public_linkedin, public_url, avatar_url,
          google_connected, google_profile_synced_at, notification_preference, role
        )
        VALUES (?, '', ?, ?, '', ?, '', '', '', '', false, '[]', false, '', '', true, false, '', '', '', '', '', '', '', '', ?, ?, '', 'relevant', 'user')
        """,
        (display_name, payload["email"], password_hash, phone_digits_value, avatar_url, db_bool(connection, google_connected)),
    )
    return connection.execute("SELECT * FROM users WHERE email = ?", (payload["email"],)).fetchone()


def find_user_by_phone(connection: DbConnection, phone: str):
    digits = phone_digits(phone)
    if not digits:
        return None
    return connection.execute("SELECT * FROM users WHERE phone_digits = ?", (digits,)).fetchone()


def find_user_by_email(connection: DbConnection, email: str):
    normalized = str(email or "").strip()
    if not normalized:
        return None
    return connection.execute("SELECT * FROM users WHERE lower(email) = lower(?)", (normalized,)).fetchone()


def find_user_by_id(connection: DbConnection, user_id: str | int | None):
    if user_id in (None, ""):
        return None
    return connection.execute("SELECT * FROM users WHERE id = ?", (str(user_id),)).fetchone()


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
        "avatar_url": row["avatar_url"],
        "google_connected": bool(row["google_connected"]),
        "google_contacts_imported_at": row["google_contacts_imported_at"],
        "google_profile_synced_at": row["google_profile_synced_at"],
        "notification_preference": row["notification_preference"],
        "role": row["role"],
    }


def insert_contact(connection: DbConnection, payload: dict, refresh_tag_counts: bool = True):
    owner_id = str(payload.get("owner_id") or "demo-user")
    note = payload.get("note") or ""
    incoming_service = payload.get("service")
    generated_services = {normalize(category.label) for category in CATEGORY_CATALOG}
    generated_services.add(normalize("contato para revisar"))
    generated_services.add(normalize("serviços gerais"))
    if payload.get("source") == "Google People API" and normalize(incoming_service) in generated_services:
        service = infer_service_from_contact(payload["name"], "", note, "")
    else:
        service = infer_service_from_contact(payload["name"], incoming_service, note, payload.get("source"))
    category = classify_service(" ".join([service, payload["name"], note, payload.get("source") or ""]))
    city = payload.get("city") or "Minha região"
    address = payload.get("address") or city
    trust = payload.get("trust") or "Novo"
    source = payload.get("source") or "Manual"
    description = payload.get("description") or ""
    demand = payload.get("demand") or ""
    demand_tags = payload.get("demand_tags") or ""
    solves = payload.get("solves") or ""
    tags = payload.get("tags") or ""
    email = payload.get("email") or ""
    whatsapp = payload.get("whatsapp") or ""
    instagram = payload.get("instagram") or ""
    linkedin = payload.get("linkedin") or ""
    organization = payload.get("organization") or ""
    custom_url = payload.get("custom_url") or ""
    avatar_url = payload.get("avatar_url") or ""
    custom_fields = payload.get("custom_fields") or "[]"
    custom_field_blob = custom_field_search_blob(payload)
    crm_status = payload.get("crm_status") or "Novo"
    crm_priority = payload.get("crm_priority") or "Média"
    last_contact_at = payload.get("last_contact_at") or ""
    next_follow_up_at = payload.get("next_follow_up_at") or ""
    crm_note = payload.get("crm_note") or ""
    search_text = normalize(" ".join([payload["name"], payload["phone"], service, note, city, address, trust, source, description, demand, demand_tags, solves, tags, email, whatsapp, instagram, linkedin, organization, custom_url, avatar_url, custom_fields, custom_field_blob, crm_status, crm_priority, crm_note, category.label, category.group]))

    returning_clause = " RETURNING id" if connection.dialect == "postgres" else ""
    cursor = connection.execute(
        f"""
        INSERT INTO contacts (
            owner_id, name, phone, service, note, city, address, trust, source,
            description, demand, demand_tags, solves, tags, email, whatsapp, instagram, linkedin, organization, custom_url, avatar_url, custom_fields,
            crm_status, crm_priority, last_contact_at, next_follow_up_at, crm_note,
            category_id, category_label, category_group, search_text
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            demand_tags,
            solves,
            tags,
            email,
            whatsapp,
            instagram,
            linkedin,
            organization,
            custom_url,
            avatar_url,
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
    sync_payload = {
        **payload,
        "owner_id": owner_id,
        "phone": payload["phone"],
        "service": service,
        "note": note,
        "city": city,
        "address": address,
        "trust": trust,
        "source": source,
        "description": description,
        "demand": demand,
        "demand_tags": demand_tags,
        "solves": solves,
        "tags": tags,
        "email": email,
        "whatsapp": whatsapp,
        "instagram": instagram,
        "linkedin": linkedin,
        "organization": organization,
        "custom_url": custom_url,
        "avatar_url": avatar_url,
        "custom_fields": custom_fields,
        "crm_status": crm_status,
        "crm_priority": crm_priority,
        "last_contact_at": last_contact_at,
        "next_follow_up_at": next_follow_up_at,
        "crm_note": crm_note,
    }
    sync_contact_structures(connection, int(contact_id), sync_payload, refresh_tag_counts=refresh_tag_counts)
    return connection.execute("SELECT * FROM contacts WHERE id = ?", (contact_id,)).fetchone()


def update_contact(connection: DbConnection, contact_id: int, payload: dict):
    owner_id = str(payload.get("owner_id") or "demo-user")
    note = payload.get("note") or ""
    service = infer_service_from_contact(payload["name"], payload.get("service"), note, payload.get("source"))
    category = classify_service(" ".join([service, payload["name"], note, payload.get("source") or ""]))
    city = payload.get("city") or "Minha região"
    address = payload.get("address") or city
    trust = payload.get("trust") or "Novo"
    source = payload.get("source") or "Manual"
    description = payload.get("description") or ""
    demand = payload.get("demand") or ""
    demand_tags = payload.get("demand_tags") or ""
    solves = payload.get("solves") or ""
    tags = payload.get("tags") or ""
    email = payload.get("email") or ""
    whatsapp = payload.get("whatsapp") or ""
    instagram = payload.get("instagram") or ""
    linkedin = payload.get("linkedin") or ""
    organization = payload.get("organization") or ""
    custom_url = payload.get("custom_url") or ""
    avatar_url = payload.get("avatar_url") or ""
    custom_fields = payload.get("custom_fields") or "[]"
    custom_field_blob = custom_field_search_blob(payload)
    crm_status = payload.get("crm_status") or "Novo"
    crm_priority = payload.get("crm_priority") or "Média"
    last_contact_at = payload.get("last_contact_at") or ""
    next_follow_up_at = payload.get("next_follow_up_at") or ""
    crm_note = payload.get("crm_note") or ""
    search_text = normalize(" ".join([payload["name"], payload["phone"], service, note, city, address, trust, source, description, demand, demand_tags, solves, tags, email, whatsapp, instagram, linkedin, organization, custom_url, avatar_url, custom_fields, custom_field_blob, crm_status, crm_priority, crm_note, category.label, category.group]))

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
            demand_tags = ?,
            solves = ?,
            tags = ?,
            email = ?,
            whatsapp = ?,
            instagram = ?,
            linkedin = ?,
            organization = ?,
            custom_url = ?,
            avatar_url = ?,
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
            demand_tags,
            solves,
            tags,
            email,
            whatsapp,
            instagram,
            linkedin,
            organization,
            custom_url,
            avatar_url,
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
    sync_payload = {
        **payload,
        "owner_id": owner_id,
        "phone": payload["phone"],
        "service": service,
        "note": note,
        "city": city,
        "address": address,
        "trust": trust,
        "source": source,
        "description": description,
        "demand": demand,
        "demand_tags": demand_tags,
        "solves": solves,
        "tags": tags,
        "email": email,
        "whatsapp": whatsapp,
        "instagram": instagram,
        "linkedin": linkedin,
        "organization": organization,
        "custom_url": custom_url,
        "avatar_url": avatar_url,
        "custom_fields": custom_fields,
        "crm_status": crm_status,
        "crm_priority": crm_priority,
        "last_contact_at": last_contact_at,
        "next_follow_up_at": next_follow_up_at,
        "crm_note": crm_note,
    }
    sync_contact_structures(connection, contact_id, sync_payload)
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
                        "primary_contact": row_to_contact(primary if primary["id"] == primary_id else duplicate, connection),
                        "duplicate_contact": row_to_contact(duplicate if duplicate["id"] == duplicate_id else primary, connection),
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
        "demand_tags": choose("demand_tags"),
        "solves": choose("solves"),
        "tags": merged_tags,
        "email": choose("email"),
        "whatsapp": choose("whatsapp"),
        "instagram": choose("instagram"),
        "linkedin": choose("linkedin"),
        "organization": choose("organization"),
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
    connection.execute("DELETE FROM contact_phones WHERE owner_id = ? AND contact_id = ?", (owner_id, duplicate_id))
    connection.execute("DELETE FROM contact_emails WHERE owner_id = ? AND contact_id = ?", (owner_id, duplicate_id))
    connection.execute("DELETE FROM contact_tags WHERE owner_id = ? AND contact_id = ?", (owner_id, duplicate_id))
    connection.execute("DELETE FROM custom_field_values WHERE owner_id = ? AND contact_id = ?", (owner_id, duplicate_id))
    connection.execute("DELETE FROM contacts WHERE owner_id = ? AND id = ?", (owner_id, duplicate_id))
    refresh_tag_usage(connection, owner_id)
    return connection.execute("SELECT * FROM contacts WHERE id = ?", (primary_id,)).fetchone()


def contact_structured_data(connection: DbConnection | None, row) -> dict:
    fallback_phone = {
        "phone": row["phone"],
        "phone_digits": phone_digits(row["phone"]),
        "ddd": extract_ddd(row["phone"]),
        "label": "Principal",
        "is_primary": True,
    } if row["phone"] else None
    fallback_email = {
        "email": row["email"],
        "normalized_email": normalized_email(row["email"]),
        "label": "Principal",
        "is_primary": True,
    } if row["email"] else None
    fallback_tags = tag_list = split_multi_value(row["tags"])
    fallback_fields = payload_custom_field_items({"custom_fields": row["custom_fields"]})

    if connection is None:
        return {
            "phones": [fallback_phone] if fallback_phone else [],
            "emails": [fallback_email] if fallback_email else [],
            "tag_items": fallback_tags,
            "ddd": fallback_phone["ddd"] if fallback_phone else "",
            "custom_field_values": fallback_fields,
        }

    phones = [
        {
            "phone": item["phone"],
            "phone_digits": item["phone_digits"],
            "ddd": item["ddd"],
            "label": item["label"],
            "is_primary": bool(item["is_primary"]),
        }
        for item in connection.execute(
            "SELECT * FROM contact_phones WHERE contact_id = ? AND owner_id = ? ORDER BY is_primary DESC, id ASC",
            (row["id"], row["owner_id"]),
        ).fetchall()
    ]
    emails = [
        {
            "email": item["email"],
            "normalized_email": item["normalized_email"],
            "label": item["label"],
            "is_primary": bool(item["is_primary"]),
        }
        for item in connection.execute(
            "SELECT * FROM contact_emails WHERE contact_id = ? AND owner_id = ? ORDER BY is_primary DESC, id ASC",
            (row["id"], row["owner_id"]),
        ).fetchall()
    ]
    tags = [
        item["name"]
        for item in connection.execute(
            """
            SELECT tags.name
            FROM contact_tags
            JOIN tags ON tags.id = contact_tags.tag_id
            WHERE contact_tags.contact_id = ? AND contact_tags.owner_id = ?
            ORDER BY tags.name ASC
            """,
            (row["id"], row["owner_id"]),
        ).fetchall()
    ]
    custom_fields = [
        {
            "id": item["field_id"],
            "owner_id": item["field_owner_id"],
            "name": item["name"],
            "label": item["name"],
            "key": item["field_key"],
            "field_type": item["field_type"],
            "scope_type": item["scope_type"],
            "scope_id": item["scope_id"],
            "options": json.loads(item["options"] or "[]"),
            "value": item["value"],
        }
        for item in connection.execute(
            """
            SELECT custom_field_values.field_id, custom_field_values.value, custom_fields.owner_id AS field_owner_id,
                   custom_fields.name, custom_fields.field_key, custom_fields.field_type,
                   custom_fields.scope_type, custom_fields.scope_id, custom_fields.options
            FROM custom_field_values
            JOIN custom_fields ON custom_fields.id = custom_field_values.field_id
            WHERE custom_field_values.contact_id = ? AND custom_field_values.owner_id = ?
            ORDER BY custom_fields.scope_type ASC, custom_fields.name ASC
            """,
            (row["id"], row["owner_id"]),
        ).fetchall()
    ]
    primary_phone = next((item for item in phones if item["is_primary"]), phones[0] if phones else fallback_phone)
    return {
        "phones": phones or ([fallback_phone] if fallback_phone else []),
        "emails": emails or ([fallback_email] if fallback_email else []),
        "tag_items": tags or fallback_tags,
        "ddd": primary_phone["ddd"] if primary_phone else "",
        "custom_field_values": custom_fields or fallback_fields,
    }


def normalize_link_identity(value: str | None) -> str:
    normalized = normalize(str(value or "").strip())
    if not normalized:
        return ""
    normalized = re.sub(r"^https?://", "", normalized)
    normalized = re.sub(r"^www\.", "", normalized)
    normalized = normalized.strip().strip("/")
    normalized = normalized.removeprefix("@")
    return normalized


def unique_normalized(values: list[str]) -> list[str]:
    seen: set[str] = set()
    results: list[str] = []
    for value in values:
        normalized = normalize(str(value or "").strip())
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        results.append(normalized)
    return results


def semantic_tokens(value: str | None) -> set[str]:
    return {token for token in re.split(r"[^a-z0-9]+", normalize(value or "")) if len(token) >= 3}


def contact_snapshot(row, structured: dict) -> dict:
    primary_phone_digits = {
        item["phone_digits"]
        for item in structured.get("phones") or []
        if str(item.get("phone_digits") or "").strip()
    }
    email_values = {
        str(item.get("normalized_email") or "").strip().lower()
        for item in structured.get("emails") or []
        if str(item.get("normalized_email") or "").strip()
    }
    tags = [str(item).strip() for item in structured.get("tag_items") or [] if str(item).strip()]
    demand_tags = split_multi_value(row["demand_tags"] or "")
    links = unique_normalized(
        [
            normalize_link_identity(row["instagram"]),
            normalize_link_identity(row["linkedin"]),
            normalize_link_identity(row["custom_url"]),
            normalize_link_identity(row["whatsapp"]),
        ]
    )
    return {
        "id": int(row["id"]),
        "owner_id": str(row["owner_id"]),
        "linked_user_id": str(row["linked_user_id"] or ""),
        "linked_user_name": str(row["linked_user_name"] or ""),
        "linked_user_email": str(row["linked_user_email"] or ""),
        "name": str(row["name"] or ""),
        "name_key": normalize(row["name"] or ""),
        "service": str(row["service"] or ""),
        "service_tokens": semantic_tokens(row["service"] or ""),
        "description": str(row["description"] or ""),
        "demand": str(row["demand"] or ""),
        "demand_tokens": semantic_tokens(" ".join([row["demand"] or "", row["demand_tags"] or ""])),
        "solves": str(row["solves"] or ""),
        "solve_tokens": semantic_tokens(" ".join([row["solves"] or "", row["service"] or ""])),
        "tags": tags,
        "tag_tokens": {normalize(tag) for tag in tags if normalize(tag)},
        "demand_tags": demand_tags,
        "demand_tag_tokens": {normalize(tag) for tag in demand_tags if normalize(tag)},
        "organization": str(row["organization"] or ""),
        "organization_tokens": semantic_tokens(row["organization"] or ""),
        "city": str(row["city"] or ""),
        "city_key": normalize(row["city"] or ""),
        "ddd": str(structured.get("ddd") or ""),
        "phone_digits": primary_phone_digits,
        "emails": email_values,
        "links": links,
        "category_id": str(row["category_id"] or ""),
        "category_label": str(row["category_label"] or ""),
        "category_group": str(row["category_group"] or ""),
    }


def build_user_identity_snapshot(row) -> dict:
    public_profile = row_to_public_user_profile(row)
    service = str(row["offered_services"] or row["public_solves"] or row["public_description"] or "")
    return {
        "user_id": str(row["id"]),
        "name": str(row["name"] or ""),
        "name_key": normalize(row["name"] or ""),
        "email": normalized_email(row["email"] or ""),
        "phone_digits": phone_digits(row["phone"] or ""),
        "links": unique_normalized(
            [
                normalize_link_identity(row["public_instagram"]),
                normalize_link_identity(row["public_linkedin"]),
                normalize_link_identity(row["public_url"]),
                normalize_link_identity(row["public_whatsapp"]),
            ]
        ),
        "city_key": normalize(row["city"] or row["service_city"] or ""),
        "service_tokens": semantic_tokens(service),
        "tag_tokens": semantic_tokens(row["public_tags"] or " ".join(public_profile.get("tags", "").split(","))),
        "public_profile": public_profile,
    }


def score_platform_match(contact: dict, user_snapshot: dict) -> tuple[int, str]:
    score = 0
    reasons: list[str] = []
    if contact["linked_user_id"] and contact["linked_user_id"] == user_snapshot["user_id"]:
        return 100, "Vínculo persistido com usuário da plataforma."
    if contact["linked_user_email"] and normalize(contact["linked_user_email"]) == user_snapshot["email"]:
        return 98, "Vínculo persistido por email com usuário da plataforma."
    if user_snapshot["email"] and user_snapshot["email"] in contact["emails"]:
        score += 90
        reasons.append("email igual")
    if user_snapshot["phone_digits"] and user_snapshot["phone_digits"] in contact["phone_digits"]:
        score += 88
        reasons.append("telefone igual")
    link_overlap = [value for value in contact["links"] if value in user_snapshot["links"]]
    if link_overlap:
        score += 72
        reasons.append("link social igual")
    if contact["name_key"] and user_snapshot["name_key"]:
        ratio = SequenceMatcher(None, contact["name_key"], user_snapshot["name_key"]).ratio()
        if ratio >= 0.94:
            score += 18
            reasons.append("nome muito próximo")
        elif ratio >= 0.88 and (contact["city_key"] and contact["city_key"] == user_snapshot["city_key"]):
            score += 14
            reasons.append("nome e cidade coerentes")
    if contact["service_tokens"] and user_snapshot["service_tokens"]:
        overlap = contact["service_tokens"] & user_snapshot["service_tokens"]
        if len(overlap) >= 2:
            score += 10
            reasons.append("serviço compatível")
    return score, ", ".join(reasons)


def score_public_profile_match(contact: dict, profile: dict) -> tuple[int, str]:
    source_user_id = str(profile.get("source_user_id") or "")
    score = 0
    reasons: list[str] = []
    if contact["linked_user_id"] and source_user_id and contact["linked_user_id"] == source_user_id:
        return 100, "Perfil público do usuário já vinculado à agenda."
    email = normalized_email(profile.get("email") or "")
    profile_phones = {
        phone_digits(profile.get("phone") or ""),
        phone_digits(profile.get("whatsapp") or ""),
    } - {""}
    profile_links = unique_normalized(
        [
            normalize_link_identity(profile.get("instagram") or ""),
            normalize_link_identity(profile.get("linkedin") or ""),
            normalize_link_identity(profile.get("custom_url") or ""),
        ]
    )
    if email and email in contact["emails"]:
        score += 90
        reasons.append("email igual")
    if profile_phones and contact["phone_digits"] & profile_phones:
        score += 88
        reasons.append("telefone igual")
    if profile_links and any(value in profile_links for value in contact["links"]):
        score += 72
        reasons.append("link social igual")
    profile_name = normalize(profile.get("name") or "")
    if contact["name_key"] and profile_name:
        ratio = SequenceMatcher(None, contact["name_key"], profile_name).ratio()
        if ratio >= 0.94:
            score += 16
            reasons.append("nome muito próximo")
    profile_tokens = semantic_tokens(" ".join([profile.get("service") or "", profile.get("solves") or "", profile.get("tags") or ""]))
    semantic_overlap = (contact["service_tokens"] | contact["solve_tokens"] | contact["tag_tokens"]) & profile_tokens
    if len(semantic_overlap) >= 2:
        score += 10
        reasons.append("atuação compatível")
    return score, ", ".join(reasons)


def contact_offer_signals_snapshot(contact: dict) -> set[str]:
    return set(contact["tag_tokens"]) | set(contact["service_tokens"]) | set(contact["solve_tokens"]) | set(contact["organization_tokens"])


def contact_need_signals_snapshot(contact: dict) -> set[str]:
    return set(contact["demand_tag_tokens"]) | set(contact["demand_tokens"])


def resolve_contact_match_metadata(connection: DbConnection | None, row, structured: dict) -> dict:
    if connection is None:
        return {"platform_match": None, "public_profile_match": None, "potential_matches": []}

    contact = contact_snapshot(row, structured)
    owner_id = contact["owner_id"]
    owner_user = find_user_by_id(connection, owner_id)
    owner_email = normalized_email(owner_user["email"]) if owner_user is not None else ""
    platform_match = None
    public_profile_match = None

    user_rows = connection.execute("SELECT * FROM users ORDER BY id ASC").fetchall()
    best_platform_score = 0
    for user_row in user_rows:
        if str(user_row["id"]) == owner_id:
            continue
        if owner_email and normalized_email(user_row["email"]) == owner_email:
            continue
        score, reason = score_platform_match(contact, build_user_identity_snapshot(user_row))
        if score > best_platform_score and score >= 72:
            best_platform_score = score
            platform_match = {
                "user_id": str(user_row["id"]),
                "name": str(user_row["name"] or ""),
                "email": str(user_row["email"] or ""),
                "confidence": min(score, 100),
                "reason": reason or "Compatibilidade estrutural com usuário da plataforma.",
            }

    profile_rows = connection.execute("SELECT * FROM public_profiles ORDER BY score DESC, people DESC, id DESC").fetchall()
    public_candidates = [row_to_public_profile(item) for item in profile_rows]
    public_candidates.extend(row_to_public_user_profile(item) for item in user_rows if bool(item["public_visible"]))
    best_public_score = 0
    for profile in public_candidates:
        if profile.get("kind") != "person":
            continue
        if platform_match and str(profile.get("source_user_id") or "") == str(platform_match["user_id"]):
            score = 100
            reason = "Perfil público do mesmo usuário já identificado."
        else:
            score, reason = score_public_profile_match(contact, profile)
        if score > best_public_score and score >= 72:
            best_public_score = score
            public_profile_match = {
                "profile_id": int(profile["id"]),
                "name": str(profile.get("name") or ""),
                "kind": str(profile.get("kind") or "person"),
                "source_user_id": profile.get("source_user_id"),
                "confidence": min(score, 100),
                "reason": reason or "Compatibilidade com perfil público.",
            }

    candidate_rows = connection.execute(
        "SELECT * FROM contacts WHERE owner_id = ? AND id != ? ORDER BY datetime(created_at) DESC, id DESC",
        (owner_id, int(row["id"])),
    ).fetchall()
    need_signals = contact_need_signals_snapshot(contact)
    offer_signals = contact_offer_signals_snapshot(contact)
    potential_matches: list[dict] = []
    for candidate_row in candidate_rows:
        candidate_structured = contact_structured_data(connection, candidate_row)
        candidate = contact_snapshot(candidate_row, candidate_structured)
        candidate_offer = contact_offer_signals_snapshot(candidate)
        candidate_need = contact_need_signals_snapshot(candidate)
        overlap = sorted((need_signals & candidate_offer) | (offer_signals & candidate_need))
        if not overlap:
            continue
        score = len(overlap) * 26
        if contact["city_key"] and contact["city_key"] == candidate["city_key"]:
            score += 8
        if contact["ddd"] and contact["ddd"] == candidate["ddd"]:
            score += 6
        if candidate["linked_user_id"]:
            score += 5
        direction = "resolve demandas parecidas"
        if need_signals & candidate_offer:
            direction = "resolve parte da demanda atual"
        elif offer_signals & candidate_need:
            direction = "busca algo que este contato já entrega"
        potential_matches.append(
            {
                "contact_id": int(candidate_row["id"]),
                "name": str(candidate_row["name"] or ""),
                "service": str(candidate_row["service"] or ""),
                "score": score,
                "overlap": overlap[:4],
                "reason": direction,
            }
        )
    for profile in public_candidates:
        if str(profile.get("source_user_id") or "") == owner_id:
            continue
        profile_offer = semantic_tokens(
            " ".join(
                [
                    profile.get("service") or "",
                    profile.get("solves") or "",
                    profile.get("description") or "",
                    profile.get("tags") or "",
                    profile.get("area") or "",
                ]
            )
        )
        profile_need = semantic_tokens(" ".join([profile.get("demand") or "", profile.get("tags") or ""]))
        overlap = sorted((need_signals & profile_offer) | (offer_signals & profile_need))
        if not overlap:
            continue
        score = len(overlap) * 22 + (12 if profile.get("kind") == "person" else 6)
        potential_matches.append(
            {
                "profile_id": int(profile["id"]),
                "name": str(profile.get("name") or ""),
                "service": str(profile.get("service") or profile.get("solves") or ""),
                "kind": "public_profile" if profile.get("kind") == "person" else "public_group",
                "score": score,
                "overlap": overlap[:4],
                "reason": "o perfil pÃºblico complementa a demanda/oferta atual",
            }
        )
    for group in list_groups_for_user(connection, owner_id):
        group_signals = semantic_tokens(" ".join([group.get("name") or "", group.get("area") or "", group.get("description") or ""]))
        overlap = sorted((need_signals | offer_signals) & group_signals)
        if not overlap:
            continue
        potential_matches.append(
            {
                "group_id": int(group["id"]),
                "name": str(group.get("name") or ""),
                "service": str(group.get("area") or ""),
                "kind": "group",
                "score": len(overlap) * 18,
                "overlap": overlap[:4],
                "reason": "grupo compartilhado relacionado ao tema do contato",
            }
        )
    potential_matches.sort(key=lambda item: (item["score"], item["name"]), reverse=True)
    return {
        "platform_match": platform_match,
        "public_profile_match": public_profile_match,
        "potential_matches": potential_matches[:4],
    }


def row_to_contact(row, connection: DbConnection | None = None) -> dict:
    structured = contact_structured_data(connection, row)
    match_metadata = resolve_contact_match_metadata(connection, row, structured)
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "linked_user_id": str(row["linked_user_id"] or ""),
        "linked_user_name": row["linked_user_name"] or "",
        "linked_user_email": row["linked_user_email"] or "",
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
        "demand_tags": row["demand_tags"] or "",
        "solves": row["solves"],
        "tags": row["tags"],
        "email": row["email"],
        "whatsapp": row["whatsapp"],
        "instagram": row["instagram"],
        "linkedin": row["linkedin"],
        "organization": row["organization"] or "",
        "custom_url": row["custom_url"],
        "avatar_url": row["avatar_url"],
        "custom_fields": row["custom_fields"],
        "crm_status": row["crm_status"],
        "crm_priority": row["crm_priority"],
        "last_contact_at": row["last_contact_at"],
        "next_follow_up_at": row["next_follow_up_at"],
        "crm_note": row["crm_note"],
        "created_at": row_text(row["created_at"]),
        "phones": structured["phones"],
        "emails": structured["emails"],
        "tag_items": structured["tag_items"],
        "ddd": structured["ddd"],
        "custom_field_values": structured["custom_field_values"],
        "platform_match": match_metadata["platform_match"],
        "public_profile_match": match_metadata["public_profile_match"],
        "potential_matches": match_metadata["potential_matches"],
        "category": {
            "id": row["category_id"],
            "label": row["category_label"],
            "group": row["category_group"],
            "keywords": [],
            "synonyms": [],
            "count": 0,
        },
    }


def group_member_rows(connection: DbConnection, group_id: int) -> list:
    return connection.execute(
        "SELECT * FROM group_members WHERE group_id = ? AND status = 'active' ORDER BY role DESC, email ASC, id ASC",
        (group_id,),
    ).fetchall()


def group_contact_count(connection: DbConnection, group_id: int) -> int:
    return int(first_value(connection.execute("SELECT COUNT(*) FROM group_contacts WHERE group_id = ?", (group_id,)).fetchone()) or 0)


def row_to_group(row, connection: DbConnection | None = None) -> dict:
    members = group_member_rows(connection, row["id"]) if connection is not None else []
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "name": row["name"],
        "area": row["area"],
        "people_goal": int(row["people_goal"] or 3),
        "description": row["description"],
        "created_by_email": row["created_by_email"],
        "member_count": len(members),
        "contact_count": group_contact_count(connection, row["id"]) if connection is not None else 0,
        "members": [row_to_group_member(member) for member in members],
        "created_at": row_text(row["created_at"]),
    }


def row_to_group_member(row) -> dict:
    return {
        "id": row["id"],
        "group_id": row["group_id"],
        "user_id": row["user_id"],
        "email": row["email"],
        "role": row["role"],
        "status": row["status"],
        "created_at": row_text(row["created_at"]),
    }


def row_to_group_message(row) -> dict:
    return {
        "id": row["id"],
        "group_id": row["group_id"],
        "sender_id": row["sender_id"],
        "sender_name": row["sender_name"],
        "sender_email": row["sender_email"],
        "message": row["message"],
        "created_at": row_text(row["created_at"]),
    }


def row_to_chat_thread(row, connection: DbConnection | None = None) -> dict:
    message_count = 0
    if connection is not None:
        message_count = int(first_value(connection.execute("SELECT COUNT(*) FROM chat_messages WHERE thread_id = ?", (row["id"],)).fetchone()) or 0)
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "title": row["title"] or "Nova conversa",
        "last_message_preview": row["last_message_preview"] or "",
        "message_count": message_count,
        "created_at": row_text(row["created_at"]),
        "updated_at": row_text(row["updated_at"]),
    }


def row_to_chat_message(row) -> dict:
    try:
        suggestions = json.loads(row["suggestions"] or "[]")
    except json.JSONDecodeError:
        suggestions = []
    cta_label = str(row["cta_label"] or "").strip()
    cta_route = str(row["cta_route"] or "").strip()
    return {
        "id": row["id"],
        "thread_id": row["thread_id"],
        "owner_id": row["owner_id"],
        "role": row["role"],
        "text": row["text"],
        "provider": row["provider"] or "",
        "suggestions": suggestions if isinstance(suggestions, list) else [],
        "cta": {"label": cta_label, "route": cta_route} if cta_label and cta_route else None,
        "created_at": row_text(row["created_at"]),
    }


def row_to_import_job(row) -> dict:
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "source": row["source"],
        "filename": row["filename"] or "",
        "status": row["status"],
        "total_count": int(row["total_count"] or 0),
        "imported_count": int(row["imported_count"] or 0),
        "skipped_count": int(row["skipped_count"] or 0),
        "failed_count": int(row["failed_count"] or 0),
        "details": row["details"] or "",
        "created_at": row_text(row["created_at"]),
    }


def row_to_push_subscription(row) -> dict:
    expiration_time = row["expiration_time"]
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "endpoint": row["endpoint"],
        "p256dh_key": row["p256dh_key"] or "",
        "auth_key": row["auth_key"] or "",
        "expiration_time": int(expiration_time) if expiration_time not in (None, "") else None,
        "user_agent": row["user_agent"] or "",
        "device_label": row["device_label"] or "",
        "created_at": row_text(row["created_at"]),
        "updated_at": row_text(row["updated_at"]),
    }


def row_to_push_dispatch_event(row) -> dict:
    return {
        "id": row["id"],
        "owner_id": row["owner_id"],
        "event_key": row["event_key"],
        "fingerprint": row["fingerprint"] or "",
        "send_count": int(row["send_count"] or 0),
        "last_sent_at": row_text(row["last_sent_at"]),
        "created_at": row_text(row["created_at"]),
        "updated_at": row_text(row["updated_at"]),
    }


def find_chat_thread_by_id(connection: DbConnection, thread_id: int):
    return connection.execute("SELECT * FROM chat_threads WHERE id = ?", (thread_id,)).fetchone()


def create_chat_thread(connection: DbConnection, owner_id: str, payload: dict | None = None) -> dict:
    title = str((payload or {}).get("title") or "").strip() or "Nova conversa"
    returning_clause = " RETURNING id" if connection.dialect == "postgres" else ""
    cursor = connection.execute(
        f"""
        INSERT INTO chat_threads (owner_id, title, last_message_preview)
        VALUES (?, ?, '')
        {returning_clause}
        """,
        (str(owner_id), title[:160]),
    )
    thread_id = first_value(cursor.fetchone()) if connection.dialect == "postgres" else cursor.lastrowid
    row = connection.execute("SELECT * FROM chat_threads WHERE id = ?", (thread_id,)).fetchone()
    return row_to_chat_thread(row, connection)


def list_chat_threads(connection: DbConnection, owner_id: str) -> list[dict]:
    rows = connection.execute(
        "SELECT * FROM chat_threads WHERE owner_id = ? ORDER BY datetime(updated_at) DESC, id DESC",
        (str(owner_id),),
    ).fetchall()
    return [row_to_chat_thread(row, connection) for row in rows]


def list_chat_messages(connection: DbConnection, thread_id: int, owner_id: str) -> list[dict]:
    rows = connection.execute(
        """
        SELECT * FROM chat_messages
        WHERE thread_id = ? AND owner_id = ?
        ORDER BY datetime(created_at) ASC, id ASC
        """,
        (thread_id, str(owner_id)),
    ).fetchall()
    return [row_to_chat_message(row) for row in rows]


def create_chat_message(connection: DbConnection, thread_id: int, owner_id: str, payload: dict) -> dict:
    thread = find_chat_thread_by_id(connection, thread_id)
    if thread is None or str(thread["owner_id"]) != str(owner_id):
        raise ValueError("Thread nÃ£o encontrada.")
    existing_count = int(first_value(connection.execute("SELECT COUNT(*) FROM chat_messages WHERE thread_id = ?", (thread_id,)).fetchone()) or 0)
    role = str(payload.get("role") or "").strip().lower()
    if role not in {"user", "assistant", "system"}:
        raise ValueError("Role de mensagem invÃ¡lido.")
    text = str(payload.get("text") or "").strip()
    if not text:
        raise ValueError("Mensagem vazia.")
    provider = str(payload.get("provider") or "").strip().lower()
    suggestions = payload.get("suggestions") or []
    if not isinstance(suggestions, list):
        suggestions = []
    cta_label = str(payload.get("cta_label") or "").strip()
    cta_route = str(payload.get("cta_route") or "").strip()
    returning_clause = " RETURNING id" if connection.dialect == "postgres" else ""
    cursor = connection.execute(
        f"""
        INSERT INTO chat_messages (thread_id, owner_id, role, text, provider, suggestions, cta_label, cta_route)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        {returning_clause}
        """,
        (
            thread_id,
            str(owner_id),
            role,
            text[:4000],
            provider[:40],
            json.dumps(suggestions, ensure_ascii=False),
            cta_label[:120],
            cta_route[:240],
        ),
    )
    message_id = first_value(cursor.fetchone()) if connection.dialect == "postgres" else cursor.lastrowid
    preview = text[:160]
    if role == "user" and existing_count == 0 and str(thread["title"] or "").strip() in {"", "Nova conversa"}:
        connection.execute(
            "UPDATE chat_threads SET title = ?, last_message_preview = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?",
            (preview, preview, thread_id, str(owner_id)),
        )
    else:
        connection.execute(
            "UPDATE chat_threads SET last_message_preview = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_id = ?",
            (preview, thread_id, str(owner_id)),
        )
    row = connection.execute("SELECT * FROM chat_messages WHERE id = ?", (message_id,)).fetchone()
    return row_to_chat_message(row)


def create_import_job(connection: DbConnection, owner_id: str, payload: dict) -> dict:
    source = str(payload.get("source") or "").strip()
    if len(source) < 2:
        raise ValueError("Informe a origem da importaÃ§Ã£o.")
    filename = str(payload.get("filename") or "").strip()
    status = str(payload.get("status") or "completed").strip() or "completed"
    total_count = max(0, int(payload.get("total_count") or 0))
    imported_count = max(0, int(payload.get("imported_count") or 0))
    skipped_count = max(0, int(payload.get("skipped_count") or 0))
    failed_count = max(0, int(payload.get("failed_count") or 0))
    details = str(payload.get("details") or "").strip()
    returning_clause = " RETURNING id" if connection.dialect == "postgres" else ""
    cursor = connection.execute(
        f"""
        INSERT INTO import_jobs (owner_id, source, filename, status, total_count, imported_count, skipped_count, failed_count, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        {returning_clause}
        """,
        (str(owner_id), source[:80], filename[:240], status[:40], total_count, imported_count, skipped_count, failed_count, details[:1200]),
    )
    job_id = first_value(cursor.fetchone()) if connection.dialect == "postgres" else cursor.lastrowid
    row = connection.execute("SELECT * FROM import_jobs WHERE id = ?", (job_id,)).fetchone()
    return row_to_import_job(row)


def list_import_jobs(connection: DbConnection, owner_id: str) -> list[dict]:
    rows = connection.execute(
        "SELECT * FROM import_jobs WHERE owner_id = ? ORDER BY datetime(created_at) DESC, id DESC",
        (str(owner_id),),
    ).fetchall()
    return [row_to_import_job(row) for row in rows]


def list_push_subscriptions(connection: DbConnection, owner_id: str) -> list[dict]:
    rows = connection.execute(
        "SELECT * FROM push_subscriptions WHERE owner_id = ? ORDER BY datetime(updated_at) DESC, id DESC",
        (str(owner_id),),
    ).fetchall()
    return [row_to_push_subscription(row) for row in rows]


def upsert_push_subscription(connection: DbConnection, owner_id: str, payload: dict) -> dict:
    endpoint = str(payload.get("endpoint") or "").strip()
    if len(endpoint) < 12:
        raise ValueError("Endpoint de push invÃƒÂ¡lido.")
    p256dh_key = str(payload.get("p256dh_key") or "").strip()
    auth_key = str(payload.get("auth_key") or "").strip()
    expiration_time = payload.get("expiration_time")
    normalized_expiration_time = None if expiration_time in ("", None) else max(0, int(expiration_time))
    user_agent = str(payload.get("user_agent") or "").strip()
    device_label = str(payload.get("device_label") or "").strip()

    if connection.dialect == "postgres":
        row = connection.execute(
            """
            INSERT INTO push_subscriptions (owner_id, endpoint, p256dh_key, auth_key, expiration_time, user_agent, device_label)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE
            SET owner_id = excluded.owner_id,
                p256dh_key = excluded.p256dh_key,
                auth_key = excluded.auth_key,
                expiration_time = excluded.expiration_time,
                user_agent = excluded.user_agent,
                device_label = excluded.device_label,
                updated_at = NOW()
            RETURNING *
            """,
            (
                str(owner_id),
                endpoint[:2000],
                p256dh_key[:600],
                auth_key[:600],
                normalized_expiration_time,
                user_agent[:600],
                device_label[:160],
            ),
        ).fetchone()
    else:
        connection.execute(
            """
            INSERT INTO push_subscriptions (owner_id, endpoint, p256dh_key, auth_key, expiration_time, user_agent, device_label)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
              owner_id = excluded.owner_id,
              p256dh_key = excluded.p256dh_key,
              auth_key = excluded.auth_key,
              expiration_time = excluded.expiration_time,
              user_agent = excluded.user_agent,
              device_label = excluded.device_label,
              updated_at = CURRENT_TIMESTAMP
            """,
            (
                str(owner_id),
                endpoint[:2000],
                p256dh_key[:600],
                auth_key[:600],
                normalized_expiration_time,
                user_agent[:600],
                device_label[:160],
            ),
        )
        row = connection.execute("SELECT * FROM push_subscriptions WHERE endpoint = ?", (endpoint[:2000],)).fetchone()
    return row_to_push_subscription(row)


def delete_push_subscription(connection: DbConnection, subscription_id: int, owner_id: str) -> bool:
    cursor = connection.execute(
        "DELETE FROM push_subscriptions WHERE id = ? AND owner_id = ?",
        (subscription_id, str(owner_id)),
    )
    return cursor.rowcount > 0


def get_push_dispatch_event(connection: DbConnection, owner_id: str, event_key: str) -> dict | None:
    normalized_key = str(event_key or "").strip().lower()
    if not normalized_key:
        return None
    row = connection.execute(
        "SELECT * FROM push_dispatch_events WHERE owner_id = ? AND event_key = ?",
        (str(owner_id), normalized_key[:120]),
    ).fetchone()
    return row_to_push_dispatch_event(row) if row is not None else None


def upsert_push_dispatch_event(connection: DbConnection, owner_id: str, event_key: str, fingerprint: str, sent_count: int = 1) -> dict:
    normalized_key = str(event_key or "").strip().lower()
    normalized_fingerprint = str(fingerprint or "").strip()
    safe_send_count = max(0, int(sent_count or 0))
    returning_clause = " RETURNING id" if connection.dialect == "postgres" else ""

    if connection.dialect == "postgres":
        row = connection.execute(
            f"""
            INSERT INTO push_dispatch_events (owner_id, event_key, fingerprint, send_count, last_sent_at)
            VALUES (?, ?, ?, ?, NOW())
            ON CONFLICT(owner_id, event_key) DO UPDATE
            SET fingerprint = excluded.fingerprint,
                send_count = push_dispatch_events.send_count + excluded.send_count,
                last_sent_at = NOW(),
                updated_at = NOW()
            RETURNING *
            """,
            (str(owner_id), normalized_key[:120], normalized_fingerprint[:120], safe_send_count),
        ).fetchone()
        return row_to_push_dispatch_event(row)

    connection.execute(
        f"""
        INSERT INTO push_dispatch_events (owner_id, event_key, fingerprint, send_count, last_sent_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(owner_id, event_key) DO UPDATE SET
          fingerprint = excluded.fingerprint,
          send_count = push_dispatch_events.send_count + excluded.send_count,
          last_sent_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        {returning_clause}
        """,
        (str(owner_id), normalized_key[:120], normalized_fingerprint[:120], safe_send_count),
    )
    row = connection.execute(
        "SELECT * FROM push_dispatch_events WHERE owner_id = ? AND event_key = ?",
        (str(owner_id), normalized_key[:120]),
    ).fetchone()
    return row_to_push_dispatch_event(row)


def find_group_by_id(connection: DbConnection, group_id: int):
    return connection.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()


def user_is_global_admin(connection: DbConnection, user_id: str) -> bool:
    row = find_user_by_id(connection, user_id)
    return bool(row and row["role"] == "admin")


def group_member_role(connection: DbConnection, group_id: int, user_id: str) -> str:
    user = find_user_by_id(connection, user_id)
    emails = [str(user["email"]).lower()] if user is not None else []
    rows = connection.execute(
        "SELECT * FROM group_members WHERE group_id = ? AND status = 'active'",
        (group_id,),
    ).fetchall()
    for row in rows:
        if str(row["user_id"]) == str(user_id) or (row["email"] and row["email"].lower() in emails):
            return row["role"]
    return ""


def can_access_group(connection: DbConnection, group_id: int, user_id: str) -> bool:
    row = connection.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    if row is None:
        return False
    return str(row["owner_id"]) == str(user_id) or user_is_global_admin(connection, user_id) or bool(group_member_role(connection, group_id, user_id))


def can_manage_group(connection: DbConnection, group_id: int, user_id: str) -> bool:
    row = connection.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    if row is None:
        return False
    role = group_member_role(connection, group_id, user_id)
    return str(row["owner_id"]) == str(user_id) or user_is_global_admin(connection, user_id) or role in {"owner", "admin"}


def create_group(connection: DbConnection, payload: dict) -> dict:
    owner_id = str(payload.get("owner_id") or "")
    owner = find_user_by_id(connection, owner_id)
    if owner is None:
        raise ValueError("Usuário não encontrado.")
    if not user_is_global_admin(connection, owner_id):
        raise PermissionError("Somente administradores podem criar grupos compartilhados.")
    name = str(payload.get("name") or "").strip()
    if len(name) < 2:
        raise ValueError("Informe um nome para o grupo.")
    area = str(payload.get("area") or "").strip()
    if len(area) < 2:
        raise ValueError("Informe a área atendida pelo grupo.")
    people_goal = int(payload.get("people_goal") or 0)
    if people_goal < 3:
        raise ValueError("O grupo precisa ter 3 ou mais pessoas.")
    description = str(payload.get("description") or "").strip()
    returning_clause = " RETURNING id" if connection.dialect == "postgres" else ""
    cursor = connection.execute(
        f"""
        INSERT INTO groups (owner_id, name, area, people_goal, description, created_by_email)
        VALUES (?, ?, ?, ?, ?, ?)
        {returning_clause}
        """,
        (owner_id, name, area, people_goal, description, owner["email"]),
    )
    group_id = first_value(cursor.fetchone()) if connection.dialect == "postgres" else cursor.lastrowid
    add_group_member(connection, int(group_id), {"user_id": owner_id, "email": owner["email"], "role": "owner"})
    row = connection.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    return row_to_group(row, connection)


def update_group(connection: DbConnection, group_id: int, payload: dict) -> dict | None:
    name = str(payload.get("name") or "").strip()
    area = str(payload.get("area") or "").strip()
    people_goal = int(payload.get("people_goal") or 0)
    description = str(payload.get("description") or "").strip()
    if len(name) < 2:
        raise ValueError("Informe um nome para o grupo.")
    if len(area) < 2:
        raise ValueError("Informe a área atendida pelo grupo.")
    if people_goal < 3:
        raise ValueError("O grupo precisa ter 3 ou mais pessoas.")
    cursor = connection.execute(
        "UPDATE groups SET name = ?, area = ?, people_goal = ?, description = ? WHERE id = ?",
        (name, area, people_goal, description, group_id),
    )
    if cursor.rowcount == 0:
        return None
    row = connection.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    return row_to_group(row, connection)


def list_groups_for_user(connection: DbConnection, user_id: str) -> list[dict]:
    user = find_user_by_id(connection, user_id)
    email = str(user["email"]).lower() if user is not None else ""
    if user_is_global_admin(connection, user_id):
        rows = connection.execute("SELECT * FROM groups ORDER BY datetime(created_at) DESC, id DESC").fetchall()
    else:
        rows = connection.execute(
            """
            SELECT DISTINCT groups.*
            FROM groups
            LEFT JOIN group_members ON group_members.group_id = groups.id AND group_members.status = 'active'
            WHERE groups.owner_id = ? OR group_members.user_id = ? OR lower(group_members.email) = lower(?)
            ORDER BY datetime(groups.created_at) DESC, groups.id DESC
            """,
            (str(user_id), str(user_id), email),
        ).fetchall()
    return [row_to_group(row, connection) for row in rows]


def add_group_member(connection: DbConnection, group_id: int, payload: dict) -> dict:
    user_id = str(payload.get("user_id") or "")
    email = str(payload.get("email") or "").strip().lower()
    role = str(payload.get("role") or "member").strip() or "member"
    if not email and user_id:
        user = find_user_by_id(connection, user_id)
        if user is not None:
            email = user["email"]
    if email and not user_id:
        user = find_user_by_email(connection, email)
        if user is not None:
            user_id = str(user["id"])
    if not email:
        raise ValueError("Informe o email do membro.")
    connection.execute(
        """
        INSERT INTO group_members (group_id, user_id, email, role, status)
        VALUES (?, ?, ?, ?, 'active')
        ON CONFLICT(group_id, email) DO UPDATE SET user_id = excluded.user_id, role = excluded.role, status = 'active'
        """,
        (group_id, user_id, email, role),
    )
    row = connection.execute("SELECT * FROM group_members WHERE group_id = ? AND lower(email) = lower(?)", (group_id, email)).fetchone()
    return row_to_group_member(row)


def remove_group_member(connection: DbConnection, group_id: int, member_id: int) -> bool:
    cursor = connection.execute("UPDATE group_members SET status = 'removed' WHERE group_id = ? AND id = ? AND role != 'owner'", (group_id, member_id))
    return cursor.rowcount > 0


def contact_matches_group_area(contact, group) -> bool:
    area_terms = split_multi_value(str(group["area"] or "").replace("/", ","))
    normalized_area = normalize(group["area"])
    contact_terms = [
        contact["service"],
        contact["description"],
        contact["demand"],
        contact["solves"],
        contact["tags"],
        contact["note"],
        contact["category_label"],
        contact["category_group"],
        contact["search_text"],
        *split_multi_value(contact["tags"]),
    ]
    normalized_contact = normalize(" ".join(str(item or "") for item in contact_terms))
    if not normalized_area:
        return True
    if normalized_area in normalized_contact:
        return True
    return any(normalize(term) and normalize(term) in normalized_contact for term in area_terms)


def add_group_contact(connection: DbConnection, group_id: int, payload: dict) -> dict:
    contact_id = int(payload.get("contact_id"))
    owner_id = str(payload.get("owner_id") or "")
    requester_id = str(payload.get("added_by") or owner_id)
    group = find_group_by_id(connection, group_id)
    if group is None:
        raise ValueError("Grupo nao encontrado.")
    if owner_id != requester_id and str(group["owner_id"]) != requester_id:
        raise PermissionError("Este contato nao esta na agenda do admin. Solicite autorizacao antes de adiciona-lo.")
    contact = connection.execute("SELECT * FROM contacts WHERE id = ? AND owner_id = ?", (contact_id, owner_id)).fetchone()
    if contact is None:
        raise ValueError("Contato não encontrado para este usuário.")
    if not contact_matches_group_area(contact, group):
        raise ValueError("Contato nao corresponde a area de atuacao do grupo.")
    connection.execute(
        """
        INSERT INTO group_contacts (group_id, contact_id, owner_id, added_by)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(group_id, contact_id) DO UPDATE SET added_by = excluded.added_by
        """,
        (group_id, contact_id, owner_id, str(payload.get("added_by") or owner_id)),
    )
    return row_to_contact(contact, connection)


def list_group_messages(connection: DbConnection, group_id: int) -> list[dict]:
    rows = connection.execute(
        """
        SELECT *
        FROM group_messages
        WHERE group_id = ?
        ORDER BY datetime(group_messages.created_at) ASC, id ASC
        """,
        (group_id,),
    ).fetchall()
    return [row_to_group_message(row) for row in rows]


def create_group_message(connection: DbConnection, group_id: int, payload: dict) -> dict:
    requester_id = str(payload.get("requester_id") or "")
    user = find_user_by_id(connection, requester_id)
    if user is None:
        raise ValueError("Usuario nao encontrado.")
    message = str(payload.get("message") or "").strip()
    if not message:
        raise ValueError("Informe uma mensagem.")
    returning_clause = " RETURNING id" if connection.dialect == "postgres" else ""
    cursor = connection.execute(
        f"""
        INSERT INTO group_messages (group_id, sender_id, sender_name, sender_email, message)
        VALUES (?, ?, ?, ?, ?)
        {returning_clause}
        """,
        (group_id, requester_id, user["name"], user["email"], message),
    )
    message_id = first_value(cursor.fetchone()) if connection.dialect == "postgres" else cursor.lastrowid
    row = connection.execute("SELECT * FROM group_messages WHERE id = ?", (message_id,)).fetchone()
    return row_to_group_message(row)


def clear_group_messages(connection: DbConnection, group_id: int) -> int:
    cursor = connection.execute("DELETE FROM group_messages WHERE group_id = ?", (group_id,))
    return cursor.rowcount


def remove_group_contact(connection: DbConnection, group_id: int, contact_id: int) -> bool:
    cursor = connection.execute("DELETE FROM group_contacts WHERE group_id = ? AND contact_id = ?", (group_id, contact_id))
    return cursor.rowcount > 0


def update_group_contact_custom_fields(connection: DbConnection, group_id: int, contact_id: int, payload: dict) -> dict:
    link = connection.execute(
        "SELECT * FROM group_contacts WHERE group_id = ? AND contact_id = ?",
        (group_id, contact_id),
    ).fetchone()
    if link is None:
        raise ValueError("Contato não encontrado no grupo.")
    group = find_group_by_id(connection, group_id)
    if group is None:
        raise ValueError("Grupo não encontrado.")
    contact = connection.execute(
        "SELECT * FROM contacts WHERE id = ? AND owner_id = ?",
        (contact_id, str(payload.get("owner_id") or link["owner_id"])),
    ).fetchone()
    if contact is None:
        raise ValueError("Contato não encontrado para este usuário.")
    items = [
        item
        for item in payload_custom_field_items(
            {
                "custom_field_values": payload.get("custom_field_values") or [],
            }
        )
        if str(item.get("scope_type") or "group") == "group" and str(item.get("scope_id") or str(group_id)) == str(group_id)
    ]
    for item in items:
        item["scope_type"] = "group"
        item["scope_id"] = str(group_id)
    sync_custom_field_values_for_scope(
        connection,
        contact_id=contact_id,
        contact_owner_id=str(contact["owner_id"]),
        field_owner_id=str(group["owner_id"]),
        scope_type="group",
        scope_id=str(group_id),
        items=items,
    )
    return row_to_contact(contact, connection)


def list_group_contacts(connection: DbConnection, group_id: int) -> list[dict]:
    rows = connection.execute(
        """
        SELECT contacts.*
        FROM group_contacts
        JOIN contacts ON contacts.id = group_contacts.contact_id
        WHERE group_contacts.group_id = ?
        ORDER BY datetime(group_contacts.created_at) DESC, contacts.id DESC
        """,
        (group_id,),
    ).fetchall()
    return [row_to_contact(row, connection) for row in rows]


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
        "whatsapp": row["public_whatsapp"],
        "instagram": row["public_instagram"],
        "linkedin": row["public_linkedin"],
        "custom_url": row["public_url"],
        "avatar_url": row["avatar_url"],
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
