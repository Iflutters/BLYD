import { describe, expect, it } from 'vitest'
import { isClosedCategory, statusChoices } from './workflow'

const status = (id: string, allowedNext: string[] = []) => ({ id, allowedNext })

describe('domain/workflow', () => {
  const list = [status('backlog', ['analise']), status('analise'), status('redesenvolver', ['homologacao']), status('homologacao', ['concluido', 'redesenvolver']), status('concluido')]

  it('lista só o status atual e os destinos permitidos, na ordem do fluxo', () => {
    expect(statusChoices(list, 'redesenvolver').map((s) => s.id)).toEqual(['redesenvolver', 'homologacao'])
    expect(statusChoices(list, 'homologacao').map((s) => s.id)).toEqual(['redesenvolver', 'homologacao', 'concluido'])
  })

  it('sem transições configuradas (ou tarefa nova, ou status fora da lista), todos', () => {
    expect(statusChoices(list, 'analise')).toHaveLength(5)
    expect(statusChoices(list, undefined)).toHaveLength(5)
    expect(statusChoices(list, 'inativo')).toHaveLength(5)
  })

  it('encerradas: concluída e cancelada', () => {
    expect(isClosedCategory('done')).toBe(true)
    expect(isClosedCategory('cancelled')).toBe(true)
    expect(isClosedCategory('in_progress')).toBe(false)
  })
})
