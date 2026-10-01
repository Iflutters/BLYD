/// <reference path="../pb_data/types.d.ts" />

/**
 * Webhooks (integrações, regras de negócio §18).
 * - webhooks: endereço, eventos assinados (lista; "grupo.*" = todos do grupo), segredo de assinatura,
 *   ativo, último envio e falhas seguidas.
 * - webhook_deliveries: uma entrega por evento × webhook, com a carga, tentativas e a resposta;
 *   as encerradas saem depois de 30 dias.
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const webhooks = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'webhooks',
        fields: [
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'url', type: 'text', required: true, max: 500 },
          { name: 'events', type: 'json', maxSize: 10000 },
          { name: 'secret', type: 'text', required: true, max: 100 },
          { name: 'active', type: 'bool' },
          { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'last_status', type: 'number', onlyInt: true },
          { name: 'last_delivery_at', type: 'date' },
          { name: 'consecutive_failures', type: 'number', onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_webhooks_active ON webhooks (active)'],
      }),
    )
    app.save(webhooks)

    const deliveries = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'webhook_deliveries',
        fields: [
          { name: 'webhook_id', type: 'relation', required: true, collectionId: webhooks.id, maxSelect: 1, cascadeDelete: true },
          { name: 'event', type: 'text', required: true, max: 80 },
          { name: 'payload', type: 'json', maxSize: 200000 },
          { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['pending', 'success', 'failed'] },
          { name: 'attempts', type: 'number', onlyInt: true },
          { name: 'response_status', type: 'number', onlyInt: true },
          { name: 'response_body', type: 'text', max: 1000 },
          { name: 'error', type: 'text', max: 500 },
          { name: 'duration_ms', type: 'number', onlyInt: true },
          { name: 'next_attempt_at', type: 'date' },
          { name: 'delivered_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_webhook_deliveries_due ON webhook_deliveries (status, next_attempt_at, created)',
          'CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries (webhook_id, created)',
        ],
      }),
    )
    app.save(deliveries)
  },
  (app) => {
    ;['webhook_deliveries', 'webhooks'].forEach((name) => {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {
        // já removida
      }
    })
  },
)
