# Changelog

Todas as mudanças relevantes do projeto ficam aqui. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- Pacote de publicação open source: licença Apache-2.0, NOTICE, guia de contribuição, código de conduta, política de segurança, integração contínua (GitHub Actions), imagem Docker com docker-compose e dados de demonstração (`npm run demo`).

### Alterado
- A Gestão de projetos virou item próprio do menu lateral (`/project-management`), fora da página do projeto; links antigos (`?tab=plan`) redirecionam.

### Corrigido
- Relatórios da Gestão de projetos: o nome do recurso não fica mais cortado (o detalhe de pendentes e horas foi para uma linha própria).

## [0.1.0] — 2026-10-01

Primeira versão.

### Adicionado
- **Fundação:** sessão segura em cookie HttpOnly, RBAC configurável (perfis e matriz de permissões), usuários, auditoria consultável, bloqueio progressivo de login, API própria `/api/v1` com OpenAPI, design system com tema claro/escuro, pt-BR/en/es, command palette (Ctrl/⌘+K).
- **Projetos:** membros com papéis (gestor, membro, leitor), arquivar, transferir posse, histórico.
- **Tipos de tarefa e campos personalizados:** 17 tipos de campo, obrigatoriedade por status, tipos traduzidos.
- **Tarefas:** formulário dinâmico por tipo, tags, checklist, comentários com @menções e imagens coladas, anexos com verificação do tipo real, relacionamentos (bloqueia/depende/relaciona/duplica), subtarefas e fork, notificações.
- **Kanban** com limite WIP e transições permitidas; **Planejamento** com sprints; **Timeline** das tarefas com marcos.
- **Relatórios** com indicadores clicáveis.
- **Documentação:** espaços, páginas com editor rico, versões e busca.
- **Gestão de projetos** (à parte das tarefas): quadro estilo Monday com grupos numerados, elementos e subelementos, etiquetas de status e recurso, filtros, arrastar, seleção em massa, dependências, importação CSV, painel do elemento (atualizações, @menções, imagens), visões Cronograma (linha de base, exportação), Kanban, Gestão (diário e problemas), Relatórios com a saúde do projeto e colunas personalizadas.
