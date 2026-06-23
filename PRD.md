# PRD - Network Intelligence CRM

Documento vivo do MVP atual. Este PRD atualiza o escopo original e deixa explicito o que ja foi entregue, o que esta parcial e o que continua pendente.

## 1. Produto

`Network Intelligence CRM` e um webapp PWA-first para organizar contatos, gerar inteligencia de networking e operar tres contextos separados:

1. agenda privada do usuario;
2. grupos compartilhados com governanca propria;
3. rede publica opcional com perfis visiveis dentro da plataforma.

O foco do MVP continua sendo:

- organizar a rede pessoal e profissional;
- localizar rapidamente quem ajuda em um tema;
- descobrir oportunidades, complementariedades e introducoes;
- operar relacionamento continuo via CRM;
- abrir a camada de comunidade e descoberta publica sem misturar dados privados.

## 2. Escopos de dados

### 2.1 Agenda privada

Escopo individual do usuario autenticado.

Status: `implementado`

Inclui:

- lista de contatos;
- detalhe completo;
- CRM;
- deduplicacao;
- campos customizados;
- grafo privado;
- mapa/proximidade;
- chat copiloto;
- importacao e edicao.

### 2.2 Grupos compartilhados

Escopo coletivo com base propria de membros, contatos, mensagens e campos.

Status: `implementado`

Inclui:

- criacao de grupos por conta admin;
- convite e remocao de membros;
- contatos compartilhados separados da agenda pessoal;
- grafo do grupo;
- chat do grupo;
- campos customizados por grupo;
- leitura de permissao por owner, admin e membro.

### 2.3 Rede publica

Escopo opcional de descoberta.

Status: `implementado`

Inclui:

- perfil publico separado do perfil pessoal;
- cards publicos;
- grafo publico;
- feed publico;
- exploracao de perfis e servicos.

## 3. Perfis e permissoes

### Visitante

Status: `implementado`

- acessa landing, login e cadastro;
- nao acessa as areas internas.

### Usuario padrao

Status: `implementado`

- gerencia agenda privada;
- usa dashboard, agenda, CRM, grafo, mapa, chat e rede publica;
- pode ativar perfil publico;
- participa de grupos dos quais faz parte.

### Usuario admin

Status: `implementado`

- tudo do usuario padrao;
- cria grupos compartilhados;
- gerencia membros, contatos compartilhados e campos de grupo;
- acessa visao administrativa de conexoes.

## 4. Status por requisito obrigatorio

### 4.1 Autenticacao

Status: `parcial`

Ja entregue:

- Google login;
- magic link quando Supabase Auth estiver configurado;
- placeholder de Apple login;
- protecao de areas internas para usuarios nao autenticados.

Observacoes:

- ainda existe fallback local com email e senha para modo legado/desenvolvimento;
- a API entra em modo `Supabase-first` quando `SUPABASE_JWT_SECRET` esta configurado;
- rollout final de auth 100% Supabase com RLS continua pendente.

### 4.2 PWA e mobile-first

Status: `parcial avancado`

Ja entregue:

- manifest;
- service worker;
- instalacao em Android e desktop;
- splash/app shell;
- `display: standalone`;
- cache basico inteligente;
- suporte a navegacao offline para dados ja carregados;
- fila de mutacoes offline com sincronizacao ao reconectar;
- navegacao app-like com bottom tab no mobile e sidebar/menu no desktop;
- suporte a dark e light theme.

Pendente:

- push notifications reais;
- estrategia mais robusta de conflito e sincronizacao offline.

### 4.3 Onboarding

Status: `implementado`

Fluxo atual:

1. login;
2. completar perfil;
3. definir visibilidade publica;
4. importar contatos;
5. ver primeiros insights.

### 4.4 Dashboard

Status: `implementado`

Ja entregue:

- total de contatos;
- atalhos de importacao, CRM, feed, grupos, mapa e chat;
- indicacao de duplicados;
- mini grafo da rede;
- leitura de backend online/offline;
- prompts de copiloto.

### 4.5 Agenda, detalhe e CRM

Status: `implementado`

Ja entregue:

- lista de contatos com busca;
- detalhe visual do contato;
- edicao e exclusao;
- tags;
- demanda atual;
- problema que resolve;
- notas;
- links sociais;
- status e prioridade de CRM;
- agendamento, conclusao, cancelamento e remarcacao de follow-up;
- bloqueio de conflito de horario no mesmo slot.

### 4.6 Importacao de contatos

Status: `parcial`

Ja entregue:

- Google Contacts real;
- CSV;
- cadastro manual.

Entregue como base de evolucao:

- placeholders claros para Apple Contacts, Outlook e LinkedIn export.

Pendente:

- integracoes reais com Apple Contacts, Outlook e LinkedIn.

### 4.7 Duplicacao e merge

Status: `implementado`

Ja entregue:

- sugestao de duplicados por email igual;
- sugestao de duplicados por telefone igual;
- merge manual;
- ignorar;
- revisar antes de aplicar.

### 4.8 Campos customizados

Status: `implementado`

Ja entregue:

- escopo `user`;
- escopo `group`;
- tipos `text_short`, `text_long`, `number`, `dropdown`, `checkbox`, `multiselect` e `date`;
- exibicao no detalhe;
- edicao por definicao e por valor.

### 4.9 Chat preparado para IA

Status: `implementado`

Ja entregue:

- UX de copiloto embutido;
- busca por contexto sobre a base do usuario;
- respostas locais para contatos, tags, CRM e follow-up;
- sugestoes com confirmacao antes de alterar dados;
- integracao opcional com OpenAI pelo backend.

Pendente:

- agente mais autonomo;
- edicoes mais amplas em lote;
- memoria conversacional mais profunda por thread.

### 4.10 Rede publica e perfil visivel

Status: `implementado`

Ja entregue:

- chave `quero ser vista(o) na rede` no perfil publico;
- card publico com nome, avatar, descricao, tags, demanda, problema que resolve e links preenchidos;
- lista publica;
- grafo publico;
- feed publico.

Parcial:

- match automatico entre contato interno e usuario real da plataforma ainda precisa ficar mais forte e mais explicito em todos os contextos.

### 4.11 Grafos

Status: `parcial avancado`

Ja entregue:

- grafo privado fora dos grupos;
- grafo do grupo;
- grafo da rede publica;
- diferenciacao visual de tipos de no;
- filtros em area unica de busca com seletor;
- tema claro e escuro consistentes;
- zoom, pan, foco e abertura de detalhe.

Parcial:

- tags e DDD ja aparecem como tipos distintos de no;
- relacoes mais ricas como demanda, problema que resolve, fonte e empresa ainda podem evoluir como nos de primeira classe em todas as views;
- a analise de caminhos e complementaridade ainda e mais visual do que analitica.

Regra mantida:

- o usuario nao edita a estrutura do grafo diretamente pelo canvas.

### 4.12 Busca e inteligencia de networking

Status: `parcial`

Ja entregue:

- busca por nome, servico, cidade, categoria, tags e campos de CRM;
- copiloto com perguntas do tipo "quem pode ajudar com X?";
- exploracao por grupo, rede publica e agenda privada.

Pendente:

- camada mais forte de busca semantica;
- rankeamento mais avancado por complementaridade;
- uso pleno de todos os campos customizados no motor de busca.

### 4.13 Documentacao API

Status: `implementado`

Ja entregue:

- Swagger automatico do FastAPI em `/docs`;
- OpenAPI JSON em `/openapi.json`;
- pagina interna `/api-docs` para descoberta rapida.

## 5. Modelo de dados do MVP

Status: `parcial avancado`

Ja suportado hoje:

- `users`
- `contacts`
- `contact_phones`
- `contact_emails`
- `contact_tags`
- `public_profiles`
- `merge_suggestions`
- `groups`
- `group_members`
- `group_contacts`
- `group_messages`
- `custom_fields`
- `custom_field_values`

Observacoes:

- o modelo ja suporta avatar, links sociais, tags, demanda, problema que resolve, DDD derivado e CRM;
- ainda ha espaco para reforcar entidades dedicadas para fontes, arestas de grafo, historico detalhado e threads persistentes de chat.

## 6. Diferencas relevantes em relacao ao PRD original

O MVP atual ja cobre o nucleo do pedido original, mas com alguns ajustes pragmaticos:

- o app esta PWA-ready agora, nao apenas "browser-first";
- grupos compartilhados voltaram a existir como modulo principal;
- ha um `feed` publico adicional, alem da exploracao por cards e grafo;
- a documentacao de API esta disponivel ja no MVP;
- a autenticacao final ainda nao esta 100% consolidada em Supabase-only;
- o grafo esta forte em experiencia visual e navegacao, mas ainda nao materializa todos os tipos de relacao da especificacao original.

## 7. Pendencias prioritarias

1. fechar auth de producao com Supabase + RLS;
2. concluir deploy estavel em Vercel + Render + Supabase;
3. ampliar match automatico entre contato privado, membro de grupo e perfil publico;
4. evoluir o motor de busca/inteligencia;
5. adicionar integracoes restantes de importacao;
6. ativar push notifications;
7. enriquecer o grafo com mais tipos de no e relacao.

## 8. Criterio de aceite do estado atual

O MVP atual e considerado coerente quando:

- um usuario entra, conclui onboarding e navega entre agenda, CRM, grafo, chat, grupos e rede publica;
- contatos podem ser importados por Google, CSV ou cadastro manual;
- duplicados podem ser revisados sem merge automatico;
- grupos mantem dados separados da agenda pessoal;
- o perfil publico fica separado do perfil proprio;
- o app funciona como PWA instalavel com suporte offline basico;
- a API exposta pelo FastAPI continua documentada e operavel.
