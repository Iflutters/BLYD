/// <reference path="../pb_data/types.d.ts" />

/**
 * Anexos em comentários: `attachments.comment_id` (vazio = anexo da tarefa).
 * Excluir um comentário é lógico; os arquivos dele são apagados pelo caso de uso.
 */

migrate(
  (app) => {
    const attachments = app.findCollectionByNameOrId('attachments')
    const comments = app.findCollectionByNameOrId('comments')
    attachments.fields.add(new RelationField({ name: 'comment_id', collectionId: comments.id, maxSelect: 1, cascadeDelete: true }))
    attachments.addIndex('idx_attachments_comment', false, 'comment_id', '')
    app.save(attachments)
  },
  (app) => {
    const attachments = app.findCollectionByNameOrId('attachments')
    attachments.removeIndex('idx_attachments_comment')
    attachments.fields.removeByName('comment_id')
    app.save(attachments)
  },
)
