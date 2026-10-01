/// <reference path="../pb_data/types.d.ts" />

/**
 * Gerenciamento de Projetos — GP-5 (colunas personalizadas).
 * - plan_columns: colunas do quadro definidas pelo gestor (nome, tipo, opções/unidade, posição).
 * - plan_items.custom: valores das colunas no elemento ({ coluna: valor }).
 * Excluir o projeto apaga as colunas (cascade). Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const columns = require(`${__hooks}/src/domain/plan-columns.js`)
    const users = app.findCollectionByNameOrId('users')
    const projects = app.findCollectionByNameOrId('projects')

    app.save(
      new Collection(
        Object.assign({}, LOCKED_RULES, {
          type: 'base',
          name: 'plan_columns',
          fields: [
            { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
            { name: 'name', type: 'text', required: true, max: columns.NAME_MAX },
            { name: 'type', type: 'select', required: true, maxSelect: 1, values: columns.COLUMN_TYPES },
            { name: 'settings', type: 'json', maxSize: 20000 },
            { name: 'position', type: 'number' },
            { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: ['CREATE INDEX idx_plan_columns_project ON plan_columns (project_id, position)'],
        }),
      ),
    )

    const items = app.findCollectionByNameOrId('plan_items')
    if (!items.fields.getByName('custom')) items.fields.add(new JSONField({ name: 'custom', maxSize: 200000 }))
    app.save(items)
  },
  (app) => {
    const items = app.findCollectionByNameOrId('plan_items')
    if (items.fields.getByName('custom')) items.fields.removeByName('custom')
    app.save(items)
    app.delete(app.findCollectionByNameOrId('plan_columns'))
  },
)
