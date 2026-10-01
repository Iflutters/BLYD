/**
 * Casos de uso de perfis (roles) e permissões.
 */

const { appError } = require('../core/errors')
const { assertValid, rules } = require('../core/validation')
const rbac = require('../domain/rbac')
const { ROLE_CODES } = require('../domain/permissions')
const { buildAuditEntry, diff } = require('./audit')
const { toRoleDto } = require('./presenters')

const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,31}$/
const MAX_PERMISSIONS = 500

const roleCode = rules.custom((value) => {
  if (typeof value !== 'string') return 'invalid_type'
  return ROLE_CODE_PATTERN.test(value.trim().toUpperCase()) ? null : 'invalid_format'
})

const CREATE_SCHEMA = {
  code: [rules.required(), roleCode],
  name: [rules.required(), rules.maxLength(60)],
  description: [rules.maxLength(255)],
  permissions: [rules.stringArray(MAX_PERMISSIONS)],
}

const UPDATE_SCHEMA = {
  name: [rules.required(), rules.maxLength(60)],
  description: [rules.maxLength(255)],
}

const READ_ROLES_PERMISSIONS = ['permissions.manage', 'users.view', 'users.create', 'users.edit']

function uniqueSorted(codes) {
  return codes.filter((code, index) => codes.indexOf(code) === index).sort()
}

function createRoleService(deps) {
  function findRoleOrFail(id) {
    const role = id ? deps.roleRepository.findById(id) : null
    if (!role) throw appError('ROLE_NOT_FOUND')
    return role
  }

  function present(role) {
    return toRoleDto(role, {
      permissions: deps.roleRepository.getPermissionCodes(role.id),
      userCount: deps.userRepository.countByRole(role.id),
    })
  }

  function assertCanReadRoles(principal) {
    rbac.assertAuthenticated(principal)
    if (!READ_ROLES_PERMISSIONS.some((code) => rbac.can(principal, code))) throw appError('FORBIDDEN')
  }

  function listPermissions(ctx) {
    rbac.assertCan(ctx.principal, 'permissions.manage')
    return deps.permissionRepository.list().map((p) => ({ id: p.id, code: p.code, module: p.module }))
  }

  function listRoles(ctx) {
    assertCanReadRoles(ctx.principal)
    return deps.roleRepository.list().map(present)
  }

  function getRole(ctx, id) {
    assertCanReadRoles(ctx.principal)
    return present(findRoleOrFail(id))
  }

  function createRole(ctx, input) {
    rbac.assertCan(ctx.principal, 'permissions.manage')
    const data = assertValid(input, CREATE_SCHEMA)
    const code = data.code.trim().toUpperCase()
    if (deps.roleRepository.findByCode(code)) throw appError('ROLE_CODE_IN_USE')

    const permissions = uniqueSorted(data.permissions || [])
    rbac.assertCanUpdateRolePermissions(ctx.principal, { id: null, code }, permissions)

    const role = deps.unitOfWork.run((repos) => {
      const created = repos.roleRepository.create({ code, name: data.name, description: data.description || '' })
      repos.roleRepository.setPermissionCodes(created.id, permissions)
      repos.auditRepository.record(
        buildAuditEntry(ctx, {
          entityType: 'role',
          entityId: created.id,
          action: 'role.created',
          newValue: { code, name: data.name, permissions },
        }),
      )
      return created
    })
    return present(role)
  }

  function updateRole(ctx, id, input) {
    rbac.assertCan(ctx.principal, 'permissions.manage')
    const role = findRoleOrFail(id)
    if (role.code === ROLE_CODES.SUPER_ADMIN) throw appError('ROLE_IMMUTABLE')
    const data = assertValid(input, UPDATE_SCHEMA)
    const changes = diff(role, { name: data.name, description: data.description }, ['name', 'description'])
    if (!changes) return present(role)

    const updated = deps.unitOfWork.run((repos) => {
      const saved = repos.roleRepository.update(role.id, changes.newValue)
      repos.auditRepository.record(
        buildAuditEntry(ctx, {
          entityType: 'role',
          entityId: role.id,
          action: 'role.updated',
          oldValue: changes.oldValue,
          newValue: changes.newValue,
        }),
      )
      return saved
    })
    return present(updated)
  }

  function updateRolePermissions(ctx, id, codes) {
    rbac.assertCan(ctx.principal, 'permissions.manage')
    const data = assertValid({ permissions: codes }, { permissions: [rules.required(), rules.stringArray(MAX_PERMISSIONS)] })
    const role = findRoleOrFail(id)
    const next = uniqueSorted(data.permissions)
    rbac.assertCanUpdateRolePermissions(ctx.principal, role, next)

    const previous = uniqueSorted(deps.roleRepository.getPermissionCodes(role.id))
    deps.unitOfWork.run((repos) => {
      repos.roleRepository.setPermissionCodes(role.id, next)
      repos.auditRepository.record(
        buildAuditEntry(ctx, {
          entityType: 'role',
          entityId: role.id,
          action: 'role.permissions_updated',
          oldValue: { permissions: previous },
          newValue: { permissions: next },
        }),
      )
    })
    return present(role)
  }

  function deleteRole(ctx, id) {
    rbac.assertCan(ctx.principal, 'permissions.manage')
    const role = findRoleOrFail(id)
    if (role.isSystem) throw appError('ROLE_IMMUTABLE')
    if (deps.userRepository.countByRole(role.id) > 0) throw appError('ROLE_IN_USE')

    deps.unitOfWork.run((repos) => {
      repos.roleRepository.delete(role.id)
      repos.auditRepository.record(
        buildAuditEntry(ctx, {
          entityType: 'role',
          entityId: role.id,
          action: 'role.deleted',
          oldValue: { code: role.code, name: role.name },
        }),
      )
    })
    return { deleted: true }
  }

  return { listPermissions, listRoles, getRole, createRole, updateRole, updateRolePermissions, deleteRole }
}

module.exports = { createRoleService }
