/// <reference path="../pb_data/types.d.ts" />

/**
 * Fase 3 — Tipos de tarefa e campos personalizados.
 *
 * Collections: custom_fields, custom_field_options, task_types, task_type_fields.
 * A carga inicial (tipos e campos da diretriz §9) é DADO editável pelo administrador,
 * não regra de código. Regras de API nulas: acesso somente por /api/v1.
 */

const LOCKED_RULES = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null }

const autodates = () => [
  { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
]

/** Biblioteca inicial de campos. */
const FIELDS = [
  { name: 'ambiente', label: 'Ambiente', type: 'select', filterable: true, options: [['Produção', 'red'], ['Homologação', 'amber'], ['Desenvolvimento', 'blue']] },
  { name: 'versao', label: 'Versão', type: 'text', config: { max_length: 50 }, searchable: true, filterable: true },
  { name: 'severidade', label: 'Severidade', type: 'select', filterable: true, sortable: true, options: [['Crítica', 'red'], ['Alta', 'orange'], ['Média', 'amber', true], ['Baixa', 'green']] },
  { name: 'passos_para_reproducao', label: 'Passos para reprodução', type: 'textarea', searchable: true },
  { name: 'resultado_esperado', label: 'Resultado esperado', type: 'textarea', searchable: true },
  { name: 'resultado_atual', label: 'Resultado atual', type: 'textarea', searchable: true },
  { name: 'evidencias', label: 'Evidências', type: 'file' },
  { name: 'cliente_afetado', label: 'Cliente afetado', type: 'text', searchable: true, filterable: true },
  { name: 'modulo', label: 'Módulo', type: 'text', searchable: true, filterable: true },
  { name: 'requisito', label: 'Requisito', type: 'textarea', searchable: true },
  { name: 'criterios_de_aceite', label: 'Critérios de aceite', type: 'textarea', searchable: true },
  { name: 'estimativa', label: 'Estimativa (horas)', type: 'decimal', config: { decimals: 1, min: 0 }, filterable: true, sortable: true },
  { name: 'tecnologia', label: 'Tecnologia', type: 'text', filterable: true },
  { name: 'branch', label: 'Branch', type: 'text', searchable: true },
  { name: 'pull_request', label: 'Pull Request', type: 'url' },
  { name: 'versao_alvo', label: 'Versão alvo', type: 'text', config: { max_length: 50 }, filterable: true },
  { name: 'problema_atual', label: 'Problema atual', type: 'textarea', searchable: true },
  { name: 'proposta', label: 'Proposta', type: 'textarea', searchable: true },
  { name: 'beneficio_esperado', label: 'Benefício esperado', type: 'textarea', searchable: true },
  { name: 'impacto', label: 'Impacto', type: 'select', filterable: true, options: [['Alto', 'red'], ['Médio', 'amber'], ['Baixo', 'green']] },
  { name: 'area_solicitante', label: 'Área solicitante', type: 'text', filterable: true },
]

/** Tipos iniciais; campos: [nome, obrigatório, exibir no card]. */
const TYPES = [
  {
    key: 'BUG', name: 'Bug', icon: 'bug', color: 'red', description: 'Defeito encontrado no sistema',
    fields: [['ambiente', true, true], ['versao', false, false], ['severidade', true, true], ['passos_para_reproducao', true, false], ['resultado_esperado', true, false], ['resultado_atual', true, false], ['evidencias', false, false], ['cliente_afetado', false, false], ['modulo', false, true]],
  },
  {
    key: 'DESENVOLVIMENTO', name: 'Desenvolvimento', icon: 'code', color: 'blue', description: 'Construção de funcionalidade',
    fields: [['requisito', true, false], ['criterios_de_aceite', true, false], ['estimativa', false, true], ['tecnologia', false, false], ['branch', false, false], ['pull_request', false, false], ['versao_alvo', false, true]],
  },
  {
    key: 'MELHORIA', name: 'Melhoria', icon: 'sparkles', color: 'violet', description: 'Evolução de algo que já existe',
    fields: [['problema_atual', true, false], ['proposta', true, false], ['beneficio_esperado', false, false], ['impacto', false, true], ['area_solicitante', false, false], ['criterios_de_aceite', false, false]],
  },
  { key: 'ADEQUACAO', name: 'Adequação', icon: 'wrench', color: 'amber', description: 'Ajuste a norma, processo ou legislação', fields: [] },
  { key: 'NOVA_FUNCIONALIDADE', name: 'Nova funcionalidade', icon: 'plus-square', color: 'green', description: 'Algo que ainda não existe', fields: [] },
  { key: 'INTEGRACAO', name: 'Integração', icon: 'plug', color: 'teal', description: 'Comunicação entre sistemas', fields: [] },
  { key: 'SUPORTE', name: 'Suporte', icon: 'life-buoy', color: 'orange', description: 'Atendimento e dúvidas', fields: [] },
  { key: 'DOCUMENTACAO', name: 'Documentação', icon: 'book', color: 'gray', description: 'Manuais, guias e registros', fields: [] },
]

migrate(
  (app) => {
    const { FIELD_TYPES } = require(`${__hooks}/src/domain/custom-field.js`)

    const fields = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'custom_fields',
        fields: [
          { name: 'name', type: 'text', required: true, max: 40 },
          { name: 'label', type: 'text', required: true, max: 80, presentable: true },
          { name: 'type', type: 'select', required: true, maxSelect: 1, values: FIELD_TYPES },
          { name: 'description', type: 'text', max: 255 },
          { name: 'config', type: 'json', maxSize: 4096 },
          { name: 'default_value', type: 'json', maxSize: 4096 },
          { name: 'searchable', type: 'bool' },
          { name: 'filterable', type: 'bool' },
          { name: 'sortable', type: 'bool' },
        ].concat(autodates()),
        indexes: ['CREATE UNIQUE INDEX idx_custom_fields_name ON custom_fields (name)', 'CREATE INDEX idx_custom_fields_type ON custom_fields (type)'],
      }),
    )
    app.save(fields)

    const options = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'custom_field_options',
        fields: [
          { name: 'field_id', type: 'relation', required: true, collectionId: fields.id, maxSelect: 1, cascadeDelete: true },
          { name: 'label', type: 'text', required: true, max: 60 },
          { name: 'color', type: 'text', max: 20 },
          { name: 'order', type: 'number', onlyInt: true },
          { name: 'is_active', type: 'bool' },
        ].concat(autodates()),
        indexes: ['CREATE INDEX idx_custom_field_options_field ON custom_field_options (field_id)'],
      }),
    )
    app.save(options)

    const types = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'task_types',
        fields: [
          { name: 'key', type: 'text', required: true, max: 30 },
          { name: 'name', type: 'text', required: true, max: 60, presentable: true },
          { name: 'description', type: 'text', max: 255 },
          { name: 'icon', type: 'text', max: 30 },
          { name: 'color', type: 'text', max: 20 },
          { name: 'order', type: 'number', onlyInt: true },
          { name: 'is_active', type: 'bool' },
        ].concat(autodates()),
        indexes: ['CREATE UNIQUE INDEX idx_task_types_key ON task_types (key)', 'CREATE INDEX idx_task_types_order ON task_types ("order")'],
      }),
    )
    app.save(types)

    const typeFields = new Collection(
      Object.assign({}, LOCKED_RULES, {
        type: 'base',
        name: 'task_type_fields',
        fields: [
          { name: 'task_type_id', type: 'relation', required: true, collectionId: types.id, maxSelect: 1, cascadeDelete: true },
          { name: 'field_id', type: 'relation', required: true, collectionId: fields.id, maxSelect: 1, cascadeDelete: true },
          { name: 'order', type: 'number', onlyInt: true },
          { name: 'required', type: 'bool' },
          { name: 'visible', type: 'bool' },
          { name: 'show_on_card', type: 'bool' },
        ].concat(autodates()),
        indexes: [
          'CREATE UNIQUE INDEX idx_task_type_fields_pair ON task_type_fields (task_type_id, field_id)',
          'CREATE INDEX idx_task_type_fields_field ON task_type_fields (field_id)',
        ],
      }),
    )
    app.save(typeFields)

    // ---------------------------------------------------------------- carga inicial
    const fieldIds = {}
    FIELDS.forEach((def) => {
      const record = new Record(fields)
      record.set('name', def.name)
      record.set('label', def.label)
      record.set('type', def.type)
      record.set('description', '')
      record.set('config', def.config || (def.type === 'text' ? { max_length: 255 } : def.type === 'textarea' ? { max_length: 10000 } : {}))
      record.set('default_value', null)
      record.set('searchable', !!def.searchable)
      record.set('filterable', !!def.filterable)
      record.set('sortable', !!def.sortable)
      app.save(record)
      fieldIds[def.name] = record.id

      if (def.options) {
        const defaults = []
        def.options.forEach((opt, index) => {
          const option = new Record(options)
          option.set('field_id', record.id)
          option.set('label', opt[0])
          option.set('color', opt[1])
          option.set('order', index)
          option.set('is_active', true)
          app.save(option)
          if (opt[2]) defaults.push(option.id)
        })
        if (defaults.length > 0) {
          record.set('default_value', def.type === 'select' ? defaults[0] : defaults)
          app.save(record)
        }
      }
    })

    TYPES.forEach((def, order) => {
      const type = new Record(types)
      type.set('key', def.key)
      type.set('name', def.name)
      type.set('description', def.description)
      type.set('icon', def.icon)
      type.set('color', def.color)
      type.set('order', order)
      type.set('is_active', true)
      app.save(type)
      def.fields.forEach((link, index) => {
        const tf = new Record(typeFields)
        tf.set('task_type_id', type.id)
        tf.set('field_id', fieldIds[link[0]])
        tf.set('order', index)
        tf.set('required', link[1])
        tf.set('visible', true)
        tf.set('show_on_card', link[2])
        app.save(tf)
      })
    })
  },
  (app) => {
    ;['task_type_fields', 'task_types', 'custom_field_options', 'custom_fields'].forEach((name) => {
      app.delete(app.findCollectionByNameOrId(name))
    })
  },
)
