# Deploy - Network Agenda

## Estrategia recomendada

Use o Vercel para o frontend e hospede a API FastAPI em um servico Python. Para dados de producao, use Supabase Postgres ou outro banco persistente.

O frontend e estatico, entao combina bem com Vercel. O backend usa SQLite local quando `DATABASE_URL` nao existe e usa Supabase/Postgres quando `DATABASE_URL=postgresql://...`. Para deploy publico, configure Supabase Postgres.

Para executar a publicacao, siga `docs/GO_LIVE.md`.

## GitHub

O repositorio remoto atual e:

```text
https://github.com/lupiilluy/network-agenda.git
```

Fluxo de atualizacao:

```powershell
git add .
git commit -m "Prepare Vercel deploy"
git push origin main
```

O GitHub Pages nao esta ativo neste repositorio. O workflow de Pages fica manual para evitar falhas em cada push; o deploy principal recomendado e Vercel.

## Frontend no Vercel

No painel do Vercel:

```text
Framework Preset: Vite
Root Directory: frontend
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

Variaveis de ambiente do projeto Vercel:

```env
VITE_API_URL=https://sua-api-em-producao
VITE_GOOGLE_CLIENT_ID=seu_client_id_google
VITE_GOOGLE_MAPS_API_KEY=sua_chave_google_maps
```

O arquivo `frontend/vercel.json` mantem o fallback de SPA para rotas como `/dashboard`, `/crm` e `/chat`.

## Backend

Para a API, use um host que rode processo Python e mantenha dados persistentes. Exemplos: Render, Railway, Fly.io, VPS ou outro servico com volume/banco.

O repositorio inclui `render.yaml` para criar o servico da API no Render por Blueprint. As variaveis marcadas como `sync: false` devem ser preenchidas no painel do Render.

Configuracao generica:

```text
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Variaveis:

```env
DATABASE_URL=postgresql://...
CORS_ALLOWED_ORIGINS=https://seu-app.vercel.app
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Depois de publicar a API, copie a URL publica para `VITE_API_URL` no Vercel e rode um novo deploy.

## Supabase

O schema inicial para Supabase esta em:

```text
supabase/schema.sql
supabase/seed.sql
```

Leia `docs/SUPABASE.md` antes de expor qualquer tabela diretamente no navegador. A API ja usa Postgres quando `DATABASE_URL` esta configurada.

## Validacao antes de publicar

Backend:

```powershell
cd backend
python -m unittest discover -s tests
python -m py_compile app\main.py app\database.py app\schemas.py
```

Frontend:

```powershell
cd frontend
npm run build
```
