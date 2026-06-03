# PRD - Network Agenda

## 1. Visao Geral

Network Agenda e um webapp PWA-first, mobile-first e multiusuario para gestao inteligente de contatos, CRM pessoal e networking.

O produto combina:

- agenda privada de contatos por usuario;
- importacao de contatos;
- categorizacao por servicos e tags;
- CRM de relacionamento e follow-ups;
- mapa/grafo de proximidade;
- chat de copiloto;
- rede publica opcional com perfis visiveis;
- servicos oferecidos exibidos por tags na rede publica.

## 2. Objetivo

Permitir que cada usuario organize sua rede pessoal/profissional e encontre rapidamente pessoas uteis para indicacoes, servicos, oportunidades e conexoes.

O sistema deve ajudar o usuario a:

- organizar contatos privados;
- encontrar pessoas por servico, categoria, tag, cidade ou contexto;
- importar contatos do Google, CSV e cadastro manual;
- visualizar contatos em lista, CRM, dashboard e mapa/grafo;
- controlar follow-ups e conversas;
- escolher se quer aparecer na rede publica;
- descobrir servicos oferecidos por tags.

## 3. Tipos de Usuario

### Visitante

- Acessa apenas login/cadastro.

### Usuario padrao

- Gerencia sua propria agenda privada.
- Importa contatos.
- Edita perfil.
- Usa CRM, dashboard, mapa/grafo e chat.
- Pode ativar perfil publico.

### Admin

- Tem as permissoes do usuario padrao.
- Acessa area administrativa.

## 4. Escopos de Dados

O produto possui tres escopos principais:

1. **Contatos privados:** base pessoal de cada usuario.
2. **Rede publica opcional:** perfis de usuarios que optam por serem vistos na plataforma.
3. **Servicos oferecidos:** agrupamentos iniciais por tags/servicos dentro da rede publica.

Contatos privados nunca devem se misturar entre usuarios.

## 5. MVP Atual

Funcionalidades implementadas:

- Login por email/senha.
- Login Google com Google Identity Services.
- Cadastro com dados do Google quando disponiveis.
- Sessao local com validade de 24 horas.
- Agenda privada por usuario.
- Cadastro, edicao, exclusao e detalhe completo de contatos.
- Campos ricos no contato: descricao, tags, demanda atual, problema que resolve, links e campos personalizados.
- Importacao por Google Contacts, CSV e cadastro manual.
- Categorias automaticas por servico/nome/metadados.
- Deduplicacao por telefone/email com aprovacao manual.
- Dashboard com metricas e atalhos.
- CRM com status, prioridade, follow-up com horario, concluir, alterar e cancelar.
- Chat operacional preparado para IA, com acoes de categoria, tags e CRM.
- Mapa/grafo 3D com contatos filtrados por tags.
- Perfil publico opcional.
- Rede publica com pessoas visiveis e servicos oferecidos por tags.
- Configuracoes com perfil, importacao Google, duplicados, exportacao e sessao.
- Area administrativa basica.
- Backend com OpenAPI/Swagger automatico do FastAPI.

## 6. Ajustes de Produto Decididos

- A aba independente de grupos foi removida.
- A antiga ideia de grupos recomendados foi reposicionada como **Servicos oferecidos** dentro da Rede Publica.
- O CTA desses cards agora e **Verificar**, nao "Abrir grupo".
- A experiencia principal deve priorizar Agenda, CRM, Mapa, Chat, Rede Publica e Configuracoes.

## 7. Modelo de Contato

Cada contato suporta:

- id;
- owner_id;
- nome;
- telefone;
- servico;
- nota;
- cidade;
- endereco;
- origem;
- categoria;
- descricao;
- demanda atual;
- problema que resolve;
- tags;
- email;
- WhatsApp;
- Instagram;
- LinkedIn;
- URL customizada;
- campos personalizados;
- status CRM;
- prioridade CRM;
- ultimo contato;
- proximo follow-up;
- nota CRM;
- data de criacao.

## 8. Rede Publica

Usuarios podem ativar a opcao **Quero ser vista na rede publica**.

Quando ativa, o perfil publico pode exibir:

- nome;
- regiao;
- descricao publica;
- demanda atual;
- problema que resolve;
- tags publicas;
- WhatsApp;
- Instagram;
- LinkedIn;
- URL customizada.

Links sociais so aparecem quando preenchidos.

## 9. Servicos Oferecidos

Dentro da Rede Publica, os servicos sao exibidos como cards por tags.

Cada card mostra:

- nome do servico/tema;
- categoria;
- tags;
- tamanho da rede;
- tempo de resposta;
- score;
- botao **Verificar**.

## 10. Importacao

### Implementado

- Manual.
- CSV/TXT.
- Google People API via OAuth.

### Regra importante

Google nao deve ser tratado como upload de arquivo. Login/importacao Google usam OAuth e consentimento do usuario.

## 11. Autenticacao

### Implementado

- Email e senha.
- Senha armazenada com hash e salt.
- Google login.
- Usuario nao autenticado nao acessa areas internas.
- Sessao local expira em 24 horas.

### Futuro

- Supabase Auth ou equivalente.
- Magic link.
- Apple login como placeholder.
- Sessao/token seguro de producao.

## 12. PWA e UX

Requisitos de UX:

- dark mode como padrao;
- layout responsivo para Android e desktop;
- navegacao app-like;
- bottom tab bar no mobile;
- visual moderno e premium;
- service worker;
- manifest;
- preparacao para offline basico.

## 13. Mapa e Grafo

### Implementado

- Grafo 3D interativo com Three.js.
- Exibicao de contatos com tags.
- Filtro por servico.
- Localizacao por endereco/cidade/DDD quando possivel.
- Abertura de localizacao no Google Maps.

### Evolucao

- Melhorar geocodificacao com API Google configurada.
- Criar camadas de nos para tags, fontes, DDDs, demandas e problemas resolvidos.
- Melhorar performance para redes maiores.

## 14. Chat Preparado para IA

O chat deve atuar como copiloto operacional.

No MVP, ele pode:

- buscar contatos;
- sugerir categorias;
- adicionar tags;
- marcar CRM/follow-up;
- concluir follow-up;
- cancelar ou alterar follow-up;
- responder em formato conversacional.

No futuro, pode usar agente externo para acoes mais complexas, sempre com confirmacao.

## 15. Integracoes

- ViaCEP para endereco por CEP.
- Nominatim/OpenStreetMap para busca textual de endereco.
- Google Maps para mapa e distancias.
- Google Identity Services para login Google.
- Google People API para importar contatos.
- OpenAI opcional para chat.
- OpenAPI/Swagger via FastAPI.

## 16. Criterios de Aceite do MVP

- Visitante nao acessa app interno sem login.
- Cadastro exige campos principais.
- Cada usuario ve apenas seus contatos.
- Google login funciona com OAuth configurado.
- Importacao Google salva contatos no usuario correto.
- Contato possui detalhe completo e campos ricos.
- Duplicados sao sugeridos, nunca mesclados automaticamente.
- CRM salva follow-ups e mostra no CRM.
- Chat aplica acoes no banco e reflete no CRM.
- Rede publica so mostra usuarios que ativaram visibilidade.
- Servicos oferecidos aparecem dentro da Rede Publica, por tags.
- App roda localmente com frontend `5174` e backend `8006`.
