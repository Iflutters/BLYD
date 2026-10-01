/**
 * Casos de uso do e-mail (regras de negócio §16): configurações do envio (integrations.manage), e-mail
 * de teste e a fila de saída — tudo que a plataforma envia entra na fila (na mesma transação da ação)
 * e uma rotina por minuto envia, com novas tentativas. Depois de enviado ou desistido, o corpo é
 * apagado (links de senha não ficam guardados).
 *
 * Portas: `emailSettingsRepository` { get() → { values, hasPassword }, save(values, password?) },
 * `emailOutboxRepository` { enqueue, listDue(now, limit), update(id, patch), counts(), listRecent(limit) },
 * `mailer` { send({ to, fromName, fromAddress, subject, html, text }) } — lança em caso de falha.
 */

const { appError } = require('../core/errors')
const rbac = require('../domain/rbac')
const emailDomain = require('../domain/email')
const { buildAuditEntry, truncate } = require('./audit')
const { currentSettings } = require('./platform-settings')
const { iso } = require('./presenters')

const PERMISSION = 'integrations.manage'
const ENTITY = 'email_settings'
const FLUSH_LIMIT = 30
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readSettings(deps) {
  const repo = deps.emailSettingsRepository
  return repo ? repo.get() : { values: Object.assign({}, emailDomain.DEFAULT_SETTINGS), hasPassword: false }
}

/** Dados para montar e enviar e-mails, ou null quando o envio está desligado. */
function emailContext(deps) {
  const values = readSettings(deps).values
  if (!values.enabled) return null
  return { appUrl: values.app_url, fromName: values.sender_name || currentSettings(deps).platform_name, fromAddress: values.sender_address, platform: currentSettings(deps).platform_name }
}

function createEmailService(deps) {
  function present() {
    const row = readSettings(deps)
    return { values: row.values, has_password: !!row.hasPassword }
  }

  function getSettings(ctx) {
    rbac.assertCan(ctx.principal, PERMISSION)
    return present()
  }

  function updateSettings(ctx, raw) {
    rbac.assertCan(ctx.principal, PERMISSION)
    const before = readSettings(deps).values
    const result = emailDomain.validateEmailSettings(raw, before)
    if (Object.keys(result.fields).length > 0) throw appError('VALIDATION_ERROR', undefined, { fields: result.fields })
    const changed = Object.keys(result.values).filter((key) => result.values[key] !== before[key])
    if (changed.length === 0 && result.password === undefined) return present()
    const pick = (source) => changed.reduce((acc, key) => Object.assign(acc, { [key]: source[key] }), {})
    deps.unitOfWork.run((repos) => {
      repos.emailSettingsRepository.save(result.values, result.password)
      repos.auditRepository.record(
        buildAuditEntry(ctx, {
          entityType: ENTITY,
          entityId: 'smtp',
          action: 'email_settings.update',
          oldValue: pick(before),
          newValue: Object.assign(pick(result.values), result.password !== undefined ? { password_changed: true } : {}),
        }),
      )
    })
    return present()
  }

  function send(mail, message) {
    deps.mailer.send(Object.assign({ fromName: mail.fromName, fromAddress: mail.fromAddress }, message))
  }

  /** Envia na hora (não passa pela fila) para quem pediu ou para `to`. */
  function sendTest(ctx, raw) {
    rbac.assertCan(ctx.principal, PERMISSION)
    const input = raw || {}
    if (input.to !== undefined && (typeof input.to !== 'string' || !EMAIL_PATTERN.test(input.to.trim()))) {
      throw appError('VALIDATION_ERROR', undefined, { fields: { to: 'invalid_email' } })
    }
    const mail = emailContext(deps)
    if (!mail) throw appError('EMAIL_NOT_CONFIGURED')
    const me = deps.userRepository.findById(ctx.principal.userId)
    const to = input.to ? input.to.trim().toLowerCase() : me.email
    const message = emailDomain.renderEmail('test', me.locale, { platform: mail.platform })
    try {
      send(mail, { to, subject: message.subject, html: message.html, text: message.text })
    } catch (err) {
      throw appError('EMAIL_SEND_FAILED', undefined, { reason: truncate(String((err && err.message) || err), 300) })
    }
    deps.auditRepository.record(buildAuditEntry(ctx, { entityType: ENTITY, entityId: 'smtp', action: 'email_settings.test_sent', newValue: { to } }))
    return { sent: true, to }
  }

  /** Rotina (cron, por minuto): envia o que venceu; falha → nova tentativa com espera crescente. */
  function flushOutbox() {
    const mail = emailContext(deps)
    if (!mail) return { sent: 0, failed: 0, retrying: 0, skipped: true }
    const now = deps.clock.now()
    const result = { sent: 0, failed: 0, retrying: 0 }
    deps.emailOutboxRepository.listDue(now, FLUSH_LIMIT).forEach((item) => {
      try {
        send(mail, { to: item.to, subject: item.subject, html: item.html, text: item.text })
        deps.emailOutboxRepository.update(item.id, { status: 'sent', sentAt: now, attempts: item.attempts + 1, lastError: '', html: '', text: '' })
        result.sent++
      } catch (err) {
        const attempts = item.attempts + 1
        const next = emailDomain.nextAttemptAt(attempts, now)
        const lastError = truncate(String((err && err.message) || err), 500)
        if (next) {
          deps.emailOutboxRepository.update(item.id, { attempts, lastError, nextAttemptAt: next })
          result.retrying++
        } else {
          deps.emailOutboxRepository.update(item.id, { status: 'failed', attempts, lastError, html: '', text: '' })
          result.failed++
        }
      }
    })
    return result
  }

  /** "Enviar agora" na tela (mesma regra da rotina). */
  function flushNow(ctx) {
    rbac.assertCan(ctx.principal, PERMISSION)
    return flushOutbox()
  }

  function outboxSummary(ctx) {
    rbac.assertCan(ctx.principal, PERMISSION)
    return {
      counts: deps.emailOutboxRepository.counts(),
      recent: deps.emailOutboxRepository.listRecent(20).map((m) => ({
        id: m.id,
        to: m.to,
        kind: m.kind,
        subject: m.subject,
        status: m.status,
        attempts: m.attempts,
        last_error: m.lastError || null,
        created_at: iso(m.createdAt),
        sent_at: iso(m.sentAt),
      })),
    }
  }

  return { getSettings, updateSettings, sendTest, flushOutbox, flushNow, outboxSummary }
}

module.exports = { createEmailService, emailContext }
