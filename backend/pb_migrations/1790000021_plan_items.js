/// <reference path="../pb_data/types.d.ts" />

/**
 * Gerenciamento de Projetos — elementos do plano, módulo à parte das tarefas (quadro estilo Monday).
 * - Permissões plan.view / plan.edit / plan.manage e concessões padrão (idempotente).
 * - plan_statuses: etiquetas de status do quadro, por projeto (nome, cor, categoria para o progresso).
 * - plan_resources: etiquetas de recursos do quadro, por projeto (ex.: "Gerente de Projetos", "Cliente").
 * - plan_items: elementos (em um grupo) e subelementos (parent_id): status, cronograma, recursos,
 *   esforço estimado, duração em dias, progresso; subelemento também tem responsável, data e realizado
 *   (`metrics` = { estimated_hours, actual_hours, duration_days }, nulo ≠ zero).
 * - Limpeza: bancos que rodaram uma versão antiga da 1790000020 tinham campos do plano nas tarefas —
 *   eles saem aqui (as tarefas não fazem parte do plano).
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }
const PLAN_PERMISSIONS = ['plan.view', 'plan.edit', 'plan.manage']
const GRANTS = {
  ADMIN: ['plan.view', 'plan.edit', 'plan.manage'],
  MANAGER: ['plan.view', 'plan.edit', 'plan.manage'],
  MEMBER: ['plan.view', 'plan.edit'],
  VIEWER: ['plan.view'],
}
const LEGACY_TASK_FIELDS = ['group_id', 'plan_position', 'progress', 'progress_set', 'resource_ids']

migrate(
  (app) => {
    const plan = require(`${__hooks}/src/domain/plan.js`)
    const { OPTION_COLORS } = require(`${__hooks}/src/domain/custom-field.js`)

    // limpeza de versões antigas: o plano não usa as tarefas
    const tasks = app.findCollectionByNameOrId('tasks')
    const legacy = LEGACY_TASK_FIELDS.filter((name) => !!tasks.fields.getByName(name))
    if (legacy.length > 0) {
      try {
        tasks.removeIndex('idx_tasks_plan')
      } catch (_) {
        // índice ausente
      }
      legacy.forEach((name) => tasks.fields.removeByName(name))
      app.save(tasks)
    }

    // permissões + concessões padrão
    const permissionIds = {}
    PLAN_PERMISSIONS.forEach((code) => {
      let record
      try {
        record = app.findFirstRecordByData('permissions', 'code', code)
      } catch (_) {
        record = new Record(app.findCollectionByNameOrId('permissions'))
        record.set('code', code)
        record.set('module', 'plan')
        app.save(record)
      }
      permissionIds[code] = record.id
    })
    Object.keys(GRANTS).forEach((roleCode) => {
      let role
      try {
        role = app.findFirstRecordByData('roles', 'code', roleCode)
      } catch (_) {
        return
      }
      GRANTS[roleCode].forEach((code) => {
        const existing = app.findRecordsByFilter('role_permissions', 'role_id = {:r} && permission_id = {:p}', '', 1, 0, { r: role.id, p: permissionIds[code] })
        if (existing.length > 0) return
        const link = new Record(app.findCollectionByNameOrId('role_permissions'))
        link.set('role_id', role.id)
        link.set('permission_id', permissionIds[code])
        app.save(link)
      })
    })

    const users = app.findCollectionByNameOrId('users')
    const projects = app.findCollectionByNameOrId('projects')
    const groups = app.findCollectionByNameOrId('project_groups')

    const statuses = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'plan_statuses',
        fields: [
          { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
          { name: 'name', type: 'text', required: true, max: plan.STATUS_NAME_MAX },
          { name: 'color', type: 'select', required: true, maxSelect: 1, values: OPTION_COLORS },
          { name: 'category', type: 'select', required: true, maxSelect: 1, values: plan.STATUS_CATEGORIES },
          { name: 'position', type: 'number' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_plan_statuses_project ON plan_statuses (project_id, position)'],
      }),
    )
    app.save(statuses)

    const resources = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'plan_resources',
        fields: [
          { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
          { name: 'name', type: 'text', required: true, max: plan.RESOURCE_NAME_MAX },
          { name: 'name_key', type: 'text', required: true, max: plan.RESOURCE_NAME_MAX },
          { name: 'color', type: 'select', required: true, maxSelect: 1, values: OPTION_COLORS },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_plan_resources_name ON plan_resources (project_id, name_key)'],
      }),
    )
    app.save(resources)

    const items = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'plan_items',
        fields: [
          { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
          { name: 'group_id', type: 'relation', required: true, collectionId: groups.id, maxSelect: 1, cascadeDelete: true },
          { name: 'parent_id', type: 'text', max: 15 },
          { name: 'name', type: 'text', required: true, max: plan.ITEM_NAME_MAX },
          { name: 'status_id', type: 'text', max: 15 },
          { name: 'start_date', type: 'date' },
          { name: 'end_date', type: 'date' },
          { name: 'due_date', type: 'date' },
          { name: 'owner_id', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'resource_ids', type: 'relation', collectionId: resources.id, maxSelect: plan.MAX_RESOURCES, cascadeDelete: false },
          // esforço estimado, realizado (h) e duração manual (dias): nulo ≠ zero ("0" é um valor válido)
          { name: 'metrics', type: 'json', maxSize: 2000 },
          { name: 'progress', type: 'number', onlyInt: true },
          { name: 'progress_set', type: 'bool' },
          { name: 'position', type: 'number' },
          { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_plan_items_order ON plan_items (project_id, group_id, parent_id, position)'],
      }),
    )
    app.save(items)
  },
  (app) => {
    ;['plan_items', 'plan_resources', 'plan_statuses'].forEach((name) => app.delete(app.findCollectionByNameOrId(name)))
  },
)
