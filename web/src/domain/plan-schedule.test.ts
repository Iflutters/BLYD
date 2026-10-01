import { describe, expect, it } from 'vitest'
import type { Plan, PlanItem, PlanStatus } from './plan'
import { battery, baselineSpan, fitZoom, itemSpan, scheduleCsv, scheduleRange, slipDays } from './plan-schedule'
import { dayFromIso } from './timeline'

const status = (id: string, category: PlanStatus['category'], position: number): PlanStatus => ({ id, name: id, color: 'blue', category, position })
const item = (id: string, extra: Partial<PlanItem> = {}): PlanItem => ({
  id,
  groupId: 'g1',
  parentId: null,
  name: id,
  statusId: null,
  startDate: null,
  endDate: null,
  dueDate: null,
  owner: null,
  resourceIds: [],
  estimatedHours: null,
  actualHours: null,
  durationDays: null,
  durationManual: null,
  progress: { value: 0, source: 'none' },
  progressManual: null,
  subitems: 0,
  position: 1,
  blocked: false,
  updates: 0,
  files: 0,
  baselineStart: null,
  baselineEnd: null,
  ...extra,
})

describe('domain/plan-schedule', () => {
  it('período da barra: início→fim; uma data só = um dia; sem datas = null; linha de base igual', () => {
    expect(itemSpan(item('a', { startDate: '2024-01-26', endDate: '2024-01-27' }))).toEqual({ start: dayFromIso('2024-01-26'), end: dayFromIso('2024-01-27') })
    expect(itemSpan(item('a', { endDate: '2024-01-27' }))).toEqual({ start: dayFromIso('2024-01-27'), end: dayFromIso('2024-01-27') })
    expect(itemSpan(item('a'))).toBeNull()
    expect(baselineSpan(item('a', { baselineStart: '2024-01-26', baselineEnd: '2024-01-28' }))).toEqual({ start: dayFromIso('2024-01-26'), end: dayFromIso('2024-01-28') })
    expect(baselineSpan(item('a'))).toBeNull()
  })

  it('desvio da linha de base: dias que o fim andou (+ atrasou, − adiantou)', () => {
    expect(slipDays(item('a', { endDate: '2024-02-09', baselineEnd: '2024-02-05' }))).toBe(4)
    expect(slipDays(item('a', { endDate: '2024-02-03', baselineEnd: '2024-02-05' }))).toBe(-2)
    expect(slipDays(item('a', { endDate: '2024-02-05' }))).toBeNull()
  })

  it('período exibido cobre cronograma, linha de base e hoje; ajuste automático escolhe a maior escala que cabe', () => {
    const range = scheduleRange([item('a', { startDate: '2024-01-26', endDate: '2024-01-27', baselineEnd: '2024-03-01', baselineStart: '2024-02-20' })], dayFromIso('2024-02-10'))
    expect(range.start).toBeLessThanOrEqual(dayFromIso('2024-01-26'))
    expect(range.end).toBeGreaterThanOrEqual(dayFromIso('2024-03-01'))
    const days = range.end - range.start + 1
    expect(fitZoom(range, days * 40)).toBe('day')
    expect(fitZoom(range, days * 18)).toBe('week')
    expect(fitZoom(range, days * 6)).toBe('month')
    expect(fitZoom(range, 10)).toBe('quarter')
  })

  it('Bateria: distribuição de status do quadro e o % feito', () => {
    const statuses = [status('todo', 'todo', 1), status('done', 'done', 2)]
    const result = battery({ items: 4, statusCounts: [{ statusId: 'done', count: 3 }, { statusId: null, count: 1 }], startDate: null, endDate: null, estimatedHours: 10, durationDays: null, progress: 75 }, statuses)
    expect(result.donePercent).toBe(75)
    expect(result.segments.map((s) => [s.statusId, s.percent])).toEqual([
      ['done', 75],
      [null, 25],
    ])
    expect(battery(null, statuses)).toEqual({ segments: [], donePercent: 0 })
  })

  it('exportar: CSV do cronograma no idioma (com linha de base), um elemento por linha, na ordem dos grupos', () => {
    const plan = {
      project: { id: 'p1', key: 'CLV', name: 'Clover', archived: false },
      capabilities: { edit: true, manage: true },
      statuses: [status('done', 'done', 1)],
      resources: [],
      groups: [{ id: 'g1', parentId: null, name: 'Iniciação', color: 'blue', position: 1, number: '1.0', summary: null }],
      items: [item('Kickoff', { statusId: 'done', startDate: '2024-01-26', endDate: '2024-01-27', durationDays: 2, estimatedHours: 1.5, progress: { value: 100, source: 'done' }, baselineStart: '2024-01-26', baselineEnd: '2024-01-26' }), item('Sub', { parentId: 'Kickoff' })],
      links: [],
      settings: { dependencyRule: 'warn', baselineAt: null },
      summary: null,
      truncated: false,
    } satisfies Plan
    const csv = scheduleCsv(plan, 'pt-BR', { group: 'Grupo', name: 'Elemento', status: 'Status', start: 'Início', end: 'Fim', duration: 'Duração', estimated: 'Esforço estimado', progress: 'Progresso', baselineStart: 'Base início', baselineEnd: 'Base fim' })
    expect(csv.split('\r\n').filter(Boolean)).toEqual([
      '﻿Grupo;Elemento;Status;Início;Fim;Duração;Esforço estimado;Progresso;Base início;Base fim',
      '1.0 Iniciação;Kickoff;done;26/01/2024;27/01/2024;2;1,5;100%;26/01/2024;26/01/2024',
    ])
  })
})
