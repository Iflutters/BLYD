/// <reference path="../pb_data/types.d.ts" />

/**
 * "Ciclo" passou a se chamar "Sprint" (pedido do usuário em 2026-09-30).
 * Bancos que aplicaram a 1790000012 antiga têm `cycles` e `tasks.cycle_id`: renomeia para
 * `sprints` e `tasks.sprint_id`, preservando os dados, e cria a ordem manual (`order`) pela
 * ordem de criação. Em bancos novos não faz nada.
 */

function findOrNull(app, name) {
  try {
    return app.findCollectionByNameOrId(name)
  } catch (_) {
    return null
  }
}

migrate(
  (app) => {
    const cycles = findOrNull(app, 'cycles')
    if (!cycles) return
    cycles.name = 'sprints'
    cycles.indexes = ['CREATE INDEX idx_sprints_project ON sprints (project_id, state)']
    if (!cycles.fields.getByName('order')) cycles.fields.add(new NumberField({ name: 'order', onlyInt: true }))
    app.save(cycles)
    app.findRecordsByFilter('sprints', "id != ''", 'created', 0, 0).forEach((record, index) => {
      record.set('order', index + 1)
      app.save(record)
    })

    const tasks = app.findCollectionByNameOrId('tasks')
    const field = tasks.fields.getByName('cycle_id')
    if (field) {
      tasks.removeIndex('idx_tasks_cycle')
      field.name = 'sprint_id'
      tasks.addIndex('idx_tasks_sprint', false, 'sprint_id', '')
      app.save(tasks)
    }

    // histórico já gravado com o nome antigo
    app.db().newQuery("UPDATE audit_logs SET entity_type = 'sprint', action = REPLACE(action, 'cycle.', 'sprint.') WHERE entity_type = 'cycle'").execute()
  },
  () => {
    // sem volta: o nome antigo deixou de existir no código
  },
)
