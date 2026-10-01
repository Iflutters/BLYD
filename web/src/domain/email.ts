import { z } from 'zod'
import type { PasswordPolicy } from './platform'

/**
 * E-mail (regras de negócio §16): configurações do envio, fila de saída e links de senha/convite.
 * O servidor valida tudo; aqui só o que a tela precisa para orientar.
 */

export interface EmailSettings {
  enabled: boolean
  host: string
  port: number
  username: string
  tls: boolean
  senderName: string
  senderAddress: string
  /** Endereço da plataforma usado nos links dos e-mails (ex.: https://kamban.empresa.com). */
  appUrl: string
}

export const EMAIL_DEFAULTS: EmailSettings = { enabled: false, host: '', port: 587, username: '', tls: false, senderName: '', senderAddress: '', appUrl: '' }

export interface EmailSettingsView {
  values: EmailSettings
  hasPassword: boolean
}

/** Formulário: a senha vazia mantém a atual. */
export type EmailSettingsForm = EmailSettings & { password: string }

/** Alteração enviada ao servidor; `password: null` remove a senha guardada. */
export type EmailSettingsPatch = Partial<EmailSettings> & { password?: string | null }

export type OutboxStatus = 'pending' | 'sent' | 'failed'
export type OutboxKind = 'notification' | 'password_reset' | 'invite' | 'test'

export interface OutboxItem {
  id: string
  to: string
  kind: OutboxKind
  subject: string
  status: OutboxStatus
  attempts: number
  lastError: string | null
  createdAt: Date | null
  sentAt: Date | null
}

export interface OutboxSummary {
  counts: Record<OutboxStatus, number>
  recent: OutboxItem[]
}

export interface FlushResult {
  sent: number
  failed: number
  retrying: number
  busy?: boolean
  skipped?: boolean
}

export type ResetTokenState = 'valid' | 'used' | 'expired' | 'invalid'

export interface ResetTokenCheck {
  valid: boolean
  state: ResetTokenState
  purpose: 'reset' | 'invite' | null
  name: string | null
  policy: PasswordPolicy | null
}

const HOST = /^[A-Za-z0-9.-]+$|^\[[0-9A-Fa-f:.]+\]$/
const URL = /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const cleanUrl = (value: string) => value.trim().replace(/\/+$/, '')

export const emailSettingsSchema = z
  .object({
    enabled: z.boolean(),
    host: z.string().trim().max(255, 'too_long').refine((v) => !v || HOST.test(v), 'invalid_format'),
    port: z.number({ error: 'invalid_type' }).int('not_integer').min(1, 'too_small').max(65535, 'too_large'),
    username: z.string().trim().max(200, 'too_long'),
    password: z.string().max(200, 'too_long'),
    tls: z.boolean(),
    senderName: z.string().trim().max(80, 'too_long'),
    senderAddress: z.string().trim().max(254, 'too_long').refine((v) => !v || EMAIL.test(v), 'invalid_email'),
    appUrl: z.string().max(300, 'too_long').refine((v) => !v.trim() || URL.test(cleanUrl(v)), 'invalid_url'),
  })
  .superRefine((v, ctx) => {
    if (!v.enabled) return
    ;(['host', 'senderAddress', 'appUrl'] as const).forEach((key) => {
      if (!v[key].trim()) ctx.addIssue({ code: 'custom', path: [key], message: 'required' })
    })
  })

/** Só o que mudou (textos sem espaços nas pontas, endereço sem barra final); senha só quando digitada. */
export function emailPatch(before: EmailSettings, form: EmailSettingsForm): EmailSettingsPatch {
  const next: EmailSettings = {
    enabled: form.enabled,
    host: form.host.trim(),
    port: form.port,
    username: form.username.trim(),
    tls: form.tls,
    senderName: form.senderName.trim(),
    senderAddress: form.senderAddress.trim().toLowerCase(),
    appUrl: cleanUrl(form.appUrl),
  }
  const patch: EmailSettingsPatch = {}
  ;(Object.keys(next) as (keyof EmailSettings)[]).forEach((key) => {
    if (next[key] !== before[key]) Object.assign(patch, { [key]: next[key] })
  })
  if (form.password) patch.password = form.password
  return patch
}
