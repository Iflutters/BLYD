import { SUPER_ADMIN_ROLE, type PermissionCode } from './permissions'
import type { CurrentUser, Role, User } from './entities'

/**
 * Regras de apresentação do RBAC: dizem à UI o que desabilitar e por quê.
 * Espelham as regras do backend (que continua sendo a autoridade).
 */

export type RoleLockReason = 'immutable' | 'own_role' | 'no_permission' | null

export function isSuperAdmin(current: CurrentUser | null): boolean {
  return current?.role?.code === SUPER_ADMIN_ROLE
}

/** Motivo pelo qual o usuário atual não pode editar as permissões de `role` (null = pode). */
export function roleLockReason(current: CurrentUser | null, role: Pick<Role, 'id' | 'code'>): RoleLockReason {
  if (!current || !current.permissions.includes('permissions.manage')) return 'no_permission'
  if (role.code === SUPER_ADMIN_ROLE) return 'immutable'
  if (!isSuperAdmin(current) && current.role?.id === role.id) return 'own_role'
  return null
}

/** Uma permissão só pode ser concedida por quem a possui (evita escalonamento). */
export function canGrantPermission(current: CurrentUser | null, permission: PermissionCode): boolean {
  if (!current) return false
  return isSuperAdmin(current) || current.permissions.includes(permission)
}

/** Perfis que o usuário atual pode atribuir a outros usuários. */
export function assignableRoles(current: CurrentUser | null, roles: Role[]): Role[] {
  if (!current) return []
  if (isSuperAdmin(current)) return roles
  return roles.filter(
    (role) => role.code !== SUPER_ADMIN_ROLE && role.permissions.every((p) => current.permissions.includes(p)),
  )
}

export type UserAction = 'edit' | 'disable' | 'enable' | 'change_role' | 'reset_password' | 'resend_invite'

/** Ações disponíveis para `target` na visão do usuário atual. */
export function userActions(current: CurrentUser | null, target: User, targetRoleCode: string | null): UserAction[] {
  if (!current) return []
  const actions: UserAction[] = []
  const isSelf = current.user.id === target.id
  const protectedTarget = targetRoleCode === SUPER_ADMIN_ROLE && !isSuperAdmin(current)

  if (isSelf || (current.permissions.includes('users.edit') && !protectedTarget)) actions.push('edit')
  if (!isSelf && current.permissions.includes('users.edit') && !protectedTarget) actions.push('change_role', 'reset_password')
  if (!isSelf && current.permissions.includes('users.disable') && !protectedTarget) {
    actions.push(target.status === 'active' ? 'disable' : 'enable')
  }
  // convite: só para quem nunca entrou (a tela também exige o envio de e-mail ligado)
  if (!isSelf && current.permissions.includes('users.create') && !target.lastLoginAt && target.status === 'active') actions.push('resend_invite')
  return actions
}

const ROLE_HIERARCHY = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']

/** Perfis de sistema na ordem de privilégio; perfis personalizados em seguida, por nome. */
export function sortRolesByHierarchy<T extends Pick<Role, 'code' | 'name'>>(roles: T[]): T[] {
  const rank = (role: T) => {
    const index = ROLE_HIERARCHY.indexOf(role.code)
    return index < 0 ? ROLE_HIERARCHY.length : index
  }
  return [...roles].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
