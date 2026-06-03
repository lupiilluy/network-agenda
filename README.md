# Network Agenda

Webapp PWA-first para gestao inteligente de contatos, CRM pessoal e networking. O produto combina uma agenda privada por usuario com organizacao por categorias, importacao de contatos, mapa/grafo de proximidade, CRM de follow-ups, chat operacional e uma rede publica opcional com perfis visiveis e servicos oferecidos.

## Objetivo

O Network Agenda ajuda cada usuario a organizar sua propria rede pessoal/profissional e encontrar rapidamente quem pode ajudar, prestar um servico, resolver um problema ou receber uma indicacao.

O MVP atual prioriza:

- base privada de contatos por usuario;
- importacao via Google Contacts, CSV e cadastro manual;
- categorizacao por servicos/tags;
- CRM com follow-ups, prioridade, status e conclusao;
- chat preparado para acionar organizacao e CRM;
- mapa/grafo interativo com contatos filtrados por tags;
- rede publica opcional para usuarios que querem aparecer dentro da plataforma;
- servicos oferecidos na rede publica apresentados por tags.

## Funcionalidades

- Login por email/senha.
- Login com Google OAuth.
- Importacao real de contatos via Google People API.
- Cadastro com dados preenchidos pelo Google quando disponiveis.
- Sessao local com expiracao em 24 horas.
- Agenda privada separada por usuario.
- Cadastro, edicao, remocao e detalhe completo de contatos.
- Campos ricos no contato: descricao, demanda atual, problema que resolve, tags, links sociais, email e campos personalizados.
- Deduplicacao por telefone/email com revisao manual.
- Dashboard com totais, pendencias, follow-ups e atalhos.
- CRM com abas de contatos ativos, com tags, sem tags e todos.
- Follow-up com data/hora, concluir, alterar e cancelar.
- Chat de copiloto para localizar contatos, ajustar categorias e acionar CRM.
- Mapa/grafo 3D com contatos que possuem tags.
- Distancias aproximadas por DDD/localizacao quando possivel.
- Perfil publico opcional: "quero ser vista na rede publica".
- Rede publica com cards de pessoas visiveis e servicos oferecidos.
- Servicos oferecidos exibidos como tags, com acao de verificar.
- Configuracoes com perfil, importacao Google, duplicados, exportacao e sessao.
- PWA basico com manifest e service worker.

## Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Lucide React
- Three.js
- PWA basico

### Backend

- Python
- FastAPI
- SQLite
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

## Variaveis de Ambiente

Crie os arquivos locais a partir dos exemplos:

```powershell
Copy-Item frontend/.env.example frontend/.env.local
Copy-Item backend/.env.example backend/.env.local
```

Frontend:

```env
VITE_API_URL=http://127.0.0.1:8006
VITE_GOOGLE_CLIENT_ID=seu_client_id_google
VITE_GOOGLE_MAPS_API_KEY=sua_chave_google_maps
```

Backend:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

## Google

Para testar login e importacao de contatos pelo Google:

1. Crie um projeto no Google Cloud.
2. Ative a Google People API.
3. Configure a tela de consentimento OAuth.
4. Adicione seu email como usuario de teste enquanto o app estiver em modo teste.
5. Crie credenciais OAuth do tipo **Web application**.
6. Em **Authorized JavaScript origins**, adicione `http://127.0.0.1:5174`.
7. Copie o **Client ID** para `VITE_GOOGLE_CLIENT_ID` em `frontend/.env.local`.
8. Reinicie o frontend.

O fluxo usa Google Identity Services no navegador e Google People API para contatos.

## IA / Chat

O chat funciona mesmo sem chave externa, usando regras locais para:

- buscar contatos;
- sugerir categorias;
- adicionar tags;
- marcar, alterar, concluir ou cancelar follow-ups;
- atualizar dados de CRM com confirmacao.

Com `OPENAI_API_KEY`, o backend pode usar modelo externo para melhorar a conversa.

## Banco de Dados

O SQLite e criado automaticamente em:

```text
backend/data/network_agenda.sqlite3
```

Esse arquivo nao deve ir para o GitHub.

Tabelas principais:

- `users`: usuarios, dados de perfil, autenticacao, endereco e perfil publico.
- `contacts`: contatos privados por `owner_id`.
- `public_profiles`: servicos/rede publica usados como sugestoes iniciais.
- `merge_suggestions`: sugestoes de duplicidade aprovadas/ignoradas.

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
GET    /api/search?query=...
```

## Usuarios de Teste

Quando o banco esta vazio:

```text
ana@network.local / 123456
admin@network.local / admin123
```

## Build e Validacao

Frontend:

```powershell
cd frontend
npm run build
```

Backend:

```powershell
cd backend
python -m compileall app
```

## Status

MVP funcional em desenvolvimento local. Integracoes com Google, Google Maps e IA externa dependem de chaves reais. A prioridade atual e consolidar a experiencia de rede publica, CRM, importacao e grafo antes de migrar para uma infraestrutura de producao com banco gerenciado e autenticacao robusta.
