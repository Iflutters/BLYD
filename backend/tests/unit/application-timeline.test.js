const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createTaskService } = require('../../pb_hooks/src/application/tasks')
const { createTimelineService } = require('../../pb_hooks/src/application/timeline')
const { createMilestoneService } = require('../../pb_hooks/src/application/milestones')
const { createSprintService } = require('../../pb_hooks/src/application/sprints')
const { createRelationService } = require('../../pb_hooks/src/application/relations')
const { createLookupService } = require('../../pb_hooks/src/application/lookups')
const { createTaskTypeService } = require('../../pb_hooks/src/application/task-types')
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
  const otto = seedUser(deps, { roleCode: 'MEMBER', name: 'Otto' })
  const admin = ctxOf(deps, adminUser)
  const project = deps.projectRepository.create({ name: 'CRM', key: 'CRM', ownerId: gabi.id, createdBy: gabi.id, status: 'active', priority: 'medium', startDate: new Date('2026-10-01T00:00:00Z'), dueDate: new Date('2026-12-15T00:00:00Z') })
  ;[
    [gabi, 'manager'],
    [mario, 'member'],
    [lia, 'viewer'],
  ].forEach(([u, role]) => deps.projectMemberRepository.add({ projectId: project.id, userId: u.id, role }))
  const doc = createTaskTypeService(deps).createType(admin, { key: 'DOC', name: 'Documentação' })
  const statuses = createLookupService(deps, 'status')
  statuses.create(admin, { key: 'BACKLOG', name: 'Backlog', category: 'backlog', is_default: true })
  statuses.create(admin, { key: 'DONE', name: 'Concluído', category: 'done' })
  createLookupService(deps, 'priority').create(admin, { key: 'MEDIA', name: 'Média', is_default: true })
  const ctx = { admin, gabi: ctxOf(deps, gabi), mario: ctxOf(deps, mario), lia: ctxOf(deps, lia), otto: ctxOf(deps, otto) }
  const tasks = createTaskService(deps)
  return {
    deps,
    ctx,
    project,
    tasks,
    timeline: createTimelineService(deps),
    milestones: createMilestoneService(deps),
    sprints: createSprintService(deps),
    relations: createRelationService(deps),
    newTask: (title, extra) => tasks.createTask(ctx.mario, Object.assign({ project_id: project.id, task_type_id: doc.id, title }, extra)),
  }
}

describe('application/tasks — início planejado', () => {
  it('grava, mostra e valida início ≤ prazo (na criação e na edição, com o valor já salvo)', () => {
    const s = setup()
    const task = s.newTask('Levantamento', { start_date: '2026-10-01', due_date: '2026-10-05' })
    assert.equal(task.start_date.slice(0, 10), '2026-10-01')
    assert.equal(codeOf(() => s.newTask('Errada', { start_date: '2026-10-09', due_date: '2026-10-05' })), 'VALIDATION_ERROR:{"start_date":"after_due_date"}')
    // o prazo salvo vale na edição: mover só o início para depois dele é recusado
    assert.equal(codeOf(() => s.tasks.updateTask(s.ctx.mario, task.id, { start_date: '2026-10-07' })), 'VALIDATION_ERROR:{"start_date":"after_due_date"}')
    const moved = s.tasks.updateTask(s.ctx.mario, task.id, { start_date: '2026-10-07', due_date: '2026-10-10' })
    assert.deepEqual([moved.start_date.slice(0, 10), moved.due_date.slice(0, 10)], ['2026-10-07', '2026-10-10'])
    const cleared = s.tasks.updateTask(s.ctx.mario, task.id, { start_date: null })
    assert.equal(cleared.start_date, null)
    // histórico mostra a mudança do início
    const history = s.deps.store.audit.filter((e) => e.entityId === task.id && e.action === 'task.updated')
    assert.ok(history.some((e) => e.newValue.start_date === '2026-10-07'))
  })
})

describe('application/timeline', () => {
  it('traz tarefas com datas, setas de dependência com conflito, sprints e marcos do projeto', () => {
    const s = setup()
    const a = s.newTask('A', { start_date: '2026-10-01', due_date: '2026-10-05' })
    const b = s.newTask('B', { start_date: '2026-10-03', due_date: '2026-10-08' })
    const c = s.newTask('C (sem datas)')
    s.relations.createRelation(s.ctx.mario, a.id, { type: 'blocks', target_id: b.id })
    s.relations.createRelation(s.ctx.mario, c.id, { type: 'depends_on', target_id: b.id })
    s.sprints.createSprint(s.ctx.gabi, s.project.id, { name: 'Sprint 1', start_date: '2026-10-01', end_date: '2026-10-14' })
    s.milestones.createMilestone(s.ctx.gabi, s.project.id, { name: 'Go-live', due_date: '2026-10-20' })

    const t = s.timeline.getTimeline(s.ctx.mario, s.project.id)
    assert.deepEqual([t.project.key, t.project.start_date.slice(0, 10), t.project.due_date.slice(0, 10)], ['CRM', '2026-10-01', '2026-12-15'])
    assert.deepEqual(t.tasks.map((x) => x.title), ['A', 'B', 'C (sem datas)'])
    assert.deepEqual(
      t.dependencies.map((e) => [e.from, e.to, e.conflict]),
      [
        [a.id, b.id, true],
        [b.id, c.id, false],
      ],
    )
    assert.deepEqual(t.sprints.map((x) => x.name), ['Sprint 1'])
    assert.deepEqual(t.milestones.map((m) => [m.name, m.due_date, m.state]), [['Go-live', '2026-10-20', 'pending']])
    assert.deepEqual(t.capabilities, { edit: true, manage_milestones: false })
    assert.deepEqual(s.timeline.getTimeline(s.ctx.gabi, s.project.id).capabilities, { edit: true, manage_milestones: true })
  })

  it('leitor vê sem editar; quem não é do projeto não enxerga', () => {
    const s = setup()
    s.newTask('A', { due_date: '2026-10-05' })
    assert.deepEqual(s.timeline.getTimeline(s.ctx.lia, s.project.id).capabilities, { edit: false, manage_milestones: false })
    assert.equal(codeOf(() => s.timeline.getTimeline(s.ctx.otto, s.project.id)), 'PROJECT_NOT_FOUND')
  })
})

describe('application/milestones', () => {
  it('gestor cria, edita, marca como atingido e exclui; tudo no histórico do projeto', () => {
    const s = setup()
    const m = s.milestones.createMilestone(s.ctx.gabi, s.project.id, { name: '  Homologação  ', due_date: '2026-11-10', description: 'Aceite do cliente' })
    assert.deepEqual([m.name, m.due_date, m.state, m.description], ['Homologação', '2026-11-10', 'pending', 'Aceite do cliente'])
    const done = s.milestones.updateMilestone(s.ctx.gabi, m.id, { state: 'done', due_date: '2026-11-12' })
    assert.deepEqual([done.state, done.due_date], ['done', '2026-11-12'])
    assert.deepEqual(s.milestones.listMilestones(s.ctx.lia, s.project.id).map((x) => x.name), ['Homologação'])
    s.milestones.deleteMilestone(s.ctx.gabi, m.id)
    assert.equal(s.milestones.listMilestones(s.ctx.gabi, s.project.id).length, 0)
    const actions = s.deps.store.audit.filter((e) => e.entityType === 'project' && e.entityId === s.project.id).map((e) => e.action)
    assert.deepEqual(actions.filter((a) => a.startsWith('milestone.')), ['milestone.created', 'milestone.updated', 'milestone.deleted'])
  })

  it('valida e restringe: membro e leitor não gerenciam; quem não vê o projeto recebe 404', () => {
    const s = setup()
    assert.equal(codeOf(() => s.milestones.createMilestone(s.ctx.gabi, s.project.id, { name: '', due_date: '2026-11-10' })), 'VALIDATION_ERROR:{"name":"required"}')
    assert.equal(codeOf(() => s.milestones.createMilestone(s.ctx.gabi, s.project.id, { name: 'X' })), 'VALIDATION_ERROR:{"due_date":"required"}')
    assert.equal(codeOf(() => s.milestones.createMilestone(s.ctx.gabi, s.project.id, { name: 'X', due_date: '2026-11-10', state: 'talvez' })), 'VALIDATION_ERROR:{"state":"invalid_option"}')
    assert.equal(codeOf(() => s.milestones.createMilestone(s.ctx.mario, s.project.id, { name: 'X', due_date: '2026-11-10' })), 'FORBIDDEN')
    const m = s.milestones.createMilestone(s.ctx.gabi, s.project.id, { name: 'X', due_date: '2026-11-10' })
    assert.equal(codeOf(() => s.milestones.updateMilestone(s.ctx.lia, m.id, { name: 'Y' })), 'FORBIDDEN')
    assert.equal(codeOf(() => s.milestones.deleteMilestone(s.ctx.otto, m.id)), 'MILESTONE_NOT_FOUND')
  })
})
