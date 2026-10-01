/// <reference path="../pb_data/types.d.ts" />

/**
 * Expansão, Onda 2 — Documentação (docs/roadmap-expansao.md).
 * - Permissões docs.view / docs.edit / docs.manage e concessões padrão (idempotente; bancos novos
 *   já recebem pelo seed de permissões).
 * - doc_spaces: espaços (empresa ou projeto; visibilidade company/project).
 * - doc_pages: páginas em árvore (parent_id), conteúdo publicado + rascunho (JSON do editor já
 *   higienizado), texto para busca (search_text sem acento/maiúsculas) e número da versão.
 * - doc_page_versions: cada publicação.
 * - doc_files: imagens e arquivos das páginas (arquivo protegido; download pela API própria).
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }
const CONTENT_MAX = 3 * 1024 * 1024
const DOCS_PERMISSIONS = ['docs.view', 'docs.edit', 'docs.manage']
const GRANTS = {
  ADMIN: ['docs.view', 'docs.edit', 'docs.manage'],
  MANAGER: ['docs.view', 'docs.edit', 'docs.manage'],
  MEMBER: ['docs.view', 'docs.edit'],
  VIEWER: ['docs.view'],
}

migrate(
  (app) => {
    const { SPACE_VISIBILITIES, PAGE_STATUSES, SPACE_ICONS } = require(`${__hooks}/src/domain/docs.js`)
    const { OPTION_COLORS } = require(`${__hooks}/src/domain/custom-field.js`)
    const { MAX_FILE_SIZE, STORAGE_MIME_TYPES } = require(`${__hooks}/src/domain/attachment.js`)

    // permissões + concessões padrão
    const permissionIds = {}
    DOCS_PERMISSIONS.forEach((code) => {
      let record
      try {
        record = app.findFirstRecordByData('permissions', 'code', code)
      } catch (_) {
        record = new Record(app.findCollectionByNameOrId('permissions'))
        record.set('code', code)
        record.set('module', 'docs')
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

    const spaces = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'doc_spaces',
        fields: [
          { name: 'key', type: 'text', required: true, max: 10 },
          { name: 'name', type: 'text', required: true, max: 80 },
          { name: 'description', type: 'text', max: 500 },
          { name: 'icon', type: 'select', maxSelect: 1, values: SPACE_ICONS },
          { name: 'color', type: 'select', maxSelect: 1, values: OPTION_COLORS },
          { name: 'project_id', type: 'relation', collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
          { name: 'visibility', type: 'select', required: true, maxSelect: 1, values: SPACE_VISIBILITIES },
          { name: 'home_page_id', type: 'text', max: 15 },
          { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_doc_spaces_key ON doc_spaces (key)', 'CREATE INDEX idx_doc_spaces_project ON doc_spaces (project_id)'],
      }),
    )
    app.save(spaces)

    const pages = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'doc_pages',
        fields: [
          { name: 'space_id', type: 'relation', required: true, collectionId: spaces.id, maxSelect: 1, cascadeDelete: true },
          { name: 'parent_id', type: 'text', max: 15 },
          { name: 'title', type: 'text', required: true, max: 200 },
          { name: 'position', type: 'number' },
          { name: 'status', type: 'select', required: true, maxSelect: 1, values: PAGE_STATUSES },
          { name: 'content', type: 'json', maxSize: CONTENT_MAX },
          { name: 'content_text', type: 'text', max: 300000 },
          { name: 'search_text', type: 'text', max: 300500 },
          { name: 'version', type: 'number', onlyInt: true },
          { name: 'published_at', type: 'date' },
          { name: 'published_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'draft', type: 'json', maxSize: CONTENT_MAX },
          { name: 'draft_title', type: 'text', max: 200 },
          { name: 'draft_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'draft_at', type: 'date' },
          { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_doc_pages_tree ON doc_pages (space_id, parent_id, position)', 'CREATE INDEX idx_doc_pages_status ON doc_pages (space_id, status, published_at)'],
      }),
    )
    app.save(pages)

    const versions = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'doc_page_versions',
        fields: [
          { name: 'page_id', type: 'relation', required: true, collectionId: pages.id, maxSelect: 1, cascadeDelete: true },
          { name: 'version', type: 'number', required: true, onlyInt: true, min: 1 },
          { name: 'title', type: 'text', required: true, max: 200 },
          { name: 'content', type: 'json', maxSize: CONTENT_MAX },
          { name: 'author', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_doc_versions_page ON doc_page_versions (page_id, version)'],
      }),
    )
    app.save(versions)

    const files = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'doc_files',
        fields: [
          { name: 'space_id', type: 'relation', required: true, collectionId: spaces.id, maxSelect: 1, cascadeDelete: true },
          { name: 'page_id', type: 'relation', required: true, collectionId: pages.id, maxSelect: 1, cascadeDelete: true },
          { name: 'file', type: 'file', required: true, maxSelect: 1, maxSize: MAX_FILE_SIZE, mimeTypes: STORAGE_MIME_TYPES, protected: true },
          { name: 'name', type: 'text', required: true, max: 200 },
          { name: 'mime', type: 'text', required: true, max: 120 },
          { name: 'kind', type: 'select', required: true, maxSelect: 1, values: ['image', 'document'] },
          { name: 'size', type: 'number', onlyInt: true },
          { name: 'uploaded_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: ['CREATE INDEX idx_doc_files_page ON doc_files (page_id, created)'],
      }),
    )
    app.save(files)
  },
  (app) => {
    ;['doc_files', 'doc_page_versions', 'doc_pages', 'doc_spaces'].forEach((name) => {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {
        // já removida
      }
    })
    DOCS_PERMISSIONS.forEach((code) => {
      try {
        app.delete(app.findFirstRecordByData('permissions', 'code', code))
      } catch (_) {
        // já removida
      }
    })
  },
)
