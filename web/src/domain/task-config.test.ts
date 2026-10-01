import { describe, expect, it } from 'vitest'
import { normalizeTypeKey, slugifyName, valueIssue, type CustomField } from './task-config'

const field = (type: CustomField['type'], config: CustomField['config'] = {}, options: CustomField['options'] = []) => ({ type, config, options })

describe('domain/task-config', () => {
  it('gera nome técnico e chave de tipo', () => {
    expect(slugifyName('Passos para reprodução')).toBe('passos_para_reproducao')
    expect(normalizeTypeKey(' nova funcionalidade ')).toBe('NOVA_FUNCIONALIDADE')
    expect(normalizeTypeKey('Adequação')).toBe('ADEQUACAO')
  })

  it('valida valores por tipo, igual ao backend', () => {
    expect(valueIssue(field('text'), '', true)).toBe('required')
    expect(valueIssue(field('text'), '', false)).toBeNull()
    expect(valueIssue(field('text', { max_length: 3 }), 'abcd', false)).toBe('too_long')
    expect(valueIssue(field('number', { min: 1 }), '0', false)).toBe('too_small')
    expect(valueIssue(field('number'), '2,5', false)).toBe('not_integer')
    expect(valueIssue(field('decimal'), '2,5', false)).toBeNull()
    expect(valueIssue(field('url'), 'ftp://x', false)).toBe('invalid_url')
    expect(valueIssue(field('phone'), '+55 (11) 99999-0000', false)).toBeNull()
    const options = [{ id: 'a', label: 'A', color: 'gray' as const, order: 0, isActive: true }]
    expect(valueIssue(field('select', {}, options), 'a', true)).toBeNull()
    expect(valueIssue(field('multiselect', {}, options), ['a', 'x'], false)).toBe('invalid_option')
  })
})
