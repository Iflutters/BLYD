/**
 * Quadro do projeto — GP-5: colunas personalizadas (gestor define; quem edita preenche).
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createPlanService } = require('../../pb_hooks/src/application/plan')
const { createPlanInteractionService } = require('../../pb_hooks/src/application/plan-interaction')
const { createPlanColumnsService } = require('../../pb_hooks/src/application/plan-columns')
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
  const columns = createPlanColumnsService(deps)
  const group = plan.createGroup(ctx.gabi, project.id, { name: 'Iniciação', color: 'blue' })
  const a = plan.createItem(ctx.mario, project.id, { group_id: group.id, name: 'Kickoff' })
  const b = plan.createItem(ctx.mario, project.id, { group_id: group.id, name: 'Plano' })
  const actions = (action) => deps.store.audit.filter((x) => x.action === action)
  const board = (who = 'lia') => plan.getPlan(ctx[who], project.id)
  return { deps, ctx, users: { gabi, mario, lia, otto }, project, plan, columns, group, a, b, actions, board }
}

describe('application/plan-columns — definir colunas (gestor)', () => {
  it('o gestor adiciona colunas; o quadro traz as colunas na ordem; quem não é gestor não mexe', () => {
    const s = setup()
    const fornecedor = s.columns.createColumn(s.ctx.gabi, s.project.id, { name: 'Fornecedor', type: 'text' })
    const custo = s.columns.createColumn(s.ctx.gabi, s.project.id, { name: 'Custo', type: 'number', settings: { unit: 'R$' } })
    assert.deepEqual([fornecedor.name, fornecedor.type, custo.settings], ['Fornecedor', 'text', { unit: 'R$' }])
    assert.deepEqual(s.board().columns.map((c) => c.name), ['Fornecedor', 'Custo'])
    assert.equal(codeOf(() => s.columns.createColumn(s.ctx.mario, s.project.id, { name: 'X', type: 'text' })), 'FORBIDDEN')
    assert.equal(codeOf(() => s.columns.createColumn(s.ctx.gabi, s.project.id, { name: 'X', type: 'formula' })), 'VALIDATION_ERROR:{"type":"invalid_option"}')
    assert.equal(s.actions('plan_column.created').length, 2)
  })

  it('preencher: quem edita o quadro grava o valor na célula (validado pelo tipo); histórico com o nome da coluna; soma no rodapé', () => {
    const s = setup()
    const custo = s.columns.createColumn(s.ctx.gabi, s.project.id, { name: 'Custo', type: 'number' })
    const fase = s.columns.createColumn(s.ctx.gabi, s.project.id, { name: 'Fase', type: 'dropdown', settings: { options: [{ name: 'Piloto', color: 'blue' }] } })
    const dono = s.columns.createColumn(s.ctx.gabi, s.project.id, { name: 'Aprovador', type: 'people' })
    const piloto = fase.settings.options[0].id
    s.plan.updateItem(s.ctx.mario, s.a.id, { custom: { [custo.id]: 1200.5, [fase.id]: piloto, [dono.id]: s.users.gabi.id } })
    s.plan.updateItem(s.ctx.mario, s.b.id, { custom: { [custo.id]: 300 } })
    const data = s.board()
    assert.deepEqual(data.items.find((i) => i.id === s.a.id).custom, { [custo.id]: 1200.5, [fase.id]: piloto, [dono.id]: s.users.gabi.id })
    assert.equal(data.groups[0].summary.custom_sums[custo.id], 1500.5)
    const audit = s.actions('plan_item.updated')[0]
    assert.deepEqual(audit.newValue, { 'cf:Custo': 1200.5, 'cf:Fase': 'Piloto', 'cf:Aprovador': 'Gabi' })

    // limpar, tipo errado, opção que não existe, pessoa de fora, leitor não edita, coluna de outro quadro
    s.plan.updateItem(s.ctx.mario, s.b.id, { custom: { [custo.id]: null } })
    assert.deepEqual(s.board().items.find((i) => i.id === s.b.id).custom, {})
    assert.equal(codeOf(() => s.plan.updateItem(s.ctx.mario, s.a.id, { custom: { [custo.id]: 'mil' } })), 'VALIDATION_ERROR:{"custom":"invalid_type"}')
    assert.equal(codeOf(() => s.plan.updateItem(s.ctx.mario, s.a.id, { custom: { [fase.id]: 'nope' } })), 'VALIDATION_ERROR:{"custom":"invalid_option"}')
    assert.equal(codeOf(() => s.plan.updateItem(s.ctx.mario, s.a.id, { custom: { [dono.id]: s.users.otto.id } })), 'VALIDATION_ERROR:{"custom":"not_member"}')
    assert.equal(codeOf(() => s.plan.updateItem(s.ctx.mario, s.a.id, { custom: { outra: 'x' } })), 'VALIDATION_ERROR:{"custom":"invalid_option"}')
    assert.equal(codeOf(() => s.plan.updateItem(s.ctx.lia, s.a.id, { custom: { [custo.id]: 1 } })), 'FORBIDDEN')
    const sub = s.plan.createItem(s.ctx.mario, s.project.id, { parent_id: s.a.id, name: 'Pauta' })
    assert.equal(codeOf(() => s.plan.updateItem(s.ctx.mario, sub.id, { custom: { [custo.id]: 1 } })), 'VALIDATION_ERROR:{"custom":"subitems_not_supported"}')
  })

  it('renomear e editar as opções (opção removida limpa os valores); duplicar copia definição e valores; excluir apaga os valores', () => {
    const s = setup()
    const fase = s.columns.createColumn(s.ctx.gabi, s.project.id, { name: 'Fase', type: 'dropdown', settings: { options: [{ name: 'Piloto', color: 'blue' }, { name: 'Produção', color: 'green' }] } })
    const [piloto, producao] = fase.settings.options
    s.plan.updateItem(s.ctx.mario, s.a.id, { custom: { [fase.id]: piloto.id } })
    s.plan.updateItem(s.ctx.mario, s.b.id, { custom: { [fase.id]: producao.id } })

    const renamed = s.columns.updateColumn(s.ctx.gabi, fase.id, { name: 'Etapa', settings: { options: [piloto] } })
    assert.equal(renamed.name, 'Etapa')
    const after = s.board()
    assert.deepEqual(after.items.find((i) => i.id === s.a.id).custom, { [fase.id]: piloto.id })
    assert.deepEqual(after.items.find((i) => i.id === s.b.id).custom, {})

    const copy = s.columns.duplicateColumn(s.ctx.gabi, fase.id)
    assert.equal(copy.name, 'Etapa (cópia)')
    assert.equal(s.board().items.find((i) => i.id === s.a.id).custom[copy.id], piloto.id)

    s.columns.deleteColumn(s.ctx.gabi, fase.id)
    const final = s.board()
    assert.deepEqual(final.columns.map((c) => c.name), ['Etapa (cópia)'])
    assert.deepEqual(Object.keys(final.items.find((i) => i.id === s.a.id).custom), [copy.id])
    assert.equal(codeOf(() => s.columns.deleteColumn(s.ctx.mario, copy.id)), 'FORBIDDEN')
    assert.equal(codeOf(() => s.columns.deleteColumn(s.ctx.otto, copy.id)), 'PLAN_COLUMN_NOT_FOUND')
    assert.deepEqual(['plan_column.updated', 'plan_column.duplicated', 'plan_column.deleted'].map((x) => s.actions(x).length), [1, 1, 1])
  })

  it('alterar o tipo: prévia (dry_run) diz quantos valores se perdem sem gravar; ao confirmar converte', () => {
    const s = setup()
    const col = s.columns.createColumn(s.ctx.gabi, s.project.id, { name: 'Valor', type: 'text' })
    s.plan.updateItem(s.ctx.mario, s.a.id, { custom: { [col.id]: '12,5' } })
    s.plan.updateItem(s.ctx.mario, s.b.id, { custom: { [col.id]: 'a combinar' } })
    assert.deepEqual(s.columns.changeType(s.ctx.gabi, col.id, { type: 'number', dry_run: true }), { converted: 1, lost: 1 })
    assert.equal(s.board().columns[0].type, 'text')
    const changed = s.columns.changeType(s.ctx.gabi, col.id, { type: 'number' })
    assert.equal(changed.type, 'number')
    const data = s.board()
    assert.equal(data.items.find((i) => i.id === s.a.id).custom[col.id], 12.5)
    assert.deepEqual(data.items.find((i) => i.id === s.b.id).custom, {})
    assert.deepEqual(s.actions('plan_column.type_changed')[0].newValue, { column: 'Valor', column_type: 'number', lost_values: 1 })
  })

  it('até 30 colunas por quadro; duplicar o elemento leva os valores', () => {
    const s = setup()
    const col = s.columns.createColumn(s.ctx.gabi, s.project.id, { name: 'Nota', type: 'text' })
    s.plan.updateItem(s.ctx.mario, s.a.id, { custom: { [col.id]: 'importante' } })
    const copy = createPlanInteractionService(s.deps).duplicateItem(s.ctx.mario, s.a.id)
    assert.equal(s.board().items.find((i) => i.id === copy.id).custom[col.id], 'importante')
    for (let i = 1; i < 30; i++) s.columns.createColumn(s.ctx.gabi, s.project.id, { name: `C${i}`, type: 'text' })
    assert.equal(codeOf(() => s.columns.createColumn(s.ctx.gabi, s.project.id, { name: 'Demais', type: 'text' })), 'VALIDATION_ERROR:{"columns":"too_many"}')
  })
})
