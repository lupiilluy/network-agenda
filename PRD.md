# PRD - Network Agenda

## 1. Visão Geral

Network Agenda é um webapp PWA-first, mobile-first e multiusuário para gestão inteligente de contatos e networking.

O produto combina uma agenda privada de contatos com recursos de rede: categorias, importação, perfis públicos opcionais, grupos compartilhados, mapa e futura visualização em grafo.

## 2. Objetivo

Permitir que cada usuário organize sua rede pessoal/profissional e encontre rapidamente pessoas úteis para indicações, serviços, oportunidades e conexões.

O sistema deve ajudar o usuário a:

- organizar contatos;
- encontrar pessoas por serviço, categoria ou contexto;
- importar contatos de fontes externas;
- visualizar conexões em mapa e futuramente em grafo;
- participar de uma rede compartilhada com perfis e grupos.

## 3. Tipos de Usuário

### Visitante

- Acessa apenas login/cadastro.

### Usuário padrão

- Gerencia sua própria agenda privada.
- Importa contatos.
- Edita perfil.
- Pode marcar se é colaborador.
- Acessa mapa e grupos recomendados.

### Admin

- Tem as permissões do usuário padrão.
- Acessa área administrativa.
- Futuramente cria e gerencia grupos compartilhados.

### Membro de grupo

- Acessa grupos dos quais faz parte.
- Pesquisa contatos/perfis dentro do grupo.

## 4. Escopos de Dados

O produto possui três escopos principais:

1. **Contatos privados:** base pessoal de cada usuário.
2. **Grupos compartilhados:** bases administradas por usuários admin.
3. **Rede pública opcional:** perfis de usuários que optam por serem vistos na rede.

Contatos privados nunca devem se misturar entre usuários.

## 5. MVP Atual

Funcionalidades já previstas/implementadas no MVP:

- Login e cadastro.
- Senha obrigatória.
- Tela de autenticação isolada.
- Agenda privada por usuário.
- Cadastro rápido de contato.
- Nome, telefone e serviço obrigatórios.
- Endereço opcional no contato.
- Busca de endereço com opções para escolha.
- Edição e exclusão de contatos.
- Filtros por categoria dentro da agenda.
- Importação por telefone quando suportado pelo navegador.
- Integração de teste com Google Identity Services e Google People API.
- Perfil com CEP, endereço, interesses e opção de colaborador.
- Mapa com contatos e perfis cadastrados.
- Grupos recomendados.
- Área administrativa visível apenas para admin.
- Backend com OpenAPI/Swagger.

## 6. Funcionalidades Futuras

- Dashboard com métricas e insights.
- Tags livres ilimitadas.
- Campos personalizados por usuário e por grupo.
- Detalhe completo do contato.
- Deduplicação e sugestão de merge.
- Grupos compartilhados reais.
- Perfil público visível na rede.
- Grafo interno, público e por grupo.
- Chat preparado para IA/copiloto.
- Login por magic link.
- Apple login como coming soon.
- Migração para Supabase/Postgres em produção.

## 7. Modelo de Contato

### MVP

Cada contato possui:

- id;
- owner_id;
- nome;
- telefone;
- serviço;
- cidade;
- endereço;
- origem;
- categoria;
- data de criação.

### Evolução

O contato deve evoluir para suportar:

- avatar/foto;
- descrição;
- tags ilimitadas;
- múltiplos telefones;
- múltiplos emails;
- DDD derivado do telefone;
- links sociais;
- o que demanda atualmente;
- problema que resolve;
- notas internas;
- campos personalizados;
- vínculo com usuário real da plataforma;
- vínculo com grupos e perfil público.

## 8. Importação

### MVP

- Manual.
- CSV/TXT/VCF como alternativa.
- Contact Picker API quando disponível.
- Google People API em modo de teste.

### Regra importante

Google não deve ser tratado como upload de arquivo. Login/importação Google devem usar OAuth e consentimento do usuário.

## 9. Autenticação

### MVP

- Email e senha.
- Senha obrigatória.
- Senha armazenada com hash e salt.
- Usuário não autenticado não acessa áreas internas.

### Futuro

- Supabase Auth ou equivalente.
- Google login em produção.
- Magic link.
- Apple login.
- Sessão/token seguro.

## 10. PWA e UX

O app deve priorizar celular, mas funcionar bem no desktop.

Requisitos:

- dark mode como padrão;
- layout responsivo;
- navegação app-like;
- bottom tab bar no mobile;
- visual moderno e premium;
- service worker;
- manifest;
- preparação para offline básico;
- preparação para push notifications futuras.

## 11. Mapa e Grafo

### Mapa

O mapa deve exibir:

- origem pelo endereço do usuário;
- contatos da agenda;
- perfis cadastrados;
- distâncias quando possível.

### Grafo Futuro

O grafo deve ser visualmente forte, com estética de network intelligence.

Nós planejados:

- contatos;
- usuários;
- grupos;
- tags;
- fontes;
- DDDs;
- demandas;
- problemas resolvidos.

Relações planejadas:

- possui tag;
- importado de fonte;
- pertence a grupo;
- demanda algo;
- resolve algo;
- tem DDD;
- vinculado a usuário da plataforma.

## 12. Grupos Compartilhados

Grupos representam comunidades, eventos, hubs ou redes específicas.

Funcionalidades futuras:

- criar grupo;
- editar grupo;
- convidar membros;
- remover membros;
- gerenciar contatos do grupo;
- campos personalizados do grupo;
- grafo do grupo;
- busca dentro do grupo.

## 13. Chat Preparado para IA

O app deve ter um módulo de chat com UX de copiloto.

No MVP/fase inicial, o chat deve ser preparado para responder buscas estruturadas, como:

- “quem presta serviço de limpeza?”
- “quem resolve problema jurídico?”
- “quem está buscando investimento?”

No futuro, o chat poderá editar dados com confirmação do usuário.

## 14. Integrações

- ViaCEP para endereço por CEP.
- Nominatim/OpenStreetMap para busca textual de endereço.
- Google Maps para mapa e distâncias.
- Google Identity Services para login Google.
- Google People API para importar contatos.
- OpenAPI/Swagger via FastAPI.

## 15. Critérios de Aceite do MVP

- Visitante não acessa agenda sem login.
- Cadastro exige senha.
- Campos obrigatórios ficam destacados.
- Cada usuário vê apenas seus contatos.
- Contato exige nome, telefone e serviço.
- Endereço do contato é opcional.
- Busca de endereço mostra opções.
- Filtros ficam dentro da agenda.
- Google não usa upload de arquivo como fluxo principal.
- Mapa inclui contatos e perfis.
- Admin vê área administrativa.
- Projeto roda localmente com frontend e backend.

## 16. Roadmap Resumido

### Fase 1 - MVP

- Login/cadastro.
- Agenda privada.
- Contatos por usuário.
- Categorias.
- Importação inicial.
- Perfil.
- Mapa.
- Admin básico.

### Fase 2 - CRM de networking

- Tags.
- Campos personalizados.
- Dashboard.
- Deduplicação.
- Detalhe completo do contato.

### Fase 3 - Rede compartilhada

- Perfis públicos.
- Grupos reais.
- Membros.
- Base compartilhada.

### Fase 4 - Inteligência

- Grafos.
- Chat IA.
- Busca em linguagem natural.
- Recomendações de conexões.
