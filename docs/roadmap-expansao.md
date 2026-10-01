# Expansão pós-MVP — Gestão de projetos e Documentação

> Autorizado pelo usuário em 2026-09-30. Amplia o escopo do MVP (diretriz §1) com dois módulos:
> **Gestão de projetos com timeline** (estilo Monday.com) e **Documentação / Base de conhecimento**
> (estilo Confluence / SharePoint Sites), entregues em ondas. Cada onda segue a diretriz inteira:
> Clean Architecture, TDD, RBAC no backend, auditoria na mesma transação, i18n (pt-BR/en/es), design
> system `App*`, telas em largura total, claro/escuro, celular, acessibilidade (varredura E2E) e a
> Definition of Done (§47). Regras de negócio de cada onda entram em
> [regras-de-negocio.md](regras-de-negocio.md) antes de a onda ser dada como pronta.

## Sequência das ondas

| Onda | Módulo | Entrega principal | Depende de |
|---|---|---|---|
| **1** ✅ | Projetos | **Timeline do projeto** (Gantt): barras por tarefa, arrastar datas, dependências, marcos | — |
| **2** ✅ | Documentação | **Espaços e páginas** com editor rico, imagens, árvore de páginas, versões e busca | — |
| **3** | Documentação | **Documentação ligada às tarefas**, modelos (ex.: especificação funcional), blocos dinâmicos, comentários, PDF | 2 |
| **4** | Projetos | **Portfólio** (todos os projetos na linha do tempo, saúde e progresso) e **visão em tabela editável** estilo Monday | 1 |
| **5** | Documentação | **Base de conhecimento e FAQ** para outras áreas: portal de consulta, perguntas e respostas, publicação e revisão | 2, 3 |
| **6** | Ambos | Avançado: linha de base, reprogramação por dependência, caminho crítico; comparação de versões, importação e permissões por página | 1–5 |
| **CG** | Plataforma | **Configurador geral**: retenção de logs com limpeza automática, bloqueio de login, política de senha, nome/logo/ícone da plataforma | — |

A ordem 1 → 2 pode ser invertida sem impacto (os módulos são independentes até a onda 3).

### Módulo Gerenciamento de Projetos (diretriz própria, a seguir da Onda 2)

> Diretriz recebida em 2026-09-30: [diretriz_feature_gerenciamento_projetos.md](diretriz_feature_gerenciamento_projetos.md).
> Decisão do usuário: **concluir a Onda 2 (Documentação) antes** (concluída) e então implementar este módulo, **vinculado ao
> módulo de Projetos** (abas do projeto: Visão geral · Tarefas · Kanban · Cronograma · Relatórios). Ele **detalha e
> substitui a "visão em tabela editável" da Onda 4** (o Portfólio continua na Onda 4).

> **Correção de conceito (2026-09-30):** o quadro é um **módulo à parte das tarefas** — a aba **Tarefas** continua sendo a lista de
> tarefas do projeto e a nova aba **Gerenciamento** traz o quadro estilo Monday com **elementos** próprios (reuniões, alinhamentos,
> entregas…), com status, recursos, cronograma, esforço, duração e progresso próprios, **sem vínculo com tarefas**. A diretriz foi
> reescrita (§22 traz as fases GP-1 a GP-5).

**GP-1 concluída em 2026-09-30** (regras em [regras-de-negocio.md](regras-de-negocio.md) §14; decisão em ADR-027): aba Gerenciamento com grupos/subgrupos numerados (recolher com resumo, expandir/recolher tudo, duplicar, excluir, reordenar), elementos e subelementos, etiquetas de status e de recurso do projeto, edição direta em todas as células, linha "+ Adicionar", totais no rodapé e colunas (redimensionar, arrastar, ordenar, recolher, ocultar) lembradas por pessoa.

| Fase | Entrega |
|---|---|
| **GP-1 Base do quadro** ✅ | grupos numerados · elementos e subelementos · etiquetas de status e de recurso · edição nas células · linha de adicionar · totais do rodapé · colunas (largura, ordem, menu) |
| **GP-2 Interação** ✅ | filtros (barra, pessoa, por coluna) · agrupar por · arrastar e soltar linhas e grupos · seleção em massa · dependências com bloqueio configurável · importar elementos |
| **GP-3 Colaboração** ✅ | painel do elemento: atualizações, @menções, arquivos e histórico |
| **GP-4 Visões e gestão** ✅ | Cronograma (Gantt, "Bateria", esforço), Kanban por status, Gestão (diário do projeto, problemas), relatórios e saúde do projeto |
| **GP-5 Colunas personalizadas** ✅ | adicionar, duplicar, renomear, mudar o tipo e excluir colunas |

**GP-2 concluída em 2026-09-30** (regras em §14; decisão em ADR-028): arrastar elementos (no grupo e entre grupos), subelementos e grupos; filtro combinável ("Filtros (N)") também pelo menu da coluna, pessoa, ordenar e agrupar por status/recurso/mês; seleção em massa (status, recursos, mover, duplicar, excluir); duplicar elemento; dependências (depende de/bloqueia/relacionado, sem ciclo) com a regra do quadro (só sinalizar ou impedir iniciar/concluir); importação de CSV com planilha modelo. **GP-3 concluída em 2026-09-30** (regras em §14; decisão em ADR-029): painel lateral do elemento (ícone com contador na linha; link direto `?item=`) com atualizações em conversa (respostas, @menções que notificam, editar/excluir) e imagens/arquivos colados (Ctrl+V), arrastados ou anexados na própria atualização (pedido do usuário: em vez de uma aba Arquivos), histórico e detalhes; notificações do quadro abrem o painel. **GP-4 concluída em 2026-09-30** (regras em §14; decisão em ADR-030): visões Quadro principal · Cronograma · Kanban · Gestão · Relatórios (`?view=`); Cronograma com Gantt por grupo, escala, Hoje, Ajustar, linha de base do gestor, exportar CSV, Bateria e Esforço; Kanban por status com arrastar e "Mover para…"; Gestão com Diário do projeto e Gestão dos problemas; Relatórios com resumo, cronograma, esforço, recursos, grupos e a saúde do projeto com os fatores. **GP-5 concluída em 2026-10-01** (regras em §14; decisão em ADR-031): colunas personalizadas do quadro (texto, número com unidade e soma, data, caixa, lista de opções, pessoa, link), pelo "+" ou "à direita"; renomear/editar opções, duplicar, alterar o tipo com prévia do que se perde e excluir — gestor define, quem edita preenche. Com isso, as fases GP-1 a GP-5 da diretriz do Gerenciamento estão concluídas. Em 2026-10-01 o módulo saiu da página do projeto e virou o item **Gestão de projetos** do menu lateral (ADR-032).

**Novo (GP-1):** `project_groups`, `plan_items` (elementos/subelementos), `plan_statuses` e `plan_resources` por projeto; permissões
`plan.view/edit/manage`; no design system `AppBoardTable` + `useBoardColumns`, `AppInlineEdit`, `AppPopover`, `AppRangeCalendar`.

---

## Onda 1 — Timeline do projeto ✅ (concluída em 2026-09-30)

> Entregue conforme abaixo. Regras funcionais em [regras-de-negocio.md](regras-de-negocio.md) §12; decisões em ADR-025.

**Objetivo:** enxergar e ajustar o cronograma do projeto numa linha do tempo viva, como no Monday.

**Funcionalidades**
- Tarefa ganha **Início planejado** (além do **Prazo** que já existe). Regra: início ≤ prazo. Sem as duas datas, a tarefa fica na lista lateral "Sem datas"; arrastá-la para a timeline define as datas.
- **Marcos do projeto** (entregas-chave): nome, data, descrição e situação (pendente/atingido); aparecem como losango.
- Tela **Timeline** por projeto (menu próprio; a aba no projeto saiu em 2026-10-01 a pedido do usuário — o cronograma do projeto é o do Gerenciamento, `?tab=plan&view=timeline`):
  - barra por tarefa do início ao prazo, na cor do status; progresso (subtarefas/checklist) dentro da barra; atrasada destacada;
  - **arrastar** a barra move as duas datas; **puxar as pontas** muda início ou prazo; teclado acessível (setas);
  - **dependências** (depende de / bloqueia) desenhadas como setas; aviso quando a tarefa começa antes de terminar a que ela depende (sem reprogramar sozinho nesta onda);
  - agrupar por sprint, responsável, tipo, status ou sem grupo; grupos recolhíveis;
  - zoom dia / semana / mês / trimestre; linha "hoje"; sprints como faixas no topo; marcos;
  - mesmos filtros e busca do Kanban; clicar na barra abre o painel da tarefa.
- Datas contadas em dias do fuso de quem está vendo.

**Dados:** `tasks.start_date` (migration); `project_milestones` (project_id, name, description, due_date, state, order).
**API:** `GET /projects/{id}/timeline` (tarefas com datas, dependências, marcos e sprints numa chamada); `PATCH /tasks/{id}` aceita `start_date`; CRUD `/projects/{id}/milestones` e `/milestones/{id}`.
**Permissões:** ver = acesso ao projeto + `tasks.view`; mover barras = `tasks.edit` (mesma regra de edição da tarefa, leitor não move); marcos = gestor/dono do projeto.
**Auditoria:** mudança de datas no histórico da tarefa; `milestone.created/updated/deleted`.
**Aceite:** E2E arrastando uma barra e puxando a ponta; leitor sem arrastar; varredura de acessibilidade na nova tela.

## Onda 2 — Documentação: espaços, páginas e editor ✅ (concluída em 2026-09-30)

> Entregue conforme abaixo, exceto **menções no texto** e **legenda editável da imagem** (a imagem leva o nome do arquivo como texto alternativo), que passam para a Onda 3 junto com os comentários de página. Regras funcionais em [regras-de-negocio.md](regras-de-negocio.md) §13; decisões em ADR-026.

**Objetivo:** criar documentação detalhada, com imagens e formatação rica, organizada como no Confluence.

**Funcionalidades**
- **Espaços** de documentação: nome, chave, ícone, cor, descrição; **da empresa** (geral) ou **de um projeto**; visibilidade: toda a empresa (usuários logados) ou só membros do projeto (link público entra na Onda 5).
- **Árvore de páginas** com subpáginas, arrastar para reordenar/mover, trilha (breadcrumb) e página inicial do espaço.
- **Editor rico** (WYSIWYG, com barra de ferramentas e atalho "/" para inserir blocos): títulos, negrito/itálico/sublinhado, cores de destaque, listas, checklist, **tabelas**, blocos de código, citação, **avisos** (informação, atenção, perigo, sucesso), divisores, links, menções, **imagens** (enviar, colar da área de transferência, arrastar; legenda e largura), anexos de arquivos e **índice automático**.
- **Rascunho salvo automaticamente**; **publicar** cria uma nova versão.
- **Histórico de versões**: ver versões anteriores, quem alterou e quando, **restaurar**.
- **Busca** por título e conteúdo; páginas recentes.

**Dados:** `doc_spaces`, `doc_pages` (space_id, parent_id, title, position, conteúdo em JSON do editor, texto para busca, status, autor), `doc_page_versions`, `doc_files` (arquivos das páginas — mesma checagem de tipo pelo conteúdo dos anexos).
**Técnica:** editor TipTap/ProseMirror no design system (`AppRichTextEditor` / `AppRichTextView`). O conteúdo é salvo como JSON estruturado e desenhado por componentes próprios — **nunca HTML cru** (sem `dangerouslySetInnerHTML`); links só http/https/mailto; imagens pelo download protegido da API.
**Permissões novas:** `docs.view`, `docs.edit`, `docs.manage` (criar/configurar espaços).
**Auditoria:** `doc_space.*`, `doc_page.created/published/moved/deleted/restored`.
**Aceite:** criar espaço, página com imagem colada, tabela e aviso; publicar; restaurar versão; busca.

## Onda 3 — Documentação ligada às tarefas, modelos e colaboração

- **Vincular páginas a tarefas**: aba "Documentação" na tarefa; na página, bloco "Tarefas relacionadas" com status atual; **criar documentação a partir da tarefa** (já preenchida com título, tipo e campos).
- **Modelos de página**: especificação funcional (seções numeradas, legenda de status com cores, histórias de usuário — como a documentação do Clover no SharePoint), manual do usuário, nota de versão, ata de reunião, FAQ; a empresa cria os próprios modelos.
- **Blocos dinâmicos**: cartão de tarefa (status ao vivo), lista de tarefas por filtro, pílula de status, legenda de cores.
- **Comentários na página** com menções e notificações.
- **Exportar PDF / imprimir** com cabeçalho do espaço.

## Onda 4 — Portfólio e visão em tabela (estilo Monday)

- **Portfólio**: todos os projetos na linha do tempo (início → entrega) com marcos, **progresso %** e **saúde** (no prazo, em risco, atrasado — regra documentada), agrupados por status, dono ou prioridade.
- **Visão em tabela editável** do projeto: grupos recolhíveis (sprint, status, responsável), **edição direta na célula** (status, responsável, prioridade, datas, campos personalizados), resumo por grupo (horas, barra de distribuição por status), linha rápida para adicionar tarefa no grupo.
- **Carga de trabalho**: horas estimadas por pessoa por semana, destacando excesso.
- Indicadores de entrega no painel do projeto.

## Onda 5 — Base de conhecimento e FAQ para outras áreas

- **Portal de conhecimento** (`/conhecimento`): busca única em documentação e FAQ, destaques, recentes e espaços publicados.
- **FAQ**: perguntas e respostas (resposta com o mesmo editor), categorias e tags, busca instantânea com destaque, "Isto ajudou?" e as mais consultadas.
- **Publicação**: rascunho → em revisão → publicado; dono da página; **data de revisão** (ex.: a cada 6 meses) com aviso de conteúdo desatualizado.
- **Perfil de consulta** para outras áreas: lê documentação e FAQ publicados, sem acesso a projetos e tarefas.
- **Link público** (decisão do usuário): páginas publicadas de espaços que permitam podem ter link aberto, sem login — regras em "Decisões do usuário".
- "Não encontrei o que procurava" vira pedido (tarefa) para o time responsável.

## Onda 6 — Avançado

- Timeline: **linha de base** (planejado × realizado), **reprogramação em cascata** pelas dependências (com prévia antes de aplicar), caminho crítico, exportar imagem/PDF.
- Documentação: comparar versões lado a lado com destaque, importar Word/Markdown, permissões por página, tradução de páginas.

## Configurador geral da plataforma (pedido do usuário em 2026-09-30)

> Independente das ondas (pode entrar entre qualquer uma delas). Hoje esses valores estão **fixos no código**: bloqueio após
> 5 falhas de login (5 min, dobrando até 60 min — `domain/lockout.js`), senha com mínimo de 10 caracteres e letras + números
> (`domain/user.js`), nome "KAMBAN" e ícone fixos, e o histórico de auditoria (`audit_logs`) sem prazo de limpeza.

Tela **Configurações → Geral**, só para administrador (permissão nova `settings.manage`, com anti-escalonamento), com os blocos:

| Bloco | O que se configura | Padrão |
|---|---|---|
| **Retenção de logs** | tempo de permanência do histórico de auditoria (1, 3, 6, 12, 24 meses ou "manter sempre"); a limpeza roda **sozinha todo dia** e apaga o que passou do prazo; também o registro de tentativas de login | **3 meses** |
| **Login** | número de tentativas antes do bloqueio, tempo inicial e máximo do bloqueio | 5 tentativas · 5 min · até 60 min |
| **Senha** | tamanho mínimo; exigir letras e números, maiúsculas e minúsculas, símbolo | 10 caracteres · letras e números |
| **Identidade** | nome da plataforma (menu, tela de login, título da aba do navegador), logo (versões para tema claro e escuro) e **ícone do navegador** (favicon) | "KAMBAN" · logo e ícone atuais |

Regras previstas:
- **Limpeza de logs:** tarefa diária (como a de lembretes de prazo) apaga em lotes os registros mais antigos que o prazo; a própria limpeza fica registrada (quantos registros saíram), sem dados sensíveis. Encurtar o prazo pede confirmação mostrando quantos registros serão apagados.
- **Limites seguros:** valores validados no domínio (ex.: 3 a 20 tentativas; senha de 8 a 128; retenção mínima de 1 mês) para ninguém desligar a proteção por engano; os padrões atuais continuam valendo até alguém mudar.
- **Senha:** a política nova vale para senhas criadas ou trocadas a partir da mudança (as atuais não são invalidadas); a tela de troca de senha mostra as exigências vigentes.
- **Identidade:** logo e ícone por upload com tipo verificado pelos bytes (PNG, SVG higienizado, ICO, WebP) e limite de tamanho; nome, logo e ícone são **públicos** (a tela de login e a aba do navegador precisam deles) por uma rota só de leitura; o resto das configurações só para administrador.
- **Técnico:** configuração única no banco (collection de configurações), lida pelos casos de uso por uma porta (`settingsRepository`) com cache curto; toda alteração auditada na mesma transação (antes/depois); i18n pt-BR/en/es; testes de domínio, API e E2E; regras em regras-de-negocio.md.

## Decisões do usuário (2026-09-30)
- **Começar pela Onda 1** (Timeline).
- **Leitura da documentação e do FAQ:** usuários logados conforme cada espaço (toda a empresa — inclusive outras áreas com perfil só de consulta — ou só membros do projeto) **e também link público** para páginas publicadas. Regras do link público (Onda 5, com segurança reforçada): só páginas **publicadas** de espaços que permitam; link com token aleatório longo e revogável; somente leitura, sem comentários nem menções a pessoas; imagens servidas pelo mesmo token; acesso auditado; o gestor do espaço vê e revoga os links.
