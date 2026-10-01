/// <reference path="../pb_data/types.d.ts" />

/**
 * Gerenciamento de Projetos — GP-3 (painel do elemento).
 * - plan_item_updates: atualizações do elemento (conversa com respostas de um nível, @menções,
 *   exclusão lógica). Excluir o elemento apaga as atualizações (cascade).
 * - plan_item_files: arquivos do elemento (arquivo protegido; download pela API própria).
 * - notifications: passam a apontar também para um elemento do quadro (`plan_item_id` + `project_id`;
 *   `task_id` deixa de ser obrigatório) e ganham os tipos da conversa do quadro.
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const updatesDomain = require(`${__hooks}/src/domain/plan-updates.js`)
    const { TYPES } = require(`${__hooks}/src/domain/notification.js`)
    const { MAX_FILE_SIZE, STORAGE_MIME_TYPES } = require(`${__hooks}/src/domain/attachment.js`)
    const users = app.findCollectionByNameOrId('users')
    const projects = app.findCollectionByNameOrId('projects')
    const items = app.findCollectionByNameOrId('plan_items')

    app.save(
      new Collection(
        Object.assign({}, LOCKED_RULES, {
          type: 'base',
          name: 'plan_item_updates',
          fields: [
            { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
            { name: 'item_id', type: 'relation', required: true, collectionId: items.id, maxSelect: 1, cascadeDelete: true },
            // resposta: id da atualização principal (um nível)
            { name: 'parent_id', type: 'text', max: 15 },
            { name: 'author_id', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
            { name: 'content', type: 'text', max: updatesDomain.MAX_CONTENT },
            { name: 'mentions', type: 'relation', collectionId: users.id, maxSelect: updatesDomain.MAX_MENTIONS, cascadeDelete: false },
            { name: 'edited_at', type: 'date' },
            { name: 'deleted_at', type: 'date' },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: ['CREATE INDEX idx_plan_item_updates_item ON plan_item_updates (item_id, created)', 'CREATE INDEX idx_plan_item_updates_project ON plan_item_updates (project_id)'],
        }),
      ),
    )

    app.save(
      new Collection(
        Object.assign({}, LOCKED_RULES, {
          type: 'base',
          name: 'plan_item_files',
          fields: [
            { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
            { name: 'item_id', type: 'relation', required: true, collectionId: items.id, maxSelect: 1, cascadeDelete: true },
            { name: 'file', type: 'file', required: true, maxSelect: 1, maxSize: MAX_FILE_SIZE, mimeTypes: STORAGE_MIME_TYPES, protected: true },
            { name: 'name', type: 'text', required: true, max: 200 },
            { name: 'mime', type: 'text', required: true, max: 120 },
            { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['image', 'document'] },
            { name: 'size', type: 'number', onlyInt: true },
            { name: 'uploaded_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          ],
          indexes: ['CREATE INDEX idx_plan_item_files_item ON plan_item_files (item_id, created)', 'CREATE INDEX idx_plan_item_files_project ON plan_item_files (project_id)'],
        }),
      ),
    )

    // notificações do quadro
    const notifications = app.findCollectionByNameOrId('notifications')
    notifications.fields.getByName('task_id').required = false
    notifications.fields.getByName('type').values = TYPES
    if (!notifications.fields.getByName('plan_item_id')) notifications.fields.add(new RelationField({ name: 'plan_item_id', collectionId: items.id, maxSelect: 1, cascadeDelete: true }))
    if (!notifications.fields.getByName('project_id')) notifications.fields.add(new RelationField({ name: 'project_id', collectionId: projects.id, maxSelect: 1, cascadeDelete: true }))
    app.save(notifications)
  },
  (app) => {
    const notifications = app.findCollectionByNameOrId('notifications')
    ;['plan_item_id', 'project_id'].forEach((name) => {
      if (notifications.fields.getByName(name)) notifications.fields.removeByName(name)
    })
    app.save(notifications)
    ;['plan_item_files', 'plan_item_updates'].forEach((name) => app.delete(app.findCollectionByNameOrId(name)))
  },
)
