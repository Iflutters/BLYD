/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 9 — bloqueio progressivo de conta (ver domain/lockout.js).
 * login_attempts: falhas de login por conta — `key` é o hash do e-mail normalizado (nunca o
 * e-mail em claro), `attempted_at` a hora da falha. Entrar com sucesso apaga as da conta; um cron
 * diário remove as antigas. Regras de API nulas: acesso somente pela aplicação.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const attempts = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'login_attempts',
        fields: [
          { name: 'key', type: 'text', required: true, max: 128 },
          { name: 'attempted_at', type: 'date', required: true },
        ],
        indexes: ['CREATE INDEX idx_login_attempts_key ON login_attempts (key, attempted_at)'],
      }),
    )
    app.save(attempts)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('login_attempts'))
  },
)
