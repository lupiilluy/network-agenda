# Go Live - Network Agenda

Este roteiro coloca o Network Agenda em producao com:

- Supabase Postgres para dados.
- Render para a API FastAPI.
- Vercel para o frontend React/Vite.

## 1. Supabase

Crie um projeto no Supabase e rode o schema:

```text
supabase/schema.sql
```

Depois copie a connection string Postgres em:

```text
Project Settings > Database > Connection string
```

Use a string no formato:

```env
DATABASE_URL=postgresql://...
```

Guarde tambem estes dados para uma fase futura de Auth:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Nao coloque `SUPABASE_SERVICE_ROLE_KEY` no Vercel.

## 2. Render

Crie um Blueprint apontando para o repositorio:

```text
https://github.com/lupiilluy/network-agenda
```

O Render deve detectar:

```text
render.yaml
```

Preencha as variaveis do servico `network-agenda-api`:

```env
DATABASE_URL=postgresql://...
CORS_ALLOWED_ORIGINS=https://seu-app.vercel.app
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Se ainda nao tiver dominio do Vercel, primeiro publique o frontend e depois volte ao Render para atualizar `CORS_ALLOWED_ORIGINS`.

Depois do deploy, teste:

```text
https://sua-api.onrender.com/api/health
```

Resposta esperada:

```json
{"status":"ok","service":"network-agenda-api"}
```

## 3. Vercel

Importe o mesmo repositorio no Vercel:

```text
https://github.com/lupiilluy/network-agenda
```

Configure:

```text
Framework Preset: Vite
Root Directory: frontend
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

Variaveis do Vercel:

```env
VITE_API_URL=https://sua-api.onrender.com
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
```

Depois do deploy do Vercel, copie o dominio final e coloque no Render:

```env
CORS_ALLOWED_ORIGINS=https://seu-app.vercel.app
```

## 4. Google OAuth

No Google Cloud, adicione o dominio do Vercel em:

```text
Authorized JavaScript origins
```

Exemplo:

```text
https://seu-app.vercel.app
```

Para testes locais, mantenha tambem:

```text
http://127.0.0.1:5174
```

## 5. Validacao final

API:

```text
GET /api/health
GET /api/categories
GET /api/public-profiles
```

Frontend:

```text
/login
/dashboard
/agenda
/crm
/chat
```

Login de teste so deve existir se o banco foi inicializado com seed local da API:

```text
ana@network.local / 123456
admin@network.local / admin123
```

## 6. Depois do deploy

Prioridades seguintes:

1. Trocar login local por Supabase Auth.
2. Criar politicas RLS antes de qualquer acesso direto do frontend ao Supabase.
3. Remover usuarios de teste em producao.
4. Configurar dominio proprio.
5. Ativar monitoramento de logs e backups.
