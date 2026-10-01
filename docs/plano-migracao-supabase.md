# Plano de migração: PocketBase → Supabase

> Situação: **proposta** (2026-10-01). Nada foi decidido nem iniciado; as decisões em aberto estão no fim.
> Base das estimativas: o código atual (backend com 12,6 mil linhas de domínio/aplicação e 9,2 mil de
> infraestrutura/HTTP/migrations) e o teste de carga `npm --prefix backend run load`.

## 1. Resumo

- **Hoje** o BLYD Sync aguenta, sem lentidão perceptível, algo como **60 a 90 pessoas trabalhando ao mesmo tempo** (equipes de até ~10 pessoas por quadro) num servidor parecido com um notebook i5 de 12 threads. Com **ajustes simples no PocketBase (fase 0, 2 a 3 dias)** isso sobe para **~200 a 250**.
- **Migrar para o Supabase** (Postgres gerenciado + armazenamento + tempo real) tira o limite de uma máquina só: a API passa a rodar em várias instâncias e o banco aceita escritas em paralelo. A meta passa a ser **milhares de pessoas simultâneas**, com backup contínuo (PITR) e réplicas.
- **Esforço:** **11 a 16 semanas** para 1 pessoa sênior (7 a 10 semanas com 2), por causa da Clean Architecture: domínio e casos de uso são reaproveitados; reescreve-se a infraestrutura (repositórios, arquivos, e-mail, rotinas), a camada HTTP e o esquema do banco. O web quase não muda (mesma API `/api/v1`).
- **Recomendação:** fazer a **fase 0 agora** (barata, multiplica a capacidade) e **migrar quando** a previsão passar de ~200 pessoas simultâneas, quando houver venda como SaaS com vários clientes, exigência de alta disponibilidade/réplicas ou quando o login corporativo (SSO) for retomado — o Supabase Auth já traz SSO.

## 2. Capacidade hoje (medida)

Teste de carga em 2026-10-01 (`backend/scripts/load-test.js`): PocketBase isolado, 30 pessoas, projeto com 400 tarefas e quadro da Gestão com 60 elementos; mistura de chamadas parecida com o uso real (30% Kanban, 20% lista de tarefas, 15% tarefa, 10% sino, 10% quadro da Gestão, 5% comentários, 10% escritas). Servidor e gerador de carga na mesma máquina (i5-1235U, 12 threads, 16 GB) — resultado conservador.

| Pool de VMs do JS | Requisições simultâneas | Vazão | p95 | Erros |
|---|---|---|---|---|
| 15 (padrão) | 5 | 39,5 req/s | 0,36 s | 0 |
| 15 | 10 | 23,1 req/s | 1,0 s | 0 |
| 15 | 20 | 17,4 req/s | 2,8 s | 0 |
| 15 | 40 | 15,3 req/s | 5,9 s | 0 |
| 60 | 10 | 56,0 req/s | 0,43 s | 0 |
| 60 | 20 | 56,0 req/s | 0,75 s | 0 |
| 60 | 40 | 27,7 req/s | 7,0 s | 0 |

**O que os números mostram**
- Nenhum erro em nenhum nível: a plataforma **fica lenta, mas não falha**.
- O gargalo não é o banco nem a rede: é a **execução do JavaScript do PocketBase**. Cada requisição ocupa uma VM do pool, e cada registro gravado dispara ganchos (histórico, webhooks, tempo real) que ocupam outra. Quando o pool acaba, o PocketBase cria VMs na hora (recarregando todos os módulos) e a vazão **cai** em vez de estabilizar — por isso 40 simultâneas rendem menos que 10.
- O SQLite aceita **uma escrita por vez**: sob carga as escritas são as primeiras a ficar lentas (editar tarefa com p95 de 2,2 s com 20 simultâneas).
- A chamada mais pesada é o **quadro do Kanban** de projetos grandes (≈150–350 ms cada).

**De requisições para pessoas** (uma pessoa com a tela aberta e trabalhando):

| Origem das chamadas | Por pessoa |
|---|---|
| Kanban se atualiza a cada 15 s (vem de antes do tempo real) | 0,07 req/s |
| Sino a cada 30 s | 0,03 req/s |
| Ações próprias (uma a cada ~30 s, ~3 chamadas cada) | 0,10 req/s |
| Atualizações ao vivo (cada mudança de um colega faz cada tela aberta buscar de novo) | 0,1 a 1,5 req/s — cresce com o tamanho da equipe no mesmo quadro |

| Cenário | Hoje (pool 15) | Com a fase 0 |
|---|---|---|
| Equipes de até ~10 pessoas por quadro (o comum) | **60 a 90 pessoas simultâneas** | **~200 a 250** |
| Um projeto grande com 30+ pessoas no mesmo quadro | **15 a 25 no mesmo quadro** | **~60 a 100** |
| Pessoas cadastradas (10–30% conectadas ao mesmo tempo) | ~300 a 600 | ~1.000 a 2.000 |

## 3. Fase 0 — ganhos rápidos no PocketBase (2 a 3 dias, recomendada antes de tudo)

1. **Pool de VMs maior:** `serve --hooksPool=60` (medir a memória; cada VM carrega os módulos do backend).
2. **Tirar a consulta periódica redundante:** com o tempo real, o Kanban não precisa buscar a cada 15 s nem o sino a cada 30 s — deixar como rede de segurança a cada 5 minutos.
3. **Controlar as atualizações ao vivo por chave:** no máximo uma busca do quadro a cada 2–3 s por tela (hoje são agrupadas em 250 ms), o que corta o crescimento quadrático em equipes grandes.
4. **Kanban leve para projetos grandes:** paginar/limitar as colunas encerradas e trazer só os campos do cartão.
5. Repetir o teste de carga e registrar a nova linha de base.

## 4. O que muda e o que fica

| Camada | Hoje | No Supabase | Esforço |
|---|---|---|---|
| `domain/` (4,2 mil linhas) | CommonJS puro | **igual** | nenhum |
| `application/` (8,4 mil linhas) | casos de uso síncronos (JSVM) | **mesmos casos de uso, assíncronos** (`async/await` nas 250 chamadas a repositório) | médio, mecânico |
| `core/` | erros, validação, paginação | igual | nenhum |
| `infrastructure/` (3,7 mil linhas) | repositórios sobre `$app`, arquivos, mailer, `$http` | **reescrita**: Postgres, Supabase Storage, nodemailer, fetch, node:crypto | alto |
| `http/` + `main.pb.js` (3,2 mil linhas) | rotas do PocketBase, ganchos, cron | **servidor Node** (Fastify) com as mesmas rotas `/api/v1`, envelope, CSRF, cookie, limites | alto |
| `pb_migrations/` (31) | collections do PocketBase | **migrations SQL** (Supabase CLI) | médio |
| Web | `/api/v1` + SSE do PocketBase | **mesma API**; troca só o cliente do tempo real (`core/realtime`) | baixo |
| Testes | unitários (fakes), API num PocketBase real, E2E | unitários iguais (com `await`); **a suíte de API vira contrato** rodando contra o novo backend; E2E igual | médio |

O contrato da API não muda — telas, tokens de API (`kb_pat_`), webhooks, links de e-mail e integrações continuam funcionando. Os **ids são preservados** (texto de 15 caracteres), então nada que já foi compartilhado quebra.

## 5. Arquitetura alvo

```
Navegador ──HTTPS──► API BLYD Sync (Node + Fastify, N instâncias, sem estado)
   │                     │  domain + application (os mesmos de hoje)
   │                     │  infrastructure: Postgres · Storage · e-mail · HTTP · cripto
   │                     ├──► Supabase Postgres (via Supavisor) ── RLS "nega tudo"; só a API acessa
   │                     ├──► Supabase Storage (buckets privados: anexos, documentação, quadro, marca)
   │                     └──► Worker (mesmo código): fila de e-mails, webhooks, lembretes, retenção
   │                            (uma execução por vez com pg_try_advisory_lock)
   └──WebSocket──► Supabase Realtime (Broadcast em canais privados project:{id} / user:{id})
                       ▲ avisos enviados pelo banco (realtime.send em gatilhos, depois do commit)
```

- **Autenticação, fase 1:** continua a nossa (cookie `kb_session`, tabela de sessões, bloqueio, política de senha, tokens de API). Para o tempo real, a API emite um JWT curto do Supabase (`sub` = id da pessoa) e as políticas de `realtime.messages` liberam só os tópicos de projetos que a pessoa vê (usando `auth.jwt()->>'sub'`, já que os ids não são UUID).
- **Autenticação, fase 2 (opcional):** passar para o Supabase Auth e ganhar **SSO** (OAuth com Microsoft/Google; SAML no plano Pro). As senhas atuais já são bcrypt e podem ser importadas.

### Mapeamento PocketBase → Supabase/Node

| PocketBase | Destino |
|---|---|
| Collections e campos | tabelas Postgres; JSON → `jsonb`; múltiplas relações → tabelas de ligação ou `text[]`; datas → `timestamptz`; chaves estrangeiras e índices explícitos |
| `$app.runInTransaction` (unitOfWork) | transação Postgres (`BEGIN … COMMIT`) na mesma conexão |
| Campos de arquivo protegidos | Supabase Storage (buckets privados), servidos pela API (mantém nosniff, CSP sandbox e conferência de permissão) |
| `onRecordAfter*Success` → tempo real | gatilhos `AFTER INSERT/UPDATE/DELETE` chamando `realtime.send(...)` (o aviso sai no commit) |
| Decorador do histórico → webhooks | igual, na infraestrutura nova (mesma transação) |
| `cronAdd` + trava em `$app.store()` | worker Node com `pg_try_advisory_lock` (ou `pg_cron` para limpezas puras em SQL) |
| Configurações SMTP do PocketBase | tabela `platform_settings`; senha do SMTP no **Supabase Vault** |
| `$app.newMailClient()` | nodemailer |
| `$http.send` / `$security.hs256` | `fetch` / `node:crypto` |
| Rate limit do PocketBase | middleware na API (com várias instâncias, contador no Postgres ou Redis) |
| Painel `/_/` do PocketBase | Supabase Studio (só administradores técnicos) |

## 6. Fases e estimativa (1 pessoa sênior)

| Fase | Entrega | Pronto quando | Estimativa |
|---|---|---|---|
| 0. Ganhos rápidos | seção 3 | nova linha de base no teste de carga | 2–3 dias |
| 1. Preparação | casos de uso assíncronos (com o backend atual ainda no ar via adaptador); suíte de API parametrizada por endereço | todos os testes verdes no PocketBase | 1,5–2 sem. |
| 2. Esquema Postgres | migrations SQL com tipos, FKs, índices, sequência do código da tarefa, RLS "nega tudo" | esquema sobe no `supabase start` local | 1–1,5 sem. |
| 3. Backend Node | servidor `/api/v1` (envelope, CSRF, cookie, limites, OpenAPI) e repositórios Postgres — **sem consultas em laço**: o SQLite local esconde o N+1, o Postgres pela rede não | suíte de API verde contra o novo backend | 4–6 sem. |
| 4. Arquivos, e-mail, rotinas, webhooks, tempo real | Storage, nodemailer, worker com travas, gatilhos `realtime.send`, JWT do tempo real e políticas | E2E de e-mail, webhooks e tempo real verdes | 1,5–2 sem. |
| 5. Web | novo `RealtimeClient` com supabase-js (mesma interface) e configuração | suíte web e E2E verdes | 3–5 dias |
| 6. Migração dos dados | script ETL SQLite → Postgres (ids, senhas bcrypt, sessões e tokens com hash) e arquivos → Storage; conferência de contagens e amostras | 2 ensaios completos numa cópia da produção | 1–1,5 sem. |
| 7. Homologação | carga (mesmo script, meta ≥ 10× a linha de base), varredura de segurança, backup/restauração (PITR), acessibilidade | critérios da seção 8 | 1,5–2 sem. |
| 8. Virada | janela de manutenção, ETL final, troca de endereço, testes de fumaça | plataforma no ar no Supabase | 1–2 dias |
| **Total** | | | **11–16 semanas** (7–10 com 2 pessoas) |

## 7. Migração dos dados e virada

1. **Ensaio:** cópia do `pb_data` → ETL → conferência (contagem por tabela, somatórios, amostras de registros e arquivos) → suíte de API e E2E contra a cópia. Repetir até zerar diferenças.
2. **Janela de manutenção** (estimar pelo ensaio; para os volumes de hoje, minutos): a plataforma fica só leitura, roda o ETL final e a conferência.
3. **Virada:** o endereço passa a apontar para a nova API; sessões, tokens e webhooks continuam valendo (ids e hashes migrados).
4. **Volta atrás:** o PocketBase fica parado mas intacto. Se algo falhar **antes de reabrir as escritas**, volta-se ao endereço antigo. Depois de reabrir, não há sincronização reversa — por isso a homologação precisa ser completa.

## 8. Critérios de aceite

- Suítes unitária, de API (contrato) e E2E verdes no novo backend; varredura de segurança e de acessibilidade sem regressão.
- Teste de carga: p95 < 1 s com **10× a vazão** medida hoje, sem erros; escalar de 1 para 2 instâncias da API aumenta a vazão.
- Backup com restauração testada (PITR) e procedimento de virada/volta ensaiado.
- Documentação (arquitetura, implantação, segurança, decisões) atualizada; ADR registrando a decisão.

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Conversão para assíncrono introduzir erros sutis (promessas esquecidas) | fazer na fase 1, ainda no PocketBase, com lint `no-floating-promises` e a suíte completa |
| Consultas em laço (N+1) ficarem lentas com o banco pela rede | repositórios novos com junções e consultas em lote; teste de carga desde o início da fase 3 |
| Diferenças de comportamento entre SQLite e Postgres (ordenação, comparação de textos, datas) | suíte de API como contrato; ordenações explícitas; colação definida |
| Tempo real com ids que não são UUID | políticas com `auth.jwt()->>'sub'` (não `auth.uid()`) |
| Custo e dependência do provedor | o Supabase é código aberto e pode ser auto-hospedado; o Postgres é padrão |
| Instalação ficar pesada para quem hospeda o código aberto | hoje é um binário único; depois serão Postgres + Storage + Realtime + API. Documentar as duas formas (Supabase Cloud e auto-hospedado com Docker) |

## 10. Custos (referência — conferir os preços atuais)

- **Supabase Cloud:** plano Pro a partir de ~US$ 25/mês, mais computação do banco conforme o tamanho; PITR e SSO SAML são adicionais/planos superiores. A API e o worker rodam num serviço de contêineres (algumas dezenas de dólares por mês para 2 instâncias pequenas).
- **Auto-hospedado:** sem licença, mas exige operar Postgres, backups e os serviços do Supabase.

## 11. Decisões em aberto

1. **Quando migrar:** só a fase 0 agora e a migração quando a demanda pedir (recomendado), ou já planejar a execução.
2. **Supabase Cloud ou auto-hospedado.**
3. **Autenticação:** manter a nossa na virada (recomendado, menos risco) e avaliar o Supabase Auth junto com o SSO depois.
4. **PocketBase como "edição simples"** para quem instala o código aberto em máquina única: manter os dois backends dobra a manutenção — a recomendação é aposentar o PocketBase depois da virada.
