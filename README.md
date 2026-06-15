# Network Agenda

Webapp browser-first para gestão inteligente de contatos, CRM pessoal e networking. O produto combina agenda privada por usuário, importação de contatos, categorização por serviços e tags, CRM de follow-ups, chat operacional, mapa/grafo interativo e rede pública opcional.

## Objetivo

O Network Agenda ajuda cada usuário a organizar sua rede pessoal/profissional e encontrar rapidamente quem pode ajudar, prestar um serviço, resolver um problema ou receber uma indicação.

O MVP atual prioriza:

- base privada de contatos por usuário;
- importação via Google Contacts, CSV/TXT e cadastro manual;
- categorização por serviços, tags e contexto;
- CRM com follow-ups, prioridade, status, conclusão e cancelamento;
- chat operacional para buscar contatos e aplicar ações no CRM;
- mapa com grafo 3D em Canvas nativo;
- perfil pessoal separado do perfil público;
- rede pública opcional para usuários que querem aparecer dentro da plataforma;
- serviços oferecidos na rede pública apresentados por tags.

## Funcionalidades

- Login por email/senha.
- Login com Google OAuth.
- Importação real de contatos via Google People API.
- Cadastro com dados preenchidos pelo Google quando disponíveis.
- Sessão local com expiração em 24 horas.
- Agenda privada separada por usuário.
- Cadastro, edição, remoção e detalhe completo de contatos.
- Campos ricos no contato: descrição, demanda atual, problema que resolve, tags, links sociais, email e campos personalizados.
- Deduplicação por telefone/email com revisão manual.
- Dashboard com métricas, atalhos e visual de rede.
- CRM com contatos ativos, com tags, sem tags e todos.
- Follow-up com data/hora, concluir, alterar e cancelar.
- Bloqueio de follow-up apenas quando outro contato do mesmo usuário já usa o mesmo dia e horário.
- Chat de copiloto para localizar contatos, sugerir comandos parecidos, ajustar categorias e acionar CRM.
- Campo de contato alvo digitável e selecionável no próprio chat.
- Mapa/grafo 3D em Canvas 2D nativo, sem dependências 3D externas.
- Distâncias aproximadas por DDD/localização quando possível.
- Google obrigatório para salvar perfil, usar mapa e usar rede pública.
- Perfil público opcional em tela separada.
- Rede pública com cards de pessoas visíveis e serviços oferecidos.
- Configurações com perfil, perfil público, importação Google, duplicados, exportação e sessão.

## Stack

### Frontend

- React 18
- Vite
- Tailwind CSS
- Lucide React
- Canvas 2D API nativa para o grafo

### Backend

- Python
- FastAPI
- SQLite local ou Supabase Postgres
- Uvicorn

## Estrutura

```text
network-agenda/
├── backend/
│   ├── app/
│   │   ├── categories.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── schemas.py
│   ├── data/
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── PRD.md
└── README.md
```

## Como Rodar

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8006
```

A API fica em:

```text
http://127.0.0.1:8006
```

### Frontend

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

O app fica em:

```text
http://127.0.0.1:5174
```

## Variáveis de Ambiente

Crie os arquivos locais a partir dos exemplos:

```powershell
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.env.example backend/.env.local
```

Frontend:

```env
VITE_API_URL=http://127.0.0.1:8006
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=cole_aqui_a_anon_key_publica
VITE_GOOGLE_CLIENT_ID=seu_client_id_google
VITE_GOOGLE_MAPS_API_KEY=sua_chave_google_maps
```

Backend:

```env
DATABASE_URL=
CORS_ALLOWED_ORIGINS=http://127.0.0.1:5174,http://localhost:5174
SUPABASE_JWT_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Google

Para testar login e importação de contatos pelo Google:

1. Crie um projeto no Google Cloud.
2. Ative a Google People API.
3. Configure a tela de consentimento OAuth.
4. Adicione seu email como usuário de teste enquanto o app estiver em modo teste.
5. Crie credenciais OAuth do tipo **Web application**.
6. Em **Authorized JavaScript origins**, adicione `http://127.0.0.1:5174`.
7. Copie o **Client ID** para `VITE_GOOGLE_CLIENT_ID` em `frontend/.env.local`.
8. Reinicie o frontend.

O fluxo usa Google Identity Services no navegador e Google People API para contatos.

## IA / Chat

O chat funciona mesmo sem chave externa, usando regras locais para:

- buscar contatos;
- sugerir comandos parecidos quando a frase não é reconhecida;
- selecionar ou digitar o contato alvo no mesmo campo;
- sugerir categorias;
- marcar, alterar, concluir ou cancelar follow-ups;
- bloquear conflito de follow-up no mesmo dia e horário;
- atualizar dados de CRM com confirmação.

Com `OPENAI_API_KEY`, o backend pode usar modelo externo para melhorar a conversa.

## Banco de Dados

Sem `DATABASE_URL`, o SQLite é criado automaticamente em:

```text
backend/data/network_agenda.sqlite3
```

Esse arquivo não deve ir para o GitHub.

Com `DATABASE_URL=postgresql://...`, o backend usa Postgres/Supabase e cria as tabelas pelo schema em `backend/app/postgres_schema.sql`.

Tabelas principais:

- `users`: usuários, dados de perfil, autenticação, endereço, conexão Google e perfil público.
- `contacts`: contatos privados por `owner_id`.
- `public_profiles`: serviços/rede pública usados como sugestões iniciais.
- `merge_suggestions`: sugestões de duplicidade aprovadas/ignoradas.

## Endpoints Principais

```text
GET    /api/health
GET    /api/categories
GET    /api/contacts?user_id=1
POST   /api/contacts
PUT    /api/contacts/{contact_id}
DELETE /api/contacts/{contact_id}?user_id=1

POST   /api/users
POST   /api/login
POST   /api/google-login
GET    /api/users
GET    /api/users/lookup?phone=...

GET    /api/address/lookup?query=...
GET    /api/public-profiles
GET    /api/merge-suggestions?user_id=1
POST   /api/merge-suggestions/ignore
POST   /api/merge-suggestions/merge
POST   /api/ai/chat
GET    /api/search?query=...&user_id=1
```

## Usuários de Teste

Quando o banco está vazio:

```text
ana@network.local / 123456
admin@network.local / admin123
```

## Build e Validação

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

O frontend esta preparado para deploy no Vercel usando `frontend` como Root Directory. O backend FastAPI agora suporta SQLite local e Supabase Postgres via `DATABASE_URL`; para deploy publico, use Supabase Postgres.

Guia detalhado: `docs/DEPLOYMENT.md`.

Guia Supabase: `docs/SUPABASE.md`.

Roteiro de publicacao: `docs/GO_LIVE.md`.

## Status

MVP funcional em desenvolvimento local. A versão atual é focada em navegador; empacotamento app/PWA completo fica para uma etapa posterior. Integrações com Google, Google Maps e IA externa dependem de chaves reais. A próxima prioridade é consolidar testes automatizados, persistência de produção e autenticação/token robustos.
