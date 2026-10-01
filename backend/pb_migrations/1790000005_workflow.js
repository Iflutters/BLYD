/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 4a — Status e prioridades de tarefas.
 *
 * Collections: task_statuses, task_priorities. A carga inicial (fluxo da diretriz §14) é DADO
 * editável pelo administrador. Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

const autodates = () => [
  { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
]

/** [chave, nome, categoria, cor, padrão] */
const STATUSES = [
  ['BACKLOG', 'Backlog', 'backlog', 'gray', true],
  ['TRIAGEM', 'Triagem', 'todo', 'violet', false],
  ['ANALISE', 'Análise', 'todo', 'indigo', false],
  ['PRIORIZADO', 'Priorizado', 'todo', 'blue', false],
  ['DESENVOLVIMENTO', 'Desenvolvimento', 'in_progress', 'amber', false],
  ['HOMOLOGACAO', 'Homologação', 'in_progress', 'orange', false],
  ['PRODUCAO', 'Produção', 'in_progress', 'teal', false],
  ['CONCLUIDO', 'Concluído', 'done', 'green', false],
  ['CANCELADO', 'Cancelado', 'cancelled', 'red', false],
]

/** [chave, nome, cor, padrão] — ordem = da mais para a menos urgente */
const PRIORITIES = [
  ['CRITICA', 'Crítica', 'red', false],
  ['ALTA', 'Alta', 'orange', false],
  ['MEDIA', 'Média', 'amber', true],
  ['BAIXA', 'Baixa', 'green', false],
]

function lookupFields(extra) {
  return [
    { name: 'key', type: 'text', required: true, max: 30 },
    { name: 'name', type: 'text', required: true, max: 60, presentable: true },
    { name: 'description', type: 'text', max: 255 },
    { name: 'color', type: 'text', max: 20 },
    { name: 'order', type: 'number', onlyInt: true },
    { name: 'is_active', type: 'bool' },
    { name: 'is_default', type: 'bool' },
  ]
    .concat(extra)
    .concat(autodates())
}

migrate(
  (app) => {
    const { STATUS_CATEGORIES } = require(`${__hooks}/src/domain/workflow.js`)

    const statuses = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'task_statuses',
        fields: lookupFields([{ name: 'category', type: 'select', required: true, maxSelect: 1, values: STATUS_CATEGORIES }]),
        indexes: ['CREATE UNIQUE INDEX idx_task_statuses_key ON task_statuses (key)', 'CREATE INDEX idx_task_statuses_order ON task_statuses ("order")'],
      }),
    )
    app.save(statuses)

    const priorities = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'task_priorities',
        fields: lookupFields([]),
        indexes: ['CREATE UNIQUE INDEX idx_task_priorities_key ON task_priorities (key)', 'CREATE INDEX idx_task_priorities_order ON task_priorities ("order")'],
      }),
    )
    app.save(priorities)

    STATUSES.forEach((def, order) => {
      const record = new Record(statuses)
      record.set('key', def[0])
      record.set('name', def[1])
      record.set('category', def[2])
      record.set('color', def[3])
      record.set('is_default', def[4])
      record.set('is_active', true)
      record.set('order', order)
      app.save(record)
    })
    PRIORITIES.forEach((def, order) => {
      const record = new Record(priorities)
      record.set('key', def[0])
      record.set('name', def[1])
      record.set('color', def[2])
      record.set('is_default', def[3])
      record.set('is_active', true)
      record.set('order', order)
      app.save(record)
    })
  },
  (app) => {
    ;['task_priorities', 'task_statuses'].forEach((name) => {
      app.delete(app.findCollectionByNameOrId(name))
    })
  },
)
