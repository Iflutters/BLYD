/// <reference path="../pb_data/types.d.ts" />

/**
 * Gerenciamento de Projetos — imagens e arquivos na própria atualização do elemento (em vez da aba
 * Arquivos do painel): `plan_item_files.update_id` liga o arquivo à atualização em que foi colado
 * ou anexado. Arquivos enviados antes pela aba (sem atualização) continuam guardados.
 */

migrate(
  (app) => {
    const files = app.findCollectionByNameOrId('plan_item_files')
    const updates = app.findCollectionByNameOrId('plan_item_updates')
    if (!files.fields.getByName('update_id')) files.fields.add(new RelationField({ name: 'update_id', collectionId: updates.id, maxSelect: 1, cascadeDelete: true }))
    files.indexes = files.indexes.concat(['CREATE INDEX idx_plan_item_files_update ON plan_item_files (update_id)'])
    app.save(files)
  },
  (app) => {
    const files = app.findCollectionByNameOrId('plan_item_files')
    files.indexes = files.indexes.filter((index) => index.indexOf('idx_plan_item_files_update') < 0)
    if (files.fields.getByName('update_id')) files.fields.removeByName('update_id')
    app.save(files)
  },
)
