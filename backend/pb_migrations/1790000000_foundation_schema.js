/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 1 — Fundação: esquema de RBAC, sessões e auditoria.
 *
 * Todas as collections ficam com regras de API nulas (somente superusuário):
 * o acesso da aplicação acontece exclusivamente pela API /api/v1 (pb_hooks),
 * que aplica autenticação, RBAC e auditoria. Isso evita IDOR pela API genérica do PocketBase.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

const autodates = () => [
  { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
]

migrate(
  (app) => {
    // permissions — catálogo definido pelo sistema
    const permissions = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'permissions',
        fields: [
          { name: 'code', type: 'text', required: true, max: 64, presentable: true },
          { name: 'module', type: 'text', required: true, max: 32 },
          { name: 'description', type: 'text', max: 255 },
        ].concat(autodates()),
        indexes: ['CREATE UNIQUE INDEX idx_permissions_code ON permissions (code)'],
      }),
    )
    app.save(permissions)

    // roles — perfis configuráveis
    const roles = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'roles',
        fields: [
          { name: 'code', type: 'text', required: true, max: 32, presentable: true },
          { name: 'name', type: 'text', required: true, max: 60 },
          { name: 'description', type: 'text', max: 255 },
          { name: 'is_system', type: 'bool' },
        ].concat(autodates()),
        indexes: ['CREATE UNIQUE INDEX idx_roles_code ON roles (code)'],
      }),
    )
    app.save(roles)

    // role_permissions — N:N perfil x permissão
    const rolePermissions = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'role_permissions',
        fields: [
          { name: 'role_id', type: 'relation', required: true, collectionId: roles.id, maxSelect: 1, cascadeDelete: true },
          {
            name: 'permission_id',
            type: 'relation',
            required: true,
            collectionId: permissions.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
        ].concat(autodates()),
        indexes: [
          'CREATE UNIQUE INDEX idx_role_permissions_pair ON role_permissions (role_id, permission_id)',
          'CREATE INDEX idx_role_permissions_permission ON role_permissions (permission_id)',
        ],
      }),
    )
    app.save(rolePermissions)

    // users — campos de domínio; autenticação por senha do PocketBase desativada (login só via /api/v1/auth)
    const users = app.findCollectionByNameOrId('users')
    unmarshal(LOCKED_RULES, users)
    users.manageRule = null
    users.passwordAuth.enabled = false
    users.authAlert.enabled = false
    users.fields.add(new SelectField({ name: 'status', required: true, maxSelect: 1, values: ['active', 'disabled'] }))
    users.fields.add(
      new RelationField({ name: 'role_id', required: true, collectionId: roles.id, maxSelect: 1, cascadeDelete: false }),
    )
    users.fields.add(new DateField({ name: 'last_login_at' }))
    users.fields.add(new SelectField({ name: 'locale', maxSelect: 1, values: ['pt-BR', 'en', 'es'] }))
    users.fields.add(new SelectField({ name: 'theme', maxSelect: 1, values: ['light', 'dark', 'system'] }))
    users.addIndex('idx_users_role', false, 'role_id', '')
    users.addIndex('idx_users_status', false, 'status', '')
    users.addIndex('idx_users_name', false, 'name', '')
    app.save(users)

    // sessions — sessões web opacas (token guardado apenas como hash SHA-256)
    const sessions = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'sessions',
        fields: [
          { name: 'user_id', type: 'relation', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
          { name: 'token_hash', type: 'text', required: true, max: 128, hidden: true },
          { name: 'ip', type: 'text', max: 64 },
          { name: 'user_agent', type: 'text', max: 512 },
          { name: 'remember', type: 'bool' },
          { name: 'expires_at', type: 'date', required: true },
          { name: 'last_seen_at', type: 'date', required: true },
          { name: 'revoked_at', type: 'date' },
        ].concat(autodates()),
        indexes: [
          'CREATE UNIQUE INDEX idx_sessions_token_hash ON sessions (token_hash)',
          'CREATE INDEX idx_sessions_user ON sessions (user_id)',
          'CREATE INDEX idx_sessions_expires ON sessions (expires_at)',
        ],
      }),
    )
    app.save(sessions)

    // audit_logs — histórico imutável (sem rota de edição/exclusão)
    const auditLogs = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'audit_logs',
        fields: [
          { name: 'entity_type', type: 'text', required: true, max: 50 },
          { name: 'entity_id', type: 'text', required: true, max: 40 },
          { name: 'action', type: 'text', required: true, max: 80 },
          { name: 'old_value', type: 'json', maxSize: 65536 },
          { name: 'new_value', type: 'json', maxSize: 65536 },
          { name: 'user_id', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'ip', type: 'text', max: 64 },
          { name: 'user_agent', type: 'text', max: 512 },
          { name: 'correlation_id', type: 'text', max: 64 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: [
          'CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id)',
          'CREATE INDEX idx_audit_entity_id ON audit_logs (entity_id)',
          'CREATE INDEX idx_audit_user ON audit_logs (user_id)',
          'CREATE INDEX idx_audit_created ON audit_logs (created)',
        ],
      }),
    )
    app.save(auditLogs)
  },
  (app) => {
    ;['audit_logs', 'sessions', 'role_permissions'].forEach((name) => {
      app.delete(app.findCollectionByNameOrId(name))
    })
    const users = app.findCollectionByNameOrId('users')
    ;['status', 'role_id', 'last_login_at', 'locale', 'theme'].forEach((name) => users.fields.removeByName(name))
    ;['idx_users_role', 'idx_users_status', 'idx_users_name'].forEach((name) => users.removeIndex(name))
    users.passwordAuth.enabled = true
    app.save(users)
    ;['roles', 'permissions'].forEach((name) => {
      app.delete(app.findCollectionByNameOrId(name))
    })
  },
)
