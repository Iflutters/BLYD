const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createTaskService } = require('../../pb_hooks/src/application/tasks')
const { createTagService } = require('../../pb_hooks/src/application/tags')
const { createCommentService } = require('../../pb_hooks/src/application/comments')
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
  deps.projectMemberRepository.add({ projectId: project.id, userId: gabi.id, role: 'manager' })
  deps.projectMemberRepository.add({ projectId: project.id, userId: mario.id, role: 'member' })
  deps.projectMemberRepository.add({ projectId: project.id, userId: lia.id, role: 'viewer' })
  const type = createTaskTypeService(deps).createType(admin, { key: 'DOC', name: 'Documentação' })
  createLookupService(deps, 'status').create(admin, { key: 'TODO', name: 'A fazer', category: 'todo' })
  createLookupService(deps, 'priority').create(admin, { key: 'MEDIA', name: 'Média' })
  const tasks = createTaskService(deps)
  const ctx = { admin, gabi: ctxOf(deps, gabi), mario: ctxOf(deps, mario), lia: ctxOf(deps, lia) }
  const task = tasks.createTask(ctx.mario, { project_id: project.id, task_type_id: type.id, title: 'Manual' })
  return { deps, tasks, tags: createTagService(deps), comments: createCommentService(deps), ctx, task, project, type }
}

describe('application/tags', () => {
  it('cadastro global com nome único (sem diferenciar maiúsculas/acentos) e só com settings.manage', () => {
    const { tags, ctx, deps } = setup()
    const urgent = tags.createTag(ctx.admin, { name: 'Urgência', color: 'red' })
    assert.deepEqual([urgent.name, urgent.color], ['Urgência', 'red'])
    assert.equal(codeOf(() => tags.createTag(ctx.admin, { name: 'URGENCIA' })), 'TAG_NAME_IN_USE')
    assert.equal(codeOf(() => tags.createTag(ctx.mario, { name: 'Outra' })), 'FORBIDDEN')
    assert.deepEqual(tags.listTags(ctx.mario).map((t) => t.name), ['Urgência'])
    assert.equal(deps.store.audit.at(-1).action, 'tag.created')
  })

  it('renomear mantém unicidade; excluir remove das tarefas', () => {
    const { tags, tasks, ctx, task } = setup()
    const a = tags.createTag(ctx.admin, { name: 'Front-end', color: 'blue' })
    const b = tags.createTag(ctx.admin, { name: 'Back-end', color: 'green' })
    assert.equal(codeOf(() => tags.updateTag(ctx.admin, b.id, { name: 'front-end' })), 'TAG_NAME_IN_USE')
    tasks.updateTask(ctx.mario, task.id, { tag_ids: [a.id, b.id] })
    assert.equal(tags.listTags(ctx.admin).find((t) => t.id === a.id).task_count, 1)
    tags.deleteTag(ctx.admin, a.id)
    assert.deepEqual(tasks.getTask(ctx.mario, task.id).tags.map((t) => t.name), ['Back-end'])
  })
})

describe('application/tasks — tags e checklist', () => {
  it('aplica tags, filtra por tag e registra no histórico pelos nomes', () => {
    const { tags, tasks, ctx, task, deps } = setup()
    const a = tags.createTag(ctx.admin, { name: 'Cliente', color: 'violet' })
    const updated = tasks.updateTask(ctx.mario, task.id, { tag_ids: [a.id] })
    assert.deepEqual(updated.tags, [{ id: a.id, name: 'Cliente', color: 'violet' }])
    assert.deepEqual(tasks.listTasks(ctx.mario, { tag_id: a.id }).items.map((t) => t.code), ['CRM-1'])
    assert.deepEqual(deps.store.audit.at(-1).newValue, { tags: 'Cliente' })
    assert.equal(codeOf(() => tasks.updateTask(ctx.mario, task.id, { tag_ids: ['nao_existe'] })), 'VALIDATION_ERROR:{"tag_ids":"invalid_option"}')
  })

  it('checklist: salva itens, mostra progresso e histórico legível', () => {
    const { tasks, ctx, task, deps } = setup()
    const updated = tasks.updateTask(ctx.mario, task.id, { checklist: [{ text: 'Escrever' }, { text: 'Revisar', done: true }] })
    assert.deepEqual(updated.checklist.map((i) => [i.text, i.done]), [['Escrever', false], ['Revisar', true]])
    assert.ok(updated.checklist.every((i) => i.id))
    assert.deepEqual(updated.checklist_progress, { done: 1, total: 2 })
    assert.deepEqual(deps.store.audit.at(-1).newValue, { checklist: ['○ Escrever', '✓ Revisar'] })
    assert.equal(codeOf(() => tasks.updateTask(ctx.mario, task.id, { checklist: [{ text: '' }] })), 'VALIDATION_ERROR:{"checklist":"item_text_required"}')
    // leitora comenta, mas não edita a tarefa (checklist faz parte da tarefa)
    assert.equal(codeOf(() => tasks.updateTask(ctx.lia, task.id, { checklist: [] })), 'FORBIDDEN')
  })
})

describe('application/comments', () => {
  it('qualquer pessoa com acesso ao projeto comenta, inclusive leitora; histórico registra o comentário', () => {
    const { comments, ctx, task, deps } = setup()
    const c = comments.createComment(ctx.mario, task.id, { content: '  Precisa de **revisão**  ' })
    assert.equal(c.content, 'Precisa de **revisão**')
    assert.equal(c.author.name, 'Mário')
    assert.deepEqual(c.capabilities, { edit: true, delete: true })
    const byViewer = comments.createComment(ctx.lia, task.id, { content: 'Posso ajudar a testar' })
    assert.equal(byViewer.author.name, 'Lia')
    assert.equal(codeOf(() => comments.createComment(ctx.mario, task.id, { content: ' ' })), 'VALIDATION_ERROR:{"content":"required"}')
    const audit = deps.store.audit.at(-1)
    assert.equal(audit.action, 'comment.added')
    assert.equal(audit.entityType, 'task')
    assert.equal(audit.entityId, task.id)
    assert.deepEqual(audit.newValue, { comment: 'Posso ajudar a testar' })
    // cada um só edita o que escreveu
    assert.deepEqual(comments.listComments(ctx.lia, task.id).map((x) => x.capabilities.edit), [false, true])
  })

  it('menções com @: só pessoas com acesso ao projeto; nomes no comentário e no histórico', () => {
    const { comments, ctx, task, deps } = setup()
    const gabi = deps.store.users.find((u) => u.name === 'Gabi')
    const lia = deps.store.users.find((u) => u.name === 'Lia')
    const c = comments.createComment(ctx.mario, task.id, { content: `@[Gabi](${gabi.id}) e @[Lia](${lia.id}), podem revisar?` })
    assert.deepEqual(c.mentions.map((m) => m.name), ['Gabi', 'Lia'])
    const audit = deps.store.audit.at(-1)
    assert.deepEqual(audit.newValue, { comment: '@Gabi e @Lia, podem revisar?', mentions: 'Gabi, Lia' })

    const outsider = seedUser(deps, { roleCode: 'MEMBER', name: 'Otto' })
    assert.equal(
      codeOf(() => comments.createComment(ctx.mario, task.id, { content: `oi @[Otto](${outsider.id})` })),
      'VALIDATION_ERROR:{"content":"invalid_mention"}',
    )
    // editar e acrescentar uma menção registra quem foi marcado
    comments.updateComment(ctx.mario, c.id, { content: `@[Gabi](${gabi.id}) pode revisar?` })
    assert.deepEqual(deps.store.audit.at(-1).newValue, { comment: '@Gabi pode revisar?', mentions: 'Gabi' })
  })

  it('lista de quem pode ser mencionado: pessoas ativas com acesso ao projeto', () => {
    const { comments, ctx, task } = setup()
    assert.deepEqual(comments.mentionCandidates(ctx.lia, task.id).map((u) => u.name).sort(), ['Gabi', 'Lia', 'Mário'])
  })

  it('só o autor edita; autor ou gestor exclui (exclusão lógica)', () => {
    const { comments, ctx, task } = setup()
    const c = comments.createComment(ctx.mario, task.id, { content: 'Primeira versão' })
    assert.equal(codeOf(() => comments.updateComment(ctx.gabi, c.id, { content: 'x' })), 'FORBIDDEN')
    const edited = comments.updateComment(ctx.mario, c.id, { content: 'Versão final' })
    assert.equal(edited.content, 'Versão final')
    assert.ok(edited.edited_at)
    assert.deepEqual(comments.deleteComment(ctx.gabi, c.id), { deleted: true })
    const [shown] = comments.listComments(ctx.mario, task.id)
    assert.deepEqual([shown.deleted, shown.content, shown.capabilities.edit], [true, '', false])
    assert.equal(codeOf(() => comments.updateComment(ctx.mario, c.id, { content: 'volta' })), 'COMMENT_NOT_FOUND')
  })

  it('conta comentários na tarefa e esconde de quem não vê o projeto', () => {
    const { comments, tasks, ctx, task, deps } = setup()
    comments.createComment(ctx.mario, task.id, { content: 'a' })
    const deleted = comments.createComment(ctx.mario, task.id, { content: 'b' })
    comments.deleteComment(ctx.mario, deleted.id)
    assert.equal(tasks.listTasks(ctx.mario, {}).items[0].comment_count, 1)
    const outsider = ctxOf(deps, seedUser(deps, { roleCode: 'MEMBER', name: 'Otto' }))
    assert.equal(codeOf(() => comments.listComments(outsider, task.id)), 'TASK_NOT_FOUND')
  })
})
