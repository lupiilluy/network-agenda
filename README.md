# Network Intelligence CRM

Repositorio do MVP atual do produto `Network Intelligence CRM`, um webapp PWA-first para gestao inteligente de contatos, CRM pessoal, networking, grupos compartilhados e descoberta de perfis publicos.

O nome do repositorio ainda e `network-agenda`, mas o produto e apresentado no app como `Network Intelligence CRM`.

## Deploy atual

- Frontend em producao: `https://frontend-three-mauve-91.vercel.app`
- API em producao: `https://network-agenda-api.onrender.com`
- Banco principal: Postgres gerenciado
- Auth principal: Google OAuth direto no app

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
- importacao via Google Contacts, CSV, VCF, cadastro manual e exports compativeis de Outlook/LinkedIn;
- sugestao de duplicados por email/telefone com merge manual;
- campos customizados por agenda e por grupo;
- chat de copiloto com resposta local estruturada e suporte opcional a OpenAI;
- PWA instalavel com manifest, service worker, cache basico, shell offline e fila de sincronizacao ao reconectar;
- tema dark como padrao e light theme funcional, inclusive nas areas de grafo;
- documentacao OpenAPI/Swagger no backend e pagina interna `/api-docs`.

## Autenticacao

O projeto agora assume fluxo `Google-first`:

- `Google login` abre o fluxo direto do Google Identity Services;
- a sessao fica salva localmente neste navegador;
- o restante do app usa essa sessao local para identificar o usuario no backend;
- `Email e senha`, `magic link` e `Apple login` nao fazem parte mais do fluxo de acesso.

Regras importantes:

- o frontend precisa de `VITE_GOOGLE_CLIENT_ID` para abrir login com Google;
- `VITE_WEB_PUSH_PUBLIC_KEY` habilita o registro real do dispositivo para web push;
- o backend continua aceitando a sessao local no navegador para identificar o usuario nas rotas privadas;
- o login por senha local so volta se voce habilitar explicitamente `ALLOW_LEGACY_PASSWORD_LOGIN=true`.

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
- Canvas 2D nativo para os grafos

### Backend

- FastAPI
- SQLite local para desenvolvimento rapido
- Postgres para deploy
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

Diagnostico rapido de auth:

```powershell
.\scripts\check-auth-readiness.ps1
```

Verificacao local completa:

```powershell
.\scripts\verify.ps1
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
VITE_GOOGLE_CLIENT_ID=seu_client_id_google
VITE_GOOGLE_MAPS_API_KEY=sua_chave_google_maps
```

### Backend

```env
DATABASE_URL=
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5174,http://localhost:5174
APP_ENV=development
ALLOW_LEGACY_PASSWORD_LOGIN=true
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Banco de dados

- sem `DATABASE_URL`, a API sobe com SQLite local em `backend/data/network_agenda.sqlite3`;
- com `DATABASE_URL=postgresql://...`, a API usa Postgres;
- o bootstrap de producao pode usar `backend/app/postgres_schema.sql`;
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

POST   /api/auth/session
POST   /api/users
POST   /api/login              # legado, desabilitado por padrao
POST   /api/google-login       # suporte legado e testes
GET    /api/public-profiles
GET    /api/search
POST   /api/ai/chat
GET    /api/import-jobs
POST   /api/import-jobs
GET    /api/import-integrations
GET    /api/push-subscriptions
POST   /api/push-subscriptions
POST   /api/push-subscriptions/test
POST   /api/push-subscriptions/dispatch
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
- `database` no Postgres gerenciado.

Arquivos de apoio:

- `docs/DEPLOYMENT.md`
- `docs/GO_LIVE.md`
- `docs/PRODUCTION_CHECKLIST.md`

Fluxo esperado:

1. conectar o repositorio do GitHub ao Vercel e ao Render;
2. configurar as variaveis de ambiente dos dois servicos;
3. fazer `push` para `main`;
4. deixar o auto deploy publicar frontend e backend.

Validacao remota de go-live:

```powershell
.\scripts\check-auth-readiness.ps1 -Strict
.\scripts\go-live.ps1 -ApiBaseUrl https://sua-api.onrender.com -VercelUrl https://seu-app.vercel.app -RunSmokeTest
```

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

- conectores nativos de Apple Contacts, Outlook e LinkedIn expostos na UX, mas ainda bloqueados por credenciais do provedor;
- rollout completo da estrategia de auth em producao;
- automacoes mais avancadas de match e inteligencia de networking, embora o MVP ja entregue match automatico com perfil publico/plataforma, complementaridade por contato e dispatch server-side de push por follow-up/importacao.
