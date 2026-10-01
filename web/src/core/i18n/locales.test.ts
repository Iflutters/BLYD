import { describe, expect, it } from 'vitest'
import ptBR from './locales/pt-BR.json'
import en from './locales/en.json'
import es from './locales/es.json'
import { PERMISSION_CODES } from '@/domain/permissions'

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' ? keys(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`],
  )
}

describe('i18n', () => {
  const base = keys(ptBR).sort()

  it.each([
    ['en', en],
    ['es', es],
  ])('%s possui exatamente as mesmas chaves que pt-BR', (_name, locale) => {
    expect(keys(locale).sort()).toEqual(base)
  })

  it('todas as permissões do catálogo têm tradução', () => {
    for (const code of PERMISSION_CODES) {
      expect((ptBR.permissions.codes as Record<string, string>)[code], code).toBeTruthy()
    }
  })
})
