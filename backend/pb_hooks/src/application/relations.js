/**
 * Relacionamentos, subtarefas (consulta) e fork de tarefas (diretriz §12 e §13).
 *
 * - Ver: quem vê a tarefa; relações com tarefas que a pessoa não enxerga ficam ocultas.
 * - Relacionar/desfazer: `tasks.link` + colaborador no projeto da tarefa (o outro lado precisa
 *   estar visível). Bloqueios e dependências não podem formar ciclo.
 * - Fork: `tasks.fork` + colaborador na origem e permissão de criar no projeto destino; copia o
 *   que foi escolhido (ver domain/relation.js#forkCopy) e guarda a origem.
 * - Histórico: criar/desfazer relação aparece nas duas tarefas (`rel:<tipo>`); o fork aparece na
 *   origem (`fork`) e na nova tarefa (`forked_from`).
 */

const { appError } = require('../core/errors')
const { assertValid, rules } = require('../core/validation')
const rbac = require('../domain/rbac')
const projectDomain = require('../domain/project')
const taskDomain = require('../domain/task')
const workflow = require('../domain/workflow')
const relationDomain = require('../domain/relation')
const { buildAuditEntry } = require('./audit')
const { iso, toUserSummary } = require('./presenters')
const { createTaskService } = require('./tasks')

const FILE_TYPES = ['image', 'file']

function invalid(fields) {
  return appError('VALIDATION_ERROR', undefined, { fields })
}

const label = (task) => `${task.code} · ${task.title}`
const unique = (ids) => ids.filter((id, i, all) => id && all.indexOf(id) === i)

function createRelationService(deps) {
  const tasks = deps.taskRepository
  const relations = deps.relationRepository
  const taskService = createTaskService(deps)

  function accessTo(ctx, task) {
    const project = deps.projectRepository.findById(task.projectId)
    if (!project) return { project: null, access: null }
    return { project, access: projectDomain.resolveAccess(ctx.principal, project, deps.projectMemberRepository.find(project.id, ctx.principal.userId)) }
  }

  function canDo(ctx, task, action) {
    const { project, access } = accessTo(ctx, task)
    if (!project) return false
    try {
      taskDomain.assertTaskAccess(access, project, action, task)
      return true
    } catch (_) {
      return false
    }
  }

  /** Tarefa visível ao usuário (TASK_NOT_FOUND caso contrário — anti-IDOR). */
  function load(ctx, id) {
    rbac.assertAuthenticated(ctx.principal)
    const task = id ? tasks.findById(id) : null
    if (!task) throw appError('TASK_NOT_FOUND')
    const { project, access } = accessTo(ctx, task)
    if (!project) throw appError('TASK_NOT_FOUND')
    taskDomain.assertTaskAccess(access, project, 'view', task)
    return { task, project, access }
  }

  function audit(repos, ctx, taskId, action, oldValue, newValue) {
    repos.auditRepository.record(buildAuditEntry(ctx, { entityType: 'task', entityId: taskId, action, oldValue, newValue }))
  }

  /** Resumos das tarefas visíveis ao usuário, por id. */
  function visibleSummaries(ctx, list) {
    const visible = list.filter((t) => canDo(ctx, t, 'view'))
    const map = {}
    taskService.summarize(visible).forEach((summary) => {
      map[summary.id] = summary
    })
    return map
  }

  function presentRelation(ctx, rel, taskId, other, canLink) {
    const creator = rel.createdBy ? deps.userRepository.findById(rel.createdBy) : null
    return {
      id: rel.id,
      type: relationDomain.viewType(rel, taskId),
      task: other,
      created_by: creator ? toUserSummary(creator) : null,
      created_at: iso(rel.createdAt),
      capabilities: { delete: canLink },
    }
  }

  // ---------------------------------------------------------------- consulta

  function listRelations(ctx, id) {
    const { task } = load(ctx, id)
    const rels = relations.listByTask(task.id)
    const children = tasks.listChildren(task.id)
    const forks = tasks.listForks(task.id)
    const otherIds = rels.map((r) => (r.sourceId === task.id ? r.targetId : r.sourceId))
    const extra = unique([task.parentTaskId, task.forkedFromTaskId])
    const loaded = tasks.findManyByIds(unique(otherIds.concat(extra)))
    const summaries = visibleSummaries(ctx, loaded.concat(children, forks))
    const canLink = canDo(ctx, task, 'link')
    const order = relationDomain.VIEW_TYPES

    const closed = deps.statusRepository
      .list({ includeInactive: true })
      .filter((s) => workflow.isClosedCategory(s.category))
      .map((s) => s.id)
    const visibleChildren = children.filter((c) => summaries[c.id])

    return {
      parent: task.parentTaskId ? summaries[task.parentTaskId] || null : null,
      children: visibleChildren.map((c) => summaries[c.id]),
      subtask_progress: { done: visibleChildren.filter((c) => closed.indexOf(c.statusId) >= 0).length, total: visibleChildren.length },
      forked_from: task.forkedFromTaskId ? summaries[task.forkedFromTaskId] || null : null,
      forks: forks.filter((f) => summaries[f.id]).map((f) => summaries[f.id]),
      relations: rels
        .map((rel) => {
          const other = summaries[rel.sourceId === task.id ? rel.targetId : rel.sourceId]
          return other ? presentRelation(ctx, rel, task.id, other, canLink) : null
        })
        .filter(Boolean)
        .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.task.number - b.task.number),
      capabilities: {
        link: canLink,
        fork: canDo(ctx, task, 'fork'),
        create_subtask: canDo(ctx, task, 'create'),
        edit: canDo(ctx, task, 'edit'),
      },
    }
  }

  // ---------------------------------------------------------------- relações

  /** Cria a relação `type` (do ponto de vista da tarefa `id`) com `target_id`. */
  function createRelation(ctx, id, input) {
    const { task, project, access } = load(ctx, id)
    taskDomain.assertTaskAccess(access, project, 'link', task)
    const raw = input || {}
    if (relationDomain.VIEW_TYPES.indexOf(raw.type) < 0) throw invalid({ type: 'invalid_option' })
    const target = typeof raw.target_id === 'string' && raw.target_id ? tasks.findById(raw.target_id) : null
    if (!target || !canDo(ctx, target, 'view')) throw invalid({ target_id: 'invalid_option' })
    const rel = relationDomain.normalize(raw.type, task.id, target.id)
    if (!rel) throw invalid({ target_id: 'invalid_option' })
    if (relationDomain.isDuplicate(relations.listBetween(task.id, target.id), rel)) throw appError('RELATION_EXISTS')
    const edge = relationDomain.precedenceOf(rel)
    if (edge) {
      const next = (ids) => relations.precedenceFrom(ids).map((r) => relationDomain.precedenceOf(r)[1])
      if (relationDomain.createsCycle(edge, next)) throw appError('RELATION_CYCLE')
    }
    const created = deps.unitOfWork.run((repos) => {
      const saved = repos.relationRepository.create({ type: rel.type, sourceId: rel.sourceId, targetId: rel.targetId, createdBy: ctx.principal.userId })
      audit(repos, ctx, task.id, 'task.linked', null, { [`rel:${raw.type}`]: label(target) })
      audit(repos, ctx, target.id, 'task.linked', null, { [`rel:${relationDomain.viewType(rel, target.id)}`]: label(task) })
      return saved
    })
    const other = taskService.summarize([target])[0]
    return presentRelation(ctx, created, task.id, other, true)
  }

  function deleteRelation(ctx, relationId) {
    rbac.assertAuthenticated(ctx.principal)
    const rel = relationId ? relations.findById(relationId) : null
    const source = rel ? tasks.findById(rel.sourceId) : null
    const target = rel ? tasks.findById(rel.targetId) : null
    if (!rel || !source || !target) throw appError('RELATION_NOT_FOUND')
    if (!canDo(ctx, source, 'view') && !canDo(ctx, target, 'view')) throw appError('RELATION_NOT_FOUND')
    if (!canDo(ctx, source, 'link') && !canDo(ctx, target, 'link')) throw appError('FORBIDDEN')
    deps.unitOfWork.run((repos) => {
      repos.relationRepository.delete(rel.id)
      audit(repos, ctx, source.id, 'task.unlinked', { [`rel:${relationDomain.viewType(rel, source.id)}`]: label(target) }, null)
      audit(repos, ctx, target.id, 'task.unlinked', { [`rel:${relationDomain.viewType(rel, target.id)}`]: label(source) }, null)
    })
    return { deleted: true }
  }

  // ---------------------------------------------------------------- fork

  function forkTask(ctx, id, input) {
    const { task, project, access } = load(ctx, id)
    taskDomain.assertTaskAccess(access, project, 'fork', task)
    const raw = input || {}
    const copy = relationDomain.forkCopy(raw.copy)
    const title = raw.title === undefined || raw.title === null ? task.title : assertValid({ title: raw.title }, { title: [rules.required(), rules.maxLength(200)] }).title
    const projectId = typeof raw.project_id === 'string' && raw.project_id ? raw.project_id : task.projectId

    // campos personalizados por nome técnico (imagem/arquivo só com os anexos copiados)
    const links = deps.taskTypeFieldRepository.listByType(task.typeId)
    const fields = {}
    deps.customFieldRepository.findManyByIds(links.map((l) => l.fieldId)).forEach((field) => {
      fields[field.id] = field
    })
    const saved = deps.taskValueRepository.listByTasks([task.id])[task.id] || {}
    const customValues = {}
    const fileValues = {}
    if (copy.custom_values) {
      Object.keys(saved).forEach((fieldId) => {
        const field = fields[fieldId]
        if (!field) return
        if (FILE_TYPES.indexOf(field.type) >= 0) fileValues[fieldId] = saved[fieldId]
        else customValues[field.name] = saved[fieldId]
      })
    }
    const tagIds = copy.tags ? deps.taskTagRepository.listByTasks([task.id])[task.id] || [] : []

    const createInput = {
      project_id: projectId,
      task_type_id: task.typeId,
      title,
      description: copy.description ? task.description || '' : '',
      priority_id: task.priorityId,
      custom_values: customValues,
      tag_ids: tagIds,
      // o trabalho do fork começa do zero: itens voltam a ficar pendentes
      checklist: copy.checklist ? (task.checklist || []).map((item) => ({ text: item.text, done: false })) : [],
    }

    const extras = (repos, created) => {
      if (copy.attachments) {
        const mapping = {}
        repos.attachmentRepository.listByTask(task.id).forEach((attachment) => {
          mapping[attachment.id] = repos.attachmentRepository.copyTo(attachment.id, { taskId: created.id, uploadedBy: ctx.principal.userId }).id
        })
        // campos de imagem/arquivo passam a apontar para as cópias
        const remapped = {}
        const types = {}
        Object.keys(fileValues).forEach((fieldId) => {
          const value = fileValues[fieldId]
          const ids = (Array.isArray(value) ? value : [value]).map((attachmentId) => mapping[attachmentId]).filter(Boolean)
          if (ids.length === 0) return
          remapped[fieldId] = Array.isArray(value) ? ids : ids[0]
          types[fieldId] = fields[fieldId].type
        })
        if (Object.keys(remapped).length > 0) {
          const current = repos.taskValueRepository.listByTasks([created.id])[created.id] || {}
          const allTypes = {}
          Object.keys(current).forEach((fieldId) => {
            if (fields[fieldId]) allTypes[fieldId] = fields[fieldId].type
          })
          repos.taskValueRepository.replace(created.id, Object.assign({}, current, remapped), Object.assign(allTypes, types))
        }
      }
      if (copy.relations) {
        repos.relationRepository.listByTask(task.id).forEach((rel) => {
          const sourceId = rel.sourceId === task.id ? created.id : rel.sourceId
          const targetId = rel.targetId === task.id ? created.id : rel.targetId
          repos.relationRepository.create({ type: rel.type, sourceId, targetId, createdBy: ctx.principal.userId })
          const otherId = rel.sourceId === task.id ? rel.targetId : rel.sourceId
          audit(repos, ctx, otherId, 'task.linked', null, { [`rel:${relationDomain.viewType({ type: rel.type, sourceId, targetId }, otherId)}`]: label(created) })
        })
      }
      audit(repos, ctx, task.id, 'task.forked', null, { fork: label(created) })
    }

    return taskService.createTask(ctx, createInput, { forkedFrom: task, extras })
  }

  return { listRelations, createRelation, deleteRelation, forkTask }
}

module.exports = { createRelationService }
