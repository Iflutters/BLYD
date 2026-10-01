const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createTaskService } = require('../../pb_hooks/src/application/tasks')
const { createCommentService } = require('../../pb_hooks/src/application/comments')
const { createNotificationService } = require('../../pb_hooks/src/application/notifications')
const { createTaskTypeService } = require('../../pb_hooks/src/application/task-types')
const { createLookupService } = require('../../pb_hooks/src/application/lookups')
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
    return err.code
  }
  return 'OK'
}

function setup() {
  const deps = createFakeDeps({ start: new Date('2026-09-29T12:00:00Z') })
  const adminUser = seedUser(deps, { roleCode: 'ADMIN', name: 'Admin' })
  const u = {
    gabi: seedUser(deps, { roleCode: 'MANAGER', name: 'Gabi' }),
    mario: seedUser(deps, { roleCode: 'MEMBER', name: 'Mário' }),
    ana: seedUser(deps, { roleCode: 'MEMBER', name: 'Ana' }),
    lia: seedUser(deps, { roleCode: 'MEMBER', name: 'Lia' }),
  }
  const admin = ctxOf(deps, adminUser)
  const project = deps.projectRepository.create({ name: 'CRM', key: 'CRM', ownerId: u.gabi.id, createdBy: u.gabi.id, status: 'active', priority: 'medium' })
  ;[
    [u.gabi, 'manager'],
    [u.mario, 'member'],
    [u.ana, 'member'],
    [u.lia, 'viewer'],
  ].forEach(([user, role]) => deps.projectMemberRepository.add({ projectId: project.id, userId: user.id, role }))
  const type = createTaskTypeService(deps).createType(admin, { key: 'DOC', name: 'Documentação' })
  const statuses = createLookupService(deps, 'status')
  statuses.create(admin, { key: 'TODO', name: 'A fazer', category: 'todo' })
  const dev = statuses.create(admin, { key: 'DEV', name: 'Desenvolvimento', category: 'in_progress' })
  const done = statuses.create(admin, { key: 'DONE', name: 'Concluído', category: 'done' })
  createLookupService(deps, 'priority').create(admin, { key: 'MEDIA', name: 'Média' })
  const ctx = { gabi: ctxOf(deps, u.gabi), mario: ctxOf(deps, u.mario), ana: ctxOf(deps, u.ana), lia: ctxOf(deps, u.lia) }
  const tasks = createTaskService(deps)
  return {
    deps,
    u,
    ctx,
    project,
    type,
    statuses: { dev, done },
    tasks,
    comments: createCommentService(deps),
    notifications: createNotificationService(deps),
    newTask: (actor, extra) => tasks.createTask(actor, Object.assign({ project_id: project.id, task_type_id: type.id, title: 'Manual' }, extra)),
  }
}

const inbox = (s, ctx) => s.notifications.listNotifications(ctx, {}).items.map((n) => [n.type, n.task.code])

describe('application/notifications — eventos', () => {
  it('atribuir tarefa a outra pessoa notifica; atribuir a si mesmo não', () => {
    const s = setup()
    s.newTask(s.ctx.mario, { assignee_id: s.u.ana.id })
    s.newTask(s.ctx.mario, { assignee_id: s.u.mario.id })
    assert.deepEqual(inbox(s, s.ctx.ana), [['assigned', 'CRM-1']])
    assert.deepEqual(inbox(s, s.ctx.mario), [])
    const [n] = s.notifications.listNotifications(s.ctx.ana, {}).items
    assert.equal(n.actor.name, 'Mário')
    assert.equal(n.task.title, 'Manual')
    assert.equal(n.read, false)
  })

  it('mencionar notifica a pessoa (inclusive leitora); comentário avisa responsável e autor, nunca quem comentou', () => {
    const s = setup()
    const task = s.newTask(s.ctx.mario, { assignee_id: s.u.ana.id })
    s.comments.createComment(s.ctx.gabi, task.id, { content: `@[Lia](${s.u.lia.id}) confere?` })
    assert.deepEqual(inbox(s, s.ctx.lia), [['mention', 'CRM-1']])
    assert.deepEqual(inbox(s, s.ctx.ana).slice(0, 1), [['comment', 'CRM-1']])
    assert.deepEqual(inbox(s, s.ctx.mario), [['comment', 'CRM-1']])
    assert.deepEqual(inbox(s, s.ctx.gabi), [])
    const mention = s.notifications.listNotifications(s.ctx.lia, {}).items[0]
    assert.equal(mention.data.comment, '@Lia confere?')
  })

  it('mencionar o responsável gera só "menção" (sem duplicar com "comentário")', () => {
    const s = setup()
    const task = s.newTask(s.ctx.mario, { assignee_id: s.u.ana.id })
    s.comments.createComment(s.ctx.gabi, task.id, { content: `@[Ana](${s.u.ana.id}) veja` })
    assert.deepEqual(inbox(s, s.ctx.ana), [['mention', 'CRM-1'], ['assigned', 'CRM-1']])
  })

  it('editar comentário notifica só quem passou a ser mencionado', () => {
    const s = setup()
    const task = s.newTask(s.ctx.mario)
    const c = s.comments.createComment(s.ctx.gabi, task.id, { content: `@[Ana](${s.u.ana.id}) veja` })
    s.comments.updateComment(s.ctx.gabi, c.id, { content: `@[Ana](${s.u.ana.id}) e @[Lia](${s.u.lia.id}) vejam` })
    assert.equal(inbox(s, s.ctx.ana).filter(([type]) => type === 'mention').length, 1)
    assert.deepEqual(inbox(s, s.ctx.lia), [['mention', 'CRM-1']])
  })

  it('mudança de status avisa responsável e autor (menos quem mudou)', () => {
    const s = setup()
    const task = s.newTask(s.ctx.mario, { assignee_id: s.u.ana.id })
    s.tasks.updateTask(s.ctx.ana, task.id, { status_id: s.statuses.dev.id })
    assert.deepEqual(inbox(s, s.ctx.mario), [['status_changed', 'CRM-1']])
    assert.equal(inbox(s, s.ctx.ana).some(([type]) => type === 'status_changed'), false)
    assert.equal(s.notifications.listNotifications(s.ctx.mario, {}).items[0].data.status, 'Desenvolvimento')
  })

  it('quem perdeu acesso ao projeto não recebe', () => {
    const s = setup()
    const task = s.newTask(s.ctx.mario, { assignee_id: s.u.ana.id })
    s.deps.projectMemberRepository.remove(s.project.id, s.u.mario.id)
    s.tasks.updateTask(s.ctx.ana, task.id, { status_id: s.statuses.dev.id })
    assert.deepEqual(inbox(s, s.ctx.mario), [])
  })
})

describe('application/notifications — caixa de entrada', () => {
  it('não lidas, marcar como lida e marcar todas; cada um só vê e mexe nas suas', () => {
    const s = setup()
    s.newTask(s.ctx.mario, { assignee_id: s.u.ana.id })
    s.newTask(s.ctx.mario, { assignee_id: s.u.ana.id })
    assert.equal(s.notifications.unreadCount(s.ctx.ana).count, 2)
    const [first] = s.notifications.listNotifications(s.ctx.ana, {}).items
    assert.equal(codeOf(() => s.notifications.markRead(s.ctx.mario, first.id)), 'NOTIFICATION_NOT_FOUND')
    s.notifications.markRead(s.ctx.ana, first.id)
    assert.equal(s.notifications.unreadCount(s.ctx.ana).count, 1)
    assert.equal(s.notifications.listNotifications(s.ctx.ana, { unread: '1' }).items.length, 1)
    assert.deepEqual(s.notifications.markAllRead(s.ctx.ana), { updated: 1 })
    assert.equal(s.notifications.unreadCount(s.ctx.ana).count, 0)
  })
})

describe('application/notifications — lembretes de prazo', () => {
  it('prazo amanhã e vencido avisam o responsável uma única vez; tarefa encerrada não', () => {
    const s = setup()
    s.newTask(s.ctx.mario, { assignee_id: s.u.ana.id, title: 'Amanhã', due_date: '2026-09-30' })
    s.newTask(s.ctx.mario, { assignee_id: s.u.ana.id, title: 'Atrasada', due_date: '2026-09-27' })
    const closed = s.newTask(s.ctx.mario, { assignee_id: s.u.ana.id, title: 'Feita', due_date: '2026-09-27' })
    s.tasks.updateTask(s.ctx.mario, closed.id, { status_id: s.statuses.done.id })
    s.newTask(s.ctx.mario, { title: 'Sem responsável', due_date: '2026-09-30' })

    const now = new Date('2026-09-29T08:00:00Z')
    assert.deepEqual(s.notifications.sendDueReminders(now), { created: 2 })
    assert.deepEqual(s.notifications.sendDueReminders(now), { created: 0 })
    const items = s.notifications.listNotifications(s.ctx.ana, {}).items.filter((n) => n.type === 'due_soon' || n.type === 'overdue')
    assert.deepEqual(items.map((n) => [n.type, n.task.title]).sort(), [['due_soon', 'Amanhã'], ['overdue', 'Atrasada']])
    assert.equal(items[0].actor, null)
  })
})
