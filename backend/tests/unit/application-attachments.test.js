const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createTaskService } = require('../../pb_hooks/src/application/tasks')
const { createAttachmentService } = require('../../pb_hooks/src/application/attachments')
const { createCustomFieldService } = require('../../pb_hooks/src/application/custom-fields')
const { createTaskTypeService } = require('../../pb_hooks/src/application/task-types')
const { createLookupService } = require('../../pb_hooks/src/application/lookups')
const { createPrincipal } = require('../../pb_hooks/src/domain/rbac')

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]
const PDF = Array.from(Buffer.from('%PDF-1.7\n'))

function upload(name, head, size) {
  return { name, head, size: size === undefined ? 1000 : size, handle: { fake: name } }
}

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
  const ana = seedUser(deps, { roleCode: 'MEMBER', name: 'Ana' })
  const lia = seedUser(deps, { roleCode: 'MEMBER', name: 'Lia' })
  const outsider = seedUser(deps, { roleCode: 'MEMBER', name: 'Otto' })
  const admin = ctxOf(deps, adminUser)
  const project = deps.projectRepository.create({ name: 'CRM', key: 'CRM', ownerId: gabi.id, createdBy: gabi.id, status: 'active', priority: 'medium' })
  ;[
    [gabi, 'manager'],
    [mario, 'member'],
    [ana, 'member'],
    [lia, 'viewer'],
  ].forEach(([u, role]) => deps.projectMemberRepository.add({ projectId: project.id, userId: u.id, role }))
  const fields = createCustomFieldService(deps)
  const evidencias = fields.createField(admin, { label: 'Evidências', type: 'image' })
  const contrato = fields.createField(admin, { label: 'Contrato', type: 'file' })
  const types = createTaskTypeService(deps)
  const bug = types.createType(admin, { key: 'BUG', name: 'Bug' })
  types.setTypeFields(admin, bug.id, [{ field_id: evidencias.id }, { field_id: contrato.id }])
  createLookupService(deps, 'status').create(admin, { key: 'TODO', name: 'A fazer', category: 'todo' })
  createLookupService(deps, 'priority').create(admin, { key: 'MEDIA', name: 'Média' })
  const tasks = createTaskService(deps)
  const ctx = { admin, gabi: ctxOf(deps, gabi), mario: ctxOf(deps, mario), ana: ctxOf(deps, ana), lia: ctxOf(deps, lia), outsider: ctxOf(deps, outsider) }
  const task = tasks.createTask(ctx.mario, { project_id: project.id, task_type_id: bug.id, title: 'Erro' })
  return { deps, tasks, attachments: createAttachmentService(deps), ctx, task }
}

describe('application/attachments', () => {
  it('colaborador anexa imagem e PDF; o tipo vem do conteúdo; histórico registra', () => {
    const { attachments, ctx, task, deps } = setup()
    const created = attachments.uploadAttachments(ctx.mario, task.id, [upload('Print da tela.png', PNG, 2048), upload('contrato.pdf', PDF)])
    assert.deepEqual(created.map((a) => [a.name, a.mime, a.kind, a.size]), [
      ['Print da tela.png', 'image/png', 'image', 2048],
      ['contrato.pdf', 'application/pdf', 'document', 1000],
    ])
    assert.equal(created[0].uploaded_by.name, 'Mário')
    assert.match(created[0].url, /^\/api\/v1\/attachments\/.+\/file$/)
    assert.deepEqual(created[0].capabilities, { delete: true })
    const audit = deps.store.audit.at(-1)
    assert.equal(audit.action, 'attachment.added')
    assert.deepEqual(audit.newValue, { attachments: 'Print da tela.png, contrato.pdf' })
    assert.equal(tasks(deps).listTasks(ctx.mario, {}).items[0].attachment_count, 2)
  })

  it('recusa arquivo com conteúdo diferente da extensão, tipo não permitido, vazio ou grande demais', () => {
    const { attachments, ctx, task, deps } = setup()
    assert.equal(codeOf(() => attachments.uploadAttachments(ctx.mario, task.id, [upload('foto.png', PDF)])), 'VALIDATION_ERROR:{"files":"type_mismatch"}')
    assert.equal(codeOf(() => attachments.uploadAttachments(ctx.mario, task.id, [upload('script.html', [60, 104])])), 'VALIDATION_ERROR:{"files":"unsupported_type"}')
    assert.equal(codeOf(() => attachments.uploadAttachments(ctx.mario, task.id, [upload('a.png', PNG, 0)])), 'VALIDATION_ERROR:{"files":"empty_file"}')
    assert.equal(codeOf(() => attachments.uploadAttachments(ctx.mario, task.id, [upload('a.png', PNG, 21 * 1024 * 1024)])), 'VALIDATION_ERROR:{"files":"file_too_large"}')
    assert.equal(codeOf(() => attachments.uploadAttachments(ctx.mario, task.id, [])), 'VALIDATION_ERROR:{"files":"required"}')
    // nada é gravado se um dos arquivos for inválido
    assert.equal(codeOf(() => attachments.uploadAttachments(ctx.mario, task.id, [upload('ok.png', PNG), upload('ruim.png', PDF)])), 'VALIDATION_ERROR:{"files":"type_mismatch"}')
    assert.equal(deps.store.attachments.length, 0)
  })

  it('leitor vê e baixa, mas não anexa; quem não é do projeto não vê', () => {
    const { attachments, ctx, task } = setup()
    const [a] = attachments.uploadAttachments(ctx.mario, task.id, [upload('a.png', PNG)])
    assert.equal(codeOf(() => attachments.uploadAttachments(ctx.lia, task.id, [upload('b.png', PNG)])), 'FORBIDDEN')
    assert.deepEqual(attachments.listAttachments(ctx.lia, task.id).map((x) => [x.name, x.capabilities.delete]), [['a.png', false]])
    assert.equal(attachments.fileFor(ctx.lia, a.id).name, 'a.png')
    assert.equal(codeOf(() => attachments.fileFor(ctx.outsider, a.id)), 'ATTACHMENT_NOT_FOUND')
    assert.equal(codeOf(() => attachments.listAttachments(ctx.outsider, task.id)), 'TASK_NOT_FOUND')
  })

  it('exclui: quem enviou ou o gestor; outra colaboradora não', () => {
    const { attachments, ctx, task, deps } = setup()
    const [a] = attachments.uploadAttachments(ctx.mario, task.id, [upload('a.png', PNG)])
    assert.equal(codeOf(() => attachments.deleteAttachment(ctx.ana, a.id)), 'FORBIDDEN')
    assert.deepEqual(attachments.deleteAttachment(ctx.gabi, a.id), { deleted: true })
    assert.equal(deps.store.attachments.length, 0)
    assert.deepEqual(deps.store.audit.at(-1).oldValue, { attachments: 'a.png' })
  })

  it('campos de imagem/arquivo: anexo vai para o campo; imagem só aceita imagem; excluir tira do campo', () => {
    const { attachments, tasks: taskService, ctx, task } = setup()
    const [img] = attachments.uploadAttachments(ctx.mario, task.id, [upload('erro.png', PNG)], 'evidencias')
    assert.deepEqual(taskService.getTask(ctx.mario, task.id).custom_values, { evidencias: [img.id] })
    assert.equal(
      codeOf(() => attachments.uploadAttachments(ctx.mario, task.id, [upload('doc.pdf', PDF)], 'evidencias')),
      'VALIDATION_ERROR:{"files":"image_required"}',
    )
    assert.equal(codeOf(() => attachments.uploadAttachments(ctx.mario, task.id, [upload('a.png', PNG)], 'nao_existe')), 'VALIDATION_ERROR:{"field":"unknown_field"}')
    const [pdf] = attachments.uploadAttachments(ctx.mario, task.id, [upload('contrato.pdf', PDF)], 'contrato')
    assert.deepEqual(taskService.getTask(ctx.mario, task.id).custom_values.contrato, [pdf.id])

    attachments.deleteAttachment(ctx.mario, img.id)
    assert.equal(taskService.getTask(ctx.mario, task.id).custom_values.evidencias, undefined)
  })

  it('ao editar a tarefa, campo de imagem só aceita anexos de imagem da própria tarefa', () => {
    const { attachments, tasks: taskService, ctx, task } = setup()
    const [pdf] = attachments.uploadAttachments(ctx.mario, task.id, [upload('contrato.pdf', PDF)])
    const [img] = attachments.uploadAttachments(ctx.mario, task.id, [upload('erro.png', PNG)])
    assert.equal(
      codeOf(() => taskService.updateTask(ctx.mario, task.id, { custom_values: { evidencias: [pdf.id] } })),
      'VALIDATION_ERROR:{"custom_values.evidencias":"invalid_option"}',
    )
    assert.equal(
      codeOf(() => taskService.updateTask(ctx.mario, task.id, { custom_values: { evidencias: ['outro_id'] } })),
      'VALIDATION_ERROR:{"custom_values.evidencias":"invalid_option"}',
    )
    const updated = taskService.updateTask(ctx.mario, task.id, { custom_values: { evidencias: [img.id], contrato: [pdf.id] } })
    assert.deepEqual(updated.custom_values, { evidencias: [img.id], contrato: [pdf.id] })
  })

  it('histórico dos campos de imagem/arquivo usa o nome do arquivo', () => {
    const { attachments, tasks: taskService, ctx, task, deps } = setup()
    const [img] = attachments.uploadAttachments(ctx.mario, task.id, [upload('erro.png', PNG)])
    taskService.updateTask(ctx.mario, task.id, { custom_values: { evidencias: [img.id] } })
    assert.deepEqual(deps.store.audit.at(-1).newValue, { 'cf:Evidências': 'erro.png' })
  })
})

describe('application/attachments — anexos em comentários', () => {
  function withComment(s, ctx, content) {
    const { createCommentService } = require('../../pb_hooks/src/application/comments')
    const comments = createCommentService(s.deps)
    return { comments, comment: comments.createComment(ctx, s.task.id, { content: content || 'Veja o print' }) }
  }

  it('autor do comentário anexa (inclusive leitora); aparece no comentário e não na aba da tarefa', () => {
    const s = setup()
    const { comments, comment } = withComment(s, s.ctx.lia)
    const [file] = s.attachments.uploadAttachments(s.ctx.lia, s.task.id, [upload('print.png', PNG)], undefined, comment.id)
    assert.equal(file.comment_id, comment.id)
    assert.deepEqual(comments.listComments(s.ctx.mario, s.task.id)[0].attachments.map((a) => a.name), ['print.png'])
    assert.deepEqual(s.attachments.listAttachments(s.ctx.mario, s.task.id), [])
    assert.deepEqual(s.deps.store.audit.at(-1).newValue, { attachments: 'print.png', comment: 'Veja o print' })
  })

  it('só o autor anexa ao próprio comentário; comentário de outra tarefa ou excluído é recusado', () => {
    const s = setup()
    const { comments, comment } = withComment(s, s.ctx.mario)
    assert.equal(codeOf(() => s.attachments.uploadAttachments(s.ctx.ana, s.task.id, [upload('a.png', PNG)], undefined, comment.id)), 'FORBIDDEN')
    assert.equal(codeOf(() => s.attachments.uploadAttachments(s.ctx.mario, s.task.id, [upload('a.png', PNG)], undefined, 'nao_existe')), 'COMMENT_NOT_FOUND')
    comments.deleteComment(s.ctx.mario, comment.id)
    assert.equal(codeOf(() => s.attachments.uploadAttachments(s.ctx.mario, s.task.id, [upload('a.png', PNG)], undefined, comment.id)), 'COMMENT_NOT_FOUND')
  })

  it('excluir o comentário apaga os anexos dele; gestor pode remover anexo de comentário', () => {
    const s = setup()
    const { comments, comment } = withComment(s, s.ctx.mario)
    const [a, b] = s.attachments.uploadAttachments(s.ctx.mario, s.task.id, [upload('a.png', PNG), upload('b.pdf', PDF)], undefined, comment.id)
    assert.equal(codeOf(() => s.attachments.deleteAttachment(s.ctx.ana, a.id)), 'FORBIDDEN')
    assert.deepEqual(s.attachments.deleteAttachment(s.ctx.gabi, a.id), { deleted: true })
    comments.deleteComment(s.ctx.mario, comment.id)
    assert.equal(s.deps.store.attachments.some((x) => x.id === b.id), false)
    assert.deepEqual(comments.listComments(s.ctx.mario, s.task.id)[0].attachments, [])
  })
})

function tasks(deps) {
  return createTaskService(deps)
}
