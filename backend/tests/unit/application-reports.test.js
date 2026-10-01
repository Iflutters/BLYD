const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createTaskService } = require('../../pb_hooks/src/application/tasks')
const { createReportService } = require('../../pb_hooks/src/application/reports')
const { createLookupService } = require('../../pb_hooks/src/application/lookups')
const { createTaskTypeService } = require('../../pb_hooks/src/application/task-types')
const { createPrincipal } = require('../../pb_hooks/src/domain/rbac')

function ctxOf(deps, user, dropPermission) {
  const role = deps.roleRepository.findById(user.roleId)
  const permissions = deps.roleRepository.getPermissionCodes(role.id).filter((p) => p !== dropPermission)
  return { principal: createPrincipal({ userId: user.id, roleId: role.id, roleCode: role.code, permissions }), ip: '1.1.1.1', userAgent: 'ua', correlationId: 'c' }
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
  const deps = createFakeDeps({ start: '2026-01-10T12:00:00.000Z' })
  const adminUser = seedUser(deps, { roleCode: 'ADMIN', name: 'Admin' })
  const gabi = seedUser(deps, { roleCode: 'MANAGER', name: 'Gabi' })
  const mario = seedUser(deps, { roleCode: 'MEMBER', name: 'Mário' })
  const admin = ctxOf(deps, adminUser)
  const mk = (name, key) => deps.projectRepository.create({ name, key, ownerId: gabi.id, createdBy: gabi.id, status: 'active', priority: 'medium' })
  const crm = mk('CRM', 'CRM')
  const erp = mk('ERP', 'ERP')
  const arq = mk('Arquivado', 'ARQ')
  ;[crm, arq].forEach((p) => deps.projectMemberRepository.add({ projectId: p.id, userId: mario.id, role: 'member' }))
  ;[crm, erp, arq].forEach((p) => deps.projectMemberRepository.add({ projectId: p.id, userId: gabi.id, role: 'manager' }))
  const types = createTaskTypeService(deps)
  const bug = types.createType(admin, { key: 'BUG', name: 'Bug' })
  const story = types.createType(admin, { key: 'STORY', name: 'História' })
  const statuses = createLookupService(deps, 'status')
  statuses.create(admin, { key: 'BACKLOG', name: 'Backlog', category: 'backlog', is_default: true })
  const dev = statuses.create(admin, { key: 'DEV', name: 'Desenvolvimento', category: 'in_progress' })
  const done = statuses.create(admin, { key: 'DONE', name: 'Concluído', category: 'done' })
  const priorities = createLookupService(deps, 'priority')
  const critica = priorities.create(admin, { key: 'CRITICA', name: 'Crítica' })
  priorities.create(admin, { key: 'MEDIA', name: 'Média', is_default: true })
  const ctx = { admin, gabi: ctxOf(deps, gabi), mario: ctxOf(deps, mario), marioNoReports: ctxOf(deps, mario, 'reports.view') }
  const tasks = createTaskService(deps)
  const add = (project, title, extra) => tasks.createTask(ctx.gabi, Object.assign({ project_id: project.id, task_type_id: story.id, title }, extra))
  const t1 = add(crm, 'Erro no checkout', { task_type_id: bug.id, priority_id: critica.id, status_id: dev.id, assignee_id: mario.id })
  const t2 = add(crm, 'Relatório', { due_date: '2026-01-05' })
  add(crm, 'Tela pronta', { status_id: done.id })
  add(crm, 'Bug resolvido', { task_type_id: bug.id, status_id: done.id })
  add(erp, 'Só no ERP')
  add(arq, 'Antiga')
  deps.projectRepository.update(arq.id, { archivedAt: new Date('2026-01-02T00:00:00Z') })
  // t1 bloqueada por t2 (aberta)
  deps.relationRepository.create({ type: 'blocks', sourceId: t2.id, targetId: t1.id })
  return { deps, ctx, crm, erp, arq, bug, done, mario, t2, reports: createReportService(deps) }
}

describe('application/reports', () => {
  it('indicadores no escopo visível (sem projetos arquivados), com período explícito e definições', () => {
    const s = setup()
    const r = s.reports.getReport(s.ctx.mario, {})
    assert.equal(r.period.from, '2025-12-11T12:00:00.000Z')
    assert.equal(r.period.to, '2026-01-10T12:00:00.000Z')
    const i = r.indicators
    assert.deepEqual(
      { total: i.total, open: i.open, in_progress: i.in_progress, blocked: i.blocked, overdue: i.overdue, critical_bugs: i.critical_bugs, completed: i.completed },
      { total: 4, open: 2, in_progress: 1, blocked: 1, overdue: 1, critical_bugs: 1, completed: 2 },
    )
    assert.equal(i.lead_time.count, 2)
    assert.deepEqual(r.definitions.critical_priority, { id: r.definitions.critical_priority.id, name: 'Crítica' })
    assert.deepEqual(r.definitions.bug_types.map((t) => t.name), ['Bug'])
    assert.deepEqual(r.overdue_tasks.map((t) => t.code), [s.t2.code])
    assert.ok(r.series.points.length > 0)
  })

  it('filtros: projeto (inclusive arquivado, se escolhido), responsável, tipo e status', () => {
    const s = setup()
    const total = (query) => s.reports.getReport(s.ctx.mario, query).indicators.total
    assert.equal(total({ project_id: s.arq.id }), 1)
    assert.equal(codeOf(() => s.reports.getReport(s.ctx.mario, { project_id: s.erp.id })), 'PROJECT_NOT_FOUND')
    assert.equal(total({ assignee_id: 'me' }), 1)
    assert.equal(total({ assignee_id: 'none' }), 3)
    assert.equal(total({ task_type_id: s.bug.id }), 2)
    assert.equal(total({ status_id: s.done.id }), 2)
    // gestor vê os três projetos ativos em que está
    assert.equal(s.reports.getReport(s.ctx.gabi, {}).indicators.total, 5)
  })

  it('recorte por dimensão traz o rótulo de cada grupo', () => {
    const s = setup()
    const byAssignee = s.reports.getReport(s.ctx.mario, { group_by: 'assignee' }).breakdown
    assert.equal(byAssignee.dimension, 'assignee')
    assert.deepEqual(
      byAssignee.rows.map((g) => [g.label ? g.label.name : null, g.total]),
      // mais abertas primeiro; empate (1 × 1) desempata por concluídas (2 × 0)
      [
        [null, 3],
        ['Mário', 1],
      ],
    )
    const byType = s.reports.getReport(s.ctx.mario, { group_by: 'type' }).breakdown.rows
    assert.deepEqual(byType.map((g) => g.label.name).sort(), ['Bug', 'História'])
  })

  it('tipos no idioma da requisição: recorte por tipo e definição de bug', () => {
    const s = setup()
    createTaskTypeService(s.deps).updateType(s.ctx.admin, s.bug.id, { translations: { es: { name: 'Error' } } })
    s.deps.locale = 'es'
    const r = s.reports.getReport(s.ctx.mario, { group_by: 'type' })
    assert.deepEqual(r.definitions.bug_types.map((t) => t.name), ['Error'])
    assert.ok(r.breakdown.rows.some((g) => g.label && g.label.name === 'Error'))
  })

  it('valida período, dimensão e fuso; exige reports.view', () => {
    const s = setup()
    assert.equal(
      codeOf(() => s.reports.getReport(s.ctx.mario, { from: '2026-01-10T00:00:00Z', to: '2026-01-01T00:00:00Z' })),
      'VALIDATION_ERROR:{"to":"to_before_from"}',
    )
    assert.equal(codeOf(() => s.reports.getReport(s.ctx.mario, { from: '2024-01-01T00:00:00Z', to: '2026-01-01T00:00:00Z' })), 'VALIDATION_ERROR:{"from":"too_long"}')
    assert.equal(codeOf(() => s.reports.getReport(s.ctx.mario, { group_by: 'cor' })), 'VALIDATION_ERROR:{"group_by":"invalid_option"}')
    assert.equal(codeOf(() => s.reports.getReport(s.ctx.mario, { tz_offset: '9999' })), 'VALIDATION_ERROR:{"tz_offset":"invalid_type"}')
    assert.equal(codeOf(() => s.reports.getReport(s.ctx.marioNoReports, {})), 'FORBIDDEN')
  })
  it('detalhamento: as tarefas por trás de cada indicador, paginadas, com o mesmo escopo e filtros', () => {
    const s = setup()
    const report = s.reports.getReport(s.ctx.mario, {})
    ;['open', 'blocked', 'overdue', 'critical_bugs', 'completed', 'lead_time', 'bug_resolution'].forEach((metric) => {
      const page = s.reports.listIndicatorTasks(s.ctx.mario, { metric })
      const expected = typeof report.indicators[metric] === 'number' ? report.indicators[metric] : report.indicators[metric].count
      assert.equal(page.meta.total, expected, metric)
      assert.equal(page.items.length, expected, metric)
    })
    const blocked = s.reports.listIndicatorTasks(s.ctx.mario, { metric: 'blocked' }).items
    assert.equal(blocked[0].title, 'Erro no checkout')
    assert.equal(blocked[0].blocked, true)
    // tempos: cada tarefa traz a própria duração
    const lead = s.reports.listIndicatorTasks(s.ctx.mario, { metric: 'lead_time' }).items
    assert.ok(lead.every((t) => typeof t.metric_hours === 'number' && t.metric_hours >= 0))
    // filtros do relatório valem também no detalhamento
    assert.equal(s.reports.listIndicatorTasks(s.ctx.mario, { metric: 'open', assignee_id: 'me' }).meta.total, 1)
    // paginação
    const first = s.reports.listIndicatorTasks(s.ctx.mario, { metric: 'completed', perPage: '1' })
    assert.deepEqual([first.items.length, first.meta.total, first.meta.totalPages], [1, 2, 2])
    const second = s.reports.listIndicatorTasks(s.ctx.mario, { metric: 'completed', perPage: '1', page: '2' })
    assert.notEqual(second.items[0].id, first.items[0].id)
  })

  it('detalhamento: valida o indicador e exige reports.view', () => {
    const s = setup()
    assert.equal(codeOf(() => s.reports.listIndicatorTasks(s.ctx.mario, {})), 'VALIDATION_ERROR:{"metric":"required"}')
    assert.equal(codeOf(() => s.reports.listIndicatorTasks(s.ctx.mario, { metric: 'tudo' })), 'VALIDATION_ERROR:{"metric":"invalid_option"}')
    assert.equal(codeOf(() => s.reports.listIndicatorTasks(s.ctx.marioNoReports, { metric: 'open' })), 'FORBIDDEN')
    assert.equal(codeOf(() => s.reports.listIndicatorTasks(s.ctx.mario, { metric: 'open', project_id: s.erp.id })), 'PROJECT_NOT_FOUND')
  })
})
