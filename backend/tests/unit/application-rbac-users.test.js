const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createRoleService } = require('../../pb_hooks/src/application/roles')
const { createUserService } = require('../../pb_hooks/src/application/users')
const { createPrincipal } = require('../../pb_hooks/src/domain/rbac')
const { DEFAULT_ROLE_PERMISSIONS } = require('../../pb_hooks/src/domain/permissions')

function ctxFor(deps, roleCode, userId) {
  const role = deps.roleRepository.findByCode(roleCode)
  const principal = createPrincipal({
    userId: userId || 'actor',
    roleId: role.id,
    roleCode,
    permissions: deps.roleRepository.getPermissionCodes(role.id),
  })
  return { principal, ip: '1.1.1.1', userAgent: 'ua', correlationId: 'c' }
}

describe('application/roles', () => {
  it('lista perfis com contagem de permissões e usuários', () => {
    const deps = createFakeDeps()
    const roles = createRoleService(deps)
    seedUser(deps, { roleCode: 'MEMBER' })
    const list = roles.listRoles(ctxFor(deps, 'ADMIN'))
    const member = list.find((r) => r.code === 'MEMBER')
    assert.equal(member.user_count, 1)
    assert.deepEqual(member.permissions, DEFAULT_ROLE_PERMISSIONS.MEMBER.slice().sort())
  })

  it('VIEWER não pode listar perfis', () => {
    const deps = createFakeDeps()
    assert.throws(() => createRoleService(deps).listRoles(ctxFor(deps, 'VIEWER')), { code: 'FORBIDDEN' })
  })

  it('atualiza permissões e audita valores antigo e novo', () => {
    const deps = createFakeDeps()
    const roles = createRoleService(deps)
    const viewer = deps.roleRepository.findByCode('VIEWER')

    const updated = roles.updateRolePermissions(ctxFor(deps, 'ADMIN'), viewer.id, ['tasks.view', 'tasks.view', 'kanban.view'])

    assert.deepEqual(updated.permissions, ['kanban.view', 'tasks.view'])
    const entry = deps.store.audit.at(-1)
    assert.equal(entry.action, 'role.permissions_updated')
    assert.deepEqual(entry.oldValue.permissions, DEFAULT_ROLE_PERMISSIONS.VIEWER.slice().sort())
    assert.deepEqual(entry.newValue.permissions, ['kanban.view', 'tasks.view'])
  })

  it('perfil inexistente retorna ROLE_NOT_FOUND', () => {
    const deps = createFakeDeps()
    assert.throws(() => createRoleService(deps).updateRolePermissions(ctxFor(deps, 'ADMIN'), 'nope', []), {
      code: 'ROLE_NOT_FOUND',
    })
  })

  it('cria perfil customizado com código normalizado e rejeita duplicado', () => {
    const deps = createFakeDeps()
    const roles = createRoleService(deps)
    const created = roles.createRole(ctxFor(deps, 'ADMIN'), { code: 'qa_lead', name: 'QA Lead' })
    assert.equal(created.code, 'QA_LEAD')
    assert.equal(created.is_system, false)
    assert.throws(() => roles.createRole(ctxFor(deps, 'ADMIN'), { code: 'QA_LEAD', name: 'Outro' }), {
      code: 'ROLE_CODE_IN_USE',
    })
  })

  it('não exclui perfil de sistema nem perfil em uso', () => {
    const deps = createFakeDeps()
    const roles = createRoleService(deps)
    const admin = ctxFor(deps, 'ADMIN')
    assert.throws(() => roles.deleteRole(admin, deps.roleRepository.findByCode('VIEWER').id), { code: 'ROLE_IMMUTABLE' })

    const custom = roles.createRole(admin, { code: 'TEMP', name: 'Temp' })
    seedUser(deps, { roleId: custom.id })
    assert.throws(() => roles.deleteRole(admin, custom.id), { code: 'ROLE_IN_USE' })
  })
})

describe('application/users', () => {
  const validInput = (deps, overrides) =>
    Object.assign(
      {
        name: 'Carlos',
        email: 'Carlos@Example.com',
        password: 'senhaForte123',
        role_id: deps.roleRepository.findByCode('MEMBER').id,
      },
      overrides,
    )

  it('cria usuário com e-mail normalizado, status ativo e auditoria sem senha', () => {
    const deps = createFakeDeps()
    const users = createUserService(deps)
    const created = users.createUser(ctxFor(deps, 'ADMIN'), validInput(deps))
    assert.equal(created.email, 'carlos@example.com')
    assert.equal(created.status, 'active')
    assert.equal('password' in created, false)
    const entry = deps.store.audit.at(-1)
    assert.equal(entry.action, 'user.created')
    assert.equal(JSON.stringify(entry).includes('senhaForte123'), false)
  })

  it('exige users.create', () => {
    const deps = createFakeDeps()
    assert.throws(() => createUserService(deps).createUser(ctxFor(deps, 'MANAGER'), validInput(deps)), { code: 'FORBIDDEN' })
  })

  it('rejeita senha fraca e e-mail duplicado', () => {
    const deps = createFakeDeps()
    const users = createUserService(deps)
    const admin = ctxFor(deps, 'ADMIN')
    assert.throws(() => users.createUser(admin, validInput(deps, { password: 'fraca' })), (err) => {
      return err.code === 'VALIDATION_ERROR' && err.details.fields.password === 'too_short'
    })
    users.createUser(admin, validInput(deps))
    assert.throws(() => users.createUser(admin, validInput(deps, { email: 'carlos@example.com' })), {
      code: 'EMAIL_ALREADY_IN_USE',
    })
  })

  it('perfil inválido e escalonamento são bloqueados', () => {
    const deps = createFakeDeps()
    const users = createUserService(deps)
    assert.throws(() => users.createUser(ctxFor(deps, 'ADMIN'), validInput(deps, { role_id: 'nope' })), {
      code: 'ROLE_NOT_FOUND',
    })
    const superRole = deps.roleRepository.findByCode('SUPER_ADMIN')
    assert.throws(() => users.createUser(ctxFor(deps, 'ADMIN'), validInput(deps, { role_id: superRole.id })), {
      code: 'PRIVILEGE_ESCALATION',
    })
  })

  it('lista com paginação e exige users.view', () => {
    const deps = createFakeDeps()
    const users = createUserService(deps)
    for (let i = 0; i < 25; i++) seedUser(deps)
    const page = users.listUsers(ctxFor(deps, 'MANAGER'), { page: '2', perPage: '10' })
    assert.equal(page.items.length, 10)
    assert.deepEqual(page.meta, { page: 2, perPage: 10, total: 25, totalPages: 3 })
    assert.throws(() => users.listUsers(ctxFor(deps, 'MEMBER'), {}), { code: 'FORBIDDEN' })
  })

  it('desativar usuário revoga todas as sessões dele', () => {
    const deps = createFakeDeps()
    const users = createUserService(deps)
    const target = seedUser(deps)
    deps.sessionRepository.create({
      userId: target.id,
      tokenHash: 'h',
      remember: false,
      expiresAt: new Date('2030-01-01'),
      lastSeenAt: new Date(),
    })
    const updated = users.changeUserStatus(ctxFor(deps, 'ADMIN'), target.id, 'disabled')
    assert.equal(updated.status, 'disabled')
    assert.ok(deps.store.sessions[0].revokedAt)
    assert.equal(deps.store.audit.at(-1).action, 'user.disabled')
  })

  it('atualiza dados e audita somente campos alterados', () => {
    const deps = createFakeDeps()
    const users = createUserService(deps)
    const target = seedUser(deps, { name: 'Maria' })
    const updated = users.updateUser(ctxFor(deps, 'ADMIN'), target.id, { name: 'Maria Silva', locale: 'es' })
    assert.equal(updated.name, 'Maria Silva')
    const entry = deps.store.audit.at(-1)
    assert.deepEqual(entry.oldValue, { name: 'Maria', locale: 'pt-BR' })
    assert.deepEqual(entry.newValue, { name: 'Maria Silva', locale: 'es' })
  })

  it('usuário comum edita o próprio nome, mas não o próprio perfil de acesso', () => {
    const deps = createFakeDeps()
    const users = createUserService(deps)
    const me = seedUser(deps, { roleCode: 'MEMBER' })
    const ctx = ctxFor(deps, 'MEMBER', me.id)
    assert.equal(users.updateUser(ctx, me.id, { name: 'Novo' }).name, 'Novo')
    assert.throws(() => users.updateUser(ctx, me.id, { role_id: deps.roleRepository.findByCode('ADMIN').id }), {
      code: 'FORBIDDEN',
    })
  })

  it('usuário inexistente retorna USER_NOT_FOUND', () => {
    const deps = createFakeDeps()
    assert.throws(() => createUserService(deps).getUser(ctxFor(deps, 'ADMIN'), 'nope'), { code: 'USER_NOT_FOUND' })
  })
})
