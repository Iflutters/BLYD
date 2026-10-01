/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 2 — Projetos: collections `projects` e `project_members`
 * e a permissão `projects.view_all` (concedida ao perfil ADMIN).
 * Regras de API nulas: acesso somente pela API /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

const autodates = () => [
  { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
]

function ensurePermission(app, code, module, roleCode) {
  let permission
  try {
    permission = app.findFirstRecordByData('permissions', 'code', code)
  } catch (_) {
    permission = new Record(app.findCollectionByNameOrId('permissions'))
    permission.set('code', code)
    permission.set('module', module)
    app.save(permission)
  }
  const role = app.findFirstRecordByData('roles', 'code', roleCode)
  const existing = app.findRecordsByFilter(
    'role_permissions',
    'role_id = {:role} && permission_id = {:permission}',
    '',
    1,
    0,
    { role: role.id, permission: permission.id },
  )
  if (existing.length === 0) {
    const link = new Record(app.findCollectionByNameOrId('role_permissions'))
    link.set('role_id', role.id)
    link.set('permission_id', permission.id)
    app.save(link)
  }
}

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const { PROJECT_STATUS, PROJECT_PRIORITY, MEMBER_ROLES } = require(`${__hooks}/src/domain/project.js`)

    const projects = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'projects',
        fields: [
          { name: 'name', type: 'text', required: true, max: 120, presentable: true },
          { name: 'key', type: 'text', required: true, max: 10 },
          { name: 'description', type: 'text', max: 10000 },
          { name: 'icon', type: 'text', max: 30 },
          { name: 'cover', type: 'text', max: 30 },
          { name: 'status', type: 'select', required: true, maxSelect: 1, values: PROJECT_STATUS },
          { name: 'priority', type: 'select', required: true, maxSelect: 1, values: PROJECT_PRIORITY },
          { name: 'owner_id', type: 'relation', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'start_date', type: 'date' },
          { name: 'due_date', type: 'date' },
          { name: 'archived_at', type: 'date' },
        ].concat(autodates()),
        indexes: [
          'CREATE UNIQUE INDEX idx_projects_key ON projects (key)',
          'CREATE INDEX idx_projects_owner ON projects (owner_id)',
          'CREATE INDEX idx_projects_status ON projects (status)',
          'CREATE INDEX idx_projects_archived ON projects (archived_at)',
          'CREATE INDEX idx_projects_name ON projects (name)',
        ],
      }),
    )
    app.save(projects)

    const members = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'project_members',
        fields: [
          { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
          { name: 'user_id', type: 'relation', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
          { name: 'role', type: 'select', required: true, maxSelect: 1, values: MEMBER_ROLES },
        ].concat(autodates()),
        indexes: [
          'CREATE UNIQUE INDEX idx_project_members_pair ON project_members (project_id, user_id)',
          'CREATE INDEX idx_project_members_user ON project_members (user_id)',
        ],
      }),
    )
    app.save(members)

    ensurePermission(app, 'projects.view_all', 'projects', 'ADMIN')
  },
  (app) => {
    ;['project_members', 'projects'].forEach((name) => app.delete(app.findCollectionByNameOrId(name)))
    try {
      app.delete(app.findFirstRecordByData('permissions', 'code', 'projects.view_all'))
    } catch (_) {
      // já removida
    }
  },
)
