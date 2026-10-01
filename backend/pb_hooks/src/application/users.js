/**
 * Casos de uso de usuários.
 */

const { appError } = require('../core/errors')
const { assertValid, rules } = require('../core/validation')
const { parsePagination, parseSort, buildPageMeta } = require('../core/pagination')
const rbac = require('../domain/rbac')
const userDomain = require('../domain/user')
const { buildAuditEntry, diff } = require('./audit')
const { toUserDto } = require('./presenters')

const password = rules.custom((value) => userDomain.passwordIssue(value))

const CREATE_SCHEMA = {
  name: [rules.required(), rules.maxLength(120)],
  email: [rules.required(), rules.email()],
  password: [rules.required(), password],
  role_id: [rules.required(), rules.maxLength(40)],
  locale: [rules.oneOf(userDomain.LOCALES)],
}

const UPDATE_SCHEMA = {
  name: [rules.required(), rules.maxLength(120)],
  email: [rules.required(), rules.email()],
  role_id: [rules.required(), rules.maxLength(40)],
  locale: [rules.oneOf(userDomain.LOCALES)],
  theme: [rules.oneOf(userDomain.THEMES)],
}

const LIST_SCHEMA = {
  search: [rules.maxLength(100)],
  status: [rules.oneOf([userDomain.USER_STATUS.ACTIVE, userDomain.USER_STATUS.DISABLED])],
  role_id: [rules.maxLength(40)],
}

/** Campos públicos ordenáveis -> campo da entidade/coluna. */
const SORTABLE = { name: 'name', email: 'email', status: 'status', created_at: 'created', last_login_at: 'last_login_at' }

/** Mapeamento entidade (camelCase) -> nome público (auditoria/API). */
const PUBLIC_KEYS = { name: 'name', email: 'email', roleId: 'role_id', locale: 'locale', theme: 'theme', status: 'status' }

function toPublic(obj) {
  const out = {}
  Object.keys(obj).forEach((key) => {
    out[PUBLIC_KEYS[key] || key] = obj[key]
  })
  return out
}

/** A API usa snake_case; internamente a entidade usa camelCase. */
function fromPublic(data) {
  const out = Object.assign({}, data)
  if (out.role_id !== undefined) {
    out.roleId = out.role_id
    delete out.role_id
  }
  return out
}

function createUserService(deps) {
  function findUserOrFail(id) {
    const user = id ? deps.userRepository.findById(id) : null
    if (!user) throw appError('USER_NOT_FOUND')
    return user
  }

  function roleCodeOf(user) {
    const role = user.roleId ? deps.roleRepository.findById(user.roleId) : null
    return role ? role.code : null
  }

  function findAssignableRole(principal, roleId) {
    const role = deps.roleRepository.findById(roleId)
    if (!role) throw appError('ROLE_NOT_FOUND')
    rbac.assertCanAssignRole(principal, role, deps.roleRepository.getPermissionCodes(role.id))
    return role
  }

  function listUsers(ctx, query) {
    rbac.assertCan(ctx.principal, 'users.view')
    const q = query || {}
    const filters = assertValid(
      { search: q.search || undefined, status: q.status || undefined, role_id: q.role_id || undefined },
      LIST_SCHEMA,
    )
    const pagination = parsePagination(q)
    const result = deps.userRepository.list({
      search: filters.search,
      status: filters.status,
      roleId: filters.role_id,
      sort: parseSort(q.sort, SORTABLE, 'name'),
      pagination,
    })
    return { items: result.items.map(toUserDto), meta: buildPageMeta(pagination, result.total) }
  }

  function getUser(ctx, id) {
    rbac.assertAuthenticated(ctx.principal)
    if (id !== ctx.principal.userId) rbac.assertCan(ctx.principal, 'users.view')
    return toUserDto(findUserOrFail(id))
  }

  function createUser(ctx, input) {
    rbac.assertCan(ctx.principal, 'users.create')
    const data = fromPublic(assertValid(input, CREATE_SCHEMA))
    const role = findAssignableRole(ctx.principal, data.roleId)
    const email = userDomain.normalizeEmail(data.email)
    if (deps.userRepository.emailExists(email)) throw appError('EMAIL_ALREADY_IN_USE')

    const user = deps.unitOfWork.run((repos) => {
      const created = repos.userRepository.create({
        name: data.name,
        email,
        password: data.password,
        roleId: role.id,
        status: userDomain.USER_STATUS.ACTIVE,
        locale: data.locale || 'pt-BR',
        theme: 'system',
      })
      repos.auditRepository.record(
        buildAuditEntry(ctx, {
          entityType: 'user',
          entityId: created.id,
          action: 'user.created',
          newValue: { name: created.name, email: created.email, role_id: role.id, status: created.status },
        }),
      )
      return created
    })
    return toUserDto(user)
  }

  function updateUser(ctx, id, input) {
    rbac.assertAuthenticated(ctx.principal)
    const target = findUserOrFail(id)
    userDomain.assertCanEdit(ctx.principal, { id: target.id, roleCode: roleCodeOf(target) })

    // Valida só os campos enviados (atualização parcial).
    const source = input || {}
    const schema = {}
    Object.keys(UPDATE_SCHEMA).forEach((key) => {
      if (source[key] !== undefined) schema[key] = UPDATE_SCHEMA[key]
    })
    const data = fromPublic(assertValid(source, schema))
    if (data.email !== undefined) data.email = userDomain.normalizeEmail(data.email)

    const isSelf = target.id === ctx.principal.userId
    const changingAccess =
      (data.roleId !== undefined && data.roleId !== target.roleId) ||
      (data.email !== undefined && data.email !== target.email)
    if (changingAccess) {
      // Perfil e e-mail são dados de acesso: exigem users.edit e não podem ser alterados pelo próprio usuário.
      if (isSelf && !rbac.isSuperAdmin(ctx.principal)) throw appError('FORBIDDEN')
      rbac.assertCan(ctx.principal, 'users.edit')
    }
    if (data.roleId !== undefined && data.roleId !== target.roleId) findAssignableRole(ctx.principal, data.roleId)
    if (data.email !== undefined && data.email !== target.email && deps.userRepository.emailExists(data.email, target.id)) {
      throw appError('EMAIL_ALREADY_IN_USE')
    }

    const changes = diff(target, data, ['name', 'email', 'roleId', 'locale', 'theme'])
    if (!changes) return toUserDto(target)

    const updated = deps.unitOfWork.run((repos) => {
      const saved = repos.userRepository.update(target.id, changes.newValue)
      repos.auditRepository.record(
        buildAuditEntry(ctx, {
          entityType: 'user',
          entityId: target.id,
          action: 'user.updated',
          oldValue: toPublic(changes.oldValue),
          newValue: toPublic(changes.newValue),
        }),
      )
      return saved
    })
    return toUserDto(updated)
  }

  function changeUserStatus(ctx, id, status) {
    rbac.assertAuthenticated(ctx.principal)
    const data = assertValid({ status }, { status: [rules.required(), LIST_SCHEMA.status[0]] })
    const target = findUserOrFail(id)
    userDomain.assertCanChangeStatus(ctx.principal, { id: target.id, roleCode: roleCodeOf(target) }, data.status)
    if (target.status === data.status) return toUserDto(target)

    const updated = deps.unitOfWork.run((repos) => {
      const saved = repos.userRepository.update(target.id, { status: data.status })
      if (data.status === userDomain.USER_STATUS.DISABLED) {
        repos.sessionRepository.revokeAllForUser(target.id, deps.clock.now())
      }
      repos.auditRepository.record(
        buildAuditEntry(ctx, {
          entityType: 'user',
          entityId: target.id,
          action: data.status === userDomain.USER_STATUS.DISABLED ? 'user.disabled' : 'user.enabled',
          oldValue: { status: target.status },
          newValue: { status: data.status },
        }),
      )
      return saved
    })
    return toUserDto(updated)
  }

  /**
   * Redefinição de senha por quem tem users.edit. Para a própria conta, usar a troca de senha
   * (que exige a senha atual). Encerra todas as sessões do usuário.
   */
  function resetPassword(ctx, id, input) {
    rbac.assertCan(ctx.principal, 'users.edit')
    const target = findUserOrFail(id)
    if (target.id === ctx.principal.userId) throw appError('USE_CHANGE_PASSWORD')
    userDomain.assertCanEdit(ctx.principal, { id: target.id, roleCode: roleCodeOf(target) })
    const data = assertValid(input, { password: [rules.required(), password] })

    deps.unitOfWork.run((repos) => {
      repos.userRepository.update(target.id, { password: data.password })
      const count = repos.sessionRepository.revokeAllForUser(target.id, deps.clock.now())
      repos.auditRepository.record(
        buildAuditEntry(ctx, {
          entityType: 'user',
          entityId: target.id,
          action: 'user.password_reset',
          newValue: { sessions_revoked: count },
        }),
      )
    })
    return { reset: true }
  }

  return { listUsers, getUser, createUser, updateUser, changeUserStatus, resetPassword }
}

module.exports = { createUserService }
