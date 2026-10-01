/// <reference path="../pb_data/types.d.ts" />

/**
 * Tokens de API pessoais (integrações, regras de negócio §17).
 * - Permissão api_tokens.create (criar os próprios tokens), concedida ao Admin e ao Gestor (idempotente).
 * - api_tokens: só o hash do token e um prefixo visível; prazo opcional, último uso e revogação.
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }
const GRANTS = ['ADMIN', 'MANAGER']

migrate(
  (app) => {
    let permission
    try {
      permission = app.findFirstRecordByData('permissions', 'code', 'api_tokens.create')
    } catch (_) {
      permission = new Record(app.findCollectionByNameOrId('permissions'))
      permission.set('code', 'api_tokens.create')
      permission.set('module', 'settings')
      app.save(permission)
    }
    GRANTS.forEach((code) => {
      let role
      try {
        role = app.findFirstRecordByData('roles', 'code', code)
      } catch (_) {
        return
      }
      const existing = app.findRecordsByFilter('role_permissions', 'role_id = {:r} && permission_id = {:p}', '', 1, 0, { r: role.id, p: permission.id })
      if (existing.length > 0) return
      const link = new Record(app.findCollectionByNameOrId('role_permissions'))
      link.set('role_id', role.id)
      link.set('permission_id', permission.id)
      app.save(link)
    })

    const users = app.findCollectionByNameOrId('users')
    const tokens = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'api_tokens',
        fields: [
          { name: 'user_id', type: 'relation', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'token_hash', type: 'text', required: true, max: 128 },
          { name: 'prefix', type: 'text', max: 16 },
          { name: 'expires_at', type: 'date' },
          { name: 'last_used_at', type: 'date' },
          { name: 'last_used_ip', type: 'text', max: 64 },
          { name: 'revoked_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_api_tokens_hash ON api_tokens (token_hash)', 'CREATE INDEX idx_api_tokens_user ON api_tokens (user_id, created)'],
      }),
    )
    app.save(tokens)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('api_tokens'))
    } catch (_) {
      // já removida
    }
    try {
      const permission = app.findFirstRecordByData('permissions', 'code', 'api_tokens.create')
      app.findRecordsByFilter('role_permissions', 'permission_id = {:p}', '', 0, 0, { p: permission.id }).forEach((r) => app.delete(r))
      app.delete(permission)
    } catch (_) {
      // permissão ausente
    }
  },
)
