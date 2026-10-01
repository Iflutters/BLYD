/**
 * Base compartilhada do quadro do projeto (Gerenciamento de Projetos): acesso e permissões,
 * apresentação, histórico legível e validação das referências do elemento. Usada pelos casos de
 * uso do quadro (application/plan.js) e das interações da GP-2 (application/plan-interaction.js).
 */

const { appError } = require('../core/errors')
const rbac = require('../domain/rbac')
const projectDomain = require('../domain/project')
const planDomain = require('../domain/plan')
const linkDomain = require('../domain/plan-links')
const { buildAuditEntry } = require('./audit')
const { iso, toUserSummary } = require('./presenters')

/** Acima disso a tela avisa que mostra só os primeiros. */
const MAX_ITEMS = 3000
const DEFAULT_RESOURCE_COLOR = 'indigo'

function invalid(fields) {
  return appError('VALIDATION_ERROR', undefined, { fields })
}

const idOf = (value) => (typeof value === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(value) ? value : null)

function presentStatus(s) {
  return { id: s.id, name: s.name, color: s.color, category: s.category, position: s.position }
}

function presentResource(r) {
  return { id: r.id, name: r.name, color: r.color || DEFAULT_RESOURCE_COLOR }
}

/** Dependência entre elementos: `blocks` = from bloqueia to; `relates` = relacionados. */
function presentLink(l) {
  return { id: l.id, from_id: l.fromId, to_id: l.toId, type: l.type }
}

function indexBy(list) {
  const map = {}
  list.forEach((x) => {
    map[x.id] = x
  })
  return map
}

const metric = (item, key) => (item.metrics && typeof item.metrics[key] === 'number' ? item.metrics[key] : null)

/** Totais (do grupo ou do quadro inteiro) com as datas em ISO. */
function presentSummary(summary) {
  return summary ? Object.assign({}, summary, { start_date: iso(summary.start_date), end_date: iso(summary.end_date) }) : null
}

function createPlanSupport(deps) {
  const groups = deps.projectGroupRepository
  const statuses = deps.planStatusRepository
  const resources = deps.planResourceRepository
  const items = deps.planItemRepository

  /* ------------------------------------------------------------------ acesso */

  function capabilities(access, project, principal) {
    const view = access.canView && rbac.can(principal, 'plan.view')
    const contributor = access.isManager || access.role === 'member'
    const open = !project.archivedAt
    return {
      view,
      edit: view && open && contributor && rbac.can(principal, 'plan.edit'),
      manage: view && open && access.isManager && rbac.can(principal, 'plan.manage'),
    }
  }

  function canFor(ctx, project) {
    const access = projectDomain.resolveAccess(ctx.principal, project, deps.projectMemberRepository.find(project.id, ctx.principal.userId))
    return capabilities(access, project, ctx.principal)
  }

  function loadProject(ctx, projectId) {
    rbac.assertAuthenticated(ctx.principal)
    const project = projectId ? deps.projectRepository.findById(projectId) : null
    if (!project) throw appError('PROJECT_NOT_FOUND')
    const can = canFor(ctx, project)
    if (!can.view) throw appError('PROJECT_NOT_FOUND')
    return { project, can }
  }

  /** Um registro do quadro que a pessoa vê (senão `notFound`). */
  function loadOwned(ctx, repo, id, notFound) {
    rbac.assertAuthenticated(ctx.principal)
    const record = id ? repo.findById(id) : null
    const project = record ? deps.projectRepository.findById(record.projectId) : null
    if (!record || !project) throw appError(notFound)
    const can = canFor(ctx, project)
    if (!can.view) throw appError(notFound)
    return { record, project, can }
  }

  function assertCan(can, project, action) {
    if (can[action]) return
    throw appError(project.archivedAt ? 'PROJECT_ARCHIVED' : 'FORBIDDEN')
  }

  function audit(repos, ctx, entityType, entityId, action, oldValue, newValue) {
    repos.auditRepository.record(buildAuditEntry(ctx, { entityType, entityId, action, oldValue, newValue }))
  }

  /** Quadro novo nasce com as etiquetas de status iniciais (como no Monday). */
  function ensureStatuses(project) {
    const list = statuses.listByProject(project.id)
    if (list.length > 0) return list
    return deps.unitOfWork.run((repos) => planDomain.defaultStatuses(deps.locale).map((s) => repos.planStatusRepository.create(Object.assign({ projectId: project.id }, s))))
  }

  /* ------------------------------------------------------------------ dependências (GP-2) */

  /** Configuração do quadro (sem registro = padrão): regra de dependência e linha de base (GP-4). */
  function settingsOf(project) {
    const saved = deps.planSettingsRepository.findByProject(project.id)
    return {
      dependencyRule: saved && saved.dependencyRule ? saved.dependencyRule : linkDomain.DEFAULT_DEPENDENCY_RULE,
      baseline: saved && saved.baseline ? saved.baseline : null,
    }
  }

  /** Elementos com dependência pendente (quem os bloqueia ainda não foi encerrado): { id: true }. */
  function pendingMap(list, links, categoryOf) {
    const byId = indexBy(list)
    const closed = (id) => !!byId[id] && linkDomain.isClosedCategory(categoryOf(byId[id]))
    const out = {}
    links.forEach((l) => {
      if (l.type === 'blocks' && byId[l.toId] && !closed(l.fromId)) out[l.toId] = true
    })
    return out
  }

  /**
   * Regra "impedir" do quadro: iniciar ou concluir (status novo) elemento que depende de outro ainda
   * aberto → PLAN_DEPENDENCY_PENDING com os nomes. Com a regra "só sinalizar", nada acontece.
   */
  function assertDependencies(project, list, statusId) {
    if (!statusId || list.length === 0 || settingsOf(project).dependencyRule !== 'block') return
    const links = deps.planLinkRepository.listByProject(project.id)
    const ids = list.map((i) => i.id)
    if (!links.some((l) => l.type === 'blocks' && ids.indexOf(l.toId) >= 0)) return
    const statusById = indexBy(statuses.listByProject(project.id))
    const categoryOf = (item) => (item && item.statusId && statusById[item.statusId] ? statusById[item.statusId].category : null)
    const target = statusById[statusId] ? statusById[statusId].category : null
    const blocked = list.filter((item) => {
      if (!linkDomain.gatesDependency(categoryOf(item), target)) return false
      return linkDomain.pendingBlockers(item.id, links, (id) => linkDomain.isClosedCategory(categoryOf(items.findById(id)))).length > 0
    })
    if (blocked.length) throw appError('PLAN_DEPENDENCY_PENDING', undefined, { items: blocked.map((i) => i.name) })
  }

  /* ------------------------------------------------------------------ apresentação */

  function usersOf(list) {
    const ids = list.map((i) => i.ownerId).filter((id, i, all) => id && all.indexOf(id) === i)
    return indexBy(ids.length ? deps.userRepository.findManyByIds(ids) : [])
  }

  function presentItem(item, progress, users, childCount) {
    const owner = item.ownerId && users[item.ownerId] ? toUserSummary(users[item.ownerId]) : null
    return {
      id: item.id,
      group_id: item.groupId,
      parent_id: item.parentId || null,
      name: item.name,
      status_id: item.statusId || null,
      start_date: item.startDate || null,
      end_date: item.endDate || null,
      due_date: item.dueDate || null,
      owner,
      resource_ids: item.resourceIds || [],
      estimated_hours: metric(item, 'estimated_hours'),
      actual_hours: metric(item, 'actual_hours'),
      // duração efetiva (cronograma ou informada) e a informada (editável quando não há cronograma)
      duration_days: planDomain.durationOf(item),
      duration_manual: metric(item, 'duration_days'),
      progress: progress[item.id] || { value: 0, source: 'none' },
      progress_manual: item.progressSet ? item.progress || 0 : null,
      subitems: childCount || 0,
      position: item.position,
      created_at: iso(item.createdAt),
      updated_at: iso(item.updatedAt),
    }
  }

  function presentGroup(group, numbers, summary) {
    return {
      id: group.id,
      parent_id: group.parentId || null,
      name: group.name,
      color: group.color,
      position: group.position,
      number: numbers[group.id] || null,
      summary: presentSummary(summary),
    }
  }

  /** Progresso de todos os elementos (subelementos contam para o pai). */
  function progressOf(list, statusById) {
    return planDomain.computeProgress(list, (i) => (i.statusId && statusById[i.statusId] ? statusById[i.statusId].category : null))
  }

  function loadGroup(ctx, id) {
    const found = loadOwned(ctx, groups, id, 'GROUP_NOT_FOUND')
    return { group: found.record, project: found.project, can: found.can }
  }

  function loadItem(ctx, id) {
    const found = loadOwned(ctx, items, id, 'PLAN_ITEM_NOT_FOUND')
    return { item: found.record, project: found.project, can: found.can }
  }

  /** Histórico legível do elemento (nomes no lugar de ids). */
  function snapshot(item) {
    const status = item.statusId ? statuses.findById(item.statusId) : null
    const group = item.groupId ? groups.findById(item.groupId) : null
    const parent = item.parentId ? items.findById(item.parentId) : null
    const owner = item.ownerId ? deps.userRepository.findById(item.ownerId) : null
    const resourceNames = (item.resourceIds || [])
      .map((rid) => resources.findById(rid))
      .filter(Boolean)
      .map((r) => r.name)
    return {
      name: item.name,
      plan_group: group ? group.name : null,
      parent_item: parent ? parent.name : null,
      plan_status: status ? status.name : null,
      start_date: item.startDate || null,
      end_date: item.endDate || null,
      due_date: item.dueDate || null,
      plan_owner: owner ? owner.name : null,
      resources: resourceNames.join(', ') || null,
      estimated_hours: metric(item, 'estimated_hours'),
      actual_hours: metric(item, 'actual_hours'),
      duration_days: metric(item, 'duration_days'),
      progress: item.progressSet ? `${item.progress || 0}%` : null,
    }
  }

  function changes(before, after) {
    const oldValue = {}
    const newValue = {}
    Object.keys(after).forEach((key) => {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        oldValue[key] = before[key] === undefined ? null : before[key]
        newValue[key] = after[key] === undefined ? null : after[key]
      }
    })
    return Object.keys(newValue).length ? { oldValue, newValue } : null
  }

  /** Confere as referências do corpo já validado (status, responsável, recursos do mesmo projeto). */
  function assertRefs(project, data) {
    if (data.status_id) {
      const status = statuses.findById(data.status_id)
      if (!status || status.projectId !== project.id) throw invalid({ status_id: 'invalid_option' })
    }
    if (data.owner_id) {
      const user = deps.userRepository.findById(data.owner_id)
      const member = user ? deps.projectMemberRepository.find(project.id, user.id) : null
      if (!user || user.status !== 'active' || (project.ownerId !== user.id && !member)) throw invalid({ owner_id: 'not_member' })
    }
    if (data.resource_ids && data.resource_ids.length) {
      const ok = data.resource_ids.every((rid) => {
        const r = resources.findById(rid)
        return r && r.projectId === project.id
      })
      if (!ok) throw invalid({ resource_ids: 'invalid_option' })
    }
  }

  /** Corpo validado → campos da entidade. */
  function fieldsFrom(data, current) {
    const out = {}
    if (data.name !== undefined) out.name = data.name
    if (data.status_id !== undefined) out.statusId = data.status_id
    if (data.start_date !== undefined) out.startDate = data.start_date
    if (data.end_date !== undefined) out.endDate = data.end_date
    if (data.due_date !== undefined) out.dueDate = data.due_date
    if (data.owner_id !== undefined) out.ownerId = data.owner_id
    if (data.resource_ids !== undefined) out.resourceIds = data.resource_ids
    const metrics = Object.assign({}, (current && current.metrics) || {})
    let metricsChanged = false
    ;['estimated_hours', 'actual_hours', 'duration_days'].forEach((key) => {
      if (data[key] === undefined) return
      metrics[key] = data[key]
      metricsChanged = true
    })
    if (metricsChanged) out.metrics = metrics
    if (data.progress !== undefined) {
      out.progress = data.progress === null ? 0 : data.progress
      out.progressSet = data.progress !== null
    }
    return out
  }

  return {
    capabilities,
    canFor,
    loadProject,
    loadOwned,
    assertCan,
    audit,
    ensureStatuses,
    settingsOf,
    pendingMap,
    assertDependencies,
    usersOf,
    presentItem,
    presentGroup,
    progressOf,
    loadGroup,
    loadItem,
    snapshot,
    changes,
    assertRefs,
    fieldsFrom,
  }
}

module.exports = { createPlanSupport, invalid, idOf, presentStatus, presentResource, presentLink, presentSummary, indexBy, metric, MAX_ITEMS, DEFAULT_RESOURCE_COLOR }
