# Network Agenda Backend

API FastAPI para o MVP do Network Agenda.

## Rodar localmente

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8006
```

## Variaveis opcionais

Crie `backend/.env.local` a partir de `backend/.env.example`:

```env
DATABASE_URL=
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5174,http://localhost:5174
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Endpoints principais

- `GET /api/health`
- `GET /api/categories`
- `GET /api/contacts?user_id=1`
- `POST /api/contacts`
- `PUT /api/contacts/{contact_id}`
- `DELETE /api/contacts/{contact_id}`
- `POST /api/users`
- `POST /api/login`
- `POST /api/google-login`
- `GET /api/users`
- `GET /api/public-profiles`
- `GET /api/merge-suggestions?user_id=1`
- `POST /api/merge-suggestions/ignore`
- `POST /api/merge-suggestions/merge`
- `POST /api/ai/chat`
- `GET /api/search?query=eletricista`

Sem `DATABASE_URL`, o banco SQLite fica em `backend/data/network_agenda.sqlite3` e e criado automaticamente.

Com `DATABASE_URL=postgresql://...`, a API usa Postgres/Supabase e inicializa as tabelas com `app/postgres_schema.sql`.
