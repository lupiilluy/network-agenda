# Network Agenda Backend

API Python para o MVP da Network Agenda.

## Rodar localmente

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8004
```

## Endpoints principais

- `GET /api/health`
- `GET /api/categories`
- `GET /api/contacts`
- `POST /api/contacts`
- `DELETE /api/contacts/{contact_id}`
- `GET /api/public-profiles`
- `GET /api/search?query=eletricista`

O banco SQLite fica em `backend/data/network_agenda.sqlite3` e e criado automaticamente.
