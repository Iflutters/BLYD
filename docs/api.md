# API REST `/api/v1`

Especificação OpenAPI 3.1 servida em **`GET /api/v1/openapi.json`** (fonte: `backend/pb_hooks/src/http/openapi.js`).

## Convenções

- **Autenticação:** cookie `kb_session` (HttpOnly), obtido em `POST /auth/login`. Não há token no corpo das respostas.
- **CSRF:** `POST`, `PUT`, `PATCH` e `DELETE` exigem o header `X-Requested-With: kamban` (senão `403 CSRF_CHECK_FAILED`).
- **Correlation ID:** envie `X-Correlation-Id` (8–64 caracteres `[A-Za-z0-9-]`) ou o servidor gera um. Volta no header e em `meta.correlationId`.
- **JSON em snake_case**, datas ISO 8601 (UTC). Corpo JSON limitado a 1 MB.
- **Cache:** respostas com `Cache-Control: no-store`.

### Envelope
```json
{ "data": {}, "meta": { "correlationId": "..." }, "error": null }
```
```json
{ "data": null, "meta": { "correlationId": "..." }, "error": { "code": "USER_NOT_FOUND", "message": "User not found", "details": {} } }
```
**Tarefas — início planejado:** `start_date` (AAAA-MM-DD; `null` limpa) ao lado de `due_date`; início depois do prazo → `VALIDATION_ERROR` `start_date = after_due_date` (considera a data já salva quando só uma é enviada).

**Idioma:** o app envia `Accept-Language` (pt-BR, en ou es — o idioma da tela). Cadastros traduzidos (hoje: tipos de tarefa) saem nele; sem tradução ou idioma não suportado, sai o original (pt-BR). Os tipos também trazem `translations` com todas as versões (`pt-BR`, `en`, `es`; `""` = sem tradução) para edição; criar/editar aceita `translations: { en: { name, description }, es: {…} }` (substitui as anteriores; idioma fora de en/es → `VALIDATION_ERROR` `translations = invalid_locale`).

`VALIDATION_ERROR` traz `details.fields` = `{ campo: código }` (nas tarefas, campos personalizados vêm como `custom_values.<nome>`, e `details.status` = `{ id, name }` indica o status considerado — criar/editar/mover exige os campos obrigatórios do status em que a tarefa vai ficar) (códigos: `required`, `invalid_email`, `too_short`, `too_long`, `weak_password`, `invalid_format`, `invalid_option`, `invalid_type`, `too_many`, `invalid_date`, `incorrect`, `same_as_current`).

### Paginação, ordenação, filtros e busca
`?page=1&perPage=20` (máx. 100) · `?sort=name,-created_at` (só campos permitidos) · filtros por parâmetro (`status`, `role_id`) · `?search=`.
```json
"meta": { "page": 1, "perPage": 20, "total": 35, "totalPages": 2, "correlationId": "..." }
```

### Códigos de erro
| HTTP | Códigos |
|---|---|
| 400 | `VALIDATION_ERROR`, `BAD_REQUEST`, `USE_CHANGE_PASSWORD` |
| 401 | `UNAUTHENTICATED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `ACCOUNT_DISABLED`, `CSRF_CHECK_FAILED`, `PRIVILEGE_ESCALATION`, `CANNOT_EDIT_OWN_ROLE`, `CANNOT_DISABLE_SELF`, `ROLE_IMMUTABLE` |
| 404 | `ROUTE_NOT_FOUND`, `USER_NOT_FOUND`, `ROLE_NOT_FOUND`, `SESSION_NOT_FOUND`, `PROJECT_NOT_FOUND`, `MEMBER_NOT_FOUND`, `FIELD_NOT_FOUND`, `TASK_TYPE_NOT_FOUND`, `STATUS_NOT_FOUND`, `PRIORITY_NOT_FOUND`, `TASK_NOT_FOUND`, `COMMENT_NOT_FOUND`, `TAG_NOT_FOUND`, `ATTACHMENT_NOT_FOUND`, `NOTIFICATION_NOT_FOUND`, `SPRINT_NOT_FOUND`, `RELATION_NOT_FOUND`, `MILESTONE_NOT_FOUND`, `GROUP_NOT_FOUND`, `DOC_SPACE_NOT_FOUND`, `DOC_PAGE_NOT_FOUND`, `DOC_VERSION_NOT_FOUND`, `DOC_FILE_NOT_FOUND` |
| 409 | `TRANSITION_NOT_ALLOWED`, `RELATION_EXISTS`, `RELATION_CYCLE`, `NOT_IN_BACKLOG`, `EMAIL_ALREADY_IN_USE`, `ROLE_CODE_IN_USE`, `ROLE_IN_USE`, `PROJECT_KEY_IN_USE`, `PROJECT_ARCHIVED`, `PROJECT_NOT_ARCHIVED`, `MEMBER_ALREADY_EXISTS`, `CANNOT_REMOVE_OWNER`, `OWNER_ROLE_LOCKED`, `FIELD_NAME_IN_USE`, `FIELD_IN_USE`, `TASK_TYPE_KEY_IN_USE`, `TASK_TYPE_IN_USE`, `STATUS_KEY_IN_USE`, `STATUS_IN_USE`, `STATUS_IS_DEFAULT`, `PRIORITY_KEY_IN_USE`, `PRIORITY_IN_USE`, `PRIORITY_IS_DEFAULT`, `TAG_NAME_IN_USE`, `DOC_SPACE_KEY_IN_USE`, `DOC_PAGE_CYCLE`, `DOC_PAGE_TOO_DEEP`, `DOC_PAGE_IS_HOME` |
| 429 | `RATE_LIMITED`, `ACCOUNT_LOCKED` (bloqueio progressivo de login; `details.retry_after_seconds`) |
| 500 | `INTERNAL_ERROR` (sem detalhes internos; use o correlation id nos logs) |

## Endpoints — Fase 1

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| GET | `/health` | pública | status, versão, checagem do banco (503 se degradado) |
| GET | `/openapi.json` | pública | especificação |
| POST | `/auth/login` | pública | `{ email, password, remember }` → define cookie; retorna `{ user, session }` |
| POST | `/auth/logout` | autenticado | revoga a sessão atual e limpa o cookie |
| GET | `/auth/me` | autenticado | `{ user, role, permissions, session }` |
| GET | `/auth/sessions` | autenticado | sessões ativas do próprio usuário |
| DELETE | `/auth/sessions/{id}` | autenticado | revoga sessão própria (de outro usuário → 404) |
| POST | `/auth/sessions/revoke-others` | autenticado | encerra todas as outras sessões do usuário (mantém a atual) |
| POST | `/auth/password` | autenticado | `{ current_password, new_password }` — troca a própria senha e encerra as outras sessões |
| GET | `/permissions` | `permissions.manage` | catálogo |
| GET | `/roles` | `permissions.manage` ou `users.view/create/edit` | perfis com `permissions` e `user_count` |
| POST | `/roles` | `permissions.manage` | cria perfil personalizado |
| GET | `/roles/{id}` | idem listagem | detalhe |
| PATCH | `/roles/{id}` | `permissions.manage` | nome/descrição (SUPER_ADMIN imutável) |
| PUT | `/roles/{id}/permissions` | `permissions.manage` | substitui as permissões (`{ permissions: [...] }`) |
| DELETE | `/roles/{id}` | `permissions.manage` | só perfis personalizados sem usuários |
| GET | `/users` | `users.view` | lista paginada; `search`, `status`, `role_id`, `sort` (`name`, `email`, `status`, `created_at`, `last_login_at`) |
| POST | `/users` | `users.create` | `{ name, email, password, role_id, locale? }` |
| GET | `/users/{id}` | `users.view` (ou o próprio) | detalhe |
| PATCH | `/users/{id}` | `users.edit` (ou o próprio: `name`, `locale`, `theme`) | atualização parcial |
| PATCH | `/users/{id}/status` | `users.disable` | `{ status: "active" \| "disabled" }` — desativar revoga as sessões |
| POST | `/users/{id}/password` | `users.edit` | `{ password }` — redefine a senha de **outro** usuário (própria conta → `USE_CHANGE_PASSWORD`) e encerra as sessões dele |
| GET | `/users/{id}/history` | `users.view` ou `audit.view` | histórico de auditoria do usuário, paginado |
| GET | `/audit-logs` | `audit.view` | auditoria paginada (mais recentes primeiro); filtros `entity_type`, `entity_id`, `user_id`, `action`, `from`, `to` (ISO 8601) |

## Endpoints — Fase 2 (Projetos)

| Método | Rota | Regra de acesso | Descrição |
|---|---|---|---|
| GET | `/projects` | `projects.view` | `view=all\|mine\|archived`, `search`, `status`, `priority`, `owner_id`, `sort` (`name`, `key`, `created_at`, `due_date`), paginado. Sem `projects.view_all`, só projetos em que é membro |
| POST | `/projects` | `projects.create` | `{ name, key, description?, icon?, cover?, status?, priority?, start_date?, due_date? }` — criador vira dono e gestor |
| GET | `/projects/{id}` | ver o projeto | inclui `owner`, `member_count`, `my_role` e `capabilities` (o que o usuário pode fazer) |
| PATCH | `/projects/{id}` | gestor + `projects.edit` | parcial; `key` é imutável; datas aceitam `null`; projeto arquivado → `PROJECT_ARCHIVED` |
| POST | `/projects/{id}/archive` · `/unarchive` | gestor + `projects.edit` | arquivado = somente leitura |
| DELETE | `/projects/{id}` | dono ou `projects.view_all`, + `projects.delete` | só projeto arquivado (`PROJECT_NOT_ARCHIVED`) |
| PUT | `/projects/{id}/owner` | dono ou `projects.view_all`, + `projects.edit` | `{ user_id }` — novo dono vira gestor; o anterior continua gestor |
| GET | `/projects/{id}/history` | ver o projeto | auditoria do projeto |
| GET | `/projects/{id}/members` | ver o projeto | dono primeiro |
| POST | `/projects/{id}/members` | gestor + `projects.edit` | `{ user_id, role }` (`manager`, `member`, `viewer`) |
| GET | `/projects/{id}/member-candidates` | gestor + `projects.edit` | usuários ativos que ainda não são membros (`search`) — dispensa `users.view` |
| PATCH | `/projects/{id}/members/{userId}` | gestor + `projects.edit` | `{ role }`; papel do dono é fixo (`OWNER_ROLE_LOCKED`) |
| DELETE | `/projects/{id}/members/{userId}` | gestor, ou o próprio membro (sair) | dono não sai (`CANNOT_REMOVE_OWNER`) |

Projeto sem acesso responde **404 `PROJECT_NOT_FOUND`** (não revela existência).

## Endpoints — Fase 3 (Tipos de tarefa e campos personalizados)

Leitura: `settings.manage` ou `tasks.view` (o formulário de tarefas precisa da configuração). Escrita: `settings.manage`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/custom-fields` | biblioteca completa, com `options` e `used_by` (tipos que usam o campo) |
| POST | `/custom-fields` | `{ name, label, type, description?, config?, default_value?, searchable?, filterable?, sortable?, options? }` — `name` e `type` são imutáveis depois |
| GET | `/custom-fields/{id}` | detalhe |
| PATCH | `/custom-fields/{id}` | parcial; `options` é sincronizado pelo `id` (sem `id` = nova; ausente = removida). Em seleção, o padrão vem de `options[].is_default` |
| DELETE | `/custom-fields/{id}` | só se nenhum tipo usa (`FIELD_IN_USE` com `details.types`) |
| GET | `/task-types` | em ordem; inativos só com `include_inactive=1` e `settings.manage` |
| POST | `/task-types` | `{ key, name, description?, icon?, color?, is_active? }` |
| PUT | `/task-types/order` | `{ ids: [...] }` — lista **completa** (`invalid_order` se faltar ou repetir) |
| GET | `/task-types/{id}` | tipo com `fields: [{ field, order, required, visible, show_on_card }]` |
| PATCH | `/task-types/{id}` | parcial; `key` é imutável |
| DELETE | `/task-types/{id}` | só sem tarefas (`TASK_TYPE_IN_USE`); em uso, desative |
| PUT | `/task-types/{id}/fields` | `{ fields: [{ field_id, required, visible, show_on_card, required_status_ids }] }` — substitui tudo; a ordem é a posição na lista. Campo oculto vira opcional e sai do card. `required_status_ids` (até 50): status em que o campo passa a ser exigido; ignorado quando `required` (vale em todos) ou oculto; status inexistente → `VALIDATION_ERROR` `fields.fields = invalid_status` |
| GET | `/task-types/{id}/history` | auditoria do tipo, paginada |

Valores de campos são validados no servidor pelo tipo (`domain/custom-field.js#validateValue`): tamanho, mín./máx., inteiro, datas ISO, URL http(s), e-mail, telefone e opções ativas.

## Endpoints — Fase 4 (Status, prioridades, tarefas, comentários e tags)

Leitura de status/prioridades/tags: `settings.manage` ou `tasks.view`. Alteração: `settings.manage`. Regras de acesso a tarefas e comentários em [permissions.md](permissions.md#tarefas-comentários-e-configurações-fase-4).

| Método | Rota | Descrição |
|---|---|---|
| GET · POST | `/statuses` · `/priorities` | lista em ordem (inativos com `include_inactive=1` e `settings.manage`) · cria `{ key, name, color?, description?, is_active?, is_default?, category* }` (*só status: `backlog`, `todo`, `in_progress`, `done`, `cancelled`) |
| PUT | `/statuses/order` · `/priorities/order` | `{ ids }` com a lista completa |
| GET · PATCH · DELETE | `/statuses/{id}` · `/priorities/{id}` | chave imutável; `is_default: true` desmarca o anterior; o padrão não pode ser desativado nem excluído (`*_IS_DEFAULT`); em uso não se exclui (`*_IN_USE`) |
| GET | `/tasks` | paginado; `project_id`, `task_type_id`, `status_id`, `priority_id`, `assignee_id` (ou `me`), `tag_id`, `category` (ex.: `backlog,todo,in_progress`), `search` (título, código e campos personalizados pesquisáveis), `sort` (`code`, `title`, `created_at`, `updated_at`, `due_date`, `priority`, `status`) |
| POST | `/tasks` | `{ project_id, task_type_id, title, description?, status_id?, priority_id?, assignee_id?, reporter_id?, due_date?, estimated_hours?, actual_hours?, custom_values?, tag_ids?, checklist? }` — número sequencial por projeto (`CRM-12`); padrões de status, prioridade e valores dos campos |
| GET | `/tasks/{id}` | detalhe com `fields` do tipo, `custom_values` (por nome técnico), `checklist`, `tags` e `capabilities` |
| PATCH | `/tasks/{id}` | parcial; `null` limpa responsável/relator/prazo/horas; trocar o tipo descarta valores de campos que o novo tipo não tem; `project_id` é imutável |
| DELETE | `/tasks/{id}` | `tasks.delete` + gestor, `projects.view_all` ou autor |
| GET | `/tasks/{id}/history` | histórico legível (nomes em vez de IDs; campos personalizados como `cf:<rótulo>`; comentários e menções) |
| GET · POST | `/tasks/{id}/comments` | lista (excluídos sem texto) · `{ content }` com menções `@[Nome](idDoUsuario)` — qualquer pessoa com acesso ao projeto, inclusive leitor |
| GET | `/tasks/{id}/mention-candidates` | pessoas ativas com acesso ao projeto (lista do @) |
| PATCH · DELETE | `/comments/{id}` | autor edita; autor ou gestor exclui (lógica) |
| GET · POST | `/tasks/{id}/attachments` | lista · envia (multipart: `files` e opcional `field` = campo de imagem/arquivo). Tipo decidido pelo **conteúdo**; até 20 MB; `tasks.edit` + colaborador |
| POST | `/tasks/{id}/attachments` com `comment_id` | anexo do comentário: só o autor do comentário (vale a regra de comentar — inclusive leitor); excluir o comentário apaga os arquivos dele |
| GET | `/notifications` | caixa do usuário, mais recentes primeiro (`unread=1`, paginado) |
| GET | `/notifications/unread-count` | contador para o sino |
| POST | `/notifications/{id}/read` · `/notifications/read-all` | marcar como lida (só as próprias; de outra pessoa → 404) |
| POST | `/notifications/due-reminders` | roda agora os lembretes de prazo (`settings.manage`; também roda todo dia às 08:00) |
| GET | `/attachments/{id}/file` | download/visualização protegida (`?download=1` força download) |
| DELETE | `/attachments/{id}` | quem enviou ou gestor; sai dos campos de imagem/arquivo |
| GET · POST | `/tags` | lista com `task_count` · cria `{ name, color? }` (nome único sem diferenciar maiúsculas/acentos) |
| PATCH · DELETE | `/tags/{id}` | renomear/cor · excluir (sai das tarefas) |

Horas (`estimated_hours`, `actual_hours`) precisam ser maiores que zero; `null` limpa (o PocketBase não tem número nulo — 0 significa "não informado").

## Endpoints — Fase 5 (Kanban)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/projects/{id}/board` | `kanban.view` + acesso ao projeto. Colunas = status ativos na ordem do fluxo, com `wip_limit`, `allowed_next`, `total`, `truncated` e `tasks` (resumo + `card_fields`: campos marcados "no card" no tipo). Colunas abertas trazem até 500 cards; as de encerramento (`done`/`cancelled`), as 30 mais recentes. `capabilities: { move, create }` |
| POST | `/tasks/{id}/move` | `{ status_id, prev_id?, next_id? }` — posição entre os vizinhos (renumera a coluna quando não há espaço). Mesma regra de `tasks.edit` + colaborador; mudar de coluna respeita `allowed_next` do status de origem (`TRANSITION_NOT_ALLOWED`, 409). Histórico registra a troca de status |

Status ganham `wip_limit` (0 = sem limite, até 999) e `allowed_next` (IDs de destino; vazio = qualquer) em `POST/PATCH /statuses`. O limite WIP é um alerta (não bloqueia); a transição é validada em toda troca de status — no quadro e em `PATCH /tasks/{id}`.

## Endpoints — Fase 6 (Backlog e sprints)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/projects/{id}/backlog` | o que ainda não começou (status das categorias `backlog` e `todo`), na ordem de prioridade (`position`), até 1000 itens (`truncated`); `statuses` planejáveis, `sprints` abertas e `capabilities: { rank, create, manage_sprints }` |
| POST | `/tasks/{id}/rank` | `{ prev_id?, next_id?, sprint_id? }` — prioriza entre vizinhos; `sprint_id` troca a sprint (`null` tira). Regra de `tasks.edit` + colaborador; tarefa em andamento/encerrada → `NOT_IN_BACKLOG` (409) |
| GET · POST | `/projects/{id}/sprints` | lista (encerradas só com `include_closed=1`) · cria `{ name, goal?, start_date?, end_date? }` (gestor do projeto) |
| PUT | `/projects/{id}/sprints/order` | `{ ids }` com todas as sprints abertas (gestor) |
| PATCH · DELETE | `/sprints/{id}` | edita (`state`: `planned`, `active`, `closed`; encerrar devolve ao backlog sem sprint o que não terminou e informa `returned_count`) · exclui (tarefas ficam sem sprint) |

Tarefas ganham `sprint: { id, name, state } | null` no resumo, `sprint_id` no POST/PATCH (`null` limpa) e o filtro `sprint_id` (id ou `none`) em `GET /tasks`. "Transformar em tarefa ativa" = `POST /tasks/{id}/move` para outro status.

## Endpoints — Fase 7 (Relacionamentos, subtarefas e fork)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/tasks/{id}/relations` | `parent`, `children` (+ `subtask_progress`), `forked_from`, `forks` e `relations` (cada uma com `type` do ponto de vista desta tarefa); só tarefas visíveis ao usuário; `capabilities: { link, fork, create_subtask, edit }` |
| POST | `/tasks/{id}/relations` | `{ type, target_id }` com `type` em `relates`, `blocks`, `blocked_by`, `duplicates`, `duplicated_by`, `depends_on`, `dependency_of` — `tasks.link` + colaborador; repetida → `RELATION_EXISTS`; ciclo de bloqueio/dependência → `RELATION_CYCLE` |
| DELETE | `/relations/{id}` | desfaz (`tasks.link` em qualquer um dos lados) |
| POST | `/tasks/{id}/fork` | `{ title?, project_id?, copy?: { description, tags, custom_values, checklist, attachments, relations } }` — `tasks.fork`; devolve a nova tarefa (201) com `forked_from` |

Subtarefas: `parent_task_id` em `POST/PATCH /tasks` (`null` solta; erros `other_project`, `cycle`, `too_deep`). O detalhe da tarefa traz `parent` e `forked_from` (`{ id, code, title }`); os resumos trazem `subtask_progress` e `blocked`; `capabilities` ganha `link` e `fork`.

## Endpoints — Fase 8 (Relatórios)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/reports` | `reports.view`; parâmetros `from`, `to` (ISO; padrão últimos 30 dias; até 366 dias), `tz_offset` (minutos de `getTimezoneOffset`; define "hoje" e os dias da série), `group_by` (`status`, `priority`, `type`, `assignee`, `project`) e filtros `project_id`, `assignee_id` (id, `me`, `none`), `task_type_id`, `priority_id`, `status_id`. Resposta: `period`, `generated_at`, `filters`, `definitions` (`bug_types`, `critical_priority`), `indicators` (agora e no período; tempos como `{ hours, count }`), `series` (`bucket` dia/semana), `breakdown` (`dimension`, `rows` com `label`) e `overdue_tasks` (até 50) |
| GET | `/projects/{id}/timeline` | acesso ao projeto + `tasks.view`; numa chamada: `project` (datas), `capabilities` (`edit` = mover barras, `manage_milestones` = gestor), `tasks` (resumos com `start_date`/`due_date`, até 2000 — `truncated`), `dependencies` (`{ id, type, from, to, conflict }` — de quem vem antes para quem vem depois; conflito = começa antes do prazo da anterior), `sprints` e `milestones` |
| GET/POST | `/projects/{id}/milestones` | listar (quem vê o projeto) / criar (gestor ou dono): `{ name*, due_date*, description, state: pending\|done }`; auditoria no projeto (`milestone.*`) |
| PATCH/DELETE | `/milestones/{id}` | editar/excluir (gestor ou dono); marco de projeto invisível → 404 `MILESTONE_NOT_FOUND` |
| GET | `/reports/tasks` | `reports.view`; **detalhamento de um indicador**: `metric` obrigatório (`open`, `backlog`, `todo`, `in_progress`, `blocked`, `overdue`, `critical_bugs`, `created`, `completed`, `cancelled`, `lead_time`, `cycle_time`, `bug_resolution`) + os mesmos período, fuso e filtros de `/reports` + `page`/`perPage` (até 100). Lista paginada das tarefas por trás do número (mesma regra da contagem: `meta.total` = valor do indicador), na ordem de leitura do indicador; nos de tempo, cada item traz `metric_hours` |

Escopo: projetos visíveis ao usuário; arquivados só quando escolhidos em `project_id`. Erros: `to_before_from` (em `to`), `too_long` (em `from`), `invalid_option` (`group_by`).

## Endpoints — Gerenciamento de Projetos (GP-1: quadro do projeto)
Módulo à parte das tarefas (nenhuma rota de tarefa aceita ou devolve campos do quadro).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/projects/{id}/plan` | acesso ao projeto + `plan.view`: `capabilities` (`edit`, `manage`), `statuses` (etiquetas do projeto; padrões criados na 1ª leitura: Planejado, Em progresso, Confirmar, Parado, Feito), `resources`, `groups` (ordem do quadro, `number` 1.0/2.1, `summary` com `items`, `status_counts`, `start_date`, `end_date`, `estimated_hours`, `duration_days`, `progress` — sobre os elementos de 1º nível), `items` (elementos e subelementos: `group_id`, `parent_id`, `name`, `status_id`, `start_date`, `end_date`, `due_date`, `owner`, `resource_ids`, `estimated_hours`, `actual_hours`, `duration_days` efetiva, `duration_manual`, `progress {value, source: done\|subitems\|manual\|none}`, `progress_manual`, `subitems`, `position`), `truncated` (acima de 3000) |
| GET/POST | `/projects/{id}/groups` | listar · criar (gestor/dono + `plan.manage`): `{ name*, color, parent_id }` — até 2 níveis (`parent_id: too_deep`) |
| PATCH/DELETE | `/groups/{id}` | renomear/cor · excluir com subgrupos e elementos (`{ deleted, items }`); grupo invisível → 404 `GROUP_NOT_FOUND` |
| PUT | `/groups/{id}/move` | `{ parent_id, prev_id \| next_id }` (sem vizinho = fim) |
| POST | `/groups/{id}/duplicate` | cópia logo depois do original ("(cópia)"), com subgrupos, elementos e subelementos |
| POST | `/projects/{id}/plan/items` | `plan.edit` + colaborador: `{ group_id* \| parent_id*, name*, status_id, start_date, end_date, due_date, owner_id, resource_ids, estimated_hours, actual_hours, duration_days, progress }` — subelemento segue o grupo do pai (1 nível: `too_deep`) |
| GET/PATCH/DELETE | `/plan/items/{id}` | ler · editar (só o que vier; `null` limpa; `group_id` move com os subelementos; em subelemento → `follows_parent`; `parent_id` → `immutable`; fim antes do início → `end_before_start`) · excluir com subelementos (`{ deleted }`); 404 `PLAN_ITEM_NOT_FOUND` |
| POST | `/projects/{id}/plan/statuses` | gestor/dono + `plan.manage`: `{ name*, color, category }` (`todo`, `in_progress`, `review`, `blocked`, `done`, `canceled`) |
| PATCH/DELETE | `/plan/statuses/{id}` | editar · excluir (elementos ficam em branco: `{ deleted, items }`); 404 `PLAN_STATUS_NOT_FOUND` |
| POST | `/projects/{id}/plan/resources` | `plan.edit` + colaborador: `{ name*, color }`; nome repetido (sem acento/maiúsculas) → 409 `PLAN_RESOURCE_NAME_IN_USE` |
| PATCH/DELETE | `/plan/resources/{id}` | editar (`plan.edit`) · excluir (gestor + `plan.manage`; sai dos elementos: `{ deleted, items }`); 404 `PLAN_RESOURCE_NOT_FOUND` |

Validação: horas ≥ 0 com até 2 casas (≤ 100000); `duration_days` inteiro 0–3650; `progress` inteiro 0–100 (`null` = automático); até 20 recursos; responsável precisa ser do projeto (`not_member`). Auditoria: `plan_item.created/updated/deleted` no elemento; `project_group.*`, `plan_status.*` e `plan_resource.*` no projeto.

### GP-2 — interação
`GET /projects/{id}/plan` também traz `links` (`{ id, from_id, to_id, type: blocks | relates }`; `blocks` = from bloqueia to), `settings` (`{ dependency_rule: warn | block }`) e, em cada elemento, `blocked` (depende de elemento ainda aberto).

| Método | Rota | Descrição |
|---|---|---|
| PUT | `/plan/items/{id}/move` | arrastar/mover (`plan.edit`): `{ group_id?, prev_id \| next_id }` — reordena entre os irmãos (sem vizinho = fim); no elemento, `group_id` troca de grupo com os subelementos (histórico só quando muda de grupo); subelemento com outro grupo → `follows_parent`; vizinho que não é irmão → `invalid_option` |
| POST | `/plan/items/{id}/duplicate` | cópia "(cópia)" logo depois do original, com os subelementos, sem as dependências (201) |
| POST | `/projects/{id}/plan/items/bulk` | seleção em massa, até 200, tudo ou nada: `{ ids*, action*: update \| move \| duplicate \| delete }`; `update`: `status_id` (null = em branco), `add_resource_ids`, `remove_resource_ids`; `move`: `group_id` (subelemento → `ids: follows_parent`). Resposta `{ updated \| moved \| duplicated \| deleted }`; id de outro projeto → `ids: invalid_option` |
| POST | `/plan/items/{id}/links` | dependência (`plan.edit`): `{ type*: depends_on \| blocks \| relates, item_id* }` → `item_id`: `self`, `duplicate`, `cycle`, `invalid_option` (201) |
| DELETE | `/plan/links/{id}` | desfaz; 404 `PLAN_LINK_NOT_FOUND` |
| PATCH | `/projects/{id}/plan/settings` | regra do quadro (gestor + `plan.manage`): `{ dependency_rule*: warn \| block }` |
| POST | `/projects/{id}/plan/import` | importação (`plan.edit`), até 500 linhas, tudo ou nada: `{ rows*: [{ group*, name*, parent, status, start_date, end_date, resources[], estimated_hours, actual_hours, duration_days, progress }] }`. Grupo/status/recursos pelo nome; faltando, são criados (grupo e status só com `plan.manage`). Problemas: 400 `VALIDATION_ERROR` com `details.rows` `{ índice: { campo: código } }` (`group`/`status`/`parent`: `invalid_option` = não encontrado). Resposta 201 `{ created: { groups, statuses, resources, items, subitems } }` |

### GP-3 — painel do elemento
Cada elemento do quadro traz `updates` (atualizações não excluídas — contador da linha) e `files` (arquivos das atualizações). Cada atualização traz `files: [PlanFile]` (com `update_id`); excluir a atualização apaga os arquivos dela.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/plan/items/{id}/updates` | quem vê o quadro: `{ updates: [principal { …, replies[] }], capabilities: { post } }` — principais da mais nova para a mais antiga; respostas em ordem |
| POST | `/plan/items/{id}/updates` | publica (quem vê o quadro, projeto aberto — inclusive leitor): JSON `{ content* (≤ 10.000; Markdown; menções `@[Nome](id)`), parent_id }` ou **multipart** com os mesmos campos + `files` (imagens coladas/anexadas: até 10, 20 MB cada, 50 MB no total; tipo pelo conteúdo; tudo ou nada; com arquivo, `content` pode ficar vazio; total → `files: upload_too_large`) (resposta: só na principal → `parent_id: invalid_option`); menção de quem não participa → `content: invalid_mention`. Notifica `plan_mention` (menção) e `plan_reply` (autor da principal) |
| PATCH | `/plan/updates/{id}` | edita (só o autor): `{ content* }`; menção nova notifica |
| DELETE | `/plan/updates/{id}` | exclui (autor ou gestor): exclusão lógica; 404 `PLAN_UPDATE_NOT_FOUND` |
| GET | `/plan/items/{id}/mention-candidates` | participantes ativos do projeto |
| POST | `/plan/updates/{id}/files` | o autor anexa mais à atualização (multipart `files`, mesmos limites) |
| GET | `/plan/files/{id}/file` | download protegido (confere acesso; `nosniff`; CSP `sandbox`; imagem aparece, o resto baixa); 404 `PLAN_FILE_NOT_FOUND` |
| DELETE | `/plan/files/{id}` | quem enviou ou o gestor |
| GET | `/plan/items/{id}/history` | histórico do elemento (quem vê o quadro) |

Notificações (`GET /notifications`) passam a trazer `task` **ou** `plan_item` (`{ id, project_id, name, project_name }`); tipos novos `plan_mention` e `plan_reply`. Auditoria: `plan_item.update_added/update_edited/update_deleted` e `plan_item.file_added/file_deleted` no elemento.

Regra `block`: trocar o status (edição, massa) para uma etiqueta que **inicia** (Em andamento/Em revisão, vindo de A fazer/Bloqueado/em branco) ou **conclui** um elemento que depende de outro ainda aberto → 409 `PLAN_DEPENDENCY_PENDING` com `details.items` (nomes). Auditoria: `plan_item.duplicated/linked/unlinked` no elemento; `plan_item.imported` e `plan_settings.updated` no projeto.

## Endpoints — Expansão Onda 2 (Documentação)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/docs/spaces` | espaços que a pessoa lê (`docs.view` + visibilidade), com `page_count` e `capabilities` |
| POST | `/docs/spaces` | `docs.manage` (espaço de projeto: gestor/dono): `{ key*, name*, description, icon, color, project_id, visibility*: company\|project }`; nasce com a página inicial publicada (v1). `DOC_SPACE_KEY_IN_USE`; `visibility: project_required` sem projeto |
| GET | `/docs/spaces/{key}` | espaço pela **chave** + árvore `pages` (`id, parent_id, title, status, position, has_draft, is_home, updated_at`; rascunhos só para quem edita) + `capabilities` |
| PATCH/DELETE | `/docs/spaces/{id}` | configurar (`name, description, icon, color, visibility`) / excluir com páginas, versões e arquivos (quem gerencia) |
| POST | `/docs/spaces/{id}/pages` | `docs.edit`: `{ title*, parent_id }` → página em rascunho; `DOC_PAGE_TOO_DEEP` (8 níveis) |
| GET/DELETE | `/docs/pages/{id}` | página (conteúdo **publicado**, `version`, `ancestors`, `children`, `draft` pendente para quem edita, `capabilities`) / excluir com subpáginas (`{ deleted }`; `DOC_PAGE_IS_HOME`) |
| GET/PUT/DELETE | `/docs/pages/{id}/draft` | rascunho para edição (ou o publicado) / salvar `{ title*, content }` (higienizado; `{ saved_at }`) / descartar |
| POST | `/docs/pages/{id}/publish` | publica o rascunho ou `{ title, content }` enviados → próxima versão |
| PUT | `/docs/pages/{id}/move` | `{ parent_id, prev_id \| next_id }` (sem vizinho = fim); `DOC_PAGE_CYCLE`, `DOC_PAGE_TOO_DEEP`, `DOC_PAGE_IS_HOME` |
| GET | `/docs/pages/{id}/versions` · `/versions/{n}` | versões publicadas (mais recente primeiro) / conteúdo de uma versão (`DOC_VERSION_NOT_FOUND`) |
| POST | `/docs/pages/{id}/versions/{n}/restore` | publica o conteúdo da versão `n` como a próxima |
| POST | `/docs/pages/{id}/files` | multipart `files` (até 10, 20 MB cada, tipo conferido pelo conteúdo) → `{ id, name, kind: image\|document, mime, size, url }` |
| GET | `/docs/files/{id}` | arquivo para quem vê a página: imagens em linha, demais como anexo; `nosniff` + CSP sandbox |
| GET | `/docs/search?q=` | título e conteúdo publicado dos espaços visíveis, sem acento/maiúsculas (2–100 caracteres; até 30) com `snippet` |
| GET | `/docs/recent` | 10 últimas publicações dos espaços visíveis |

Conteúdo: JSON do editor (TipTap/ProseMirror). Blocos aceitos: `paragraph`, `heading` (1–4), `blockquote`, `bulletList`, `orderedList`, `listItem`, `taskList`/`taskItem` (`checked`), `codeBlock` (`language`), `horizontalRule`, `hardBreak`, `image` (`src` de `/api/v1/docs/files/{id}`, `alt`, `title`, `width` 25/50/75/100), `table`/`tableRow`/`tableHeader`/`tableCell` (`colspan`, `rowspan`, `colwidth`), `callout` (`tone` info/success/warning/danger), `tableOfContents`. Marcações: `bold`, `italic`, `underline`, `strike`, `code`, `highlight`, `link` (`href` http(s)/mailto/`/docs/…`/arquivo). O resto é removido; erros de conteúdo em `content`: `invalid_content`, `too_deep`, `too_large`, `too_long`.

## Exemplo
```bash
curl -c jar -X POST http://127.0.0.1:8090/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: kamban' \
  -d '{"email":"admin@kamban.local","password":"***"}'
curl -b jar 'http://127.0.0.1:8090/api/v1/users?perPage=10&sort=-created_at'
```

## Próximos endpoints (diretriz §26)
todos os módulos do MVP já têm API; novas rotas seguem as mesmas convenções.
