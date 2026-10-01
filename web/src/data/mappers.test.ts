import { describe, expect, it } from 'vitest'
import { toCurrentUser, toRole, toUser } from './mappers'
import type { UserDto } from './dtos'

const userDto: UserDto = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@x.com',
  avatar_url: null,
  status: 'active',
  role_id: 'r1',
  locale: 'es',
  theme: 'dark',
  created_at: '2026-01-10T12:00:00.000Z',
  updated_at: '2026-01-10T12:00:00.000Z',
  last_login_at: null,
}

describe('data/mappers', () => {
  it('converte usuário (snake_case -> camelCase, datas)', () => {
    const user = toUser(userDto)
    expect(user.roleId).toBe('r1')
    expect(user.createdAt?.toISOString()).toBe('2026-01-10T12:00:00.000Z')
    expect(user.lastLoginAt).toBeNull()
    expect(user.locale).toBe('es')
    expect(user.theme).toBe('dark')
  })

  it('usa padrões seguros para valores desconhecidos', () => {
    const user = toUser({ ...userDto, locale: 'fr', theme: 'neon', status: 'weird', created_at: 'invalid' })
    expect(user.locale).toBe('pt-BR')
    expect(user.theme).toBe('system')
    expect(user.status).toBe('active')
    expect(user.createdAt).toBeNull()
  })

  it('descarta permissões desconhecidas', () => {
    const role = toRole({ id: 'r', code: 'X', name: 'X', description: '', is_system: false, permissions: ['tasks.view', 'hack.all'] })
    expect(role.permissions).toEqual(['tasks.view'])
    expect(role.userCount).toBe(0)
  })

  it('converte contexto do usuário atual', () => {
    const me = toCurrentUser({ user: userDto, role: null, permissions: ['users.view'], session: null })
    expect(me.user.id).toBe('u1')
    expect(me.permissions).toEqual(['users.view'])
    expect(me.role).toBeNull()
  })
})
