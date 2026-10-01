/// <reference path="../pb_data/types.d.ts" />

/**
 * Obrigatoriedade por status (diretriz §9, pedido do usuário em 2026-09-30).
 * task_type_fields.required_status_ids: IDs dos status em que o campo passa a ser exigido
 * (além de `required`, que vale em todos). Vazio = só o `required` geral.
 */

migrate(
  (app) => {
    const links = app.findCollectionByNameOrId('task_type_fields')
    links.fields.add(new JSONField({ name: 'required_status_ids', maxSize: 4096 }))
    app.save(links)
  },
  (app) => {
    const links = app.findCollectionByNameOrId('task_type_fields')
    links.fields.removeByName('required_status_ids')
    app.save(links)
  },
)
