/**
 * Quadro do projeto — GP-4: Gestão (Diário do projeto e Gestão dos problemas), linha de base do
 * Cronograma e relatório com a saúde do projeto (docs/diretriz_feature_gerenciamento_projetos.md
 * §13, §15 e §16).
 *
 * - Ver (diário, problemas, relatório): acesso ao projeto + `plan.view` (inclusive leitor).
 * - Diário: quem edita o quadro registra; o autor ou o gestor edita/exclui.
 * - Problemas: quem edita o quadro abre e atualiza; quem abriu ou o gestor exclui. Numeração por
 *   projeto que não se repete (nem depois de excluir).
 * - Linha de base: o gestor salva (foto do cronograma atual dos elementos) e limpa.
 * - Projeto arquivado: só leitura. Registro de outro projeto invisível: 404.
 * - Histórico no projeto (plan_journal.*, plan_issue.*, plan_settings.baseline_*).
 */

const { appError } = require('../core/errors')
const planDomain = require('../domain/plan')
const mgmtDomain = require('../domain/plan-management')
const { planReport } = require('../domain/plan-report')
const { localDay } = require('../domain/report')
const { truncate } = require('./audit')
const { iso, toUserSummary } = require('./presenters')
const { createPlanSupport, invalid, indexBy, MAX_ITEMS } = require('./plan-support')

const EXCERPT = 300

function createPlanManagementService(deps) {
  const journal = deps.planJournalRepository
  const issues = deps.planIssueRepository
  const support = createPlanSupport(deps)
  const { loadProject, loadOwned, assertCan, audit, ensureStatuses, settingsOf, pendingMap, progressOf, assertRefs } = support

  const today = () => deps.clock.now().toISOString().slice(0, 10)
  const usersFor = (ids) => {
    const unique = ids.filter((id, i, all) => id && all.indexOf(id) === i)
    return indexBy(unique.length ? deps.userRepository.findManyByIds(unique) : [])
  }
  const summaryOf = (users, id) => (id && users[id] ? toUserSummary(users[id]) : null)
  const check = (result) => {
    if (Object.keys(result.issues).length > 0) throw invalid(result.issues)
    return result.data
  }

  /* ------------------------------------------------------------------ diário */

  function presentEntry(entry, users, can, userId) {
    return {
      id: entry.id,
      entry_date: entry.entryDate,
      content: entry.content,
      author: summaryOf(users, entry.authorId),
      created_at: iso(entry.createdAt),
      updated_at: iso(entry.updatedAt),
      capabilities: mgmtDomain.journalCapabilities(can, entry, userId),
    }
  }

  function listJournal(ctx, projectId) {
    const { project, can } = loadProject(ctx, projectId)
    const list = mgmtDomain.sortJournal(journal.listByProject(project.id))
    const users = usersFor(list.map((e) => e.authorId))
    return { entries: list.map((e) => presentEntry(e, users, can, ctx.principal.userId)), capabilities: { create: can.edit } }
  }

  const journalAudit = (entry) => ({ entry_date: entry.entryDate, content: truncate(entry.content, EXCERPT) })

  function createJournalEntry(ctx, projectId, raw) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'edit')
    const data = check(mgmtDomain.journalInput(raw, false))
    const created = deps.unitOfWork.run((repos) => {
      const entry = repos.planJournalRepository.create({ projectId: project.id, entryDate: data.entry_date, content: data.content, authorId: ctx.principal.userId })
      audit(repos, ctx, 'project', project.id, 'plan_journal.created', null, journalAudit(entry))
      return entry
    })
    return presentEntry(created, usersFor([created.authorId]), can, ctx.principal.userId)
  }

  function loadEntry(ctx, id) {
    const found = loadOwned(ctx, journal, id, 'PLAN_JOURNAL_NOT_FOUND')
    return { entry: found.record, project: found.project, can: found.can }
  }

  function assertEntry(ctx, found, action) {
    if (mgmtDomain.journalCapabilities(found.can, found.entry, ctx.principal.userId)[action]) return
    throw appError(found.project.archivedAt ? 'PROJECT_ARCHIVED' : 'FORBIDDEN')
  }

  function updateJournalEntry(ctx, id, raw) {
    const found = loadEntry(ctx, id)
    assertEntry(ctx, found, 'edit')
    const data = check(mgmtDomain.journalInput(raw, true))
    const patch = {}
    if (data.entry_date !== undefined && data.entry_date !== found.entry.entryDate) patch.entryDate = data.entry_date
    if (data.content !== undefined && data.content !== found.entry.content) patch.content = data.content
    let saved = found.entry
    if (Object.keys(patch).length > 0) {
      const before = journalAudit(found.entry)
      saved = deps.unitOfWork.run((repos) => {
        const result = repos.planJournalRepository.update(found.entry.id, patch)
        audit(repos, ctx, 'project', found.project.id, 'plan_journal.updated', before, journalAudit(result))
        return result
      })
    }
    return presentEntry(saved, usersFor([saved.authorId]), found.can, ctx.principal.userId)
  }

  function deleteJournalEntry(ctx, id) {
    const found = loadEntry(ctx, id)
    assertEntry(ctx, found, 'delete')
    deps.unitOfWork.run((repos) => {
      repos.planJournalRepository.delete(found.entry.id)
      audit(repos, ctx, 'project', found.project.id, 'plan_journal.deleted', journalAudit(found.entry), null)
    })
    return { deleted: true }
  }

  /* ------------------------------------------------------------------ problemas */

  function presentIssue(issue, users, can, userId) {
    return {
      id: issue.id,
      number: issue.number,
      opened_on: issue.openedOn,
      description: issue.description,
      state: issue.state,
      owner: summaryOf(users, issue.ownerId),
      resolved_on: issue.resolvedOn || null,
      created_by: summaryOf(users, issue.createdBy),
      created_at: iso(issue.createdAt),
      updated_at: iso(issue.updatedAt),
      capabilities: mgmtDomain.issueCapabilities(can, issue, userId),
    }
  }

  const issueUsers = (list) => usersFor(list.reduce((ids, i) => ids.concat([i.ownerId, i.createdBy]), []))

  function listIssues(ctx, projectId) {
    const { project, can } = loadProject(ctx, projectId)
    const list = issues.listByProject(project.id).sort((a, b) => a.number - b.number)
    const users = issueUsers(list)
    return { issues: list.map((i) => presentIssue(i, users, can, ctx.principal.userId)), capabilities: { create: can.edit } }
  }

  /** Histórico legível: número, campos que mudaram e o nome do responsável. */
  function issueAudit(issue, keys) {
    const owner = issue.ownerId ? deps.userRepository.findById(issue.ownerId) : null
    const all = { opened_on: issue.openedOn, description: truncate(issue.description, EXCERPT), issue_state: issue.state, issue_owner: owner ? owner.name : null }
    const out = { issue: `#${issue.number}` }
    ;(keys || Object.keys(all)).forEach((key) => {
      out[key] = all[key]
    })
    return out
  }

  function createIssue(ctx, projectId, raw) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'edit')
    const data = check(mgmtDomain.issueInput(raw, false))
    if (data.owner_id) assertRefs(project, { owner_id: data.owner_id })
    const created = deps.unitOfWork.run((repos) => {
      const settings = repos.planSettingsRepository.findByProject(project.id)
      const number = Math.max(settings && settings.issueSeq ? settings.issueSeq : 0, repos.planIssueRepository.maxNumber(project.id)) + 1
      repos.planSettingsRepository.save(project.id, { issueSeq: number })
      const issue = repos.planIssueRepository.create({
        projectId: project.id,
        number,
        openedOn: data.opened_on,
        description: data.description,
        state: data.state,
        ownerId: data.owner_id || null,
        resolvedOn: mgmtDomain.resolvedOn({ state: null }, data.state, today()),
        createdBy: ctx.principal.userId,
      })
      audit(repos, ctx, 'project', project.id, 'plan_issue.created', null, issueAudit(issue))
      return issue
    })
    return presentIssue(created, issueUsers([created]), can, ctx.principal.userId)
  }

  function loadIssue(ctx, id) {
    const found = loadOwned(ctx, issues, id, 'PLAN_ISSUE_NOT_FOUND')
    return { issue: found.record, project: found.project, can: found.can }
  }

  function assertIssue(ctx, found, action) {
    if (mgmtDomain.issueCapabilities(found.can, found.issue, ctx.principal.userId)[action]) return
    throw appError(found.project.archivedAt ? 'PROJECT_ARCHIVED' : 'FORBIDDEN')
  }

  function updateIssue(ctx, id, raw) {
    const found = loadIssue(ctx, id)
    assertIssue(ctx, found, 'edit')
    const data = check(mgmtDomain.issueInput(raw, true))
    if (data.owner_id) assertRefs(found.project, { owner_id: data.owner_id })
    const current = found.issue
    const patch = {}
    const changed = []
    if (data.opened_on !== undefined && data.opened_on !== current.openedOn) {
      patch.openedOn = data.opened_on
      changed.push('opened_on')
    }
    if (data.description !== undefined && data.description !== current.description) {
      patch.description = data.description
      changed.push('description')
    }
    if (data.state !== undefined && data.state !== current.state) {
      patch.state = data.state
      patch.resolvedOn = mgmtDomain.resolvedOn(current, data.state, today())
      changed.push('issue_state')
    }
    if (data.owner_id !== undefined && (data.owner_id || null) !== (current.ownerId || null)) {
      patch.ownerId = data.owner_id || null
      changed.push('issue_owner')
    }
    let saved = current
    if (changed.length > 0) {
      const before = issueAudit(current, changed)
      saved = deps.unitOfWork.run((repos) => {
        const result = repos.planIssueRepository.update(current.id, patch)
        audit(repos, ctx, 'project', found.project.id, 'plan_issue.updated', before, issueAudit(result, changed))
        return result
      })
    }
    return presentIssue(saved, issueUsers([saved]), found.can, ctx.principal.userId)
  }

  function deleteIssue(ctx, id) {
    const found = loadIssue(ctx, id)
    assertIssue(ctx, found, 'delete')
    const before = issueAudit(found.issue)
    deps.unitOfWork.run((repos) => {
      repos.planIssueRepository.delete(found.issue.id)
      audit(repos, ctx, 'project', found.project.id, 'plan_issue.deleted', before, null)
    })
    return { deleted: true }
  }

  /* ------------------------------------------------------------------ linha de base */

  function saveBaseline(ctx, projectId) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'manage')
    const snapshot = mgmtDomain.baselineSnapshot(deps.planItemRepository.listByProject(project.id, MAX_ITEMS))
    const savedAt = deps.clock.now()
    const count = Object.keys(snapshot).length
    deps.unitOfWork.run((repos) => {
      repos.planSettingsRepository.save(project.id, { baseline: { savedAt, items: snapshot } })
      audit(repos, ctx, 'project', project.id, 'plan_settings.baseline_saved', null, { baseline_items: count })
    })
    return { saved_at: iso(savedAt), items: count }
  }

  function clearBaseline(ctx, projectId) {
    const { project, can } = loadProject(ctx, projectId)
    assertCan(can, project, 'manage')
    if (!settingsOf(project).baseline) return { cleared: false }
    deps.unitOfWork.run((repos) => {
      repos.planSettingsRepository.save(project.id, { baseline: null })
      audit(repos, ctx, 'project', project.id, 'plan_settings.baseline_cleared', null, null)
    })
    return { cleared: true }
  }

  /* ------------------------------------------------------------------ relatório */

  function readOffset(query) {
    const raw = query && query.tz_offset !== undefined && query.tz_offset !== '' ? String(query.tz_offset) : '0'
    if (!/^-?\d{1,3}$/.test(raw) || Math.abs(Number(raw)) > 840) throw invalid({ tz_offset: 'invalid_type' })
    return Number(raw)
  }

  function getReport(ctx, projectId, query) {
    const { project } = loadProject(ctx, projectId)
    const offset = readOffset(query)
    const statusById = indexBy(ensureStatuses(project))
    const list = deps.planItemRepository.listByProject(project.id, MAX_ITEMS)
    const categoryOf = (i) => (i.statusId && statusById[i.statusId] ? statusById[i.statusId].category : null)
    const groupList = deps.projectGroupRepository.listByProject(project.id)
    const numbers = planDomain.numberGroups(groupList)
    return planReport({
      items: list,
      categoryOf,
      progress: progressOf(list, statusById),
      groups: planDomain.orderGroups(groupList).map((g) => ({ id: g.id, name: g.name, color: g.color, number: numbers[g.id] })),
      resources: deps.planResourceRepository.listByProject(project.id),
      issues: issues.listByProject(project.id),
      pending: pendingMap(list, deps.planLinkRepository.listByProject(project.id), categoryOf),
      today: localDay(deps.clock.now(), offset),
    })
  }

  return {
    listJournal,
    createJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
    listIssues,
    createIssue,
    updateIssue,
    deleteIssue,
    saveBaseline,
    clearBaseline,
    getReport,
  }
}

module.exports = { createPlanManagementService }
