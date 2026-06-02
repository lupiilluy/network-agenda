# Network Agenda Backend

API Python para o MVP da Network Agenda.

## Rodar localmente

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8005
```

## Endpoints principais

- `GET /api/health`
- `GET /api/categories`
- `GET /api/contacts?user_id=1`
- `POST /api/contacts`
- `DELETE /api/contacts/{contact_id}`
- `POST /api/login`
- `POST /api/google-login`
- `GET /api/users`
- `GET /api/public-profiles`
- `GET /api/search?query=eletricista`

O banco SQLite fica em `backend/data/network_agenda.sqlite3` e é criado automaticamente.
