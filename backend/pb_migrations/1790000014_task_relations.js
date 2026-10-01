/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 7 — Relacionamentos.
 * - task_relations: relação entre duas tarefas (relates, blocks, duplicates, depends_on), sempre
 *   de origem para destino; os inversos são a mesma relação vista do outro lado. Some junto com
 *   qualquer uma das tarefas (a API registra isso no histórico do outro lado antes de excluir).
 * - tasks.forked_from_task_id: origem do fork (fica vazio se a origem for excluída).
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const { RELATION_TYPES } = require(`${__hooks}/src/domain/relation.js`)
    const users = app.findCollectionByNameOrId('users')
    const tasks = app.findCollectionByNameOrId('tasks')
    const relations = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'task_relations',
        fields: [
          { name: 'source_task_id', type: 'relation', required: true, collectionId: tasks.id, maxSelect: 1, cascadeDelete: true },
          { name: 'target_task_id', type: 'relation', required: true, collectionId: tasks.id, maxSelect: 1, cascadeDelete: true },
          { name: 'relation_type', type: 'select', required: true, maxSelect: 1, values: RELATION_TYPES },
          { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_task_relations_unique ON task_relations (source_task_id, target_task_id, relation_type)',
          'CREATE INDEX idx_task_relations_target ON task_relations (target_task_id, relation_type)',
        ],
      }),
    )
    app.save(relations)

    tasks.fields.add(new RelationField({ name: 'forked_from_task_id', collectionId: tasks.id, maxSelect: 1, cascadeDelete: false }))
    tasks.addIndex('idx_tasks_forked_from', false, 'forked_from_task_id', '')
    app.save(tasks)
  },
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks')
    tasks.removeIndex('idx_tasks_forked_from')
    tasks.fields.removeByName('forked_from_task_id')
    app.save(tasks)
    app.delete(app.findCollectionByNameOrId('task_relations'))
  },
)
