/// <reference path="../pb_data/types.d.ts" />

/**
 * Configurador geral da plataforma (regras de negócio §15).
 * - Permissão platform.manage (segurança e identidade da plataforma), concedida ao Admin (idempotente).
 * - platform_settings: registro único com os valores alterados (`values`; o que não está lá usa o
 *   padrão do domínio), os arquivos de identidade (logo claro/escuro e ícone do navegador, protegidos —
 *   servidos só por /api/v1/platform/branding) e os dados deles (`files`: nome, tipo e tamanho).
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }
const SLOTS = ['logo_light', 'logo_dark', 'favicon']

migrate(
  (app) => {
    const { BRANDING_MAX_BYTES, BRANDING_MIME_TYPES } = require(`${__hooks}/src/domain/platform-settings.js`)

    let permission
    try {
      permission = app.findFirstRecordByData('permissions', 'code', 'platform.manage')
    } catch (_) {
      permission = new Record(app.findCollectionByNameOrId('permissions'))
      permission.set('code', 'platform.manage')
      permission.set('module', 'settings')
      app.save(permission)
    }
    try {
      const role = app.findFirstRecordByData('roles', 'code', 'ADMIN')
      const existing = app.findRecordsByFilter('role_permissions', 'role_id = {:r} && permission_id = {:p}', '', 1, 0, { r: role.id, p: permission.id })
      if (existing.length === 0) {
        const link = new Record(app.findCollectionByNameOrId('role_permissions'))
        link.set('role_id', role.id)
        link.set('permission_id', permission.id)
        app.save(link)
      }
    } catch (_) {
      // perfil ADMIN ausente (banco montado de outro jeito): o Super Admin já tem tudo
    }

    const fileField = (name) => ({ name, type: 'file', maxSelect: 1, maxSize: BRANDING_MAX_BYTES, mimeTypes: BRANDING_MIME_TYPES, protected: true })
    const collection = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'platform_settings',
        fields: [{ name: 'values', type: 'json', maxSize: 20000 }, { name: 'files', type: 'json', maxSize: 4000 }]
          .concat(SLOTS.map(fileField))
          .concat([
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ]),
      }),
    )
    app.save(collection)

    const record = new Record(collection)
    record.set('values', {})
    record.set('files', {})
    app.save(record)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('platform_settings'))
    } catch (_) {
      // já removida
    }
    try {
      const permission = app.findFirstRecordByData('permissions', 'code', 'platform.manage')
      app.findRecordsByFilter('role_permissions', 'permission_id = {:p}', '', 0, 0, { p: permission.id }).forEach((r) => app.delete(r))
      app.delete(permission)
    } catch (_) {
      // permissão ausente
    }
  },
)
