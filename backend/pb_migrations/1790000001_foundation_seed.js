/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 1 — Fundação: catálogo de permissões, perfis padrão e configurações de segurança.
 *
 * A matriz inicial vem de pb_hooks/src/domain/permissions.js (fonte única).
 * O super administrador NÃO é criado aqui (nada de credenciais em código):
 * use `npm run create-admin` (ver docs/deployment.md).
 */

migrate(
  (app) => {
    const { PERMISSIONS, DEFAULT_ROLES, DEFAULT_ROLE_PERMISSIONS } = require(`${__hooks}/src/domain/permissions.js`)

    const permissionsCol = app.findCollectionByNameOrId('permissions')
    const permissionIds = {}
    PERMISSIONS.forEach((p) => {
      const record = new Record(permissionsCol)
      record.set('code', p.code)
      record.set('module', p.module)
      app.save(record)
      permissionIds[p.code] = record.id
    })

    const rolesCol = app.findCollectionByNameOrId('roles')
    const rolePermissionsCol = app.findCollectionByNameOrId('role_permissions')
    DEFAULT_ROLES.forEach((r) => {
      const role = new Record(rolesCol)
      role.set('code', r.code)
      role.set('name', r.name)
      role.set('description', r.description)
      role.set('is_system', true)
      app.save(role)

      if (r.code === 'SUPER_ADMIN') return // possui tudo implicitamente
      DEFAULT_ROLE_PERMISSIONS[r.code].forEach((code) => {
        const link = new Record(rolePermissionsCol)
        link.set('role_id', role.id)
        link.set('permission_id', permissionIds[code])
        app.save(link)
      })
    })

    // Configurações de segurança e observabilidade
    const settings = app.settings()
    unmarshal(
      {
        meta: { appName: 'KAMBAN' },
        logs: { maxDays: 14, logIP: true },
        rateLimits: {
          enabled: true,
          rules: [
            { label: 'POST /api/v1/auth/login', audience: '', duration: 60, maxRequests: 10 },
            { label: '/api/v1/', audience: '', duration: 60, maxRequests: 600 },
            { label: '*:auth', audience: '', duration: 3, maxRequests: 2 },
            { label: '/api/', audience: '', duration: 10, maxRequests: 300 },
          ],
        },
      },
      settings,
    )
    app.save(settings)
  },
  (app) => {
    ;['role_permissions', 'roles', 'permissions'].forEach((name) => {
      app.findAllRecords(name).forEach((record) => app.delete(record))
    })
  },
)
