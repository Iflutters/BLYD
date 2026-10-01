import { describe, expect, it } from 'vitest'
import {
  addMonths,
  dateOrder,
  formatDayValue,
  formatTyped,
  maskTyped,
  monthGrid,
  parseDay,
  parseTyped,
  weekStartFor,
  weekdayNames,
} from './calendar'

describe('core/utils/calendar', () => {
  it('converte e valida AAAA-MM-DD', () => {
    expect(parseDay('2026-02-28')).toEqual({ year: 2026, month: 1, day: 28 })
    expect(parseDay('2026-02-30')).toBeNull()
    expect(parseDay('')).toBeNull()
    expect(formatDayValue({ year: 2026, month: 8, day: 1 })).toBe('2026-09-01')
  })

  it('soma meses sem estourar o fim do mês', () => {
    expect(addMonths({ year: 2026, month: 0, day: 31 }, 1)).toEqual({ year: 2026, month: 1, day: 28 })
    expect(addMonths({ year: 2026, month: 0, day: 15 }, -1)).toEqual({ year: 2025, month: 11, day: 15 })
  })

  it('monta grade de 6 semanas respeitando o início da semana', () => {
    // setembro/2026 começa numa terça-feira
    const sundayStart = monthGrid(2026, 8, 0)
    expect(sundayStart).toHaveLength(42)
    expect(sundayStart[0]).toEqual({ year: 2026, month: 7, day: 30 })
    expect(sundayStart[2]).toEqual({ year: 2026, month: 8, day: 1 })
    const mondayStart = monthGrid(2026, 8, 1)
    expect(mondayStart[0]).toEqual({ year: 2026, month: 7, day: 31 })
  })

  it('idioma define início da semana e nomes', () => {
    expect(weekStartFor('pt-BR')).toBe(0)
    expect(weekStartFor('es')).toBe(1)
    expect(weekdayNames('pt-BR', 0, 'narrow')[0]).toBe('D')
  })

  it('digitação com máscara na ordem do idioma', () => {
    expect(dateOrder('pt-BR')).toEqual(['day', 'month', 'year'])
    expect(dateOrder('en')).toEqual(['month', 'day', 'year'])
    expect(maskTyped('01092026', 'pt-BR')).toBe('01/09/2026')
    expect(maskTyped('0109', 'pt-BR')).toBe('01/09')
    expect(parseTyped('01/09/2026', 'pt-BR')).toEqual({ year: 2026, month: 8, day: 1 })
    expect(parseTyped('09/01/2026', 'en')).toEqual({ year: 2026, month: 8, day: 1 })
    expect(parseTyped('31/02/2026', 'pt-BR')).toBeNull()
    expect(parseTyped('01/09/26', 'pt-BR')).toBeNull()
    expect(formatTyped({ year: 2026, month: 8, day: 1 }, 'pt-BR')).toBe('01/09/2026')
  })
})
