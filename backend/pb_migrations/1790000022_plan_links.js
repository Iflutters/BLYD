/// <reference path="../pb_data/types.d.ts" />

/**
 * Gerenciamento de Projetos — GP-2 (interação).
 * - plan_item_links: dependências entre elementos do quadro (`blocks` = de bloqueia para; `relates`).
 *   Excluir um elemento apaga as ligações dele (cascade).
 * - plan_settings: configuração do quadro de cada projeto (regra de dependência: só sinalizar ou
 *   impedir iniciar/concluir com dependência pendente). Sem registro = padrão.
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const links = require(`${__hooks}/src/domain/plan-links.js`)
    const users = app.findCollectionByNameOrId('users')
    const projects = app.findCollectionByNameOrId('projects')
    const items = app.findCollectionByNameOrId('plan_items')

    app.save(
      new Collection(
        Object.assign({}, LOCKED_RULES, {
          type: 'base',
          name: 'plan_item_links',
          fields: [
            { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
            { name: 'from_id', type: 'relation', required: true, collectionId: items.id, maxSelect: 1, cascadeDelete: true },
            { name: 'to_id', type: 'relation', required: true, collectionId: items.id, maxSelect: 1, cascadeDelete: true },
            { name: 'type', type: 'select', required: true, maxSelect: 1, values: ['blocks', 'relates'] },
            { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          ],
          indexes: ['CREATE UNIQUE INDEX idx_plan_item_links_pair ON plan_item_links (from_id, to_id, type)', 'CREATE INDEX idx_plan_item_links_project ON plan_item_links (project_id)'],
        }),
      ),
    )

    app.save(
      new Collection(
        Object.assign({}, LOCKED_RULES, {
          type: 'base',
          name: 'plan_settings',
          fields: [
            { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
            { name: 'dependency_rule', type: 'select', required: true, maxSelect: 1, values: links.DEPENDENCY_RULES },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: ['CREATE UNIQUE INDEX idx_plan_settings_project ON plan_settings (project_id)'],
        }),
      ),
    )
  },
  (app) => {
    ;['plan_item_links', 'plan_settings'].forEach((name) => app.delete(app.findCollectionByNameOrId(name)))
  },
)
