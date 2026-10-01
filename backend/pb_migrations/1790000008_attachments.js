/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 4e — Anexos e imagens das tarefas.
 *
 * - O arquivo fica num campo `file` PROTEGIDO (sem acesso público pela API genérica) e com lista de
 *   tipos permitidos — o PocketBase também confere o tipo pelo conteúdo (segunda barreira; a primeira é
 *   domain/attachment.js). O download passa por /api/v1/attachments/{id}/file, que checa o acesso ao projeto.
 * - `kind` separa imagens (galeria/visualizador) de documentos.
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const { MAX_FILE_SIZE, STORAGE_MIME_TYPES } = require(`${__hooks}/src/domain/attachment.js`)
    const users = app.findCollectionByNameOrId('users')
    const tasks = app.findCollectionByNameOrId('tasks')

    const attachments = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'attachments',
        fields: [
          { name: 'task_id', type: 'relation', required: true, collectionId: tasks.id, maxSelect: 1, cascadeDelete: true },
          { name: 'file', type: 'file', required: true, maxSelect: 1, maxSize: MAX_FILE_SIZE, mimeTypes: STORAGE_MIME_TYPES, protected: true },
          { name: 'name', type: 'text', required: true, max: 200 },
          { name: 'mime', type: 'text', required: true, max: 120 },
          { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['image', 'document'] },
          { name: 'size', type: 'number', onlyInt: true },
          { name: 'uploaded_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: ['CREATE INDEX idx_attachments_task ON attachments (task_id, created)'],
      }),
    )
    app.save(attachments)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('attachments'))
  },
)
