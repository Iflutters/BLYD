/// <reference path="../pb_data/types.d.ts" />

/**
 * Notificações internas (diretriz §41): menção, tarefa atribuída, comentário, mudança de status,
 * prazo amanhã e prazo vencido. `data` guarda o que é exibido (código/título da tarefa, trecho…);
 * `dedupe_key` evita repetir lembretes automáticos (índice único por pessoa quando preenchido).
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const { TYPES } = require(`${__hooks}/src/domain/notification.js`)
    const users = app.findCollectionByNameOrId('users')
    const tasks = app.findCollectionByNameOrId('tasks')
    const notifications = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'notifications',
        fields: [
          { name: 'user_id', type: 'relation', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
          { name: 'type', type: 'select', required: true, maxSelect: 1, values: TYPES },
          { name: 'task_id', type: 'relation', required: true, collectionId: tasks.id, maxSelect: 1, cascadeDelete: true },
          { name: 'actor_id', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'data', type: 'json', maxSize: 4096 },
          { name: 'dedupe_key', type: 'text', max: 120 },
          { name: 'read_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: [
          'CREATE INDEX idx_notifications_inbox ON notifications (user_id, read_at, created)',
          "CREATE UNIQUE INDEX idx_notifications_dedupe ON notifications (user_id, dedupe_key) WHERE dedupe_key != ''",
        ],
      }),
    )
    app.save(notifications)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('notifications'))
  },
)
