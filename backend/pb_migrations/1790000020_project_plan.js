/// <reference path="../pb_data/types.d.ts" />

/**
 * Gerenciamento de Projetos (docs/diretriz_feature_gerenciamento_projetos.md) — módulo à parte das tarefas.
 * - project_groups: grupos/fases do plano (até 2 níveis: 2.0 Planejamento → 2.1 Plano do Projeto), com cor e posição.
 * Os elementos do plano (atividades, reuniões, alinhamentos) e as etiquetas vêm na migration 1790000021.
 * Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

migrate(
  (app) => {
    const { GROUP_NAME_MAX } = require(`${__hooks}/src/domain/plan.js`)
    const { OPTION_COLORS } = require(`${__hooks}/src/domain/custom-field.js`)
    const users = app.findCollectionByNameOrId('users')
    const projects = app.findCollectionByNameOrId('projects')
    const groups = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'project_groups',
        fields: [
          { name: 'project_id', type: 'relation', required: true, collectionId: projects.id, maxSelect: 1, cascadeDelete: true },
          { name: 'parent_id', type: 'text', max: 15 },
          { name: 'name', type: 'text', required: true, max: GROUP_NAME_MAX },
          { name: 'color', type: 'select', required: true, maxSelect: 1, values: OPTION_COLORS },
          { name: 'position', type: 'number' },
          { name: 'created_by', type: 'relation', collectionId: users.id, maxSelect: 1, cascadeDelete: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_project_groups_order ON project_groups (project_id, parent_id, position)'],
      }),
    )
    app.save(groups)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('project_groups'))
  },
)
