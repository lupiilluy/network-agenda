# Network Agenda

Aplicativo mobile-first para agenda inteligente de contatos, networking e indicação de serviços. A ideia é unir uma agenda privada, parecida com contatos do celular, com recursos de rede: categorias automáticas, grupos recomendados, mapa de proximidade e perfis de usuários que também podem oferecer serviços.

## Objetivo

O Network Agenda resolve um problema simples: guardar contatos úteis de forma rápida, mas com contexto suficiente para encontrar a pessoa certa depois.

Em vez de salvar apenas nome e telefone, cada contato recebe um serviço. A partir desse serviço, o app classifica automaticamente em categorias como casa e manutenção, jurídico, saúde, tecnologia, educação, veículos e negócios. Cada usuário tem sua própria agenda privada, e os contatos não se misturam entre contas.

## Funcionalidades

- Login e cadastro de usuários.
- Senha obrigatória no cadastro e autenticação por email/senha.
- Tela de login/cadastro isolada do restante do app.
- Agenda privada separada por usuário.
- Cadastro rápido de contatos com nome, telefone e serviço obrigatórios.
- Endereço opcional no contato, com busca de opções para o usuário escolher.
- Edição e remoção de contatos.
- Filtros de categoria dentro da agenda.
- Importação de contatos do telefone quando o navegador suporta Contact Picker API.
- Integração de teste com Google Identity Services e Google People API para login rápido e importação de contatos.
- Perfil com endereço via CEP, interesses e opção de colaborador.
- Mapa da rede com contatos e perfis cadastrados.
- Grupos recomendados de acordo com interesses e categorias.
- Área administrativa para conexões, visível apenas para admin.

## Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Lucide React
- PWA básico com manifesto e service worker

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
uvicorn app.main:app --reload --host 127.0.0.1 --port 8005
```

A API fica em:

```text
http://127.0.0.1:8005
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

O app fica em:

```text
http://127.0.0.1:5174
```

## Variáveis de Ambiente

O frontend usa valores padrão para desenvolvimento local, mas aceita variáveis do Vite:

```env
VITE_API_URL=http://127.0.0.1:8005
VITE_GOOGLE_MAPS_API_KEY=sua_chave_google_maps
VITE_GOOGLE_CLIENT_ID=seu_client_id_google
```

### Google

Para testar login e importação de contatos pelo Google:

1. Crie um projeto no Google Cloud.
2. Ative a Google People API.
3. Crie um OAuth Client ID para aplicação web.
4. Adicione a origem local, por exemplo `http://127.0.0.1:5174`.
5. Configure `VITE_GOOGLE_CLIENT_ID`.

Sem `VITE_GOOGLE_CLIENT_ID`, o app continua funcionando com login por email/senha, mas o botão Google mostra uma mensagem pedindo configuração.

### Google Maps

Para carregar o mapa completo com geocodificação e distâncias:

1. Crie uma chave de API no Google Cloud.
2. Ative Maps JavaScript API, Geocoding API e Distance Matrix API.
3. Configure `VITE_GOOGLE_MAPS_API_KEY`.

Sem a chave, o app mostra um mapa incorporado simples e uma lista com fallback de distância quando possível.

## Banco de Dados

O SQLite é criado automaticamente em:

```text
backend/data/network_agenda.sqlite3
```

Esse arquivo não deve ir para o GitHub. Ele está ignorado pelo `.gitignore`.

Tabelas principais:

- `users`: usuários, senha com hash, endereço, interesses e perfil de colaborador.
- `contacts`: contatos privados, separados por `owner_id`.
- `public_profiles`: grupos/perfis públicos usados como sugestões.

## Endpoints Principais

```text
GET  /api/health
GET  /api/categories
GET  /api/contacts?user_id=1
POST /api/contacts
PUT  /api/contacts/{contact_id}
DELETE /api/contacts/{contact_id}?user_id=1

POST /api/users
POST /api/login
POST /api/google-login
GET  /api/users
GET  /api/users/lookup?phone=...

GET  /api/address/lookup?query=...
GET  /api/public-profiles
GET  /api/search?query=...
```

## Usuários de Teste

O banco cria usuários iniciais quando está vazio:

```text
ana@network.local / 123456
admin@network.local / admin123
```

O usuário admin consegue acessar a área de conexões.

## Build

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

## Status do Projeto

Este é um MVP funcional. Algumas integrações externas estão preparadas para teste, mas precisam de chaves reais:

- Google Maps precisa de `VITE_GOOGLE_MAPS_API_KEY`.
- Login/importação Google precisa de `VITE_GOOGLE_CLIENT_ID`.
- A busca de endereço usa endpoint externo e pode variar conforme disponibilidade.

## Próximos Passos

- Criar autenticação com sessão/token real.
- Adicionar migrations formais para o banco.
- Melhorar importação de contatos com deduplicação.
- Criar perfil público de colaborador com página própria.
- Melhorar mapa com rotas e filtros por categoria.
- Adicionar testes automatizados.
