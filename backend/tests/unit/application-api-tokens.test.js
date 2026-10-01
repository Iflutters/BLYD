const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createApiTokenService } = require('../../pb_hooks/src/application/api-tokens')
const { createAuthService } = require('../../pb_hooks/src/application/auth')
const rbac = require('../../pb_hooks/src/domain/rbac')

function setup() {
  const deps = createFakeDeps({ start: '2026-10-01T12:00:00.000Z' })
  const admin = seedUser(deps, { email: 'admin@example.com', name: 'Admin', roleCode: 'ADMIN' })
  const gestor = seedUser(deps, { email: 'gestor@example.com', name: 'Gil', roleCode: 'MANAGER' })
  const membro = seedUser(deps, { email: 'membro@example.com', name: 'Mia', roleCode: 'MEMBER' })
  const ctxOf = (user, authMethod) => {
    const role = deps.roleRepository.findById(user.roleId)
    return {
      principal: rbac.createPrincipal({ userId: user.id, roleId: role.id, roleCode: role.code, permissions: deps.roleRepository.getPermissionCodes(role.id), sessionId: authMethod === 'token' ? null : 's1' }),
      authMethod: authMethod || 'session',
      ip: '10.0.0.1',
      userAgent: 'test',
      correlationId: 'c1',
    }
  }
  return { deps, admin, gestor, membro, ctxOf, tokens: createApiTokenService(deps) }
}

const codeOf = (fn) => {
  try {
    fn()
  } catch (err) {
    return err.code
  }
  return 'OK'
}

describe('application/api-tokens', () => {
  it('criar: precisa de api_tokens.create; o valor aparece uma vez; só o hash fica guardado; histórico', () => {
    const { deps, gestor, membro, ctxOf, tokens } = setup()
    assert.equal(codeOf(() => tokens.create(ctxOf(membro), { name: 'BI', expires_in_days: 30 })), 'FORBIDDEN')
    const created = tokens.create(ctxOf(gestor), { name: 'Integração BI', expires_in_days: 90 })
    assert.match(created.token, /^kb_pat_[A-Za-z0-9]{40}$/)
    assert.equal(created.name, 'Integração BI')
    assert.equal(created.prefix, created.token.slice(0, 11))
    assert.equal(created.expires_at, '2026-12-30T12:00:00.000Z')
    assert.equal(created.state, 'active')
    const stored = deps.store.apiTokens[0]
    // nenhum campo guarda o token em claro (o fake de hash é "hash(valor)")
    assert.equal(Object.values(stored).includes(created.token), false)
    assert.equal(stored.tokenHash, deps.tokens.hash(created.token))
    const entry = deps.store.audit.at(-1)
    assert.equal(entry.action, 'api_token.created')
    assert.equal(JSON.stringify(entry).includes(created.token), false)
    // a lista nunca traz o valor
    const mine = tokens.listMine(ctxOf(gestor))
    assert.equal(mine.length, 1)
    assert.equal('token' in mine[0], false)
  })

  it('autenticar: age como a pessoa (permissões do perfil atual); vencido, revogado ou pessoa desativada não entra', () => {
    const { deps, gestor, ctxOf, tokens } = setup()
    const { token } = tokens.create(ctxOf(gestor), { name: 'BI', expires_in_days: 30 })
    const auth = tokens.authenticate(token, '10.0.0.7')
    assert.equal(auth.principal.userId, gestor.id)
    assert.equal(auth.principal.roleCode, 'MANAGER')
    assert.ok(auth.principal.permissions.includes('projects.view'))
    assert.equal(deps.store.apiTokens[0].lastUsedIp, '10.0.0.7')
    assert.equal(tokens.authenticate('kb_pat_' + 'x'.repeat(40), 'ip').principal, null)
    assert.equal(tokens.authenticate('não é token', 'ip').principal, null)

    deps.clock.advanceMinutes(30 * 24 * 60 + 1)
    assert.equal(tokens.authenticate(token, 'ip').reason, 'expired')

    const second = tokens.create(ctxOf(gestor), { name: 'Sem prazo', expires_in_days: 0 }).token
    assert.ok(tokens.authenticate(second, 'ip').principal)
    deps.userRepository.update(gestor.id, { status: 'disabled' })
    assert.equal(tokens.authenticate(second, 'ip').principal, null)
  })

  it('"último uso" é gravado no máximo a cada 5 minutos', () => {
    const { deps, gestor, ctxOf, tokens } = setup()
    const { token } = tokens.create(ctxOf(gestor), { name: 'BI', expires_in_days: 30 })
    tokens.authenticate(token, 'a')
    deps.clock.advanceMinutes(2)
    tokens.authenticate(token, 'b')
    assert.equal(deps.store.apiTokens[0].lastUsedIp, 'a')
    deps.clock.advanceMinutes(4)
    tokens.authenticate(token, 'c')
    assert.equal(deps.store.apiTokens[0].lastUsedIp, 'c')
  })

  it('revogar: a própria pessoa ou integrations.manage; de outra pessoa sem permissão responde como inexistente', () => {
    const { gestor, admin, ctxOf, tokens, deps } = setup()
    const mine = tokens.create(ctxOf(gestor), { name: 'BI', expires_in_days: 30 })
    const other = tokens.create(ctxOf(admin), { name: 'Admin', expires_in_days: 30 })
    assert.equal(codeOf(() => tokens.revoke(ctxOf(gestor), other.id)), 'API_TOKEN_NOT_FOUND')
    assert.deepEqual(tokens.revoke(ctxOf(gestor), mine.id).state, 'revoked')
    assert.equal(tokens.authenticate(mine.token, 'ip').reason, 'revoked')
    assert.equal(deps.store.audit.at(-1).action, 'api_token.revoked')
    // Admin vê e revoga de todos
    assert.equal(codeOf(() => tokens.listAll(ctxOf(gestor))), 'FORBIDDEN')
    const all = tokens.listAll(ctxOf(admin))
    assert.deepEqual(all.map((t) => t.user.name).sort(), ['Admin', 'Gil'])
    assert.equal(tokens.revoke(ctxOf(admin), other.id).state, 'revoked')
  })

  it('com o próprio token não dá para criar/revogar tokens nem trocar senha ou sessões', () => {
    const { deps, gestor, ctxOf, tokens } = setup()
    const created = tokens.create(ctxOf(gestor), { name: 'BI', expires_in_days: 30 })
    const viaToken = ctxOf(gestor, 'token')
    assert.equal(codeOf(() => tokens.create(viaToken, { name: 'Outro', expires_in_days: 30 })), 'TOKEN_NOT_ALLOWED')
    assert.equal(codeOf(() => tokens.revoke(viaToken, created.id)), 'TOKEN_NOT_ALLOWED')
    const auth = createAuthService(deps)
    assert.equal(codeOf(() => auth.changePassword(viaToken, { current_password: 'senhaForte123', new_password: 'OutraSenha1234' })), 'TOKEN_NOT_ALLOWED')
    assert.equal(codeOf(() => auth.revokeOtherSessions(viaToken)), 'TOKEN_NOT_ALLOWED')
    assert.equal(codeOf(() => auth.logout(viaToken)), 'TOKEN_NOT_ALLOWED')
    // ler os próprios dados continua valendo
    assert.equal(auth.getMe(viaToken).user.id, gestor.id)
  })

  it('no máximo 20 tokens ativos por pessoa', () => {
    const { gestor, ctxOf, tokens } = setup()
    for (let i = 0; i < 20; i++) tokens.create(ctxOf(gestor), { name: `T${i}`, expires_in_days: 30 })
    assert.equal(codeOf(() => tokens.create(ctxOf(gestor), { name: 'Demais', expires_in_days: 30 })), 'API_TOKEN_LIMIT')
  })
})
