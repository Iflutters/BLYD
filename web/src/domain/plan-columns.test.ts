import { describe, expect, it } from 'vitest'
import { COLUMN_TYPES, customColumnId, customSortKey, isCustomColumnId, isSafeLink, isSortableType, optionOf, sumCustom, type PlanColumn } from './plan-columns'

const fase: PlanColumn = { id: 'c1', name: 'Fase', type: 'dropdown', settings: { options: [{ id: 'o1', name: 'Piloto', color: 'blue' }, { id: 'o2', name: 'Produção', color: 'green' }] }, position: 1 }
const custo: PlanColumn = { id: 'c2', name: 'Custo', type: 'number', settings: { unit: 'R$' }, position: 2 }

describe('domain/plan-columns', () => {
  it('tipos iguais aos do servidor; ids das colunas no quadro com prefixo próprio', () => {
    expect(COLUMN_TYPES).toEqual(['text', 'number', 'date', 'checkbox', 'dropdown', 'people', 'link'])
    expect(customColumnId('c1')).toBe('custom:c1')
    expect(isCustomColumnId('custom:c1')).toBe(true)
    expect(isCustomColumnId('status')).toBe(false)
  })

  it('ordenar: lista pela ordem das opções, número pelo valor, texto sem acento; pessoa não ordena', () => {
    expect(customSortKey(fase, 'o2')).toBe(1)
    expect(customSortKey(fase, 'apagada')).toBeNull()
    expect(customSortKey(custo, 12)).toBe(12)
    expect(customSortKey({ ...custo, type: 'text' }, 'Ábaco')).toBe('abaco')
    expect(customSortKey({ ...custo, type: 'checkbox' }, true)).toBe(1)
    expect(customSortKey({ ...custo, type: 'text' }, undefined)).toBeNull()
    expect(isSortableType('people')).toBe(false)
    expect(isSortableType('date')).toBe(true)
  })

  it('soma das colunas numéricas (rodapé dos recortes), opção pelo id e link seguro', () => {
    expect(sumCustom([{ custom: { c2: 2.5 } }, { custom: { c2: 1 } }, { custom: {} }], [fase, custo])).toEqual({ c2: 3.5 })
    expect(sumCustom([{ custom: {} }], [custo])).toEqual({ c2: null })
    expect(optionOf(fase, 'o1')?.name).toBe('Piloto')
    expect(isSafeLink('https://acme.com/a?b=1')).toBe(true)
    expect(isSafeLink('javascript:alert(1)')).toBe(false)
  })
})
