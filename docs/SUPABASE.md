# Supabase - Network Agenda

## O que vai para o Supabase

Supabase entra como banco Postgres gerenciado e tambem assume o fluxo principal de Auth.

O backend ja suporta Postgres/Supabase quando `DATABASE_URL` aponta para uma connection string `postgresql://...`. Sem essa variavel, ele continua usando SQLite local.

Para autenticacao:

- o frontend precisa de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`;
- o backend valida o bearer token com `SUPABASE_URL` e/ou `SUPABASE_JWT_SECRET`;
- o login legado por senha fica desligado por padrao e so pode ser reaberto com `ALLOW_LEGACY_PASSWORD_LOGIN=true`.

Para checar se o ambiente local esta pronto:

```powershell
.\scripts\check-auth-readiness.ps1
```

## Criar o projeto

1. Crie um projeto no Supabase.
2. Se o SQL Editor estiver indisponivel, aplique o schema direto pelo terminal com `scripts/apply-supabase-schema.ps1`.
3. Opcionalmente rode `supabase/seed.sql`.
4. Copie a connection string em Database Settings.

Exemplo:

```powershell
.\scripts\apply-supabase-schema.ps1 -DatabaseUrl "postgresql://postgres:SUA_SENHA@db.qbqqfkvvbvsdpwsajkha.supabase.co:5432/postgres"
```

Para backend em servidor persistente, use a connection string direta. Para backend serverless ou funcoes com conexoes curtas, use o pooler/transacao.

## Variaveis esperadas

Backend:

```env
APP_ENV=production
DATABASE_URL=postgresql://...
CORS_ALLOWED_ORIGINS=https://seu-app.vercel.app
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_JWT_SECRET=
ALLOW_LEGACY_PASSWORD_LOGIN=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Frontend:

```env
VITE_API_URL=https://sua-api-em-producao
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_WEB_PUSH_PUBLIC_KEY=...
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
```

Backend push:

```env
WEB_PUSH_VAPID_PRIVATE_KEY=...
WEB_PUSH_VAPID_SUBJECT=mailto:voce@seudominio.com
```

As chaves VAPID podem ser geradas localmente com:

```powershell
python .\scripts\generate-web-push-vapid-keys.py --subject mailto:voce@seudominio.com
```

O backend aceita `WEB_PUSH_VAPID_PRIVATE_KEY` em tres formatos:

- PKCS8 DER em base64url, que e o formato impresso pelo script;
- PEM literal;
- caminho para um arquivo PEM local.

Com essas variaveis, o frontend usa Supabase para Google OAuth e magic link. O backend valida o bearer token via JWKS usando `SUPABASE_URL` e usa o usuario autenticado como dono real dos contatos.

Nao use no navegador:

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` deve ficar somente no backend.

## Sequencia recomendada

1. Manter frontend no Vercel.
2. Criar Supabase Postgres com `supabase/schema.sql`.
3. Configurar `DATABASE_URL` no host da API.
4. Hospedar a API FastAPI em Render, Railway, Fly.io ou container equivalente.
5. Configurar `VITE_API_URL` no Vercel apontando para a API.
6. Configurar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `SUPABASE_URL`.
7. Configurar `VITE_WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` e `WEB_PUSH_VAPID_SUBJECT` para habilitar push de teste.
8. Depois ativar RLS nas tabelas expostas, caso o frontend passe a chamar Supabase direto.

## Seguranca

Enquanto o frontend fala apenas com a FastAPI, o isolamento por usuario continua no backend via `owner_id`.

Em producao, deixe `APP_ENV=production`. Nesse modo, o backend bloqueia o fallback `demo-user` quando `SUPABASE_URL`/`SUPABASE_JWT_SECRET` nao estiver configurado.

Se decidirmos chamar Supabase direto do navegador, precisamos ativar RLS e criar politicas por usuario antes de expor qualquer tabela da agenda privada.

Para checar o estado do ambiente e ver se auth/push estao prontos:

```powershell
.\scripts\check-auth-readiness.ps1
```
