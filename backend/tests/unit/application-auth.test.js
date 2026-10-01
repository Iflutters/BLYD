const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createAuthService } = require('../../pb_hooks/src/application/auth')

const ctx = { ip: '10.0.0.1', userAgent: 'test-agent', correlationId: 'corr-1' }

function setup() {
  const deps = createFakeDeps()
  const auth = createAuthService(deps)
  const user = seedUser(deps, { email: 'ana@example.com', password: 'senhaForte123', roleCode: 'MEMBER' })
  return { deps, auth, user }
}

describe('application/auth — login', () => {
  it('valida o formato de entrada', () => {
    const { auth } = setup()
    assert.throws(() => auth.login({ email: 'x', password: '' }, ctx), (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR')
      assert.deepEqual(err.details.fields, { email: 'invalid_email', password: 'required' })
      return true
    })
  })

  it('usuário inexistente recebe erro genérico', () => {
    const { auth } = setup()
    assert.throws(() => auth.login({ email: 'ninguem@example.com', password: 'qualquer123' }, ctx), {
      code: 'INVALID_CREDENTIALS',
    })
  })

  it('senha errada recebe erro genérico e gera auditoria de falha', () => {
    const { auth, deps, user } = setup()
    assert.throws(() => auth.login({ email: 'ana@example.com', password: 'errada12345' }, ctx), {
      code: 'INVALID_CREDENTIALS',
    })
    const entry = deps.store.audit.at(-1)
    assert.equal(entry.action, 'auth.login_failed')
    assert.equal(entry.entityId, user.id)
    assert.equal(JSON.stringify(entry).includes('errada12345'), false, 'senha não pode ir para a auditoria')
  })

  it('usuário desativado não entra, mesmo com a senha correta', () => {
    const { auth, deps, user } = setup()
    deps.userRepository.update(user.id, { status: 'disabled' })
    assert.throws(() => auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx), {
      code: 'ACCOUNT_DISABLED',
    })
    assert.equal(deps.store.sessions.length, 0)
  })

  it('login com sucesso cria sessão com token apenas como hash', () => {
    const { auth, deps, user } = setup()
    const result = auth.login({ email: '  ANA@example.com ', password: 'senhaForte123', remember: false }, ctx)

    assert.ok(result.token.length >= 40)
    assert.equal(result.user.id, user.id)
    const stored = deps.store.sessions[0]
    assert.equal(stored.tokenHash, deps.tokens.hash(result.token))
    assert.equal(JSON.stringify(stored).includes(result.token + '"'), false)
    assert.equal(stored.ip, '10.0.0.1')
    assert.equal(stored.userAgent, 'test-agent')
    assert.equal(stored.expiresAt.toISOString(), '2026-01-11T00:00:00.000Z')
    assert.ok(deps.userRepository.findById(user.id).lastLoginAt)
    assert.equal(deps.store.audit.at(-1).action, 'auth.login')
  })

  it('"lembrar-me" gera sessão persistente de 30 dias', () => {
    const { auth, deps } = setup()
    const result = auth.login({ email: 'ana@example.com', password: 'senhaForte123', remember: true }, ctx)
    assert.equal(result.session.remember, true)
    assert.equal(deps.store.sessions[0].expiresAt.toISOString(), '2026-02-09T12:00:00.000Z')
  })
})

describe('application/auth — authenticate', () => {
  it('sem token retorna principal nulo sem motivo', () => {
    const { auth } = setup()
    assert.deepEqual(auth.authenticate(''), { principal: null, session: null, reason: null })
  })

  it('token desconhecido é inválido', () => {
    const { auth } = setup()
    assert.equal(auth.authenticate('nao-existe').reason, 'invalid')
  })

  it('token válido carrega principal com permissões do perfil', () => {
    const { auth, user } = setup()
    const { token } = auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)
    const result = auth.authenticate(token)
    assert.equal(result.reason, null)
    assert.equal(result.principal.userId, user.id)
    assert.equal(result.principal.roleCode, 'MEMBER')
    assert.ok(result.principal.permissions.includes('tasks.create'))
    assert.equal(result.principal.sessionId, result.session.id)
  })

  it('registra uso (touch) após o intervalo e expira por inatividade', () => {
    const { auth, deps } = setup()
    const { token } = auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)

    deps.clock.advanceMinutes(10)
    auth.authenticate(token)
    assert.equal(deps.store.sessions[0].lastSeenAt.toISOString(), '2026-01-10T12:10:00.000Z')

    deps.clock.advanceMinutes(121)
    assert.equal(auth.authenticate(token).reason, 'idle')
  })

  it('sessão de usuário desativado é revogada', () => {
    const { auth, deps, user } = setup()
    const { token } = auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)
    deps.userRepository.update(user.id, { status: 'disabled' })
    assert.equal(auth.authenticate(token).reason, 'revoked')
    assert.ok(deps.store.sessions[0].revokedAt)
  })
})

describe('application/auth — logout e sessões', () => {
  it('logout revoga a sessão atual e audita', () => {
    const { auth, deps } = setup()
    const { token } = auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)
    const { principal } = auth.authenticate(token)
    auth.logout(Object.assign({ principal }, ctx))
    assert.equal(auth.authenticate(token).reason, 'revoked')
    assert.equal(deps.store.audit.at(-1).action, 'auth.logout')
  })

  it('lista apenas sessões ativas do próprio usuário e marca a atual', () => {
    const { auth, deps } = setup()
    seedUser(deps, { email: 'outro@example.com', password: 'senhaForte123' })
    const a = auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)
    auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)
    auth.login({ email: 'outro@example.com', password: 'senhaForte123' }, ctx)
    const { principal } = auth.authenticate(a.token)

    const sessions = auth.listMySessions(Object.assign({ principal }, ctx))
    assert.equal(sessions.length, 2)
    assert.equal(sessions.filter((s) => s.current).length, 1)
    assert.equal(sessions.some((s) => 'token_hash' in s || 'tokenHash' in s), false, 'hash do token não pode ser exposto')
  })

  it('não permite revogar sessão de outro usuário (IDOR)', () => {
    const { auth, deps } = setup()
    seedUser(deps, { email: 'outro@example.com', password: 'senhaForte123' })
    const mine = auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)
    const other = auth.login({ email: 'outro@example.com', password: 'senhaForte123' }, ctx)
    const { principal } = auth.authenticate(mine.token)

    assert.throws(() => auth.revokeMySession(Object.assign({ principal }, ctx), other.session.id), {
      code: 'SESSION_NOT_FOUND',
    })
    assert.equal(auth.authenticate(other.token).reason, null)
  })

  it('encerra todas as outras sessões, mantendo a atual, e audita', () => {
    const { auth, deps } = setup()
    seedUser(deps, { email: 'outro@example.com', password: 'senhaForte123' })
    const a = auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)
    const b = auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)
    const c = auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)
    const alheia = auth.login({ email: 'outro@example.com', password: 'senhaForte123' }, ctx)
    const { principal } = auth.authenticate(a.token)

    const result = auth.revokeOtherSessions(Object.assign({ principal }, ctx))

    assert.equal(result.revoked, 2)
    assert.equal(auth.authenticate(a.token).reason, null)
    assert.equal(auth.authenticate(b.token).reason, 'revoked')
    assert.equal(auth.authenticate(c.token).reason, 'revoked')
    assert.equal(auth.authenticate(alheia.token).reason, null, 'sessões de outros usuários não são afetadas')
    assert.equal(deps.store.audit.at(-1).action, 'auth.other_sessions_revoked')
  })

  it('me retorna usuário, perfil e permissões', () => {
    const { auth } = setup()
    const { token } = auth.login({ email: 'ana@example.com', password: 'senhaForte123' }, ctx)
    const { principal, session } = auth.authenticate(token)
    const me = auth.getMe(Object.assign({ principal, session }, ctx))
    assert.equal(me.user.email, 'ana@example.com')
    assert.equal(me.role.code, 'MEMBER')
    assert.ok(Array.isArray(me.permissions))
    assert.ok(me.session.expires_at)
  })
})
