/// <reference path="../pb_data/types.d.ts" />

/**
 * Expansão, Onda 1 — Timeline do projeto (docs/roadmap-expansao.md).
 * - tasks.start_date: início planejado (a barra vai do início ao prazo).
 * - project_milestones: marcos do projeto (entregas-chave com data e situação).
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const { MILESTONE_STATES, MILESTONE_NAME_MAX, MILESTONE_DESCRIPTION_MAX } = require(`${__hooks}/src/domain/timeline.js`)
    const tasks = app.findCollectionByNameOrId('tasks')
    tasks.fields.add(new DateField({ name: 'start_date' }))
    tasks.addIndex('idx_tasks_start_date', false, 'project_id, start_date', '')
    app.save(tasks)

    const users = app.findCollectionByNameOrId('users')
    const projects = app.findCollectionByNameOrId('projects')
    const milestones = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'project_milestones',
        fields: [
          { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
          { name: 'name', type: 'text', required: true, max: MILESTONE_NAME_MAX },
          { name: 'description', type: 'text', max: MILESTONE_DESCRIPTION_MAX },
          { name: 'due_date', type: 'date', required: true },
          { name: 'state', type: 'select', required: true, maxSelect: 1, values: MILESTONE_STATES },
          { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_milestones_project ON project_milestones (project_id, due_date)'],
      }),
    )
    app.save(milestones)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('project_milestones'))
    const tasks = app.findCollectionByNameOrId('tasks')
    tasks.removeIndex('idx_tasks_start_date')
    tasks.fields.removeByName('start_date')
    app.save(tasks)
  },
)
