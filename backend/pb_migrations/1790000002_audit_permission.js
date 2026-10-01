/// <reference path="../pb_data/types.d.ts" />

/**
 * Adiciona a permissão `audit.view` (consulta do histórico de auditoria) e concede ao perfil ADMIN.
 * Idempotente: bancos criados depois desta versão já recebem a permissão pelo seed.
 */

migrate(
  (app) => {
    let permission
    try {
      permission = app.findFirstRecordByData('permissions', 'code', 'audit.view')
    } catch (_) {
      permission = new Record(app.findCollectionByNameOrId('permissions'))
      permission.set('code', 'audit.view')
      permission.set('module', 'audit')
      app.save(permission)
    }

    const admin = app.findFirstRecordByData('roles', 'code', 'ADMIN')
    const existing = app.findRecordsByFilter(
      'role_permissions',
      'role_id = {:role} && permission_id = {:permission}',
      '',
      1,
      0,
      { role: admin.id, permission: permission.id },
    )
    if (existing.length === 0) {
      const link = new Record(app.findCollectionByNameOrId('role_permissions'))
      link.set('role_id', admin.id)
      link.set('permission_id', permission.id)
      app.save(link)
    }
  },
  (app) => {
    try {
      app.delete(app.findFirstRecordByData('permissions', 'code', 'audit.view'))
    } catch (_) {
      // já removida
    }
  },
)
