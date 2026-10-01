/// <reference path="../pb_data/types.d.ts" />

/**
 * E-mail (integrações, regras de negócio §16).
 * - Permissão integrations.manage (e-mail, webhooks, tokens de API de todos), concedida ao Admin.
 * - users.email_notifications_off: a pessoa desligou as notificações por e-mail (padrão: ligadas).
 * - email_outbox: fila de saída (tudo que a plataforma envia); o corpo é apagado depois de enviar.
 * - auth_tokens: links de uso único (redefinir senha, convite) — só o hash do token.
 * As configurações do SMTP ficam nas configurações do próprio PocketBase (smtp + meta).
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    let permission
    try {
      permission = app.findFirstRecordByData('permissions', 'code', 'integrations.manage')
    } catch (_) {
      permission = new Record(app.findCollectionByNameOrId('permissions'))
      permission.set('code', 'integrations.manage')
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
      // perfil ADMIN ausente: o Super Admin já tem tudo
    }

    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('email_notifications_off')) {
      users.fields.add(new BoolField({ name: 'email_notifications_off' }))
      app.save(users)
    }

    const outbox = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'email_outbox',
        fields: [
          { name: 'to', type: 'text', required: true, max: 254 },
          { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['notification', 'password_reset', 'invite', 'test'] },
          { name: 'subject', type: 'text', max: 300 },
          { name: 'html', type: 'text', max: 200000 },
          { name: 'text', type: 'text', max: 100000 },
          { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['pending', 'sent', 'failed'] },
          { name: 'attempts', type: 'number', onlyInt: true },
          { name: 'last_error', type: 'text', max: 500 },
          { name: 'next_attempt_at', type: 'date' },
          { name: 'sent_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_email_outbox_due ON email_outbox (status, next_attempt_at, created)'],
      }),
    )
    app.save(outbox)

    const tokens = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'auth_tokens',
        fields: [
          { name: 'user_id', type: 'relation', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
          { name: 'purpose', type: 'select', required: true, maxSelect: 1, values: ['reset', 'invite'] },
          { name: 'token_hash', type: 'text', required: true, max: 128 },
          { name: 'expires_at', type: 'date', required: true },
          { name: 'used_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_auth_tokens_hash ON auth_tokens (token_hash)', 'CREATE INDEX idx_auth_tokens_user ON auth_tokens (user_id, purpose, created)'],
      }),
    )
    app.save(tokens)
  },
  (app) => {
    ;['auth_tokens', 'email_outbox'].forEach((name) => {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {
        // já removida
      }
    })
    const users = app.findCollectionByNameOrId('users')
    if (users.fields.getByName('email_notifications_off')) {
      users.fields.removeByName('email_notifications_off')
      app.save(users)
    }
    try {
      const permission = app.findFirstRecordByData('permissions', 'code', 'integrations.manage')
      app.findRecordsByFilter('role_permissions', 'permission_id = {:p}', '', 0, 0, { p: permission.id }).forEach((r) => app.delete(r))
      app.delete(permission)
    } catch (_) {
      // permissão ausente
    }
  },
)
