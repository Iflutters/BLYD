import { describe, expect, it } from 'vitest'
import { EMAIL_DEFAULTS, emailPatch, emailSettingsSchema, type EmailSettingsForm } from './email'

const FORM: EmailSettingsForm = { ...EMAIL_DEFAULTS, password: '' }

const issues = (value: EmailSettingsForm) =>
  Object.fromEntries((emailSettingsSchema.safeParse(value).error?.issues ?? []).map((i) => [i.path.join('.'), i.message]))

describe('domain/email', () => {
  it('desligado não exige nada; ligado exige servidor, remetente e endereço da plataforma', () => {
    expect(issues(FORM)).toEqual({})
    expect(issues({ ...FORM, enabled: true })).toEqual({ host: 'required', senderAddress: 'required', appUrl: 'required' })
    expect(
      issues({ ...FORM, enabled: true, host: 'smtp.empresa.com', senderAddress: 'portal@empresa.com', appUrl: 'https://kamban.empresa.com' }),
    ).toEqual({})
  })

  it('formatos: servidor, porta, e-mail e endereço http(s) sem parâmetros', () => {
    expect(issues({ ...FORM, host: 'smtp empresa', port: 70000, senderAddress: 'x', appUrl: 'ftp://x' })).toEqual({
      host: 'invalid_format',
      port: 'too_large',
      senderAddress: 'invalid_email',
      appUrl: 'invalid_url',
    })
    expect(issues({ ...FORM, appUrl: 'https://k.com/?a=1' })).toEqual({ appUrl: 'invalid_url' })
  })

  it('só o que mudou vai para o servidor; senha só quando digitada', () => {
    const before = { ...EMAIL_DEFAULTS }
    expect(emailPatch(before, { ...FORM, host: ' smtp.x.com ', port: 465 })).toEqual({ host: 'smtp.x.com', port: 465 })
    expect(emailPatch(before, { ...FORM, password: 'segredo' })).toEqual({ password: 'segredo' })
    expect(emailPatch(before, { ...FORM, appUrl: 'https://k.com/' })).toEqual({ appUrl: 'https://k.com' })
    expect(emailPatch(before, FORM)).toEqual({})
  })
})
