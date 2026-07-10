# Production Checklist - Network Intelligence CRM

Use este checklist antes de liberar o app para usuarios reais.

Para executar a parte automatizavel do go-live:

```powershell
.\scripts\go-live.ps1
```

Depois da publicação:

```powershell
.\scripts\go-live.ps1 -ApiBaseUrl https://sua-api.onrender.com -VercelUrl https://seu-app.vercel.app -RunSmokeTest
```

## 1. Supabase

- Criar projeto Supabase.
- Rodar `supabase/schema.sql` no SQL Editor ou usar `.\scripts\apply-supabase-schema.ps1 -DatabaseUrl "postgresql://postgres:SUA_SENHA@db.qbqqfkvvbvsdpwsajkha.supabase.co:5432/postgres"`.
- Confirmar que `/api/auth/status` mostra `database_dialect=postgres`.
- Confirmar que `/api/auth/status` mostra `rls_ready=true`.
- Configurar Google provider em Supabase Auth.
- Configurar Email magic link em Supabase Auth.
- Configurar Apple provider se for usar Apple login no go-live.
- Definir Site URL para o dominio Vercel final.
- Definir Redirect URLs para:

```text
https://seu-app.vercel.app
https://seu-app.vercel.app/login
https://seu-app.vercel.app/onboarding
```

## 2. Render + Vercel

Se voce ja tiver `RENDER_API_KEY` e `VERCEL_TOKEN`, rode:

```powershell
.\scripts\provision-production.ps1
```

Isso sincroniza os envs a partir de `frontend/.env.local` e `backend/.env.production.local`, cria os deploys e reduz o preenchimento manual ao minimo.

Depois que a URL final da Vercel existir, rode de novo:

```powershell
.\scripts\provision-production.ps1 -FrontendUrl https://seu-app.vercel.app
```

Se voce preferir fazer pelo painel, os envs obrigatorios continuam sendo:

```env
APP_ENV=production
DATABASE_URL=postgresql://...
CORS_ALLOWED_ORIGINS=https://seu-app.vercel.app
SUPABASE_URL=https://qbqqfkvvbvsdpwsajkha.supabase.co
SUPABASE_JWT_SECRET=
ALLOW_LEGACY_PASSWORD_LOGIN=false
WEB_PUSH_VAPID_PRIVATE_KEY=...
WEB_PUSH_VAPID_SUBJECT=mailto:voce@seudominio.com
OPENAI_MODEL=gpt-4o-mini
VITE_API_URL=https://sua-api.onrender.com
VITE_SUPABASE_URL=https://qbqqfkvvbvsdpwsajkha.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_WEB_PUSH_PUBLIC_KEY=...
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
```

`SUPABASE_JWT_SECRET` pode ficar vazio quando `SUPABASE_URL` estiver configurado e a validacao via JWKS estiver funcionando.

## 4. Smoke Test

Depois dos deploys, rode:

```powershell
.\scripts\check-auth-readiness.ps1 -Strict
.\scripts\go-live.ps1 -ApiBaseUrl https://sua-api.onrender.com -RunSmokeTest
```

Endpoints que precisam responder:

```text
GET /api/health
GET /api/auth/status
GET /api/public-profiles
GET /api/graph?scope=public
```

O `/api/auth/status` deve indicar:

```text
production_auth_enforced = true
demo_fallback_enabled = false
production_auth_ready = true
rls_ready = true
legacy_password_login_enabled = false
```

## 5. Fluxo Manual Final

- Abrir `/login`.
- Entrar com Google.
- Entrar com magic link.
- Completar onboarding.
- Criar um contato manual.
- Importar um CSV pequeno.
- Abrir `/grafo`.
- Abrir `/rede`.
- Criar grupo com usuario admin.
- Abrir `/api-docs`.
- Instalar como PWA no Android.
- Ativar notificacoes e enviar push teste em Configuracoes.
