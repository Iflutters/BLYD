/// <reference path="../pb_data/types.d.ts" />

/**
 * Tipos de tarefa traduzidos (pedido do usuário em 2026-09-30).
 * - task_types.translations: { en: { name, description }, es: {…} } — o original (pt-BR) continua em
 *   name/description e é editável como sempre; o que faltar na tradução usa o original.
 * - Os 8 tipos padrão já vêm traduzidos. Cada texto só é traduzido se ainda for o padrão (nome ou
 *   descrição alterados pela empresa não recebem uma tradução que não combina) e se o tipo ainda
 *   não tiver tradução.
 */

const DEFAULTS = {
  BUG: {
    'pt-BR': ['Bug', 'Defeito encontrado no sistema'],
    en: ['Bug', 'Defect found in the system'],
    es: ['Error', 'Defecto encontrado en el sistema'],
  },
  DESENVOLVIMENTO: {
    'pt-BR': ['Desenvolvimento', 'Construção de funcionalidade'],
    en: ['Development', 'Building a feature'],
    es: ['Desarrollo', 'Construcción de funcionalidad'],
  },
  MELHORIA: {
    'pt-BR': ['Melhoria', 'Evolução de algo que já existe'],
    en: ['Improvement', 'Evolving something that already exists'],
    es: ['Mejora', 'Evolución de algo que ya existe'],
  },
  ADEQUACAO: {
    'pt-BR': ['Adequação', 'Ajuste a norma, processo ou legislação'],
    en: ['Compliance', 'Adjustment to a standard, process or legislation'],
    es: ['Adecuación', 'Ajuste a norma, proceso o legislación'],
  },
  NOVA_FUNCIONALIDADE: {
    'pt-BR': ['Nova funcionalidade', 'Algo que ainda não existe'],
    en: ['New feature', 'Something that does not exist yet'],
    es: ['Nueva funcionalidad', 'Algo que aún no existe'],
  },
  INTEGRACAO: {
    'pt-BR': ['Integração', 'Comunicação entre sistemas'],
    en: ['Integration', 'Communication between systems'],
    es: ['Integración', 'Comunicación entre sistemas'],
  },
  SUPORTE: {
    'pt-BR': ['Suporte', 'Atendimento e dúvidas'],
    en: ['Support', 'Help desk and questions'],
    es: ['Soporte', 'Atención y dudas'],
  },
  DOCUMENTACAO: {
    'pt-BR': ['Documentação', 'Manuais, guias e registros'],
    en: ['Documentation', 'Manuals, guides and records'],
    es: ['Documentación', 'Manuales, guías y registros'],
  },
}

migrate(
  (app) => {
    const types = app.findCollectionByNameOrId('task_types')
    types.fields.add(new JSONField({ name: 'translations', maxSize: 8192 }))
    app.save(types)

    Object.keys(DEFAULTS).forEach((key) => {
      let record = null
      try {
        record = app.findFirstRecordByData('task_types', 'key', key)
      } catch (_) {
        return
      }
      const current = record.getString('translations')
      if (current && current !== 'null' && current !== '{}') return
      const seed = DEFAULTS[key]
      const sameName = record.getString('name') === seed['pt-BR'][0]
      const sameDescription = record.getString('description') === seed['pt-BR'][1]
      if (!sameName && !sameDescription) return
      const translations = {}
      ;['en', 'es'].forEach((locale) => {
        const version = {}
        if (sameName) version.name = seed[locale][0]
        if (sameDescription) version.description = seed[locale][1]
        translations[locale] = version
      })
      record.set('translations', translations)
      app.save(record)
    })
  },
  (app) => {
    const types = app.findCollectionByNameOrId('task_types')
    types.fields.removeByName('translations')
    app.save(types)
  },
)
