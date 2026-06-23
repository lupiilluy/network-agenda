# Network Intelligence CRM

Repositorio do MVP atual do produto `Network Intelligence CRM`, um webapp PWA-first para gestao inteligente de contatos, CRM pessoal, networking, grupos compartilhados e descoberta de perfis publicos.

O nome do repositorio ainda e `network-agenda`, mas o produto e apresentado no app como `Network Intelligence CRM`.

## MVP atual

- onboarding em 5 passos: login, perfil, visibilidade publica, importacao e primeiros insights;
- dashboard com metricas, atalhos e mini grafo da rede;
- agenda privada com busca, filtros, detalhe, edicao e exclusao de contatos;
- grafo privado separado do grafo publico e do grafo de grupos;
- mapa/rede com leitura por proximidade, DDD e contexto;
- CRM com status, prioridade, follow-up, conclusao e cancelamento;
- grupos compartilhados com chat, grafo, membros, contatos e campos customizados proprios;
- rede publica com cards, feed, perfis visiveis e exploracao em grafo;
- perfil proprio separado do perfil publico;
- importacao via Google Contacts, CSV e cadastro manual;
- sugestao de duplicados por email/telefone com merge manual;
- campos customizados por agenda e por grupo;
- chat de copiloto com resposta local estruturada e suporte opcional a OpenAI;
- PWA instalavel com manifest, service worker, cache basico, shell offline e fila de sincronizacao ao reconectar;
- tema dark como padrao e light theme funcional, inclusive nas areas de grafo;
- documentacao OpenAPI/Swagger no backend e pagina interna `/api-docs`.

## Autenticacao

O projeto hoje trabalha em modo hibrido:

- `Google login` implementado;
- `Email magic link` implementado quando Supabase Auth estiver configurado;
- `Email e senha` continuam disponiveis apenas no modo local/legado, quando Supabase nao estiver exigido;
- `Apple login` aparece como placeholder `em breve`.

Regra importante:

- quando `SUPABASE_JWT_SECRET` estiver configurado no backend, a API entra em modo `Supabase-first` e bloqueia login local por senha;
- no fluxo legado/local, algumas operacoes do perfil ainda exigem conta Google conectada.

## Importacao e dados

Contatos e perfis hoje suportam:

- nome, avatar, descricao, demanda atual, problema que resolve e notas;
- tags livres;
- telefone principal e email principal;
- estruturas auxiliares para multiplos telefones, multiplos emails e valores de campos customizados;
- DDD derivado e usado em visualizacao/filtros;
- links sociais opcionais;
- origem do contato;
- status e prioridade de CRM;
- relacao com grupos e perfil publico quando aplicavel.

O fluxo de foto de perfil aceita:

- arquivo local;
- camera do dispositivo;
- seletor nativo do celular;
- Google Drive;
- Google Fotos.

## Areas principais

Rotas principais do frontend:

- `/onboarding`
- `/dashboard`
- `/agenda`
- `/grafo`
- `/mapa`
- `/crm`
- `/chat`
- `/grupos`
- `/rede`
- `/feed`
- `/perfil-publico`
- `/configuracoes`
- `/duplicados`
- `/api-docs`

## Stack

### Frontend

- React 18
- Vite
- Tailwind CSS
- Lucide React
- Supabase JS
- Canvas 2D nativo para os grafos

### Backend

- FastAPI
- SQLite local para desenvolvimento rapido
- Postgres/Supabase para deploy
- Uvicorn

## Estrutura

```text
network-agenda/
├── backend/
├── docs/
├── frontend/
├── supabase/
├── PRD.md
├── README.md
└── render.yaml
```

## Como rodar localmente

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8006
```

API local:

```text
http://127.0.0.1:8006
```

Swagger:

```text
http://127.0.0.1:8006/docs
```

### Frontend

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

App local:

```text
http://127.0.0.1:5174
```

## Variaveis de ambiente

Copie os exemplos:

```powershell
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.env.example backend/.env.local
```

### Frontend

```env
VITE_API_URL=http://127.0.0.1:8006
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=cole_aqui_a_anon_key
VITE_GOOGLE_CLIENT_ID=seu_client_id_google
VITE_GOOGLE_MAPS_API_KEY=sua_chave_google_maps
```

### Backend

```env
DATABASE_URL=
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5174,http://localhost:5174
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_JWT_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Banco de dados

- sem `DATABASE_URL`, a API sobe com SQLite local em `backend/data/network_agenda.sqlite3`;
- com `DATABASE_URL=postgresql://...`, a API usa Postgres/Supabase;
- o bootstrap de producao pode usar `supabase/schema.sql`;
- o backend tambem contem o schema SQL em `backend/app/postgres_schema.sql`.

## Endpoints principais

```text
GET    /api/health
GET    /api/contacts
POST   /api/contacts
PUT    /api/contacts/{contact_id}
DELETE /api/contacts/{contact_id}

GET    /api/merge-suggestions
POST   /api/merge-suggestions/ignore
POST   /api/merge-suggestions/merge

GET    /api/custom-fields
POST   /api/custom-fields
PUT    /api/custom-fields/{field_id}
DELETE /api/custom-fields/{field_id}

GET    /api/groups
POST   /api/groups
POST   /api/groups/{group_id}/members
GET    /api/groups/{group_id}/contacts
POST   /api/groups/{group_id}/messages

POST   /api/users
POST   /api/login
POST   /api/google-login
GET    /api/public-profiles
GET    /api/search
POST   /api/ai/chat
```

## Validacao

Frontend:

```powershell
cd frontend
npm run build
```

Backend:

```powershell
cd backend
python -m py_compile app\main.py app\database.py app\schemas.py
python -m unittest discover -s tests
```

## Deploy

Stack de publicacao prevista pelo repositorio:

- `frontend` no Vercel;
- `backend` no Render via `render.yaml`;
- `database` no Supabase Postgres.

Arquivos de apoio:

- `docs/DEPLOYMENT.md`
- `docs/GO_LIVE.md`
- `docs/SUPABASE.md`

Fluxo esperado:

1. conectar o repositorio do GitHub ao Vercel e ao Render;
2. configurar as variaveis de ambiente dos dois servicos;
3. fazer `push` para `main`;
4. deixar o auto deploy publicar frontend e backend.

## Status resumido

Ja implementado:

- base privada multiusuario;
- grupos compartilhados com escopo proprio;
- rede publica opcional;
- onboarding;
- PWA base;
- chat preparado para IA;
- campos customizados;
- deduplicacao manual;
- documentacao de API.

Ainda pendente ou parcial:

- Apple login real;
- importacao nativa de Apple Contacts, Outlook e LinkedIn;
- push notifications reais;
- rollout completo de Supabase Auth + RLS em producao;
- automacoes mais avancadas de match e inteligencia de networking.
