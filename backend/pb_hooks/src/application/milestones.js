/**
 * Marcos do projeto (expansão, Onda 1): entregas-chave com data e situação, na timeline.
 *
 * - Ver: quem vê o projeto. Criar/editar/excluir: gestor ou dono (mesma regra das sprints —
 *   `projects.edit` + gestor, projeto não arquivado).
 * - Anti-IDOR: marco de projeto que a pessoa não vê responde MILESTONE_NOT_FOUND.
 * - Histórico: no próprio projeto (entity_type = project), ações milestone.*.
 */

const { appError } = require('../core/errors')
const { assertValid, rules } = require('../core/validation')
const rbac = require('../domain/rbac')
const projectDomain = require('../domain/project')
const timeline = require('../domain/timeline')
const { buildAuditEntry } = require('./audit')
const { iso } = require('./presenters')

const RULES = {
  name: [rules.required(), rules.string(), rules.maxLength(timeline.MILESTONE_NAME_MAX)],
  description: [rules.string(), rules.maxLength(timeline.MILESTONE_DESCRIPTION_MAX)],
  due_date: [rules.required(), rules.isoDate()],
  state: [rules.oneOf(timeline.MILESTONE_STATES)],
}

function presentMilestone(milestone) {
  return {
    id: milestone.id,
    project_id: milestone.projectId,
    name: milestone.name,
    description: milestone.description || '',
    due_date: milestone.dueDate,
    state: milestone.state || 'pending',
    created_at: iso(milestone.createdAt),
    updated_at: iso(milestone.updatedAt),
  }
}

const dayOf = (date) => date.toISOString().slice(0, 10)

function createMilestoneService(deps) {
  const milestones = deps.milestoneRepository

  function projectAccess(ctx, projectId) {
    rbac.assertAuthenticated(ctx.principal)
    const project = projectId ? deps.projectRepository.findById(projectId) : null
    if (!project) throw appError('PROJECT_NOT_FOUND')
    const access = projectDomain.resolveAccess(ctx.principal, project, deps.projectMemberRepository.find(project.id, ctx.principal.userId))
    projectDomain.assertAccess(access, project, 'view')
    return { project, access }
  }

  function load(ctx, id) {
    rbac.assertAuthenticated(ctx.principal)
    const milestone = id ? milestones.findById(id) : null
    const project = milestone ? deps.projectRepository.findById(milestone.projectId) : null
    if (!milestone || !project) throw appError('MILESTONE_NOT_FOUND')
    const access = projectDomain.resolveAccess(ctx.principal, project, deps.projectMemberRepository.find(project.id, ctx.principal.userId))
    if (!access.canView) throw appError('MILESTONE_NOT_FOUND')
    return { milestone, project, access }
  }

  /** Valida o corpo; `partial` = só os campos enviados (edição). */
  function parse(input, partial) {
    const source = input || {}
    const schema = {}
    Object.keys(RULES).forEach((key) => {
      if (!partial || source[key] !== undefined) schema[key] = RULES[key]
    })
    const data = assertValid(source, schema)
    const out = {}
    if (data.name !== undefined) out.name = data.name
    if (data.description !== undefined) out.description = data.description
    if (data.due_date !== undefined) out.dueDate = dayOf(data.due_date)
    if (data.state !== undefined) out.state = data.state
    return out
  }

  function audit(repos, ctx, project, action, oldValue, newValue) {
    repos.auditRepository.record(buildAuditEntry(ctx, { entityType: 'project', entityId: project.id, action, oldValue, newValue }))
  }

  const snapshot = (m) => ({ name: m.name, due_date: m.dueDate, state: m.state || 'pending', description: m.description || '' })

  function listMilestones(ctx, projectId) {
    const { project } = projectAccess(ctx, projectId)
    return milestones.listByProject(project.id).map(presentMilestone)
  }

  function createMilestone(ctx, projectId, input) {
    const { project, access } = projectAccess(ctx, projectId)
    projectDomain.assertAccess(access, project, 'edit')
    const data = parse(input, false)
    const created = deps.unitOfWork.run((repos) => {
      const milestone = repos.milestoneRepository.create({
        projectId: project.id,
        name: data.name,
        description: data.description || '',
        dueDate: data.dueDate,
        state: data.state || 'pending',
        createdBy: ctx.principal.userId,
      })
      audit(repos, ctx, project, 'milestone.created', null, snapshot(milestone))
      return milestone
    })
    return presentMilestone(created)
  }

  function updateMilestone(ctx, id, input) {
    const { milestone, project, access } = load(ctx, id)
    projectDomain.assertAccess(access, project, 'edit')
    const patch = parse(input, true)
    const before = snapshot(milestone)
    const after = snapshot(Object.assign({}, milestone, patch))
    if (JSON.stringify(before) === JSON.stringify(after)) return presentMilestone(milestone)
    const saved = deps.unitOfWork.run((repos) => {
      const updated = repos.milestoneRepository.update(milestone.id, patch)
      audit(repos, ctx, project, 'milestone.updated', before, after)
      return updated
    })
    return presentMilestone(saved)
  }

  function deleteMilestone(ctx, id) {
    const { milestone, project, access } = load(ctx, id)
    projectDomain.assertAccess(access, project, 'edit')
    deps.unitOfWork.run((repos) => {
      repos.milestoneRepository.delete(milestone.id)
      audit(repos, ctx, project, 'milestone.deleted', snapshot(milestone), null)
    })
    return { deleted: true }
  }

  return { listMilestones, createMilestone, updateMilestone, deleteMilestone }
}

module.exports = { createMilestoneService, presentMilestone }
