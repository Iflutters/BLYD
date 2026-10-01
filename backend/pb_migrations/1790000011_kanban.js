/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 5 — Kanban.
 * - task_statuses.wip_limit (0 = sem limite) e allowed_next (IDs de destino; vazio = qualquer).
 * - tasks.position: ordem manual do card dentro da coluna (também usada pelo Backlog).
 * Tarefas existentes recebem posição pela ordem de criação (número).
 */

migrate(
  (app) => {
    const statuses = app.findCollectionByNameOrId('task_statuses')
    statuses.fields.add(new NumberField({ name: 'wip_limit', onlyInt: true, min: 0 }))
    statuses.fields.add(new JSONField({ name: 'allowed_next', maxSize: 4096 }))
    app.save(statuses)

    const tasks = app.findCollectionByNameOrId('tasks')
    tasks.fields.add(new NumberField({ name: 'position' }))
    tasks.addIndex('idx_tasks_board', false, 'project_id, status_id, position', '')
    app.save(tasks)

    app.findRecordsByFilter('tasks', "id != ''", 'number', 0, 0).forEach((record) => {
      record.set('position', record.getInt('number') * 1024)
      app.save(record)
    })
  },
  (app) => {
    const tasks = app.findCollectionByNameOrId('tasks')
    tasks.removeIndex('idx_tasks_board')
    tasks.fields.removeByName('position')
    app.save(tasks)
    const statuses = app.findCollectionByNameOrId('task_statuses')
    statuses.fields.removeByName('allowed_next')
    statuses.fields.removeByName('wip_limit')
    app.save(statuses)
  },
)
