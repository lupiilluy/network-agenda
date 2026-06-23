# Supabase - Network Agenda

## O que vai para o Supabase

Supabase entra como banco Postgres gerenciado e tambem pode assumir Auth. O app mantem o login antigo como fallback quando as variaveis de Auth nao estao configuradas.

O backend ja suporta Postgres/Supabase quando `DATABASE_URL` aponta para uma connection string `postgresql://...`. Sem essa variavel, ele continua usando SQLite local.

## Criar o projeto

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode `supabase/schema.sql`, ou deixe a API criar as tabelas no primeiro startup usando `backend/app/postgres_schema.sql`.
4. Opcionalmente rode `supabase/seed.sql`.
5. Copie a connection string em Database Settings.

Para backend em servidor persistente, use a connection string direta. Para backend serverless ou funcoes com conexoes curtas, use o pooler/transacao.

## Variaveis esperadas

Backend:

```env
DATABASE_URL=postgresql://...
CORS_ALLOWED_ORIGINS=https://seu-app.vercel.app
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_JWT_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Frontend:

```env
VITE_API_URL=https://sua-api-em-producao
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
```

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
7. Depois ativar RLS nas tabelas expostas, caso o frontend passe a chamar Supabase direto.

## Seguranca

Enquanto o frontend fala apenas com a FastAPI, o isolamento por usuario continua no backend via `owner_id`.

Se decidirmos chamar Supabase direto do navegador, precisamos ativar RLS e criar politicas por usuario antes de expor qualquer tabela da agenda privada.
