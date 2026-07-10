from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import psycopg
except ImportError as exc:  # pragma: no cover - runtime guard
    psycopg = None
    _import_error = exc
else:
    _import_error = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Aplica o schema do Supabase/Postgres sem usar o SQL Editor."
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", "").strip(),
        help="Connection string postgres/postgresql. Se omitido, usa DATABASE_URL.",
    )
    parser.add_argument(
        "--schema",
        default=str(Path(__file__).resolve().parent.parent / "supabase" / "schema.sql"),
        help="Caminho para o arquivo SQL principal.",
    )
    parser.add_argument(
        "--seed",
        action="store_true",
        help="Aplica tambem supabase/seed.sql depois do schema principal.",
    )
    return parser.parse_args()


def read_sql(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Arquivo nao encontrado: {path}")
    return path.read_text(encoding="utf-8")


def apply_sql(database_url: str, sql: str, label: str) -> None:
    if psycopg is None:
        raise RuntimeError(
            "psycopg nao esta instalado. Rode `pip install -r backend/requirements.txt` primeiro."
        ) from _import_error

    with psycopg.connect(database_url) as conn:
        conn.execute(sql)
        conn.commit()
    print(f"{label}: OK")


def main() -> int:
    args = parse_args()
    database_url = args.database_url.strip()
    if not database_url:
        print("DATABASE_URL ausente. Informe --database-url ou defina a variavel de ambiente.", file=sys.stderr)
        return 2
    if "[YOUR-PASSWORD]" in database_url or ("<" in database_url and ">" in database_url):
        print(
            "DATABASE_URL ainda parece conter placeholder. Substitua pela senha real do banco Supabase.",
            file=sys.stderr,
        )
        return 2

    schema_path = Path(args.schema).expanduser().resolve()
    print(f"Aplicando schema: {schema_path}")
    apply_sql(database_url, read_sql(schema_path), "schema")

    if args.seed:
        seed_path = schema_path.parent / "seed.sql"
        if seed_path.exists():
            print(f"Aplicando seed: {seed_path}")
            apply_sql(database_url, read_sql(seed_path), "seed")
        else:
            print(f"Seed ignorado: arquivo nao encontrado em {seed_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
