# Render - Network Intelligence CRM

Use este guia para subir a API FastAPI no Render.

## Blueprint

O repositório ja inclui `render.yaml`. No Render:

1. Crie um novo Web Service via Blueprint.
2. Aponte para este repositório.
3. Confirme que o Render leu `render.yaml`.

## Variaveis do servico `network-agenda-api`

O que ja pode ficar fixo agora:

- `APP_ENV=production`
- `SUPABASE_URL=https://qbqqfkvvbvsdpwsajkha.supabase.co`
- `ALLOW_LEGACY_PASSWORD_LOGIN=false`
- `OPENAI_MODEL=gpt-4o-mini`

O que precisa ser preenchido no painel:

- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `SUPABASE_JWT_SECRET` opcional
- `OPENAI_API_KEY` opcional
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT`

## Ordem recomendada

1. Coloque `DATABASE_URL` usando a connection string do Supabase Postgres.
2. Preencha `WEB_PUSH_VAPID_PRIVATE_KEY` e `WEB_PUSH_VAPID_SUBJECT`.
3. Deixe `SUPABASE_URL` como o valor do projeto.
4. Se voce quiser JWT simetrico legado, preencha `SUPABASE_JWT_SECRET`; caso contrario, pode deixar vazio.
5. Depois que a Vercel estiver no ar, ajuste `CORS_ALLOWED_ORIGINS` para a URL final do frontend.

## Validacao

Depois do deploy:

```powershell
.\scripts\check-auth-readiness.ps1 -Strict
.\scripts\go-live.ps1 -ApiBaseUrl https://sua-api.onrender.com -RunSmokeTest
```

O resultado esperado em `/api/auth/status` e:

- `production_auth_ready=true`
- `rls_ready=true`
- `demo_fallback_enabled=false`
- `configured_web_push_vapid=true`

## Automacao reduzida

Se voce ja tiver:

- `RENDER_API_KEY`
- `VERCEL_TOKEN`
- `frontend/.env.local`
- `backend/.env.production.local`

rode:

```powershell
.\scripts\provision-production.ps1
```

Quando a URL final da Vercel existir, rode de novo para atualizar o CORS do Render:

```powershell
.\scripts\provision-production.ps1 -FrontendUrl https://seu-app.vercel.app
```
