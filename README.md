# Network Agenda

PWA-first para agenda inteligente de contatos uteis e networking.

O MVP comeca com uma agenda privada onde o usuario adiciona/importa contatos, informa apenas o servico que a pessoa presta e o app organiza automaticamente em categorias e grupos. Quando a agenda privada nao resolve a busca, a interface mostra grupos da rede publica.

## Desenvolvimento

Backend:

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8004
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
cd frontend
npm run build
```

## API

O frontend usa `http://127.0.0.1:8004` por padrao. Para trocar, defina `VITE_API_URL` no ambiente do frontend.

Endpoints principais:

- `GET /api/health`
- `GET /api/categories`
- `GET /api/contacts`
- `POST /api/contacts`
- `GET /api/public-profiles`
- `GET /api/search?query=eletricista`
