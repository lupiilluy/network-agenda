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

Se o SQL Editor nao estiver acessivel, use:

```powershell
.\scripts\apply-supabase-schema.ps1 -DatabaseUrl "postgresql://postgres:SUA_SENHA@db.qbqqfkvvbvsdpwsajkha.supabase.co:5432/postgres"
```

Depois copie a connection string Postgres em:

```text
Project Settings > Database > Connection string
```

Use a string no formato:

```env
DATABASE_URL=postgresql://...
```

Guarde tambem estes dados para ativar Auth pelo Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_JWT_SECRET=
```

`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam no frontend. `SUPABASE_URL` fica no backend para validacao via JWKS. `SUPABASE_JWT_SECRET` so e necessario se voce estiver usando um projeto com JWT simetrico legado.

Antes de seguir com o deploy, gere as chaves de web push:

```powershell
python .\scripts\generate-web-push-vapid-keys.py --subject mailto:voce@seudominio.com
```

O script imprime:

- `VITE_WEB_PUSH_PUBLIC_KEY` para Vercel/frontend;
- `WEB_PUSH_VAPID_PRIVATE_KEY` e `WEB_PUSH_VAPID_SUBJECT` para Render/backend.

## 2. Render

Crie um Blueprint apontando para o repositorio:

```text
https://github.com/lupiilluy/network-agenda
```

O Render deve detectar:

```text
render.yaml
```

Veja tambem `docs/RENDER.md` para a sequencia exata de preenchimento. Se quiser reduzir o preenchimento manual ao minimo, use `scripts/provision-production.ps1` com `RENDER_API_KEY` e `VERCEL_TOKEN`.

Preencha as variaveis do servico `network-agenda-api`:

```env
APP_ENV=production
DATABASE_URL=postgresql://...
CORS_ALLOWED_ORIGINS=https://seu-app.vercel.app
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_JWT_SECRET=
ALLOW_LEGACY_PASSWORD_LOGIN=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_SUBJECT=mailto:voce@seudominio.com
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
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_WEB_PUSH_PUBLIC_KEY=...
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
```

Depois do deploy do Vercel, copie o dominio final e coloque no Render:

```env
CORS_ALLOWED_ORIGINS=https://seu-app.vercel.app
```

Sem as variaveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `SUPABASE_URL`, o app sobe, mas a autenticacao fica indisponivel. O login local por senha nao e mais o caminho padrao; so volta se voce habilitar `ALLOW_LEGACY_PASSWORD_LOGIN=true` no backend.

## 4. Google OAuth

No Google Cloud, o callback autorizado do cliente OAuth precisa apontar para o callback do projeto Supabase:

```text
Authorized redirect URIs
```

Exemplo:

```text
https://qbqqfkvvbvsdpwsajkha.supabase.co/auth/v1/callback
```

Se voce usar outro projeto Supabase, troque o `project-ref` no URL acima.

No Supabase Auth, adicione o dominio do Vercel em:

```text
Site URL
Additional Redirect URLs
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
GET /api/auth/status
GET /api/categories
GET /api/public-profiles
GET /api/graph?scope=public
```

Push:

```text
POST /api/push-subscriptions/test
```

Checklist rapido local:

```powershell
.\scripts\check-auth-readiness.ps1
.\scripts\check-auth-readiness.ps1 -Strict
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

1. Conferir `docs/PRODUCTION_CHECKLIST.md` do inicio ao fim.
2. Configurar as variaveis de Supabase Auth na Vercel e redeployar frontend/backend.
3. Remover usuarios de teste em producao.
4. Configurar dominio proprio.
5. Ativar monitoramento de logs e backups.
6. Trocar o push de teste/manual por disparos automatizados de produto.
