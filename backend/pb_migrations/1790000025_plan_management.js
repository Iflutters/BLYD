/// <reference path="../pb_data/types.d.ts" />

/**
 * Gerenciamento de Projetos — GP-4 (visões e gestão).
 * - plan_settings: linha de base do Cronograma (`baseline`: { savedAt, items: { id: { start, end } } })
 *   e a sequência dos problemas (`issue_seq`: o número não se repete nem depois de excluir).
 * - plan_journal: Diário do projeto (registros datados).
 * - plan_issues: Gestão dos problemas (número por projeto, data, descrição, situação, responsável).
 * Excluir o projeto apaga tudo (cascade). Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const mgmt = require(`${__hooks}/src/domain/plan-management.js`)
    const users = app.findCollectionByNameOrId('users')
    const projects = app.findCollectionByNameOrId('projects')

    const settings = app.findCollectionByNameOrId('plan_settings')
    if (!settings.fields.getByName('baseline')) settings.fields.add(new JSONField({ name: 'baseline', maxSize: 2000000 }))
    if (!settings.fields.getByName('issue_seq')) settings.fields.add(new NumberField({ name: 'issue_seq', onlyInt: true }))
    app.save(settings)

    app.save(
      new Collection(
        Object.assign({}, LOCKED_RULES, {
          type: 'base',
          name: 'plan_journal',
          fields: [
            { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
            { name: 'entry_date', type: 'date', required: true },
            { name: 'content', type: 'text', required: true, max: mgmt.JOURNAL_MAX },
            { name: 'author_id', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: ['CREATE INDEX idx_plan_journal_project ON plan_journal (project_id, entry_date)'],
        }),
      ),
    )

    app.save(
      new Collection(
        Object.assign({}, LOCKED_RULES, {
          type: 'base',
          name: 'plan_issues',
          fields: [
            { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
            { name: 'number', type: 'number', required: true, onlyInt: true, min: 1 },
            { name: 'opened_on', type: 'date', required: true },
            { name: 'description', type: 'text', required: true, max: mgmt.ISSUE_DESCRIPTION_MAX },
            { name: 'state', type: 'select', required: true, maxSelect: 1, values: mgmt.ISSUE_STATES },
            { name: 'owner_id', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
            { name: 'resolved_on', type: 'date' },
            { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: ['CREATE UNIQUE INDEX idx_plan_issues_number ON plan_issues (project_id, number)'],
        }),
      ),
    )
  },
  (app) => {
    ;['plan_issues', 'plan_journal'].forEach((name) => app.delete(app.findCollectionByNameOrId(name)))
    const settings = app.findCollectionByNameOrId('plan_settings')
    ;['baseline', 'issue_seq'].forEach((name) => {
      if (settings.fields.getByName(name)) settings.fields.removeByName(name)
    })
    app.save(settings)
  },
)
