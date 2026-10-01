# KAMBAN

Plataforma de gestão de projetos, backlog e Kanban — núcleo de uma futura plataforma corporativa de gestão de demandas.

- **Diretriz do projeto:** [docs/diretriz-desenvolvimento.md](docs/diretriz-desenvolvimento.md)
- **Stack:** React + TypeScript (Vite) · PocketBase 0.40 + hooks JS · API REST `/api/v1`

## Como rodar

```bash
cd backend && npm install && npm run setup && cd ..   # dependências + binário do PocketBase
cd web && npm install && cd ..
cp backend/.env.example backend/.env                  # defina KAMBAN_ADMIN_EMAIL / KAMBAN_ADMIN_PASSWORD
npm --prefix backend run create-admin                 # cria o super administrador
npm run dev                                           # API :8090 + web :5173
```

Abra http://localhost:5173.

| Comando (raiz) | O que faz |
|---|---|
| `npm run dev` | API e web juntos |
| `npm run check` | lint, tipos e todos os testes (unitários e API) |
| `npm run build` | build do frontend em `backend/pb_public` (servido pelo PocketBase) |
| `npm run e2e` | build + testes de ponta a ponta no navegador (Edge instalado; fluxos do MVP, acessibilidade e responsividade) |

## Estado atual — Fases 1 a 4 concluídas (Fundação, Projetos, Tipos e campos, Tarefas)

- **Fundação:** autenticação com sessão segura (troca/redefinição de senha, sessões ativas), RBAC configurável (perfis e matriz de permissões), usuários, auditoria consultável, API documentada (OpenAPI), design system com tema claro/escuro, i18n (pt-BR, en, es), command palette (Ctrl/⌘+K), DataTable padrão e toasts React-Toastify.
- **Projetos:** cadastro com chave única, status, prioridade, datas, ícone e capa; membros com papéis (gestor, membro, leitor); posse transferível; arquivar/excluir; histórico; visões Todos / Meus / Arquivados.
- **Tipos de tarefa e campos personalizados:** biblioteca de campos (17 tipos: texto, número, decimal, data, seleção única/múltipla, URL, e-mail, telefone…) com opções coloridas, valor padrão e comportamento (pesquisável, filtrável, ordenável); tipos de tarefa reordenáveis por arrastar (mouse, toque ou teclado) com campos obrigatórios/visíveis/no card e pré-visualização do formulário. Seed com 8 tipos (Bug, Desenvolvimento, Melhoria…) e 21 campos.

- **Tarefas:** status e prioridades configuráveis; tarefas com código por projeto (CRM-12), formulário dinâmico por tipo, lista com filtros, detalhe com troca rápida de status/prioridade/responsável; tags, checklist e comentários com menções (@) — qualquer pessoa com acesso ao projeto comenta, inclusive leitor; anexos e imagens com verificação do tipo real do arquivo, galeria e visualizador com zoom; tudo no histórico.

Os módulos das próximas fases (relatórios…) aparecem na navegação como "Em breve".

## Documentação

| | |
|---|---|
| [Arquitetura](docs/architecture.md) | camadas, dependências, fluxo de requisição, estado |
| [Banco de dados](docs/database.md) | collections, índices, auditoria |
| [API](docs/api.md) | convenções, envelope, erros, endpoints |
| [Segurança](docs/security.md) | sessão, CSRF, CSP, RBAC, rate limit |
| [Permissões](docs/permissions.md) | catálogo, matriz, regras anti-escalonamento |
| [Design System](docs/design-system.md) | tokens, componentes, DataTable |
| [Testes](docs/testing.md) | estratégia e comandos |
| [Implantação](docs/deployment.md) | execução, build e produção |
| [Decisões](docs/decisions.md) | ADRs |
