/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 4b — Tarefas e valores de campos personalizados.
 *
 * - tasks: número sequencial por projeto (`code` = CHAVE-N, único); relações com tipo, status,
 *   prioridade e pessoas; datas derivadas do status (started_at/completed_at).
 * - task_custom_values: um registro por (tarefa, campo). `value` guarda o valor original (JSON);
 *   value_text/number/date/bool são cópias indexadas para busca, filtro e ordenação.
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const projects = app.findCollectionByNameOrId('projects')
    const types = app.findCollectionByNameOrId('task_types')
    const statuses = app.findCollectionByNameOrId('task_statuses')
    const priorities = app.findCollectionByNameOrId('task_priorities')
    const fields = app.findCollectionByNameOrId('custom_fields')

    const tasks = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'tasks',
        fields: [
          { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
          { name: 'number', type: 'number', required: true, onlyInt: true, min: 1 },
          { name: 'code', type: 'text', required: true, max: 24 },
          { name: 'title', type: 'text', required: true, max: 200, presentable: true },
          { name: 'description', type: 'text', max: 50000 },
          { name: 'task_type_id', type: 'relation', required: true, collectionId: types.id, maxSelect: 1, cascadeDelete: false },
          { name: 'status_id', type: 'relation', required: true, collectionId: statuses.id, maxSelect: 1, cascadeDelete: false },
          { name: 'priority_id', type: 'relation', required: true, collectionId: priorities.id, maxSelect: 1, cascadeDelete: false },
          { name: 'creator_id', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'assignee_id', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'reporter_id', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'due_date', type: 'date' },
          { name: 'started_at', type: 'date' },
          { name: 'completed_at', type: 'date' },
          { name: 'estimated_hours', type: 'number' },
          { name: 'actual_hours', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_tasks_project_number ON tasks (project_id, number)',
          'CREATE UNIQUE INDEX idx_tasks_code ON tasks (code)',
          'CREATE INDEX idx_tasks_status ON tasks (status_id)',
          'CREATE INDEX idx_tasks_priority ON tasks (priority_id)',
          'CREATE INDEX idx_tasks_type ON tasks (task_type_id)',
          'CREATE INDEX idx_tasks_assignee ON tasks (assignee_id)',
          'CREATE INDEX idx_tasks_creator ON tasks (creator_id)',
          'CREATE INDEX idx_tasks_created ON tasks (created)',
          'CREATE INDEX idx_tasks_due_date ON tasks (due_date)',
        ],
      }),
    )
    app.save(tasks)

    // relação com a própria collection (subtarefas — Fase 7) só depois que ela existe
    tasks.fields.add(new RelationField({ name: 'parent_task_id', collectionId: tasks.id, maxSelect: 1, cascadeDelete: false }))
    tasks.addIndex('idx_tasks_parent', false, 'parent_task_id', '')
    app.save(tasks)

    const values = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'task_custom_values',
        fields: [
          { name: 'task_id', type: 'relation', required: true, collectionId: tasks.id, maxSelect: 1, cascadeDelete: true },
          { name: 'field_id', type: 'relation', required: true, collectionId: fields.id, maxSelect: 1, cascadeDelete: true },
          { name: 'value', type: 'json', maxSize: 65536 },
          { name: 'value_text', type: 'text', max: 500 },
          { name: 'value_number', type: 'number' },
          { name: 'value_date', type: 'date' },
          { name: 'value_bool', type: 'bool' },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_task_values_pair ON task_custom_values (task_id, field_id)',
          'CREATE INDEX idx_task_values_text ON task_custom_values (field_id, value_text)',
          'CREATE INDEX idx_task_values_number ON task_custom_values (field_id, value_number)',
          'CREATE INDEX idx_task_values_date ON task_custom_values (field_id, value_date)',
        ],
      }),
    )
    app.save(values)
  },
  (app) => {
    ;['task_custom_values', 'tasks'].forEach((name) => {
      app.delete(app.findCollectionByNameOrId(name))
    })
  },
)
