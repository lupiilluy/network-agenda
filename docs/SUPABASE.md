# Supabase - Network Agenda

## O que vai para o Supabase

Supabase deve entrar como banco Postgres gerenciado primeiro. Depois podemos migrar login para Supabase Auth.

O app atual ainda usa `sqlite3` diretamente em `backend/app/database.py`, entao o schema abaixo prepara o banco, mas a API ainda precisa de uma etapa de adaptacao para Postgres antes de usar Supabase em producao.

## Criar o projeto

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode `supabase/schema.sql`.
4. Opcionalmente rode `supabase/seed.sql`.
5. Copie a connection string em Database Settings.

Para backend em servidor persistente, use a connection string direta. Para backend serverless ou funcoes com conexoes curtas, use o pooler/transacao.

## Variaveis esperadas

Backend:

```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

Frontend:

```env
VITE_API_URL=https://sua-api-em-producao
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_MAPS_API_KEY=...
```

Quando migrarmos Auth para Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` deve ficar somente no backend.

## Sequencia recomendada

1. Manter frontend no Vercel.
2. Criar Supabase Postgres com `supabase/schema.sql`.
3. Adaptar `backend/app/database.py` para usar `DATABASE_URL` com Postgres.
4. Hospedar a API FastAPI em Render, Railway, Fly.io ou container equivalente.
5. Configurar `VITE_API_URL` no Vercel apontando para a API.
6. Depois migrar login local para Supabase Auth e ativar RLS nas tabelas expostas.

## Seguranca

Enquanto o frontend fala apenas com a FastAPI, o isolamento por usuario continua no backend via `owner_id`.

Se decidirmos chamar Supabase direto do navegador, precisamos ativar RLS e criar politicas por usuario antes de expor qualquer tabela da agenda privada.
