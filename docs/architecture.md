# Arquitetura

> Referência: [diretriz-desenvolvimento.md](diretriz-desenvolvimento.md) §2–§4, §29. Decisões em [decisions.md](decisions.md).

## Visão geral

```
┌──────────────────────────── navegador ────────────────────────────┐
│  web/ (React + TypeScript)                                        │
│  presentation ──▶ domain (interfaces) ◀── data (HTTP) ──▶ ApiClient│
└───────────────────────────────┬───────────────────────────────────┘
                                │ /api/v1  (cookie HttpOnly + X-Requested-With)
┌───────────────────────────────▼───────────────────────────────────┐
│  backend/ (PocketBase 0.40 + hooks JS)                            │
│  http (rotas/handler) ──▶ application (casos de uso)              │
│                              │                                    │
│                         domain (regras puras)                     │
│                              │ portas (interfaces)                │
│                  infrastructure (repositórios PocketBase)         │
│                              │                                    │
│                         SQLite (pb_data)                          │
└───────────────────────────────────────────────────────────────────┘
```

- **API-first**: o frontend só conversa com `/api/v1`. A API genérica do PocketBase (`/api/collections/...`) fica bloqueada (regras nulas) — ver [security.md](security.md).
- Em produção o PocketBase serve o build do frontend (`backend/pb_public`) na mesma origem; em desenvolvimento o Vite faz proxy de `/api`.

## Backend (`backend/`)

```
backend/
├── bin/                     # binário do PocketBase (npm run setup) — não versionar
├── pb_migrations/           # esquema e seed (JS, executados pelo PocketBase)
├── pb_hooks/
│   ├── main.pb.js           # SOMENTE registro de rotas/middlewares
│   └── src/
│       ├── core/            # erros, envelope de resposta, validação, paginação (puros)
│       ├── domain/          # regras de negócio puras: RBAC, sessão, usuário, catálogo de permissões
│       ├── application/     # casos de uso (auth, roles, users), auditoria, presenters (DTO)
│       ├── infrastructure/  # repositórios PocketBase, config (env), container (composition root)
│       └── http/            # handler (envelope, CSRF, sessão, correlation id), rotas, OpenAPI
├── tests/
│   ├── unit/                # domínio + aplicação com fakes em memória (node --test)
│   ├── api/                 # ponta a ponta contra um PocketBase real e isolado
│   └── support/             # fakes e harness
└── scripts/                 # setup, dev, create-admin
```

Regras de dependência (de fora para dentro):

| Camada | Pode depender de | Nunca depende de |
|---|---|---|
| `domain` | `core` | PocketBase, HTTP, application |
| `application` | `domain`, `core`, portas (`application/ports.js`) | PocketBase, HTTP |
| `infrastructure` | tudo acima + globais do PocketBase (`$app`, `$dbx`…) | `http` |
| `http` | `application` via container | regras de negócio |

**Restrições do JSVM (goja)**: código em `pb_hooks`/`pb_migrations` é CommonJS síncrono. Cada handler roda numa VM isolada e não enxerga variáveis do arquivo — por isso `main.pb.js` faz `require()` dentro de cada handler. O ESLint bloqueia `?.`, `??` e `await` nessas pastas.

**Transações**: casos de uso recebem `unitOfWork.run(fn)`; a implementação usa `app.runInTransaction` e entrega repositórios transacionais. Operação + auditoria são gravadas atomicamente.

**Trocar o banco** (PostgreSQL, Supabase…): reescrever `infrastructure/` (e o adaptador HTTP, se sair do PocketBase). `domain/` e `application/` não mudam — as portas estão em `application/ports.js`.

## Frontend (`web/`)

A estrutura `lib/` da diretriz foi mapeada para `src/` preservando as camadas:

```
web/src/
├── app/            # composition root: container (ApiClient, repositórios, QueryClient), router, App
├── core/           # config, errors (AppError), networking (ApiClient), i18n, theme, storage, utils
├── domain/         # entidades, permissões, regras de RBAC para a UI, paginação, validação (zod), interfaces de repositório
├── data/           # DTOs (snake_case), mappers, repositórios HTTP
├── presentation/
│   ├── components/ # Design System (App*) — ver design-system.md
│   ├── layouts/    # AppShell, PageHeader
│   ├── navigation/ # nav-items (fonte única), Sidebar, CommandPalette
│   ├── common/     # hooks transversais (tema, hotkey, media query, erros, DI)
│   └── state/      # ui-store (Zustand)
├── features/       # auth, dashboard, users, settings (perfis/permissões), account, preferences, errors
└── test/           # setup e utilitários de teste
```

- A UI depende apenas das **interfaces** em `domain/repositories.ts`; as implementações HTTP são injetadas por `RepositoriesContext` (testes injetam fakes).
- O ESLint proíbe `fetch` em `presentation/` e `features/`.

### Estado (diretriz §29)

| Tipo | Onde | Exemplos |
|---|---|---|
| Server State | TanStack Query | usuários, perfis, `auth/me` |
| Session State | `features/auth/session.ts` (query `auth/me`) + `session-store.ts` | usuário atual, motivo do fim da sessão |
| UI State | `presentation/state/ui-store.ts` (Zustand, persistido) | tema, sidebar, paleta aberta |
| Domain State | entidades mapeadas pelos repositórios | `User`, `Role` |

Estratégia de cache: `staleTime` 30s; listas usam `keepPreviousData` na paginação; erros 4xx não são repetidos; mutações invalidam as chaves afetadas; logout e sessão expirada limpam todo o cache.

## Tempo real
- **Servidor:** `onRealtimeSubscribeRequest` (`http/realtime.js`) confere a sessão do cookie e o CSRF e deixa só os tópicos autorizados (`application/realtime.js`); `onRecordAfter{Create,Update,Delete}Success` das coleções de `domain/realtime.js#WATCHED` monta o aviso (`infrastructure/realtime.js`, projeto descoberto pela tarefa quando preciso) e envia pelo broker do PocketBase a quem assina o tópico — depois da transação confirmada.
- **Web:** `core/realtime/realtime-client.ts` (uma conexão `EventSource` por aba, assinaturas com contagem, reconexão), injetado por `RealtimeContext`; `useLiveProject(id)` / `useLiveNotifications(id)` (`presentation/common/use-live.ts`) traduzem cada aviso nas chaves do cache a invalidar (`domain/realtime.ts`), agrupadas em 250 ms e no máximo uma busca a cada 2,5 s por tela; `useLiveRefetchInterval` deixa a consulta periódica em 5 min com o tempo real ligado e `useRealtimeResync` (no AppShell) busca de novo as telas abertas ao reconectar.

## Fluxo de uma requisição

1. `ApiClient` envia `X-Correlation-Id`, `X-Requested-With: kamban` (mutações) e o cookie de sessão.
2. Middleware `kamban_api_errors` garante envelope padrão até para erros da plataforma (rate limit, body limit).
3. `handler.handle`: correlation id → CSRF → sessão (`auth.authenticate`) → caso de uso → `{ data, meta, error }`.
4. Caso de uso valida entrada, aplica RBAC/regras de domínio, grava via `unitOfWork` com auditoria.
5. Erros de aplicação viram `{ error: { code, message, details } }`; erros inesperados viram `INTERNAL_ERROR` sem vazar detalhes e são logados com o correlation id.
