# Testes

> Diretriz §5 (TDD: RED → GREEN → REFACTOR) e §42. Uma funcionalidade só está pronta com testes passando.

## Comandos
| Onde | Comando | O quê |
|---|---|---|
| raiz | `npm run check` | tudo abaixo (lint, tipos, unitários, API) |
| `backend/` | `npm test` | domínio + aplicação (`node --test`, fakes em memória) |
| `backend/` | `npm run test:api` | API ponta a ponta contra PocketBase real e isolado |
| `backend/` | `npm run coverage` | cobertura dos unitários |
| `backend/` | `npm run lint` | ESLint (inclui restrições do JSVM) |
| `web/` | `npm test` | Vitest + Testing Library (jsdom) |
| `web/` | `npm run typecheck` / `npm run lint` | TypeScript estrito / ESLint (a11y, hooks) |
| raiz | `npm run e2e` | build do front + testes de ponta a ponta no navegador (fluxos do MVP, acessibilidade e responsividade) |
| raiz | `npm run e2e:run` | só os testes de ponta a ponta, usando o build já gerado |

## Backend
- **Unitários** (`tests/unit`): regras de domínio (RBAC, sessão, usuário), validação, paginação e casos de uso com os fakes de `tests/support/fakes.js`, que implementam as mesmas portas dos repositórios PocketBase.
- **API** (`tests/api`): `tests/support/pb-harness.js` cria um diretório temporário, roda as migrations, cria admin e superusuário, sobe o PocketBase numa porta livre e derruba ao final. Cobre contrato do envelope, CSRF, cookie, bloqueio da API genérica, sessões/IDOR, RBAC, escalonamento, usuários, auditoria e rate limit.

## Frontend
- `core/networking/api-client.test.ts` — contrato HTTP (envelope, CSRF, correlation id, 401, rede, timeout).
- `domain/rbac.test.ts`, `data/mappers.test.ts`, `presentation/navigation/nav-items.test.ts`.
- `features/auth/auth-flow.test.tsx` — redirecionamentos, validação, erros, permissão, open redirect.
- `presentation/components/AppDataTable.test.tsx` — ações, ordenação, busca com debounce, persistência, estados.
- `core/i18n/locales.test.ts` — mesmas chaves nos 3 idiomas.
- `features/projects/ProjectFormDialog.test.tsx`, `features/projects/ProjectPreviewDrawer.test.tsx`, `features/account/AccountPage.test.tsx`, `features/audit/audit-format.test.ts`.
- `features/task-config/task-config-ui.test.tsx` — tipos de tarefa e campos personalizados.
- Utilitários: `src/test/utils.tsx` (`fakeRepositories`, `renderRoutes`, `renderWithProviders`).

## Ponta a ponta (Fase 9)
Pasta `e2e/` (node:test + playwright-core, com o **Edge instalado** — nada é baixado; `KAMBAN_E2E_CHANNEL=chrome` usa o Chrome, `KAMBAN_E2E_HEADED=1` mostra a janela). `e2e/support.mjs` sobe um PocketBase isolado (mesmo harness dos testes de API) servindo o **build de produção** (`backend/pb_public`), cria projeto, membro e leitor, e oferece login, chamadas à API pela sessão do navegador, axe-core e medições de layout.
- **`flows.e2e.test.mjs`** — critérios de aceite (§43): login com troca de idioma (en/es carregados sob demanda), senha errada, tema escuro, sair e voltar a exigir login; criar projeto e adicionar membro pela interface; Kanban (criação rápida, arrastar entre colunas e arrastar para coluna que exige campo → "Preencha para mover"); Planejamento (gestor cria a sprint, membro arrasta a tarefa para ela); comentário, relação "bloqueia" e fork; relatórios; leitor sem edição (Kanban, Planejamento, área administrativa e a própria API recusando); sessão encerrada em outro lugar volta ao login com aviso. Todo teste também exige **zero erros no console**.
- **`a11y.e2e.test.mjs`** — 25 telas + formulário de tarefa + paleta de comandos, em **desktop (1366) e celular (390), tema claro e escuro**: zero violações graves/críticas do axe-core (WCAG 2.1 A/AA), nenhuma rolagem horizontal, **nenhuma 2ª barra de rolagem** (só o `<main>` rola) e nenhum erro no console.
- Regressões que a varredura já pegou e que ficaram corrigidas: contraste do cinza "sutil" e dos selos coloridos (status, prioridade, tags) nos dois temas; botão de perigo no tema escuro; tabela oculta do gráfico esticando a página (2ª barra de rolagem que fazia a tela "tremer" ao abrir filtros no Dashboard, nos Relatórios e no tipo de tarefa).

Também na Fase 9: `tests/api/security-sweep.test.js` (ver [security.md](security.md#verificações-automatizadas-fase-9)), `tests/unit/audit-catalog.test.js` e `tests/api/performance.test.js` — 1.500 tarefas com relações e subtarefas; mede lista paginada, busca, ordenação, quadro, planejamento e relatórios (limite folgado de 2 s por chamada; na máquina de desenvolvimento: lista ~30 ms, quadro ~300 ms, planejamento ~130 ms, relatórios ~80 ms).

## Situação na entrega da Fase 9 (2026-09-30)
- Backend: **257** unitários + **78** de API — todos passando.
- Frontend: **175** testes — todos passando; typecheck e lint limpos; build sem avisos (pacote inicial 190 kB / 57 kB gzip, com en/es sob demanda).
- Ponta a ponta: **12** (8 fluxos + 4 varreduras de acessibilidade/responsividade) — todos passando.

## Expansão — Onda 1: Timeline (2026-09-30)
- Domínio: datas (início ≤ prazo), período da barra, setas e conflito, marcos (`domain-timeline.test.js`); geometria, escalas, arraste/pontas, soltar, grupos e régua (`web/src/domain/timeline.test.ts`).
- Casos de uso: início planejado (criação, edição com a data salva, limpar, histórico), timeline (tarefas, setas com conflito, sprints, marcos, capacidades, leitor e anti-IDOR) e marcos (gestor, validação, histórico do projeto) (`application-timeline.test.js`); API real (`api/timeline.test.js`); a varredura de segurança já cobre as rotas novas.
- Interface: barras e "Sem datas", teclado (mover e mudar o prazo), "Datas" com duração pela estimativa, leitor sem edição, marco pelo losango (`features/timeline/timeline-ui.test.tsx`); E2E arrastando a barra e puxando a ponta no Edge, leitor só vê; a tela entra na varredura de acessibilidade.

## Gerenciamento de Projetos — GP-1: quadro do projeto (2026-09-30)
- Domínio: grupos (validação, numeração 1.0/2.1, 2 níveis), etiquetas de status e de recurso, corpo do elemento (datas, horas, duração, progresso, recursos), subelemento (1 nível, ciclo), duração pelo cronograma, progresso (concluído, manual, subelementos ponderados/média, cancelados fora), totais do grupo e posição entre vizinhos (`domain-plan.test.js`); web: seções do quadro (fase só com subgrupos = cabeçalho), busca com subelementos, ordenação com vazios no fim, barra de status, números digitados e formatos (`web/src/domain/plan.test.ts`); estado das colunas — ordem, larguras, ocultas, recolhidas (`presentation/components/board/board-columns.test.ts`).
- Casos de uso: quadro com etiquetas padrão, grupos (gestor), elementos e subelementos (colaborador; leitor não), mover com os subelementos, excluir/duplicar grupo, etiquetas (status: gestor; recurso: nome único), histórico legível (`application-plan.test.js`); API real, inclusive "tarefas sem campos do quadro" (`api/plan.test.js`); catálogo de auditoria com `plan_item.*`, `plan_status.*`, `plan_resource.*`.
- Interface (`features/plan/plan-ui.test.tsx`): grupos numerados, fase com subgrupo, células e totais; editar nome, status e esforço na célula (valor inválido avisa); recursos (marcar e criar pela busca); subelementos e "+ Adicionar"; recolher/expandir tudo; menu da coluna (ordenar, ocultar em todos os grupos); excluir grupo com confirmação; quadro vazio cria o 1º grupo; leitor sem edição.
- E2E (`e2e/plan.e2e.test.mjs`, Edge): cria grupo e elementos pela linha de adicionar, status, cronograma por dois cliques (3 dias), recurso criado na busca, esforço com vírgula no rodapé, subelementos com progresso ponderado (88%), subgrupo, **arrasta a coluna** e oculta outra (lembrado ao recarregar), recolher lembrado, mover para o subgrupo, duplicar e excluir grupo, aba Tarefas intacta; leitor só vê (403 na API). A aba entra na varredura de acessibilidade (1366/390, claro/escuro).

## Gerenciamento de Projetos — GP-2: interação (2026-09-30)
- Domínio: dependências (depende de = bloqueia invertido; próprio, repetida, ciclo; pendentes; quando a regra vale), massa e mover (validação), importação (linhas, limites) (`domain-plan-interaction.test.js`); web: filtros combináveis (em branco, sem recurso, fase com subgrupos, período, progresso, atrasados, dependências), pessoa, agrupar por status/recurso/mês, totais das visões e dependências vistas do elemento (`web/src/domain/plan-view.test.ts`); CSV (separador, aspas, BOM), colunas em 3 idiomas, datas/números do idioma, linhas e modelo (`web/src/domain/plan-import.test.ts`).
- Casos de uso: mover (ordem sem histórico, grupo com histórico, subelementos, renumeração), duplicar, massa (status/recursos, mover, duplicar, excluir; tudo ou nada), dependências e regra (impedir iniciar/concluir; só sinalizar), importação (cria o que falta, pai por nome, tudo ou nada com linha/campo) (`application-plan-interaction.test.js`); API real com a migration 1790000022 (`api/plan.test.js`); catálogo de auditoria com `plan_settings.*`.
- Interface (`features/plan/plan-ui.test.tsx`): "Filtrar" no menu da coluna e "Filtros (1)", pessoa, agrupar por status, massa (status e excluir), dependência (desfazer, ligar, regra pelo gestor), dependência pendente volta o status com aviso, mover pelo menu e duplicar, importação (colunas, problema da linha, reimportar).
- E2E (`e2e/plan.e2e.test.mjs`, Edge): arrasta elemento no grupo, para outro grupo (tabela vazia) e o grupo pelo título; filtro pela coluna, pessoa, agrupar por status; dependência com a regra "impedir"; massa; importa CSV. A varredura de acessibilidade cobre o painel de filtros, a barra da seleção e a importação (4 modos).

## Gerenciamento de Projetos — GP-3: painel do elemento (2026-09-30)
- Domínio: capacidades da atualização (autor edita; autor ou gestor exclui; responde só na principal; excluída/arquivado não), conversa (ordem das principais e das respostas), texto e contador (`domain-plan-updates.test.js`); menções extraídas para `domain/mentions.js` (os testes de tarefa continuam cobrindo).
- Casos de uso: publicar com menção (notifica `plan_mention`), responder (avisa o autor), leitor publica, menção inválida, resposta de resposta, editar (menção nova), excluir lógico com respostas, contador no quadro, arquivado; imagens/arquivos na atualização (junto com o texto ou só a imagem, tudo ou nada, limites, leitor anexa na sua, autor anexa depois, autor ou gestor exclui, excluir a atualização apaga os arquivos, editar pode deixar só a imagem) e histórico do elemento (`application-plan-collaboration.test.js`); API real com as migrations 1790000023–24: menção e resposta chegam em `/notifications`, atualização multipart com imagem (e só a imagem, na resposta), arquivo protegido com `nosniff`, contadores e histórico (`api/plan.test.js`).
- Interface: botão da linha com contador abre o painel e o endereço; publicar, responder, editar e excluir; endereço direto abre a aba (o antigo `panel=files` cai em Atualizações); imagem colada aparece em miniatura e publica sem texto; excluir arquivo; histórico e detalhes (`features/plan/plan-ui.test.tsx`); colar/soltar no `AppMentionTextarea` (texto copiado continua texto); imagem colada no comentário da tarefa (`collaboration-ui.test.tsx`); nome da imagem colada e limites do envio (`domain/attachments.test.ts`, `domain/plan-updates.test.ts`); notificação do quadro com o nome do elemento abre o projeto no painel (`features/notifications/notifications-ui.test.tsx`).
- E2E (`e2e/plan.e2e.test.mjs`, Edge): membro abre o painel pela linha, publica mencionando o administrador (escolhendo na lista do @) e **colando um print** (evento de paste real), vê a imagem na atualização e o histórico; o administrador clica na notificação e cai no painel do elemento; a resposta notifica o autor. O painel entra na varredura de acessibilidade (4 modos).

## Status e Planejamento (2026-09-30)
- Transições na tarefa: `statusChoices` (`web/src/domain/workflow.test.ts`) e listas do formulário Editar e da troca rápida só com o atual + destinos permitidos; sem transições, todos (`features/tasks/tasks-ui.test.tsx`).
- Planejamento com tudo que não está encerrado (em andamento entra; concluída/cancelada fora) (`application-backlog.test.js`, `api/backlog.test.js`).

## Expansão — Onda 2: Documentação (2026-09-30)
- Domínio: higienização do conteúdo (blocos/atributos, links e imagens perigosos removidos, limites), texto de busca sem acento e trecho, árvore (ciclo, profundidade, posição entre vizinhos) e acesso por espaço (`domain-docs.test.js`); web: árvore/arraste/destino, movimento otimista, links aceitos, sumário, destaque da busca e validação do espaço (`web/src/domain/docs.test.ts`).
- Casos de uso: espaço com página inicial, rascunho só para quem edita, publicar/versões/restaurar, mover sem ciclo, excluir com subpáginas, busca e arquivos (`application-docs.test.js`); API real: permissões, higienização, versões, busca sem acento, árvore, espaço de projeto e arquivo falso recusado (`api/docs.test.js`); auditoria no catálogo.
- Interface: leitura dos blocos (aviso, tabela, checklist, imagem com largura), links internos/externos, barra do editor e menu "Inserir", filtro do "/" (`rich-text.test.tsx`); início (espaços, recentes, busca com destaque, criação com chave sugerida), árvore/trilha/"Nesta página"/subpáginas, leitor sem edição, mover pelo teclado, excluir com contagem e publicar do editor (`features/docs/docs-ui.test.tsx`).
- E2E (`e2e/docs.e2e.test.mjs`, Edge): cria espaço, escreve com "/" (título, aviso), envia imagem, insere tabela, espera o rascunho salvo sozinho, publica, v2, restaura a v1 (v3), busca sem acento, arrasta página para dentro de outra na árvore e confere o leitor (sem editar, sem rascunhos, 403/404 na API). As 4 telas entram na varredura de acessibilidade.

## Tipos de tarefa traduzidos (2026-09-30)
- Domínio: idioma do `Accept-Language`, tradução com reserva no original, versões para edição e validação (`domain-content-locale.test.js`).
- Casos de uso: criar/editar com traduções, exibição no idioma da requisição, histórico e validação (`application-task-config.test.js`); nome traduzido no resumo das tarefas com histórico no original (`application-tasks.test.js`); relatórios (`application-reports.test.js`); API real com os 8 tipos padrão traduzidos pela migration (`api/task-config.test.js`).
- Interface: cliente HTTP envia `Accept-Language` (`api-client.test.ts`); formulário edita o original e as traduções (`task-type-translations.test.tsx`); E2E troca para espanhol e vê "Documentación" no formulário de tarefa.

## Obrigatoriedade por status (2026-09-30)
- Domínio: `requiredIn`/`isRequiredIn` (sempre, por status, oculto nunca) e validação considerando o status (`domain-task.test.js`, `domain/required-by-status.test.ts`).
- Casos de uso: gravar/validar/normalizar os status do campo e o histórico do tipo (`application-task-config.test.js`); criar, mudar de status (edição e `/move`) e esvaziar no status que exige (`application-tasks.test.js`); API real (`api/task-config.test.js`).
- Interface: configuração por status e "Validar como no status" (`task-config-ui.test.tsx`); "Preencha para mover" na troca rápida de status (`features/tasks/required-fields-ui.test.tsx`); E2E arrastando no Kanban para a coluna que exige o campo (`flows.e2e.test.mjs`).

## Situação na entrega da Fase 4 (2026-09-29)
- Backend: **205** unitários + **57** de API (inclui `notifications`) (inclui `workflow`, `tasks`, `collaboration` e `attachments` com upload multipart real) — todos passando.
- Frontend: **125** testes — todos passando; typecheck e lint limpos; build sem avisos.
- Cobertos: regras de acesso de tarefas (leitor comenta mas não edita; anti-IDOR), numeração por projeto, campos personalizados na tarefa, datas pela categoria do status, histórico legível, tags, checklist, comentários com menções (@), Markdown seguro (sem HTML cru, só links http/https), lista de menções por teclado e mouse, anexos (tipo pelo conteúdo — extensão falsa, SVG/HTML e HTML disfarçado de .txt recusados; download protegido com nosniff/CSP), galeria e visualizador, anexos em comentários, notificações (sino, leitura, navegação) e o cursor do campo de menções logo após escolher alguém.
- Estabilidade: `testTimeout` 15 s e `asyncUtilTimeout` 4 s (a suíte de UI roda em paralelo); rodar a partir de `E:\KAMBAN` (ver CLAUDE.md).

## Situação na entrega da Fase 3 (2026-09-28)
- Backend: **138** unitários + **38** de API (inclui `tests/api/task-config.test.js`) — todos passando.
- Frontend: **78** testes — todos passando; typecheck e lint limpos; build sem avisos.
- Fase 3 no front: `domain/task-config.test.ts` (validação de valores, slug), `features/task-config/task-config-ui.test.tsx` (editor de campos do tipo, pré-visualização com valor padrão, padrão único em seleção, opções vazias/repetidas), `AppDatePicker.test.tsx` e `core/utils/calendar.test.ts`.
- Regressões cobertas: toasts com `prefers-reduced-motion` (a barra de progresso não pode ser zerada); pré-visualização que ignorava o valor padrão do campo.
- Validação visual (Edge headless): tipos de tarefa, detalhe do tipo, campos personalizados e edição de campo em claro/escuro e mobile, sem rolagem horizontal.

## Convenções
- Teste descreve comportamento em português ("desativar usuário derruba as sessões dele").
- Regras de segurança sempre com teste negativo (o que **não** pode acontecer).
- Não testar detalhes de implementação de bibliotecas; testar o contrato do nosso código.
- Arrastar e soltar do Kanban foi validado no navegador (Playwright + Edge, fora da suíte): mover entre colunas, transição bloqueada, WIP, raias, criação rápida, tema escuro, celular e leitor. No jsdom não há layout, então os testes de UI cobrem renderização, filtros, raias, painel e criação rápida; as regras do arraste ficam em `domain/kanban.ts` (testes unitários). O Backlog foi validado da mesma forma (arrastar para a sprint, reordenar no mesmo grupo, mover de status, seleção em lote, tema escuro, celular e leitor), com dados temporários apagados ao final. Relacionamentos também (relacionar pela interface, "Bloqueada" no outro lado e no card do Kanban, subtarefa rápida, fork com checklist pendente, celular). Relatórios e dashboard foram conferidos em 1920/1366 px, claro/escuro e celular. Desde a Fase 9 os fluxos principais estão na suíte automatizada de ponta a ponta (`e2e/`).
