import { describe, expect, it } from 'vitest'
import { groupRelations, relationCount, type TaskRelation } from './relations'
import type { TaskSummary } from './tasks'

const task = { id: 't', code: 'CRM-2', number: 2 } as TaskSummary
const rel = (id: string, type: TaskRelation['type']): TaskRelation => ({ id, type, task, createdBy: null, createdAt: null, capabilities: { delete: true } })

describe('relations', () => {
  it('agrupa na ordem de exibição: bloqueios primeiro, depois dependências, relacionadas e duplicadas', () => {
    const groups = groupRelations([rel('1', 'relates'), rel('2', 'blocked_by'), rel('3', 'duplicates'), rel('4', 'blocked_by')])
    expect(groups.map((g) => [g.type, g.items.length])).toEqual([
      ['blocked_by', 2],
      ['relates', 1],
      ['duplicates', 1],
    ])
  })

  it('conta todos os vínculos para a aba', () => {
    expect(relationCount({ parent: task, children: [task, task], forkedFrom: null, forks: [task], relations: [rel('1', 'relates')] })).toBe(5)
  })
})
