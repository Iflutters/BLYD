const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createAuthService } = require('../../pb_hooks/src/application/auth')
const { createUserService } = require('../../pb_hooks/src/application/users')
const { createAuditService } = require('../../pb_hooks/src/application/audit-logs')
const { createPrincipal } = require('../../pb_hooks/src/domain/rbac')

const baseCtx = { ip: '10.0.0.1', userAgent: 'ua', correlationId: 'c' }

function loggedIn(deps, email, password) {
  const auth = createAuthService(deps)
  const { token } = auth.login({ email, password }, baseCtx)
  const { principal, session } = auth.authenticate(token)
  return { auth, token, ctx: Object.assign({ principal, session }, baseCtx) }
}

function ctxFor(deps, roleCode, userId) {
  const role = deps.roleRepository.findByCode(roleCode)
  return Object.assign(
    {
      principal: createPrincipal({
        userId: userId || 'actor',
        roleId: role.id,
        roleCode,
        permissions: deps.roleRepository.getPermissionCodes(role.id),
      }),
    },
    baseCtx,
  )
}

describe('application/auth — troca da própria senha', () => {
  it('exige a senha atual correta', () => {
    const deps = createFakeDeps()
    seedUser(deps, { email: 'ana@x.com', password: 'senhaAntiga123' })
    const { auth, ctx } = loggedIn(deps, 'ana@x.com', 'senhaAntiga123')
    assert.throws(
      () => auth.changePassword(ctx, { current_password: 'errada12345', new_password: 'senhaNova12345' }),
      (err) => err.code === 'VALIDATION_ERROR' && err.details.fields.current_password === 'incorrect',
    )
  })

  it('valida a política e rejeita senha igual à atual', () => {
    const deps = createFakeDeps()
    seedUser(deps, { email: 'ana@x.com', password: 'senhaAntiga123' })
    const { auth, ctx } = loggedIn(deps, 'ana@x.com', 'senhaAntiga123')
    assert.throws(
      () => auth.changePassword(ctx, { current_password: 'senhaAntiga123', new_password: 'curta' }),
      (err) => err.details.fields.new_password === 'too_short',
    )
    assert.throws(
      () => auth.changePassword(ctx, { current_password: 'senhaAntiga123', new_password: 'senhaAntiga123' }),
      (err) => err.details.fields.new_password === 'same_as_current',
    )
  })

  it('troca a senha, mantém a sessão atual, encerra as outras e audita', () => {
    const deps = createFakeDeps()
    const user = seedUser(deps, { email: 'ana@x.com', password: 'senhaAntiga123' })
    const other = loggedIn(deps, 'ana@x.com', 'senhaAntiga123')
    const { auth, token, ctx } = loggedIn(deps, 'ana@x.com', 'senhaAntiga123')

    const result = auth.changePassword(ctx, { current_password: 'senhaAntiga123', new_password: 'senhaNova12345' })

    assert.equal(result.other_sessions_revoked, 1)
    assert.equal(deps.userRepository.verifyPassword(user.id, 'senhaNova12345'), true)
    assert.equal(auth.authenticate(token).reason, null)
    assert.equal(auth.authenticate(other.token).reason, 'revoked')
    const entry = deps.store.audit.at(-1)
    assert.equal(entry.action, 'auth.password_changed')
    assert.equal(JSON.stringify(entry).includes('senhaNova12345'), false)
  })
})

describe('application/users — redefinição de senha pelo administrador', () => {
  it('exige users.edit', () => {
    const deps = createFakeDeps()
    const target = seedUser(deps)
    assert.throws(() => createUserService(deps).resetPassword(ctxFor(deps, 'MANAGER'), target.id, { password: 'senhaNova12345' }), {
      code: 'FORBIDDEN',
    })
  })

  it('não redefine a própria senha por esta rota nem a de um SUPER_ADMIN (sem ser SUPER_ADMIN)', () => {
    const deps = createFakeDeps()
    const users = createUserService(deps)
    const me = seedUser(deps, { roleCode: 'ADMIN' })
    const root = seedUser(deps, { roleCode: 'SUPER_ADMIN' })
    assert.throws(() => users.resetPassword(ctxFor(deps, 'ADMIN', me.id), me.id, { password: 'senhaNova12345' }), {
      code: 'USE_CHANGE_PASSWORD',
    })
    assert.throws(() => users.resetPassword(ctxFor(deps, 'ADMIN', me.id), root.id, { password: 'senhaNova12345' }), {
      code: 'FORBIDDEN',
    })
  })

  it('redefine, encerra todas as sessões do usuário e audita sem a senha', () => {
    const deps = createFakeDeps()
    const target = seedUser(deps, { email: 'alvo@x.com', password: 'senhaAntiga123' })
    const session = loggedIn(deps, 'alvo@x.com', 'senhaAntiga123')
    createUserService(deps).resetPassword(ctxFor(deps, 'ADMIN'), target.id, { password: 'senhaNova12345' })

    assert.equal(deps.userRepository.verifyPassword(target.id, 'senhaNova12345'), true)
    assert.equal(session.auth.authenticate(session.token).reason, 'revoked')
    const entry = deps.store.audit.at(-1)
    assert.equal(entry.action, 'user.password_reset')
    assert.equal(JSON.stringify(entry).includes('senhaNova12345'), false)
  })
})

describe('application/audit-logs', () => {
  function seedAudit(deps) {
    const admin = seedUser(deps, { name: 'Admin', roleCode: 'ADMIN' })
    const users = createUserService(deps)
    const ctx = ctxFor(deps, 'ADMIN', admin.id)
    const created = users.createUser(ctx, {
      name: 'Carlos',
      email: 'carlos@x.com',
      password: 'senhaForte123',
      role_id: deps.roleRepository.findByCode('MEMBER').id,
    })
    users.updateUser(ctx, created.id, { name: 'Carlos Silva' })
    return { admin, created }
  }

  it('exige audit.view', () => {
    const deps = createFakeDeps()
    assert.throws(() => createAuditService(deps).listAuditLogs(ctxFor(deps, 'MANAGER'), {}), { code: 'FORBIDDEN' })
  })

  it('lista do mais recente para o mais antigo, com autor e paginação', () => {
    const deps = createFakeDeps()
    const { admin, created } = seedAudit(deps)
    const page = createAuditService(deps).listAuditLogs(ctxFor(deps, 'ADMIN'), { perPage: '1' })
    assert.equal(page.meta.total, 2)
    assert.equal(page.items.length, 1)
    assert.equal(page.items[0].action, 'user.updated')
    assert.equal(page.items[0].entity_id, created.id)
    assert.deepEqual(page.items[0].user, { id: admin.id, name: 'Admin', email: admin.email })
    assert.deepEqual(page.items[0].new_value, { name: 'Carlos Silva' })
    assert.ok(page.items[0].created_at)
  })

  it('filtra por entidade e ação e valida datas', () => {
    const deps = createFakeDeps()
    const { created } = seedAudit(deps)
    const audit = createAuditService(deps)
    const ctx = ctxFor(deps, 'ADMIN')
    const page = audit.listAuditLogs(ctx, { entity_type: 'user', entity_id: created.id, action: 'user.created' })
    assert.equal(page.items.length, 1)
    assert.throws(() => audit.listAuditLogs(ctx, { from: 'ontem' }), (err) => err.details.fields.from === 'invalid_date')
  })

  it('quem vê usuários pode consultar o histórico de um usuário específico', () => {
    const deps = createFakeDeps()
    const { created } = seedAudit(deps)
    const audit = createAuditService(deps)
    const page = audit.listEntityHistory(ctxFor(deps, 'MANAGER'), 'user', created.id)
    assert.equal(page.items.length, 2)
    assert.throws(() => audit.listEntityHistory(ctxFor(deps, 'MEMBER'), 'user', created.id), { code: 'FORBIDDEN' })
    assert.throws(() => audit.listEntityHistory(ctxFor(deps, 'ADMIN'), 'user', 'nope'), { code: 'USER_NOT_FOUND' })
  })
})
