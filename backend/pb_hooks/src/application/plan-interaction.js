/**
 * Quadro do projeto — GP-2 (interação; docs/diretriz_feature_gerenciamento_projetos.md §8–§11).
 *
 * - Mover (arrastar e soltar ou menu): reordena entre os irmãos (`prev_id`/`next_id`) e, no elemento,
 *   troca de grupo levando os subelementos. Reordenar não gera histórico; trocar de grupo gera.
 * - Duplicar: cópia logo depois do original, com os subelementos (sem as dependências).
 * - Seleção em massa (até 200): status, recursos (acrescentar/tirar), mover de grupo, duplicar e
 *   excluir — tudo ou nada, com histórico de cada elemento.
 * - Dependências entre elementos (depende de / bloqueia / relacionado), sem ciclo de bloqueio.
 *   A regra do quadro (gestor) decide se só sinaliza ou impede iniciar/concluir.
 * - Importar elementos (linhas lidas da planilha no navegador): grupos, etiquetas de status e
 *   recursos pelo nome; os que faltam são criados (grupo e status: gestor). Tudo ou nada.
 * Permissões: editar o quadro (`plan.edit` + colaborador); regra do quadro: `plan.manage` + gestor.
 */

const { appError } = require('../core/errors')
const planDomain = require('../domain/plan')
const linkDomain = require('../domain/plan-links')
const importDomain = require('../domain/plan-import')
const { createPlanSupport, invalid, presentLink, DEFAULT_RESOURCE_COLOR } = require('./plan-support')
const { createPlanService } = require('./plan')

const copySuffix = (locale) => (locale === 'en' ? 'copy' : locale === 'es' ? 'copia' : 'cópia')
/** "3.0 Execução" → "Execução" (a numeração do grupo é automática). */
const withoutNumber = (name) => name.replace(/^\d+(\.\d+)?\s+/, '')

function createPlanInteractionService(deps) {
  const groups = deps.projectGroupRepository
  const resources = deps.planResourceRepository
  const items = deps.planItemRepository
  const links = deps.planLinkRepository
  const support = createPlanSupport(deps)
  const { loadProject, loadOwned, loadItem, assertCan, audit, ensureStatuses, settingsOf, assertDependencies, snapshot, changes, assertRefs, fieldsFrom } = support
  const plan = createPlanService(deps)

  /* ------------------------------------------------------------------ mover */

  /** Posição entre os irmãos (renumera quando não há folga). */
  function positionAmong(groupId, parentId, exceptId, target) {
    const siblings = () => items.listSiblings(groupId, parentId).filter((x) => x.id !== exceptId)
    let position = planDomain.placeAmong(siblings(), target)
    if (position === null) {
      deps.unitOfWork.run((repos) => repos.planItemRepository.renumber(groupId, parentId))
      position = planDomain.placeAmong(siblings(), target)
    }
    return position
  }

  function moveItem(ctx, id, raw) {
    const { item, project, can } = loadItem(ctx, id)
    assertCan(can, project, 'edit')
    const { issues, data } = planDomain.moveInput(raw)
    if (Object.keys(issues).length > 0) throw invalid(issues)
    let groupId = item.groupId
    if (data.group_id && data.group_id !== item.groupId) {
      if (item.parentId) throw invalid({ group_id: 'follows_parent' })
      const group = groups.findById(data.group_id)
      if (!group || group.projectId !== project.id) throw invalid({ group_id: 'invalid_option' })
      groupId = group.id
    }
    const siblings = items.listSiblings(groupId, item.parentId)
    ;['prev_id', 'next_id'].forEach((key) => {
      if (data[key] && (data[key] === item.id || !siblings.some((x) => x.id === data[key]))) throw invalid({ [key]: 'invalid_option' })
    })
    const position = positionAmong(groupId, item.parentId, item.id, { prevId: data.prev_id, nextId: data.next_id })
    const patch = { position }
    const change = groupId !== item.groupId ? changes(snapshot(item), snapshot(Object.assign({}, item, { groupId }))) : null
    if (change) patch.groupId = groupId
    deps.unitOfWork.run((repos) => {
      repos.planItemRepository.update(item.id, patch)
      if (!change) return
      repos.planItemRepository.listChildren(item.id).forEach((child) => repos.planItemRepository.update(child.id, { groupId }))
      audit(repos, ctx, 'plan_item', item.id, 'plan_item.updated', change.oldValue, change.newValue)
    })
    return plan.getItem(ctx, item.id)
  }

  /* ------------------------------------------------------------------ duplicar */

  /** Copia o elemento (e os subelementos) na posição dada; devolve a cópia. */
  function copyItem(repos, ctx, project, item, position) {
    const values = (source) => ({
      projectId: project.id,
      groupId: source.groupId,
      statusId: source.statusId || null,
      startDate: source.startDate || null,
      endDate: source.endDate || null,
      dueDate: source.dueDate || null,
      ownerId: source.ownerId || null,
      resourceIds: source.resourceIds || [],
      metrics: Object.assign({}, source.metrics || {}),
      custom: Object.assign({}, source.custom || {}),
      progress: source.progress || 0,
      progressSet: !!source.progressSet,
      createdBy: ctx.principal.userId,
    })
    const name = `${item.name} (${copySuffix(deps.locale)})`.slice(0, planDomain.ITEM_NAME_MAX)
    const copy = repos.planItemRepository.create(Object.assign(values(item), { parentId: item.parentId || null, name, position }))
    if (!item.parentId) {
      repos.planItemRepository.listChildren(item.id).forEach((child) => {
        repos.planItemRepository.create(Object.assign(values(child), { groupId: copy.groupId, parentId: copy.id, name: child.name, position: child.position }))
      })
    }
    audit(repos, ctx, 'plan_item', copy.id, 'plan_item.duplicated', { name: item.name }, { name: copy.name })
    return copy
  }

  function duplicateItem(ctx, id) {
    const { item, project, can } = loadItem(ctx, id)
    assertCan(can, project, 'edit')
    const position = positionAmong(item.groupId, item.parentId, null, { prevId: item.id })
    const copy = deps.unitOfWork.run((repos) => copyItem(repos, ctx, project, item, position))
    return plan.getItem(ctx, copy.id)
  }

  /* ------------------------------------------------------------------ seleção em massa */

  function bulkItems(ctx, projectId, raw) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'edit')
    const { issues, data } = planDomain.bulkInput(raw)
    if (Object.keys(issues).length > 0) throw invalid(issues)
    const list = data.ids.map((id) => items.findById(id))
    if (list.some((i) => !i || i.projectId !== project.id)) throw invalid({ ids: 'invalid_option' })
    list.sort((a, b) => a.position - b.position)

    if (data.action === 'update') {
      assertRefs(project, { status_id: data.status_id || null, resource_ids: data.add_resource_ids || [] })
      const patches = list.map((item) => {
        const patch = {}
        if (data.status_id !== undefined) patch.statusId = data.status_id
        if (data.add_resource_ids || data.remove_resource_ids) {
          const next = (item.resourceIds || []).concat(data.add_resource_ids || []).filter((rid, i, all) => all.indexOf(rid) === i && (data.remove_resource_ids || []).indexOf(rid) < 0)
          if (next.length > planDomain.MAX_RESOURCES) throw invalid({ add_resource_ids: 'too_many' })
          patch.resourceIds = next
        }
        return { item, patch, change: changes(snapshot(item), snapshot(Object.assign({}, item, patch))) }
      })
      if (data.status_id !== undefined) assertDependencies(project, list.filter((i) => (i.statusId || null) !== data.status_id), data.status_id)
      const changed = patches.filter((p) => p.change)
      deps.unitOfWork.run((repos) =>
        changed.forEach(({ item, patch, change }) => {
          repos.planItemRepository.update(item.id, patch)
          audit(repos, ctx, 'plan_item', item.id, 'plan_item.updated', change.oldValue, change.newValue)
        }),
      )
      return { updated: changed.length }
    }

    if (data.action === 'move') {
      if (list.some((i) => i.parentId)) throw invalid({ ids: 'follows_parent' })
      const group = groups.findById(data.group_id)
      if (!group || group.projectId !== project.id) throw invalid({ group_id: 'invalid_option' })
      deps.unitOfWork.run((repos) => {
        let position = repos.planItemRepository.maxPosition(group.id, null) || 0
        list
          .filter((i) => i.groupId !== group.id)
          .forEach((item) => {
            position += planDomain.POSITION_STEP
            const change = changes(snapshot(item), snapshot(Object.assign({}, item, { groupId: group.id })))
            repos.planItemRepository.update(item.id, { groupId: group.id, position })
            repos.planItemRepository.listChildren(item.id).forEach((child) => repos.planItemRepository.update(child.id, { groupId: group.id }))
            if (change) audit(repos, ctx, 'plan_item', item.id, 'plan_item.updated', change.oldValue, change.newValue)
          })
      })
      return { moved: list.length }
    }

    if (data.action === 'duplicate') {
      list.forEach((item) => {
        const position = positionAmong(item.groupId, item.parentId, null, { prevId: item.id })
        deps.unitOfWork.run((repos) => copyItem(repos, ctx, project, items.findById(item.id), position))
      })
      return { duplicated: list.length }
    }

    // excluir: com os subelementos (e as ligações)
    const children = list.filter((i) => !i.parentId).reduce((all, i) => all.concat(items.listChildren(i.id)), [])
    const removed = list.concat(children.filter((c) => !list.some((i) => i.id === c.id)))
    deps.unitOfWork.run((repos) => {
      repos.planLinkRepository.deleteByItems(removed.map((i) => i.id))
      removed
        .slice()
        .sort((a, b) => Number(!a.parentId) - Number(!b.parentId))
        .forEach((i) => repos.planItemRepository.delete(i.id))
      list.forEach((item) => audit(repos, ctx, 'plan_item', item.id, 'plan_item.deleted', { name: item.name, subitems: children.filter((c) => c.parentId === item.id).length }, null))
    })
    return { deleted: removed.length }
  }

  /* ------------------------------------------------------------------ dependências */

  function createLink(ctx, itemId, raw) {
    const { item, project, can } = loadItem(ctx, itemId)
    assertCan(can, project, 'edit')
    const input = raw || {}
    const typeIssue = linkDomain.linkTypeIssue(input.type)
    if (typeIssue) throw invalid({ type: typeIssue })
    const other = typeof input.item_id === 'string' ? items.findById(input.item_id) : null
    if (!other || other.projectId !== project.id) throw invalid({ item_id: 'invalid_option' })
    const link = linkDomain.normalizeLink(item.id, other.id, input.type)
    const issue = linkDomain.linkIssue(links.listByProject(project.id), link)
    if (issue) throw invalid({ item_id: issue })
    const created = deps.unitOfWork.run((repos) => {
      const saved = repos.planLinkRepository.create(Object.assign({ projectId: project.id, createdBy: ctx.principal.userId }, link))
      audit(repos, ctx, 'plan_item', item.id, 'plan_item.linked', null, { link_type: input.type, linked_item: other.name })
      return saved
    })
    return presentLink(created)
  }

  function deleteLink(ctx, id) {
    const found = loadOwned(ctx, links, id, 'PLAN_LINK_NOT_FOUND')
    assertCan(found.can, found.project, 'edit')
    const link = found.record
    const target = items.findById(link.toId)
    deps.unitOfWork.run((repos) => {
      repos.planLinkRepository.delete(link.id)
      audit(repos, ctx, 'plan_item', link.fromId, 'plan_item.unlinked', { link_type: link.type, linked_item: target ? target.name : null }, null)
    })
    return { deleted: true }
  }

  /* ------------------------------------------------------------------ regra do quadro */

  function updateSettings(ctx, projectId, raw) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'manage')
    const input = raw || {}
    const issue = linkDomain.ruleIssue(input.dependency_rule)
    if (issue) throw invalid({ dependency_rule: issue })
    const current = settingsOf(project).dependencyRule
    if (current !== input.dependency_rule) {
      deps.unitOfWork.run((repos) => {
        repos.planSettingsRepository.save(project.id, { dependencyRule: input.dependency_rule })
        audit(repos, ctx, 'project', project.id, 'plan_settings.updated', { dependency_rule: current }, { dependency_rule: input.dependency_rule })
      })
    }
    return { dependency_rule: input.dependency_rule }
  }

  /* ------------------------------------------------------------------ importar */

  function importItems(ctx, projectId, raw) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'edit')
    const { issues, rows } = importDomain.importRows(raw && raw.rows)
    if (issues.rows) throw invalid({ rows: issues.rows })
    const rowIssues = Object.assign({}, issues)
    const flag = (index, field, code) => {
      rowIssues[index] = rowIssues[index] || {}
      if (!rowIssues[index][field]) rowIssues[index][field] = code
    }
    const key = planDomain.nameKey

    // grupos pelo nome (ou pelo título numerado "1.0 Iniciação")
    const groupList = groups.listByProject(project.id)
    const numbers = planDomain.numberGroups(groupList)
    const groupOf = {}
    groupList.forEach((g) => {
      groupOf[key(g.name)] = g.id
      if (numbers[g.id]) groupOf[key(`${numbers[g.id]} ${g.name}`)] = g.id
    })
    const newGroups = {}
    const groupKeyOf = (name) => (groupOf[key(name)] ? `id:${groupOf[key(name)]}` : `new:${key(withoutNumber(name))}`)
    rows.forEach((r) => {
      if (!r.group || groupOf[key(r.group)]) return
      if (!can.manage) flag(r.index, 'group', 'invalid_option')
      else if (!newGroups[key(withoutNumber(r.group))]) newGroups[key(withoutNumber(r.group))] = withoutNumber(r.group)
    })

    // etiquetas de status pelo nome
    const statusList = ensureStatuses(project)
    const statusOf = {}
    statusList.forEach((s) => {
      statusOf[key(s.name)] = s.id
    })
    const newStatuses = {}
    rows.forEach((r) => {
      if (!r.status || statusOf[key(r.status)]) return
      if (!can.manage) flag(r.index, 'status', 'invalid_option')
      else if (!newStatuses[key(r.status)]) newStatuses[key(r.status)] = r.status
    })

    // recursos pelo nome (quem edita o quadro cria os que faltam)
    const resourceOf = {}
    resources.listByProject(project.id).forEach((res) => {
      resourceOf[res.nameKey || key(res.name)] = res.id
    })
    const newResources = {}
    rows.forEach((r) =>
      r.resources.forEach((name) => {
        if (!resourceOf[key(name)] && !newResources[key(name)]) newResources[key(name)] = name
      }),
    )

    // subelemento: pai com esse nome no mesmo grupo (da planilha ou já no quadro)
    const parentKey = (groupName, name) => `${groupKeyOf(groupName)}|${key(name)}`
    const importedParents = {}
    rows.forEach((r) => {
      if (!r.parent && r.group && r.name) importedParents[parentKey(r.group, r.name)] = true
    })
    const existingParents = {}
    groupList.forEach((g) =>
      items.listSiblings(g.id, null).forEach((i) => {
        const k = `id:${g.id}|${key(i.name)}`
        if (!existingParents[k]) existingParents[k] = i.id
      }),
    )
    rows.forEach((r) => {
      if (!r.parent || !r.group) return
      const k = parentKey(r.group, r.parent)
      if (!importedParents[k] && !existingParents[k]) flag(r.index, 'parent', 'invalid_option')
    })

    if (Object.keys(rowIssues).length > 0) throw appError('VALIDATION_ERROR', undefined, { fields: { rows: 'invalid' }, rows: rowIssues })

    const created = deps.unitOfWork.run((repos) => {
      const count = { groups: 0, statuses: 0, resources: 0, items: 0, subitems: 0 }
      let groupPosition = repos.projectGroupRepository.maxPosition(project.id, null) || 0
      const groupId = {}
      Object.keys(newGroups).forEach((k) => {
        groupPosition += planDomain.POSITION_STEP
        groupId[`new:${k}`] = repos.projectGroupRepository.create({ projectId: project.id, parentId: null, name: newGroups[k], color: 'blue', position: groupPosition, createdBy: ctx.principal.userId }).id
        count.groups += 1
      })
      const resolveGroup = (name) => {
        const k = groupKeyOf(name)
        return k.indexOf('id:') === 0 ? k.slice(3) : groupId[k]
      }
      let statusPosition = statusList.reduce((max, s) => Math.max(max, s.position || 0), 0)
      Object.keys(newStatuses).forEach((k) => {
        statusPosition += planDomain.POSITION_STEP
        statusOf[k] = repos.planStatusRepository.create({ projectId: project.id, name: newStatuses[k], color: 'gray', category: 'todo', position: statusPosition }).id
        count.statuses += 1
      })
      Object.keys(newResources).forEach((k) => {
        resourceOf[k] = repos.planResourceRepository.create({ projectId: project.id, name: newResources[k], nameKey: k, color: DEFAULT_RESOURCE_COLOR }).id
        count.resources += 1
      })
      const values = (r, target, parentId) =>
        Object.assign(
          {
            projectId: project.id,
            groupId: target,
            parentId,
            statusId: r.status ? statusOf[key(r.status)] : null,
            resourceIds: r.resources.map((name) => resourceOf[key(name)]),
            metrics: {},
            progress: 0,
            progressSet: false,
            position: (repos.planItemRepository.maxPosition(target, parentId) || 0) + planDomain.POSITION_STEP,
            createdBy: ctx.principal.userId,
          },
          fieldsFrom(Object.assign({ name: r.name }, r.data), null),
        )
      const parentIds = Object.assign({}, existingParents)
      rows
        .filter((r) => !r.parent)
        .forEach((r) => {
          const target = resolveGroup(r.group)
          const item = repos.planItemRepository.create(values(r, target, null))
          const k = parentKey(r.group, r.name)
          if (!parentIds[k] || existingParents[k] === parentIds[k]) parentIds[k] = item.id
          count.items += 1
        })
      rows
        .filter((r) => r.parent)
        .forEach((r) => {
          repos.planItemRepository.create(values(r, resolveGroup(r.group), parentIds[parentKey(r.group, r.parent)]))
          count.subitems += 1
        })
      audit(repos, ctx, 'project', project.id, 'plan_item.imported', null, count)
      return count
    })
    return { created }
  }

  return { moveItem, duplicateItem, bulkItems, createLink, deleteLink, updateSettings, importItems }
}

module.exports = { createPlanInteractionService }
