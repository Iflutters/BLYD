const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createPlanService } = require('../../pb_hooks/src/application/plan')
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
  deps.locale = 'pt-BR'
  const gabi = seedUser(deps, { roleCode: 'MANAGER', name: 'Gabi' })
  const mario = seedUser(deps, { roleCode: 'MEMBER', name: 'Mário' })
  const lia = seedUser(deps, { roleCode: 'MEMBER', name: 'Lia' })
  const otto = seedUser(deps, { roleCode: 'MEMBER', name: 'Otto' })
  const project = deps.projectRepository.create({ name: 'Clover 6', key: 'CLV', ownerId: gabi.id, createdBy: gabi.id, status: 'active', priority: 'medium' })
  ;[
    [gabi, 'manager'],
    [mario, 'member'],
    [lia, 'viewer'],
  ].forEach(([u, role]) => deps.projectMemberRepository.add({ projectId: project.id, userId: u.id, role }))
  const ctx = { gabi: ctxOf(deps, gabi), mario: ctxOf(deps, mario), lia: ctxOf(deps, lia), otto: ctxOf(deps, otto) }
  const plan = createPlanService(deps)
  const statusNamed = (name) => plan.getPlan(ctx.gabi, project.id).statuses.find((s) => s.name === name)
  return {
    deps,
    ctx,
    users: { gabi, mario, lia, otto },
    project,
    plan,
    statusNamed,
    group: (name, extra) => plan.createGroup(ctx.gabi, project.id, Object.assign({ name, color: 'blue' }, extra)),
    item: (groupId, name, extra) => plan.createItem(ctx.mario, project.id, Object.assign({ group_id: groupId, name }, extra)),
  }
}

describe('application/plan — quadro e grupos', () => {
  it('quadro novo nasce com as etiquetas de status (como no Monday); leitor vê; quem não é do projeto não', () => {
    const s = setup()
    const board = s.plan.getPlan(s.ctx.lia, s.project.id)
    assert.deepEqual(board.statuses.map((x) => x.name), ['Planejado', 'Em progresso', 'Confirmar', 'Parado', 'Feito'])
    assert.deepEqual(board.capabilities, { edit: false, manage: false })
    assert.deepEqual(s.plan.getPlan(s.ctx.mario, s.project.id).capabilities, { edit: true, manage: false })
    assert.deepEqual(s.plan.getPlan(s.ctx.gabi, s.project.id).capabilities, { edit: true, manage: true })
    assert.equal(codeOf(() => s.plan.getPlan(s.ctx.otto, s.project.id)), 'PROJECT_NOT_FOUND')
  })

  it('gestor cria grupos e subgrupos numerados; membro não; 2 níveis; histórico no projeto', () => {
    const s = setup()
    s.group('Iniciação')
    const pl = s.group('Planejamento', { color: 'violet' })
    assert.equal(s.group('Plano do Projeto', { parent_id: pl.id }).number, '2.1')
    assert.equal(codeOf(() => s.plan.createGroup(s.ctx.mario, s.project.id, { name: 'X' })), 'FORBIDDEN')
    assert.equal(codeOf(() => s.group('  ')), 'VALIDATION_ERROR:{"name":"required"}')
    const sub = s.plan.getPlan(s.ctx.gabi, s.project.id).groups[2]
    assert.equal(codeOf(() => s.group('Neto', { parent_id: sub.id })), 'VALIDATION_ERROR:{"parent_id":"too_deep"}')
    assert.ok(s.deps.store.audit.some((e) => e.entityType === 'project' && e.action === 'project_group.created'))
  })
})

describe('application/plan — elementos e subelementos', () => {
  it('cria elemento com status, cronograma, recursos, esforço e duração; valida referências e datas', () => {
    const s = setup()
    const g = s.group('Iniciação')
    const feito = s.statusNamed('Feito')
    const gp = s.plan.createResource(s.ctx.mario, s.project.id, { name: 'Gerente de Projetos' })
    const item = s.item(g.id, 'Elaborar pré-cronograma do projeto', { status_id: feito.id, start_date: '2026-01-26', end_date: '2026-01-27', resource_ids: [gp.id], estimated_hours: 1 })
    assert.equal(item.duration_days, 2)
    assert.deepEqual(item.progress, { value: 100, source: 'done' })
    assert.deepEqual(item.resource_ids, [gp.id])
    // sem cronograma, a duração informada vale; zero é valor
    const semData = s.item(g.id, 'Reunião inicial', { duration_days: 1, estimated_hours: 0 })
    assert.equal(semData.duration_days, 1)
    assert.equal(semData.estimated_hours, 0)
    assert.equal(codeOf(() => s.item(g.id, 'X', { start_date: '2026-02-10', end_date: '2026-02-01' })), 'VALIDATION_ERROR:{"end_date":"end_before_start"}')
    assert.equal(codeOf(() => s.item(g.id, 'X', { resource_ids: ['rs_inexistente'] })), 'VALIDATION_ERROR:{"resource_ids":"invalid_option"}')
    assert.equal(codeOf(() => s.plan.createItem(s.ctx.lia, s.project.id, { group_id: g.id, name: 'X' })), 'FORBIDDEN')
    assert.equal(codeOf(() => s.plan.createItem(s.ctx.mario, s.project.id, { name: 'Sem grupo' })), 'VALIDATION_ERROR:{"group_id":"required"}')
  })

  it('subelementos: responsável, data, trabalho e realizado; progresso do pai ponderado pelo trabalho', () => {
    const s = setup()
    const g = s.group('Execução')
    const pai = s.item(g.id, 'Validação do ambiente')
    const feito = s.statusNamed('Feito')
    const sub1 = s.plan.createItem(s.ctx.mario, s.project.id, { parent_id: pai.id, name: 'Validar Web', status_id: feito.id, estimated_hours: 6, owner_id: s.users.mario.id, due_date: '2026-02-11' })
    s.plan.createItem(s.ctx.mario, s.project.id, { parent_id: pai.id, name: 'Validar Android', estimated_hours: 2, progress: 50, actual_hours: 1.5 })
    assert.equal(sub1.group_id, g.id)
    assert.equal(sub1.owner.name, 'Mário')
    assert.equal(codeOf(() => s.plan.createItem(s.ctx.mario, s.project.id, { parent_id: sub1.id, name: 'Neto' })), 'VALIDATION_ERROR:{"parent_id":"too_deep"}')
    assert.equal(codeOf(() => s.plan.createItem(s.ctx.mario, s.project.id, { parent_id: pai.id, name: 'X', owner_id: s.users.otto.id })), 'VALIDATION_ERROR:{"owner_id":"not_member"}')
    const board = s.plan.getPlan(s.ctx.gabi, s.project.id)
    const row = board.items.find((i) => i.id === pai.id)
    // (6 × 100 + 2 × 50) / 8 = 87,5 → 88
    assert.deepEqual(row.progress, { value: 88, source: 'subitems' })
    assert.equal(row.subitems, 2)
    // excluir o elemento leva os subelementos
    assert.deepEqual(s.plan.deleteItem(s.ctx.mario, pai.id), { deleted: 3 })
  })

  it('edição direta registra o histórico legível; mover de grupo leva os subelementos', () => {
    const s = setup()
    const a = s.group('1.0')
    const b = s.group('2.0')
    const item = s.item(a.id, 'Kick-off')
    const sub = s.plan.createItem(s.ctx.mario, s.project.id, { parent_id: item.id, name: 'Pauta' })
    const progresso = s.statusNamed('Em progresso')
    s.plan.updateItem(s.ctx.mario, item.id, { status_id: progresso.id, estimated_hours: 1.5 })
    const entry = s.deps.store.audit.filter((e) => e.entityId === item.id && e.action === 'plan_item.updated').pop()
    assert.deepEqual(entry.newValue, { plan_status: 'Em progresso', estimated_hours: 1.5 })
    const moved = s.plan.updateItem(s.ctx.mario, item.id, { group_id: b.id })
    assert.equal(moved.group_id, b.id)
    assert.equal(s.plan.getItem(s.ctx.mario, sub.id).group_id, b.id)
    assert.equal(codeOf(() => s.plan.updateItem(s.ctx.mario, sub.id, { group_id: a.id })), 'VALIDATION_ERROR:{"group_id":"follows_parent"}')
    // progresso manual e limpar
    assert.equal(s.plan.updateItem(s.ctx.mario, item.id, { progress: 30 }).progress_manual, 30)
    assert.equal(s.plan.updateItem(s.ctx.mario, item.id, { progress: null }).progress_manual, null)
  })
})

describe('application/plan — totais, etiquetas e grupos', () => {
  it('rodapé do grupo: distribuição, período, somas e progresso', () => {
    const s = setup()
    const g = s.group('Iniciação')
    const feito = s.statusNamed('Feito')
    s.item(g.id, 'Reunião inicial', { status_id: feito.id, estimated_hours: 1.5, duration_days: 1 })
    s.item(g.id, 'Abrir pasta do cliente', { status_id: feito.id, start_date: '2026-01-26', estimated_hours: 0.1 })
    s.item(g.id, 'Criar cabeçalho', { start_date: '2026-01-27', end_date: '2026-01-30', estimated_hours: 0.2 })
    const summary = s.plan.getPlan(s.ctx.gabi, s.project.id).groups[0].summary
    assert.deepEqual(summary.status_counts, [
      { status_id: feito.id, count: 2 },
      { status_id: null, count: 1 },
    ])
    assert.equal(summary.estimated_hours, 1.8)
    assert.equal(summary.duration_days, 6)
    assert.deepEqual([summary.start_date.slice(0, 10), summary.end_date.slice(0, 10)], ['2026-01-26', '2026-01-30'])
    // (1,5×100 + 0,1×100 + 0,2×0) / 1,8 = 88,9 → 89
    assert.equal(summary.progress, 89)
  })

  it('etiquetas: status pelo gestor (excluir deixa em branco); recursos únicos, pelo membro; excluir recurso tira dos elementos', () => {
    const s = setup()
    const g = s.group('Iniciação')
    const custom = s.plan.createStatus(s.ctx.gabi, s.project.id, { name: 'Aguardando cliente', color: 'violet', category: 'blocked' })
    assert.equal(codeOf(() => s.plan.createStatus(s.ctx.mario, s.project.id, { name: 'X' })), 'FORBIDDEN')
    const cliente = s.plan.createResource(s.ctx.mario, s.project.id, { name: 'Cliente' })
    assert.equal(codeOf(() => s.plan.createResource(s.ctx.mario, s.project.id, { name: ' cliente ' })), 'PLAN_RESOURCE_NAME_IN_USE')
    const item = s.item(g.id, 'Aprovar plano', { status_id: custom.id, resource_ids: [cliente.id] })
    s.plan.deleteStatus(s.ctx.gabi, custom.id)
    assert.equal(s.plan.getItem(s.ctx.mario, item.id).status_id, null)
    assert.equal(codeOf(() => s.plan.deleteResource(s.ctx.mario, cliente.id)), 'FORBIDDEN')
    assert.deepEqual(s.plan.deleteResource(s.ctx.gabi, cliente.id), { deleted: true, items: 1 })
    assert.deepEqual(s.plan.getItem(s.ctx.mario, item.id).resource_ids, [])
  })

  it('duplicar copia subgrupos, elementos e subelementos com os valores; excluir leva tudo', () => {
    const s = setup()
    const exec = s.group('Execução')
    s.group('Encerramento')
    const inst = s.group('Instalações CRM', { parent_id: exec.id })
    const feito = s.statusNamed('Feito')
    const pai = s.item(inst.id, 'Backup da base', { status_id: feito.id, estimated_hours: 4 })
    s.plan.createItem(s.ctx.mario, s.project.id, { parent_id: pai.id, name: 'Conferir rotina' })
    const copy = s.plan.duplicateGroup(s.ctx.gabi, exec.id)
    assert.equal(copy.name, 'Execução (cópia)')
    const board = s.plan.getPlan(s.ctx.gabi, s.project.id)
    assert.deepEqual(
      board.groups.map((g) => `${g.number} ${g.name}`),
      ['1.0 Execução', '1.1 Instalações CRM', '2.0 Execução (cópia)', '2.1 Instalações CRM', '3.0 Encerramento'],
    )
    const copiedGroup = board.groups[3]
    const copies = board.items.filter((i) => i.group_id === copiedGroup.id)
    const copiedParent = copies.find((i) => i.name === 'Backup da base')
    assert.equal(copiedParent.status_id, feito.id)
    assert.equal(copiedParent.estimated_hours, 4)
    assert.equal(copies.find((i) => i.name === 'Conferir rotina').parent_id, copiedParent.id)
    assert.deepEqual(s.plan.deleteGroup(s.ctx.gabi, exec.id), { deleted: 2, items: 2 })
    assert.equal(codeOf(() => s.plan.getItem(s.ctx.mario, pai.id)), 'PLAN_ITEM_NOT_FOUND')
  })
})
