import { describe, expect, it } from 'vitest'
import { isOverdue, isValidKey, normalizeKey, suggestKey } from './projects'

describe('domain/projects', () => {
  it('sugere chave a partir do nome', () => {
    expect(suggestKey('Projetos Internos')).toBe('PI')
    expect(suggestKey('CRM')).toBe('CRM')
    expect(suggestKey('Integrações')).toBe('INTEG')
    expect(suggestKey('SAP Business One')).toBe('SAP')
    expect(suggestKey('CRM Corporativo')).toBe('CRM')
    expect(suggestKey('Portal do Cliente')).toBe('PDC')
    // iniciais "2M" viram "M" (chave não começa com número); com menos de 2 letras, usa o nome inteiro
    expect(suggestKey('2026 Migração')).toBe('MIGRA')
    expect(suggestKey('')).toBe('')
  })

  it('valida e normaliza a chave', () => {
    expect(normalizeKey(' crm ')).toBe('CRM')
    expect(isValidKey('CRM')).toBe(true)
    expect(isValidKey('C')).toBe(false)
    expect(isValidKey('1AB')).toBe(false)
  })

  it('identifica prazo vencido', () => {
    const now = new Date('2026-03-10T12:00:00Z')
    expect(isOverdue({ dueDate: new Date('2026-03-09T00:00:00Z'), status: 'active' }, now)).toBe(true)
    expect(isOverdue({ dueDate: new Date('2026-03-10T00:00:00Z'), status: 'active' }, now)).toBe(false)
    expect(isOverdue({ dueDate: new Date('2026-03-09T00:00:00Z'), status: 'completed' }, now)).toBe(false)
    expect(isOverdue({ dueDate: null, status: 'active' }, now)).toBe(false)
  })
})
