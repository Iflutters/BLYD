/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 4d — Tags, checklist e comentários.
 *
 * - tags: cadastro global (nome único sem diferenciar maiúsculas, cor).
 * - task_tag_relations: tags de cada tarefa.
 * - tasks.checklist: itens { id, text, done } (JSON; até 100 itens).
 * - comments: comentários com edição e exclusão lógica (deleted_at) e menções (@) — IDs em `mentions`.
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    const tasks = app.findCollectionByNameOrId('tasks')

    const tags = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'tags',
        fields: [
          { name: 'name', type: 'text', required: true, max: 40, presentable: true },
          { name: 'name_key', type: 'text', required: true, max: 40 },
          { name: 'color', type: 'text', max: 20 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_tags_name_key ON tags (name_key)'],
      }),
    )
    app.save(tags)

    const relations = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'task_tag_relations',
        fields: [
          { name: 'task_id', type: 'relation', required: true, collectionId: tasks.id, maxSelect: 1, cascadeDelete: true },
          { name: 'tag_id', type: 'relation', required: true, collectionId: tags.id, maxSelect: 1, cascadeDelete: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_task_tags_pair ON task_tag_relations (task_id, tag_id)',
          'CREATE INDEX idx_task_tags_tag ON task_tag_relations (tag_id)',
        ],
      }),
    )
    app.save(relations)

    tasks.fields.add(new JSONField({ name: 'checklist', maxSize: 65536 }))
    app.save(tasks)

    const comments = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'comments',
        fields: [
          { name: 'task_id', type: 'relation', required: true, collectionId: tasks.id, maxSelect: 1, cascadeDelete: true },
          { name: 'user_id', type: 'relation', required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'content', type: 'text', max: 10000 },
          { name: 'mentions', type: 'json', maxSize: 4096 },
          { name: 'edited_at', type: 'date' },
          { name: 'deleted_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_comments_task ON comments (task_id, created)', 'CREATE INDEX idx_comments_user ON comments (user_id)'],
      }),
    )
    app.save(comments)
  },
  (app) => {
    ;['comments', 'task_tag_relations', 'tags'].forEach((name) => {
      app.delete(app.findCollectionByNameOrId(name))
    })
    const tasks = app.findCollectionByNameOrId('tasks')
    tasks.fields.removeByName('checklist')
    app.save(tasks)
  },
)
