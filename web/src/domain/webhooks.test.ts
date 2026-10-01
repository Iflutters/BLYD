import { describe, expect, it } from 'vitest'
import { eventSummary, groupOf, groupsOf, isSelected, toggleEvent, toggleGroup } from './webhooks'

const CATALOG = ['task.created', 'task.updated', 'task.deleted', 'comment.added', 'doc_page.published']

describe('domain/webhooks — seleção de eventos', () => {
  it('grupos na ordem do catálogo', () => {
    expect(groupOf('doc_page.published')).toBe('doc_page')
    expect(groupsOf(CATALOG)).toEqual([
      { group: 'task', events: ['task.created', 'task.updated', 'task.deleted'] },
      { group: 'comment', events: ['comment.added'] },
      { group: 'doc_page', events: ['doc_page.published'] },
    ])
  })

  it('marcar o grupo inteiro troca os avulsos por "grupo.*"; desmarcar limpa o grupo', () => {
    let selection = toggleEvent([], 'task.created', true)
    expect(selection).toEqual(['task.created'])
    selection = toggleGroup(selection, 'task', true)
    expect(selection).toEqual(['task.*'])
    expect(isSelected(selection, 'task.deleted')).toBe(true)
    expect(toggleGroup(selection, 'task', false)).toEqual([])
  })

  it('desmarcar um evento com o grupo inteiro marcado vira os demais avulsos', () => {
    const selection = toggleEvent(['task.*', 'comment.added'], 'task.updated', false, CATALOG)
    expect(selection).toEqual(['comment.added', 'task.created', 'task.deleted'])
  })

  it('resumo legível do que o webhook assina', () => {
    expect(eventSummary(['task.*'], CATALOG)).toEqual({ groups: ['task'], count: 3 })
    expect(eventSummary(['task.*', 'comment.added'], CATALOG)).toEqual({ groups: ['task'], count: 4 })
  })
})
