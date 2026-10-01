/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 6 — Backlog e sprints.
 * - sprints: sprints de planejamento do projeto (nome, objetivo, período, estado).
 * - tasks.sprint_id: sprint planejada da tarefa (opcional). Excluir a sprint é feito pela API,
 *   que antes tira a sprint das tarefas (com histórico); a relação não apaga tarefas.
 * Regras de API nulas: acesso somente por /api/v1.
 *
 * O nome do arquivo ficou "cycles" porque bancos locais já aplicaram esta migration quando o
 * conceito se chamava "ciclo"; a 1790000013 renomeia esses bancos (aqui já nasce "sprints").
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const { SPRINT_STATES } = require(`${__hooks}/src/domain/sprint.js`)
    const users = app.findCollectionByNameOrId('users')
    const projects = app.findCollectionByNameOrId('projects')
    const sprints = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'sprints',
        fields: [
          { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'goal', type: 'text', max: 1000 },
          { name: 'start_date', type: 'date' },
          { name: 'end_date', type: 'date' },
          { name: 'state', type: 'select', required: true, maxSelect: 1, values: SPRINT_STATES },
          { name: 'order', type: 'number', onlyInt: true },
          { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_sprints_project ON sprints (project_id, state)'],
      }),
    )
    app.save(sprints)

    const tasks = app.findCollectionByNameOrId('tasks')
    tasks.fields.add(new RelationField({ name: 'sprint_id', collectionId: sprints.id, maxSelect: 1, cascadeDelete: false }))
    tasks.addIndex('idx_tasks_sprint', false, 'sprint_id', '')
    app.save(tasks)
  },
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks')
    tasks.removeIndex('idx_tasks_sprint')
    tasks.fields.removeByName('sprint_id')
    app.save(tasks)
    app.delete(app.findCollectionByNameOrId('sprints'))
  },
)
