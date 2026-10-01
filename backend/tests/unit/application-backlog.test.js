const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createTaskService } = require('../../pb_hooks/src/application/tasks')
const { createBacklogService } = require('../../pb_hooks/src/application/backlog')
const { createSprintService } = require('../../pb_hooks/src/application/sprints')
const { createLookupService } = require('../../pb_hooks/src/application/lookups')
const { createTaskTypeService } = require('../../pb_hooks/src/application/task-types')
const sprintDomain = require('../../pb_hooks/src/domain/sprint')
const { createPrincipal } = require('../../pb_hooks/src/domain/rbac')

function ctxOf(deps, user) {
  const role = deps.roleRepository.findById(user.roleId)
  return {
    principal: createPrincipal({ userId: user.id, roleId: role.id, roleCode: role.code, permissions: deps.roleRepository.getPermissionCodes(role.id) }),
    ip: '1.1.1.1',
    userAgent: 'ua',
    correlationId: 'c',
  }
}

function codeOf(fn) {
  try {
    fn()
  } catch (err) {
    return err.code === 'VALIDATION_ERROR' ? `${err.code}:${JSON.stringify(err.details.fields)}` : err.code
  }
  return 'OK'
}

function setup() {
  const deps = createFakeDeps()
  const adminUser = seedUser(deps, { roleCode: 'ADMIN', name: 'Admin' })
  const gabi = seedUser(deps, { roleCode: 'MANAGER', name: 'Gabi' })
  const mario = seedUser(deps, { roleCode: 'MEMBER', name: 'Mário' })
  const lia = seedUser(deps, { roleCode: 'MEMBER', name: 'Lia' })
  const admin = ctxOf(deps, adminUser)
  const project = deps.projectRepository.create({ name: 'CRM', key: 'CRM', ownerId: gabi.id, createdBy: gabi.id, status: 'active', priority: 'medium' })
  const other = deps.projectRepository.create({ name: 'ERP', key: 'ERP', ownerId: gabi.id, createdBy: gabi.id, status: 'active', priority: 'medium' })
  ;[
    [gabi, 'manager'],
    [mario, 'member'],
    [lia, 'viewer'],
  ].forEach(([u, role]) => deps.projectMemberRepository.add({ projectId: project.id, userId: u.id, role }))
  deps.projectMemberRepository.add({ projectId: other.id, userId: gabi.id, role: 'manager' })
  const bug = createTaskTypeService(deps).createType(admin, { key: 'BUG', name: 'Bug' })
  const statuses = createLookupService(deps, 'status')
  const backlog = statuses.create(admin, { key: 'BACKLOG', name: 'Backlog', category: 'backlog', is_default: true })
  const todo = statuses.create(admin, { key: 'TODO', name: 'A fazer', category: 'todo' })
  const dev = statuses.create(admin, { key: 'DEV', name: 'Desenvolvimento', category: 'in_progress' })
  const done = statuses.create(admin, { key: 'DONE', name: 'Concluído', category: 'done' })
  createLookupService(deps, 'priority').create(admin, { key: 'MEDIA', name: 'Média' })
  const ctx = { admin, gabi: ctxOf(deps, gabi), mario: ctxOf(deps, mario), lia: ctxOf(deps, lia) }
  const tasks = createTaskService(deps)
  return {
    deps,
    ctx,
    project,
    other,
    statuses: { backlog, todo, dev, done },
    tasks,
    sprints: createSprintService(deps),
    backlog: createBacklogService(deps),
    newTask: (title, extra) => tasks.createTask(ctx.mario, Object.assign({ project_id: project.id, task_type_id: bug.id, title }, extra)),
  }
}

const titles = (items) => items.map((t) => t.title)

describe('domain/sprint', () => {
  it('fim antes do início é inválido; só sprint não encerrado recebe tarefas', () => {
    assert.equal(sprintDomain.datesIssue('2026-10-10', '2026-10-01'), 'end_before_start')
    assert.equal(sprintDomain.datesIssue('2026-10-01', '2026-10-10'), null)
    assert.equal(sprintDomain.datesIssue(null, '2026-10-10'), null)
    assert.equal(sprintDomain.isOpen({ state: 'planned' }), true)
    assert.equal(sprintDomain.isOpen({ state: 'closed' }), false)
  })
})

describe('application/sprints', () => {
  it('gestor planeja sprints; membro e leitor não; tudo auditado', () => {
    const s = setup()
    const sprint = s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'Sprint 1', goal: 'Checkout estável', start_date: '2026-10-01', end_date: '2026-10-14' })
    assert.equal(sprint.state, 'planned')
    assert.equal(sprint.start_date, '2026-10-01')
    assert.equal(codeOf(() => s.sprints.createSprint(s.ctx.mario, s.project.id, { name: 'X' })), 'FORBIDDEN')
    assert.equal(codeOf(() => s.sprints.createSprint(s.ctx.lia, s.project.id, { name: 'X' })), 'FORBIDDEN')
    assert.equal(
      codeOf(() => s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'X', start_date: '2026-10-10', end_date: '2026-10-01' })),
      'VALIDATION_ERROR:{"end_date":"end_before_start"}',
    )
    assert.equal(codeOf(() => s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: '' })), 'VALIDATION_ERROR:{"name":"required"}')

    // todo participante do projeto vê os sprints
    assert.deepEqual(
      s.sprints.listSprints(s.ctx.lia, s.project.id, {}).map((c) => c.name),
      ['Sprint 1'],
    )
    const renamed = s.sprints.updateSprint(s.ctx.gabi, sprint.id, { name: 'Sprint 1 — outubro', state: 'active' })
    assert.equal(renamed.state, 'active')
    assert.equal(codeOf(() => s.sprints.updateSprint(s.ctx.gabi, sprint.id, { state: 'paused' })), 'VALIDATION_ERROR:{"state":"invalid_option"}')
    const actions = s.deps.store.audit.filter((a) => a.entityType === 'sprint').map((a) => a.action)
    assert.deepEqual(actions, ['sprint.created', 'sprint.updated'])
    // de outro projeto não se vê (anti-IDOR)
    assert.equal(codeOf(() => s.sprints.updateSprint(s.ctx.mario, sprint.id, { name: 'Y' })), 'FORBIDDEN')
  })

  it('encerrar devolve ao backlog o que não terminou; excluir tira a sprint das tarefas', () => {
    const s = setup()
    const sprint = s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'Sprint 1' })
    const open = s.newTask('Aberta', { sprint_id: sprint.id })
    const finished = s.newTask('Pronta', { sprint_id: sprint.id, status_id: s.statuses.done.id })
    const closed = s.sprints.updateSprint(s.ctx.gabi, sprint.id, { state: 'closed' })
    assert.equal(closed.state, 'closed')
    assert.equal(closed.returned_count, 1)
    assert.equal(s.tasks.getTask(s.ctx.mario, open.id).sprint, null)
    assert.equal(s.tasks.getTask(s.ctx.mario, finished.id).sprint.name, 'Sprint 1')
    // sprint encerrada não recebe tarefas nem aparece na lista padrão
    assert.equal(codeOf(() => s.tasks.updateTask(s.ctx.mario, open.id, { sprint_id: sprint.id })), 'VALIDATION_ERROR:{"sprint_id":"invalid_option"}')
    assert.deepEqual(s.sprints.listSprints(s.ctx.mario, s.project.id, {}), [])
    assert.equal(s.sprints.listSprints(s.ctx.mario, s.project.id, { include_closed: '1' }).length, 1)

    const next = s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'Sprint 2' })
    s.tasks.updateTask(s.ctx.mario, open.id, { sprint_id: next.id })
    s.sprints.deleteSprint(s.ctx.gabi, next.id)
    assert.equal(s.tasks.getTask(s.ctx.mario, open.id).sprint, null)
    const history = s.deps.store.audit.filter((a) => a.action === 'task.updated' && a.entityId === open.id && 'sprint' in a.newValue)
    assert.deepEqual(
      history.map((a) => [a.oldValue.sprint, a.newValue.sprint]),
      [
        ['Sprint 1', null],
        [null, 'Sprint 2'],
        ['Sprint 2', null],
      ],
    )
  })
})

describe('ordem das sprints', () => {
  it('gestor organiza a ordem; novas entram no fim; encerradas vão para o final', () => {
    const s = setup()
    const names = () => s.sprints.listSprints(s.ctx.mario, s.project.id, {}).map((x) => x.name)
    const a = s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'A', start_date: '2026-12-01' })
    const b = s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'B', start_date: '2026-10-01' })
    const c = s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'C' })
    // ordem de criação (não pela data): quem organiza é o time
    assert.deepEqual(names(), ['A', 'B', 'C'])

    const reordered = s.sprints.reorderSprints(s.ctx.gabi, s.project.id, [c.id, a.id, b.id])
    assert.deepEqual(reordered.map((x) => x.name), ['C', 'A', 'B'])
    assert.deepEqual(names(), ['C', 'A', 'B'])
    const last = s.deps.store.audit.at(-1)
    assert.equal(last.action, 'sprint.reordered')
    assert.deepEqual(last.newValue, { order: ['C', 'A', 'B'] })

    assert.equal(codeOf(() => s.sprints.reorderSprints(s.ctx.mario, s.project.id, [a.id, b.id, c.id])), 'FORBIDDEN')
    assert.equal(codeOf(() => s.sprints.reorderSprints(s.ctx.gabi, s.project.id, [a.id, b.id])), 'VALIDATION_ERROR:{"ids":"invalid_option"}')

    s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'D' })
    s.sprints.updateSprint(s.ctx.gabi, c.id, { state: 'closed' })
    assert.deepEqual(s.sprints.listSprints(s.ctx.mario, s.project.id, { include_closed: '1' }).map((x) => x.name), ['A', 'B', 'D', 'C'])
  })
})

describe('tarefas com sprint', () => {
  it('sprint precisa ser do mesmo projeto; aparece no resumo e filtra a lista', () => {
    const s = setup()
    const sprint = s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'Sprint 1' })
    const foreign = s.sprints.createSprint(s.ctx.gabi, s.other.id, { name: 'ERP 1' })
    assert.equal(codeOf(() => s.newTask('X', { sprint_id: foreign.id })), 'VALIDATION_ERROR:{"sprint_id":"invalid_option"}')
    const planned = s.newTask('Planejada', { sprint_id: sprint.id })
    s.newTask('Solta')
    assert.deepEqual(planned.sprint, { id: sprint.id, name: 'Sprint 1', state: 'planned' })
    const created = s.deps.store.audit.find((a) => a.action === 'task.created' && a.entityId === planned.id)
    assert.equal(created.newValue.sprint, 'Sprint 1')

    const list = (sprintId) => titles(s.tasks.listTasks(s.ctx.mario, { project_id: s.project.id, sprint_id: sprintId }).items)
    assert.deepEqual(list(sprint.id), ['Planejada'])
    assert.deepEqual(list('none'), ['Solta'])
    // null limpa
    assert.equal(s.tasks.updateTask(s.ctx.mario, planned.id, { sprint_id: null }).sprint, null)
  })
})

describe('application/backlog', () => {
  it('lista tudo que não está encerrado (concluída/cancelada fora), na ordem manual, com sprints e permissões', () => {
    const s = setup()
    const sprint = s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'Sprint 1' })
    s.newTask('A')
    s.newTask('B', { sprint_id: sprint.id, estimated_hours: 3 })
    s.newTask('Analisada', { status_id: s.statuses.todo.id })
    s.newTask('Em andamento', { status_id: s.statuses.dev.id })
    s.newTask('Concluída', { status_id: s.statuses.done.id })
    s.newTask('C')

    const view = s.backlog.getBacklog(s.ctx.mario, s.project.id)
    // posição manual (mesma escala das colunas do Kanban); tudo que não está encerrado entra (concluída/cancelada fora)
    assert.deepEqual(titles(view.items), ['A', 'Analisada', 'Em andamento', 'B', 'C'])
    const b = view.items.find((i) => i.title === 'B')
    assert.equal(b.sprint.name, 'Sprint 1')
    assert.equal(b.estimated_hours, 3)
    assert.deepEqual(view.sprints.map((c) => c.name), ['Sprint 1'])
    assert.deepEqual(view.statuses.map((st) => st.key), ['BACKLOG', 'TODO', 'DEV'])
    assert.deepEqual(view.capabilities, { rank: true, create: true, manage_sprints: false })
    assert.equal(view.truncated, false)
    assert.deepEqual(s.backlog.getBacklog(s.ctx.gabi, s.project.id).capabilities.manage_sprints, true)
    assert.deepEqual(s.backlog.getBacklog(s.ctx.lia, s.project.id).capabilities, { rank: false, create: false, manage_sprints: false })
    assert.equal(codeOf(() => s.backlog.getBacklog(s.ctx.mario, s.other.id)), 'PROJECT_NOT_FOUND')
  })

  it('priorizar: reordena entre vizinhos e pode trocar de sprint (com histórico)', () => {
    const s = setup()
    const sprint = s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'Sprint 1' })
    const a = s.newTask('A')
    const b = s.newTask('B')
    const c = s.newTask('C')
    const order = () => titles(s.backlog.getBacklog(s.ctx.mario, s.project.id).items)

    s.backlog.rankTask(s.ctx.mario, c.id, { next_id: a.id })
    assert.deepEqual(order(), ['C', 'A', 'B'])
    s.backlog.rankTask(s.ctx.mario, c.id, { prev_id: b.id })
    assert.deepEqual(order(), ['A', 'B', 'C'])
    // sem histórico só por reordenar
    assert.equal(s.deps.store.audit.filter((x) => x.action === 'task.updated').length, 0)

    const moved = s.backlog.rankTask(s.ctx.mario, a.id, { prev_id: b.id, sprint_id: sprint.id })
    assert.equal(moved.sprint.name, 'Sprint 1')
    assert.deepEqual(order(), ['B', 'A', 'C'])
    assert.equal(s.deps.store.audit.filter((x) => x.action === 'task.updated' && x.newValue.sprint === 'Sprint 1').length, 1)

    assert.equal(codeOf(() => s.backlog.rankTask(s.ctx.lia, a.id, { next_id: b.id })), 'FORBIDDEN')
    // analisada e em andamento continuam planejáveis; concluída sai da lista
    s.tasks.updateTask(s.ctx.mario, b.id, { status_id: s.statuses.todo.id })
    assert.equal(codeOf(() => s.backlog.rankTask(s.ctx.mario, b.id, { next_id: c.id })), 'OK')
    s.tasks.updateTask(s.ctx.mario, b.id, { status_id: s.statuses.dev.id })
    assert.equal(codeOf(() => s.backlog.rankTask(s.ctx.mario, b.id, { next_id: c.id })), 'OK')
    s.tasks.updateTask(s.ctx.mario, b.id, { status_id: s.statuses.done.id })
    assert.equal(codeOf(() => s.backlog.rankTask(s.ctx.mario, b.id, {})), 'NOT_IN_BACKLOG')
  })

  it('sem espaço entre vizinhos, renumera o backlog e mantém a ordem', () => {
    const s = setup()
    const a = s.newTask('A')
    const b = s.newTask('B')
    const c = s.newTask('C')
    s.deps.store.tasks.find((t) => t.id === a.id).position = 1
    s.deps.store.tasks.find((t) => t.id === b.id).position = 1.0000000001
    s.backlog.rankTask(s.ctx.mario, c.id, { prev_id: a.id, next_id: b.id })
    assert.deepEqual(titles(s.backlog.getBacklog(s.ctx.mario, s.project.id).items), ['A', 'C', 'B'])
  })
})
