/**
 * Casos de uso dos tokens de API pessoais (regras de negócio §17). O token é o "crachá" de quem o
 * criou para chamar a API sem o navegador: as permissões são as do perfil da pessoa no momento de cada
 * chamada, e ele para de valer se a pessoa for desativada, se vencer ou se for revogado.
 *
 * Porta: `apiTokenRepository` { create, findById, findByHash, listByUser, listAll, countActiveByUser,
 * touch(id, at, ip), revoke(id, at) }.
 */

const { appError } = require('../core/errors')
const rbac = require('../domain/rbac')
const userDomain = require('../domain/user')
const tokenDomain = require('../domain/api-token')
const { buildAuditEntry } = require('./audit')
const { iso, toUserSummary } = require('./presenters')

const CREATE_PERMISSION = 'api_tokens.create'
const MANAGE_PERMISSION = 'integrations.manage'

/** Operações que só valem no navegador (sessão), nunca com um token de API. */
function assertBrowserSession(ctx) {
  if (ctx && ctx.authMethod === 'token') throw appError('TOKEN_NOT_ALLOWED')
}

function createApiTokenService(deps) {
  function present(token, user) {
    return {
      id: token.id,
      name: token.name,
      prefix: token.prefix,
      state: tokenDomain.tokenState(token, deps.clock.now()),
      created_at: iso(token.createdAt),
      expires_at: iso(token.expiresAt),
      last_used_at: iso(token.lastUsedAt),
      last_used_ip: token.lastUsedIp || null,
      revoked_at: iso(token.revokedAt),
      user: user ? toUserSummary(user) : undefined,
    }
  }

  function create(ctx, raw) {
    assertBrowserSession(ctx)
    rbac.assertCan(ctx.principal, CREATE_PERMISSION)
    const input = tokenDomain.tokenInput(raw)
    if (Object.keys(input.fields).length > 0) throw appError('VALIDATION_ERROR', undefined, { fields: input.fields })
    if (deps.apiTokenRepository.countActiveByUser(ctx.principal.userId, deps.clock.now()) >= tokenDomain.MAX_PER_USER) throw appError('API_TOKEN_LIMIT')
    const value = tokenDomain.tokenValue(deps.tokens.generate().replace(/[^A-Za-z0-9]/g, '').slice(0, tokenDomain.RANDOM_LENGTH))
    const now = deps.clock.now()
    const created = deps.unitOfWork.run((repos) => {
      const token = repos.apiTokenRepository.create({
        userId: ctx.principal.userId,
        name: input.values.name,
        tokenHash: deps.tokens.hash(value),
        prefix: tokenDomain.displayPrefix(value),
        expiresAt: tokenDomain.expiresAt(input.values.expiresInDays, now),
        createdAt: now,
      })
      repos.auditRepository.record(
        buildAuditEntry(ctx, { entityType: 'api_token', entityId: token.id, action: 'api_token.created', newValue: { name: token.name, prefix: token.prefix, expires_at: iso(token.expiresAt) } }),
      )
      return token
    })
    // o valor do token só existe nesta resposta
    return Object.assign({ token: value }, present(created))
  }

  function listMine(ctx) {
    rbac.assertAuthenticated(ctx.principal)
    return deps.apiTokenRepository.listByUser(ctx.principal.userId).map((t) => present(t))
  }

  function listAll(ctx) {
    rbac.assertCan(ctx.principal, MANAGE_PERMISSION)
    const tokens = deps.apiTokenRepository.listAll()
    const users = {}
    deps.userRepository.findManyByIds(Array.from(new Set(tokens.map((t) => t.userId)))).forEach((u) => {
      users[u.id] = u
    })
    return tokens.map((t) => present(t, users[t.userId] || null))
  }

  /** A própria pessoa ou quem gerencia integrações; de outra pessoa sem permissão = inexistente. */
  function revoke(ctx, id) {
    assertBrowserSession(ctx)
    rbac.assertAuthenticated(ctx.principal)
    const token = id ? deps.apiTokenRepository.findById(id) : null
    const allowed = token && (token.userId === ctx.principal.userId || rbac.can(ctx.principal, MANAGE_PERMISSION))
    if (!allowed) throw appError('API_TOKEN_NOT_FOUND')
    if (token.revokedAt) return present(token)
    const revoked = deps.unitOfWork.run((repos) => {
      const updated = repos.apiTokenRepository.revoke(token.id, deps.clock.now())
      repos.auditRepository.record(
        buildAuditEntry(ctx, { entityType: 'api_token', entityId: token.id, action: 'api_token.revoked', oldValue: { name: token.name, prefix: token.prefix, user_id: token.userId } }),
      )
      return updated
    })
    return present(revoked)
  }

  /**
   * Resolve o valor do header `Authorization: Bearer` num principal. Nunca lança erro.
   * Retorna { principal, token } ou { principal: null, reason }.
   */
  function authenticate(value, ip) {
    if (!tokenDomain.looksLikeToken(value)) return { principal: null, reason: 'invalid' }
    const token = deps.apiTokenRepository.findByHash(deps.tokens.hash(value))
    if (!token) return { principal: null, reason: 'invalid' }
    const now = deps.clock.now()
    const state = tokenDomain.tokenState(token, now)
    if (state !== 'active') return { principal: null, reason: state }
    const user = deps.userRepository.findById(token.userId)
    if (!user || user.status !== userDomain.USER_STATUS.ACTIVE) return { principal: null, reason: 'user_inactive' }
    const role = user.roleId ? deps.roleRepository.findById(user.roleId) : null
    if (tokenDomain.shouldTouch(token.lastUsedAt, now)) deps.apiTokenRepository.touch(token.id, now, ip || '')
    const principal = rbac.createPrincipal({
      userId: user.id,
      roleId: role ? role.id : null,
      roleCode: role ? role.code : null,
      permissions: role ? deps.roleRepository.getPermissionCodes(role.id) : [],
      sessionId: null,
    })
    return { principal, token }
  }

  return { create, listMine, listAll, revoke, authenticate }
}

module.exports = { createApiTokenService, assertBrowserSession }
