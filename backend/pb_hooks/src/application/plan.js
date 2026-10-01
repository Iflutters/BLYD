/**
 * Quadro do projeto — Gerenciamento de Projetos (docs/diretriz_feature_gerenciamento_projetos.md).
 *
 * Módulo à parte das tarefas: grupos (fases), elementos e subelementos com etiquetas próprias de
 * status e de recursos. Uma chamada (`getPlan`) traz o quadro inteiro com os cálculos prontos.
 * - Ver: acesso ao projeto + `plan.view`.
 * - Elementos/subelementos e etiquetas de recurso (criar, editar): `plan.edit` + colaborar no
 *   projeto (dono, gestor ou membro).
 * - Grupos, etiquetas de status e excluir etiquetas de recurso: `plan.manage` + gestor/dono.
 * - Projeto arquivado: só leitura. Registro de projeto invisível responde 404 (anti-IDOR).
 * - Histórico: elementos em `plan_item.*`; grupos e etiquetas no projeto.
 * - Regras de cálculo em domain/plan.js.
 */

const { appError } = require('../core/errors')
const planDomain = require('../domain/plan')
const { iso } = require('./presenters')
const { createPlanSupport, invalid, idOf, presentStatus, presentResource, presentLink, presentSummary, indexBy, MAX_ITEMS, DEFAULT_RESOURCE_COLOR } = require('./plan-support')

function createPlanService(deps) {
  const groups = deps.projectGroupRepository
  const statuses = deps.planStatusRepository
  const resources = deps.planResourceRepository
  const items = deps.planItemRepository

  const support = createPlanSupport(deps)
  const { loadProject, loadOwned, assertCan, audit, ensureStatuses, settingsOf, pendingMap, assertDependencies, usersOf, presentItem, presentGroup, progressOf, loadGroup, loadItem, snapshot, changes, assertRefs, fieldsFrom } = support

  /* ------------------------------------------------------------------ leitura */

  function getPlan(ctx, projectId) {
    const { project, can } = loadProject(ctx, projectId)
    const statusList = ensureStatuses(project)
    const statusById = indexBy(statusList)
    const loaded = items.listByProject(project.id, MAX_ITEMS + 1)
    const list = loaded.slice(0, MAX_ITEMS)
    const groupList = groups.listByProject(project.id)
    const numbers = planDomain.numberGroups(groupList)
    const progress = progressOf(list, statusById)
    const users = usersOf(list)
    const childCount = {}
    list.forEach((i) => {
      if (i.parentId) childCount[i.parentId] = (childCount[i.parentId] || 0) + 1
    })
    const categoryOf = (i) => (i.statusId && statusById[i.statusId] ? statusById[i.statusId].category : null)
    const links = deps.planLinkRepository.listByProject(project.id)
    const pending = pendingMap(list, links, categoryOf)
    // contadores da linha (GP-3): atualizações e arquivos do painel do elemento
    const updateCounts = deps.planUpdateRepository.countByProject(project.id)
    const fileCounts = deps.planFileRepository.countByProject(project.id)
    // linha de base do Cronograma (GP-4): datas salvas pelo gestor para comparar com as atuais
    const settings = settingsOf(project)
    const baseline = settings.baseline ? settings.baseline.items || {} : {}
    const baseOf = (id) => baseline[id] || { start: null, end: null }
    const statusOf = (i) => i.statusId || null
    return {
      project: { id: project.id, key: project.key, name: project.name, archived: !!project.archivedAt },
      capabilities: { edit: can.edit, manage: can.manage },
      statuses: statusList.map(presentStatus),
      resources: resources.listByProject(project.id).map(presentResource),
      groups: planDomain.orderGroups(groupList).map((g) =>
        presentGroup(
          g,
          numbers,
          planDomain.groupSummary(
            list.filter((i) => i.groupId === g.id),
            progress,
            statusOf,
            categoryOf,
          ),
        ),
      ),
      // resumo de todo o quadro (Bateria e Esforço do Cronograma)
      summary: presentSummary(planDomain.groupSummary(list, progress, statusOf, categoryOf)),
      settings: { dependency_rule: settings.dependencyRule, baseline_at: settings.baseline ? iso(settings.baseline.savedAt) : null },
      links: links.map(presentLink),
      // bloqueado = depende de elemento ainda aberto (a regra do quadro decide se só sinaliza ou impede)
      items: list.map((i) =>
        Object.assign(presentItem(i, progress, users, childCount[i.id]), {
          blocked: !!pending[i.id],
          updates: updateCounts[i.id] || 0,
          files: fileCounts[i.id] || 0,
          baseline_start: baseOf(i.id).start,
          baseline_end: baseOf(i.id).end,
        }),
      ),
      truncated: loaded.length > MAX_ITEMS,
    }
  }

  /* ------------------------------------------------------------------ grupos */

  function readGroupInput(raw, partial) {
    const input = raw || {}
    const issues = planDomain.groupIssues(input, partial)
    if (Object.keys(issues).length > 0) throw invalid(issues)
    const out = {}
    if (input.name !== undefined) out.name = String(input.name).trim()
    if (input.color !== undefined) out.color = input.color
    return out
  }

  function listGroups(ctx, projectId) {
    const { project } = loadProject(ctx, projectId)
    const list = groups.listByProject(project.id)
    const numbers = planDomain.numberGroups(list)
    return planDomain.orderGroups(list).map((g) => presentGroup(g, numbers, null))
  }

  function createGroup(ctx, projectId, raw) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'manage')
    const input = raw || {}
    const data = readGroupInput(Object.assign({ color: 'blue' }, input), false)
    const parentId = input.parent_id === undefined || input.parent_id === null ? null : idOf(input.parent_id)
    if (input.parent_id && !parentId) throw invalid({ parent_id: 'invalid_type' })
    const issue = planDomain.groupParentIssue(groups.listByProject(project.id), parentId, null)
    if (issue) throw invalid({ parent_id: issue })
    const created = deps.unitOfWork.run((repos) => {
      const group = repos.projectGroupRepository.create({
        projectId: project.id,
        parentId,
        name: data.name,
        color: data.color,
        position: (repos.projectGroupRepository.maxPosition(project.id, parentId) || 0) + planDomain.POSITION_STEP,
        createdBy: ctx.principal.userId,
      })
      audit(repos, ctx, 'project', project.id, 'project_group.created', null, { name: group.name, color: group.color })
      return group
    })
    return presentGroup(created, planDomain.numberGroups(groups.listByProject(project.id)), null)
  }

  function updateGroup(ctx, id, raw) {
    const { group, project, can } = loadGroup(ctx, id)
    assertCan(can, project, 'manage')
    const data = readGroupInput(raw, true)
    const patch = {}
    if (data.name !== undefined && data.name !== group.name) patch.name = data.name
    if (data.color !== undefined && data.color !== group.color) patch.color = data.color
    if (Object.keys(patch).length > 0) {
      deps.unitOfWork.run((repos) => {
        repos.projectGroupRepository.update(group.id, patch)
        const before = {}
        Object.keys(patch).forEach((key) => {
          before[key] = group[key]
        })
        audit(repos, ctx, 'project', project.id, 'project_group.updated', Object.assign({ group: group.name }, before), Object.assign({ group: patch.name || group.name }, patch))
      })
    }
    return presentGroup(groups.findById(group.id), planDomain.numberGroups(groups.listByProject(project.id)), null)
  }

  /** Reordena (e muda de nível): `{ parent_id, prev_id | next_id }`; sem vizinho = fim. */
  function moveGroup(ctx, id, raw) {
    const { group, project, can } = loadGroup(ctx, id)
    assertCan(can, project, 'manage')
    const input = raw || {}
    const parentId = input.parent_id === undefined ? group.parentId || null : input.parent_id === null ? null : idOf(input.parent_id)
    if (input.parent_id && !parentId) throw invalid({ parent_id: 'invalid_type' })
    const list = groups.listByProject(project.id)
    const issue = planDomain.groupParentIssue(list, parentId, group.id)
    if (issue) throw invalid({ parent_id: issue })
    const siblings = () => groups.listByProject(project.id).filter((g) => (g.parentId || null) === parentId && g.id !== group.id)
    const target = { prevId: typeof input.prev_id === 'string' ? input.prev_id : undefined, nextId: typeof input.next_id === 'string' ? input.next_id : undefined }
    let position = planDomain.placeAmong(siblings(), target)
    if (position === null) {
      deps.unitOfWork.run((repos) => repos.projectGroupRepository.renumber(project.id, parentId))
      position = planDomain.placeAmong(siblings(), target)
    }
    deps.unitOfWork.run((repos) => {
      repos.projectGroupRepository.update(group.id, { parentId, position })
      if ((group.parentId || null) !== parentId) {
        const nameOf = (gid) => {
          const found = gid ? list.find((g) => g.id === gid) : null
          return found ? found.name : null
        }
        audit(repos, ctx, 'project', project.id, 'project_group.moved', { group: group.name, parent_group: nameOf(group.parentId) }, { group: group.name, parent_group: nameOf(parentId) })
      }
    })
    return presentGroup(groups.findById(group.id), planDomain.numberGroups(groups.listByProject(project.id)), null)
  }

  /** Exclui o grupo, os subgrupos e os elementos deles. */
  function deleteGroup(ctx, id) {
    const { group, project, can } = loadGroup(ctx, id)
    assertCan(can, project, 'manage')
    const removed = [group].concat(groups.listByProject(project.id).filter((g) => g.parentId === group.id))
    const affected = items.listByGroups(removed.map((g) => g.id))
    deps.unitOfWork.run((repos) => {
      repos.planLinkRepository.deleteByItems(affected.map((i) => i.id))
      // subelementos antes dos elementos
      affected
        .slice()
        .sort((a, b) => Number(!a.parentId) - Number(!b.parentId))
        .forEach((item) => repos.planItemRepository.delete(item.id))
      removed
        .slice()
        .reverse()
        .forEach((g) => repos.projectGroupRepository.delete(g.id))
      audit(repos, ctx, 'project', project.id, 'project_group.deleted', { group: group.name, subgroups: removed.length - 1, items: affected.length }, null)
    })
    return { deleted: removed.length, items: affected.length }
  }

  /** Duplica logo depois do original, com subgrupos, elementos e subelementos (mesmos valores). */
  function duplicateGroup(ctx, id) {
    const { group, project, can } = loadGroup(ctx, id)
    assertCan(can, project, 'manage')
    const list = groups.listByProject(project.id)
    const children = list.filter((g) => g.parentId === group.id).sort((a, b) => a.position - b.position)
    const source = items.listByGroups([group.id].concat(children.map((g) => g.id)))
    const siblingsOf = () => groups.listByProject(project.id).filter((g) => (g.parentId || null) === (group.parentId || null))
    let position = planDomain.placeAmong(siblingsOf(), { prevId: group.id })
    if (position === null) {
      deps.unitOfWork.run((repos) => repos.projectGroupRepository.renumber(project.id, group.parentId || null))
      position = planDomain.placeAmong(siblingsOf(), { prevId: group.id })
    }
    const suffix = deps.locale === 'en' ? 'copy' : deps.locale === 'es' ? 'copia' : 'cópia'
    const copy = deps.unitOfWork.run((repos) => {
      const created = repos.projectGroupRepository.create({
        projectId: project.id,
        parentId: group.parentId || null,
        name: `${group.name} (${suffix})`.slice(0, planDomain.GROUP_NAME_MAX),
        color: group.color,
        position,
        createdBy: ctx.principal.userId,
      })
      const groupMap = { [group.id]: created.id }
      children.forEach((child) => {
        groupMap[child.id] = repos.projectGroupRepository.create({ projectId: project.id, parentId: created.id, name: child.name, color: child.color, position: child.position, createdBy: ctx.principal.userId }).id
      })
      const itemMap = {}
      // elementos antes dos subelementos (o pai precisa existir)
      source
        .slice()
        .sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId))
        .forEach((item) => {
          const copied = repos.planItemRepository.create({
            projectId: project.id,
            groupId: groupMap[item.groupId],
            parentId: item.parentId ? itemMap[item.parentId] || null : null,
            name: item.name,
            statusId: item.statusId || null,
            startDate: item.startDate || null,
            endDate: item.endDate || null,
            dueDate: item.dueDate || null,
            ownerId: item.ownerId || null,
            resourceIds: item.resourceIds || [],
            metrics: Object.assign({}, item.metrics || {}),
            progress: item.progress || 0,
            progressSet: !!item.progressSet,
            position: item.position,
            createdBy: ctx.principal.userId,
          })
          itemMap[item.id] = copied.id
        })
      audit(repos, ctx, 'project', project.id, 'project_group.duplicated', { group: group.name }, { group: created.name, subgroups: children.length, items: source.length })
      return created
    })
    return presentGroup(copy, planDomain.numberGroups(groups.listByProject(project.id)), null)
  }

  /* ------------------------------------------------------------------ elementos */

  function getItem(ctx, id) {
    const { item, project } = loadItem(ctx, id)
    const root = item.parentId ? items.findById(item.parentId) || item : item
    const family = [root].concat(items.listChildren(root.id))
    const progress = progressOf(family, indexBy(statuses.listByProject(project.id)))
    return presentItem(item, progress, usersOf([item]), item.parentId ? 0 : family.length - 1)
  }

  function createItem(ctx, projectId, raw) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'edit')
    const { issues, data } = planDomain.itemInput(raw, false)
    if (Object.keys(issues).length > 0) throw invalid(issues)
    let groupId = data.group_id || null
    let parentId = null
    if (data.parent_id) {
      const parent = items.findById(data.parent_id)
      const issue = planDomain.parentIssue(parent, project.id, null)
      if (issue) throw invalid({ parent_id: issue })
      parentId = parent.id
      groupId = parent.groupId
    } else {
      const group = groupId ? groups.findById(groupId) : null
      if (!group || group.projectId !== project.id) throw invalid({ group_id: groupId ? 'invalid_option' : 'required' })
    }
    const dates = planDomain.datesIssue(data.start_date || null, data.end_date || null)
    if (dates) throw invalid({ end_date: dates })
    assertRefs(project, data)
    const created = deps.unitOfWork.run((repos) => {
      const item = repos.planItemRepository.create(
        Object.assign(
          {
            projectId: project.id,
            groupId,
            parentId,
            statusId: null,
            resourceIds: [],
            metrics: {},
            progress: 0,
            progressSet: false,
            position: (repos.planItemRepository.maxPosition(groupId, parentId) || 0) + planDomain.POSITION_STEP,
            createdBy: ctx.principal.userId,
          },
          fieldsFrom(data, null),
        ),
      )
      const after = snapshot(item)
      const filled = {}
      Object.keys(after).forEach((key) => {
        if (after[key] !== null) filled[key] = after[key]
      })
      audit(repos, ctx, 'plan_item', item.id, 'plan_item.created', null, filled)
      return item
    })
    return getItem(ctx, created.id)
  }

  function updateItem(ctx, id, raw) {
    const { item, project, can } = loadItem(ctx, id)
    assertCan(can, project, 'edit')
    const { issues, data } = planDomain.itemInput(raw, true)
    if (Object.keys(issues).length > 0) throw invalid(issues)
    if (data.parent_id !== undefined && (data.parent_id || null) !== (item.parentId || null)) throw invalid({ parent_id: 'immutable' })
    let moveGroupTo
    if (data.group_id !== undefined && data.group_id !== item.groupId) {
      if (item.parentId) throw invalid({ group_id: 'follows_parent' })
      const group = data.group_id ? groups.findById(data.group_id) : null
      if (!group || group.projectId !== project.id) throw invalid({ group_id: 'invalid_option' })
      moveGroupTo = group.id
    }
    const start = data.start_date !== undefined ? data.start_date : item.startDate || null
    const end = data.end_date !== undefined ? data.end_date : item.endDate || null
    const dates = planDomain.datesIssue(start, end)
    if (dates) throw invalid({ end_date: dates })
    assertRefs(project, data)
    if (data.status_id !== undefined && (data.status_id || null) !== (item.statusId || null)) assertDependencies(project, [item], data.status_id)
    const patch = fieldsFrom(data, item)
    if (moveGroupTo) {
      patch.groupId = moveGroupTo
      patch.position = (items.maxPosition(moveGroupTo, null) || 0) + planDomain.POSITION_STEP
    }
    const change = changes(snapshot(item), snapshot(Object.assign({}, item, patch)))
    if (!change) return getItem(ctx, item.id)
    deps.unitOfWork.run((repos) => {
      repos.planItemRepository.update(item.id, patch)
      // subelementos acompanham o grupo do elemento
      if (moveGroupTo) repos.planItemRepository.listChildren(item.id).forEach((child) => repos.planItemRepository.update(child.id, { groupId: moveGroupTo }))
      audit(repos, ctx, 'plan_item', item.id, 'plan_item.updated', change.oldValue, change.newValue)
    })
    return getItem(ctx, item.id)
  }

  /** Exclui o elemento e os subelementos. */
  function deleteItem(ctx, id) {
    const { item, project, can } = loadItem(ctx, id)
    assertCan(can, project, 'edit')
    const children = items.listChildren(item.id)
    deps.unitOfWork.run((repos) => {
      repos.planLinkRepository.deleteByItems([item.id].concat(children.map((c) => c.id)))
      children.forEach((child) => repos.planItemRepository.delete(child.id))
      repos.planItemRepository.delete(item.id)
      audit(repos, ctx, 'plan_item', item.id, 'plan_item.deleted', { name: item.name, subitems: children.length }, null)
    })
    return { deleted: 1 + children.length }
  }

  /* ------------------------------------------------------------------ etiquetas de status */

  function createStatus(ctx, projectId, raw) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'manage')
    const input = Object.assign({ color: 'gray', category: 'todo' }, raw || {})
    const issues = planDomain.statusIssues(input, false)
    if (Object.keys(issues).length > 0) throw invalid(issues)
    const list = ensureStatuses(project)
    const created = deps.unitOfWork.run((repos) => {
      const status = repos.planStatusRepository.create({
        projectId: project.id,
        name: String(input.name).trim(),
        color: input.color,
        category: input.category,
        position: list.reduce((max, s) => Math.max(max, s.position || 0), 0) + planDomain.POSITION_STEP,
      })
      audit(repos, ctx, 'project', project.id, 'plan_status.created', null, { name: status.name, color: status.color, category: status.category })
      return status
    })
    return presentStatus(created)
  }

  function updateStatus(ctx, id, raw) {
    const found = loadOwned(ctx, statuses, id, 'PLAN_STATUS_NOT_FOUND')
    assertCan(found.can, found.project, 'manage')
    const input = raw || {}
    const issues = planDomain.statusIssues(input, true)
    if (Object.keys(issues).length > 0) throw invalid(issues)
    const status = found.record
    const patch = {}
    if (input.name !== undefined && String(input.name).trim() !== status.name) patch.name = String(input.name).trim()
    if (input.color !== undefined && input.color !== status.color) patch.color = input.color
    if (input.category !== undefined && input.category !== status.category) patch.category = input.category
    if (Object.keys(patch).length === 0) return presentStatus(status)
    const updated = deps.unitOfWork.run((repos) => {
      const result = repos.planStatusRepository.update(status.id, patch)
      const before = {}
      Object.keys(patch).forEach((key) => {
        before[key] = status[key]
      })
      audit(repos, ctx, 'project', found.project.id, 'plan_status.updated', Object.assign({ plan_status: status.name }, before), Object.assign({ plan_status: result.name }, patch))
      return result
    })
    return presentStatus(updated)
  }

  /** Exclui a etiqueta; os elementos com ela ficam em branco. */
  function deleteStatus(ctx, id) {
    const found = loadOwned(ctx, statuses, id, 'PLAN_STATUS_NOT_FOUND')
    assertCan(found.can, found.project, 'manage')
    const affected = items.listByStatus(found.record.id)
    deps.unitOfWork.run((repos) => {
      affected.forEach((item) => repos.planItemRepository.update(item.id, { statusId: null }))
      repos.planStatusRepository.delete(found.record.id)
      audit(repos, ctx, 'project', found.project.id, 'plan_status.deleted', { plan_status: found.record.name, items: affected.length }, null)
    })
    return { deleted: true, items: affected.length }
  }

  /* ------------------------------------------------------------------ etiquetas de recurso */

  function readResource(project, raw, partial, currentId) {
    const input = raw || {}
    const issues = planDomain.resourceIssues(input, partial)
    if (Object.keys(issues).length > 0) throw invalid(issues)
    const out = {}
    if (input.name !== undefined) {
      out.name = String(input.name).trim()
      out.nameKey = planDomain.nameKey(out.name)
      const existing = resources.findByKey(project.id, out.nameKey)
      if (existing && existing.id !== currentId) throw appError('PLAN_RESOURCE_NAME_IN_USE')
    }
    if (input.color !== undefined) out.color = input.color
    return out
  }

  function createResource(ctx, projectId, raw) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'edit')
    const data = readResource(project, raw, false, null)
    const created = deps.unitOfWork.run((repos) => {
      const resource = repos.planResourceRepository.create(Object.assign({ projectId: project.id, color: DEFAULT_RESOURCE_COLOR }, data))
      audit(repos, ctx, 'project', project.id, 'plan_resource.created', null, { name: resource.name })
      return resource
    })
    return presentResource(created)
  }

  function updateResource(ctx, id, raw) {
    const found = loadOwned(ctx, resources, id, 'PLAN_RESOURCE_NOT_FOUND')
    assertCan(found.can, found.project, 'edit')
    const data = readResource(found.project, raw, true, found.record.id)
    const resource = found.record
    const patch = {}
    if (data.name !== undefined && data.name !== resource.name) Object.assign(patch, { name: data.name, nameKey: data.nameKey })
    if (data.color !== undefined && data.color !== resource.color) patch.color = data.color
    if (Object.keys(patch).length === 0) return presentResource(resource)
    const updated = deps.unitOfWork.run((repos) => {
      const result = repos.planResourceRepository.update(resource.id, patch)
      audit(repos, ctx, 'project', found.project.id, 'plan_resource.updated', { resource: resource.name, color: resource.color }, { resource: result.name, color: result.color })
      return result
    })
    return presentResource(updated)
  }

  /** Exclui a etiqueta de recurso (sai dos elementos). */
  function deleteResource(ctx, id) {
    const found = loadOwned(ctx, resources, id, 'PLAN_RESOURCE_NOT_FOUND')
    assertCan(found.can, found.project, 'manage')
    const affected = items.listByResource(found.record.id)
    deps.unitOfWork.run((repos) => {
      affected.forEach((item) => repos.planItemRepository.update(item.id, { resourceIds: (item.resourceIds || []).filter((rid) => rid !== found.record.id) }))
      repos.planResourceRepository.delete(found.record.id)
      audit(repos, ctx, 'project', found.project.id, 'plan_resource.deleted', { resource: found.record.name, items: affected.length }, null)
    })
    return { deleted: true, items: affected.length }
  }

  return {
    getPlan,
    listGroups,
    createGroup,
    updateGroup,
    moveGroup,
    deleteGroup,
    duplicateGroup,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    createStatus,
    updateStatus,
    deleteStatus,
    createResource,
    updateResource,
    deleteResource,
  }
}

module.exports = { createPlanService, MAX_ITEMS }
