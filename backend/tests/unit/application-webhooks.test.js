const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const { createFakeDeps, seedUser } = require('../support/fakes')
const { createWebhookService, enqueueForEntry } = require('../../pb_hooks/src/application/webhooks')
const rbac = require('../../pb_hooks/src/domain/rbac')

function setup() {
  const deps = createFakeDeps({ start: '2026-10-01T12:00:00.000Z' })
  deps.allowInsecureWebhooks = false
  const admin = seedUser(deps, { email: 'admin@example.com', roleCode: 'ADMIN' })
  const gestor = seedUser(deps, { email: 'gestor@example.com', roleCode: 'MANAGER' })
  const ctxOf = (user) => {
    const role = deps.roleRepository.findById(user.roleId)
    return {
      principal: rbac.createPrincipal({ userId: user.id, roleId: role.id, roleCode: role.code, permissions: deps.roleRepository.getPermissionCodes(role.id), sessionId: 's1' }),
      ip: '10.0.0.1',
      userAgent: 'test',
      correlationId: 'c1',
    }
  }
  return { deps, admin, gestor, ctxOf, webhooks: createWebhookService(deps) }
}

const codeOf = (fn) => {
  try {
    fn()
  } catch (err) {
    return err.code
  }
  return 'OK'
}

const entry = (action, extra) => Object.assign({ action, entityType: action.split('.')[0], entityId: 't1', userId: 'u1', oldValue: null, newValue: { title: 'Nova tela' } }, extra)

describe('application/webhooks — cadastro', () => {
  it('só integrations.manage; o segredo aparece na criação (e ao gerar outro), nunca na lista nem no histórico', () => {
    const { deps, admin, gestor, ctxOf, webhooks } = setup()
    assert.equal(codeOf(() => webhooks.create(ctxOf(gestor), { name: 'CRM', url: 'https://hooks.x.com', events: ['task.*'] })), 'FORBIDDEN')
    const created = webhooks.create(ctxOf(admin), { name: 'CRM', url: 'https://hooks.x.com', events: ['task.*'] })
    assert.match(created.secret, /^whsec_[A-Za-z0-9]{32}$/)
    assert.equal(created.active, true)
    assert.equal('secret' in webhooks.list(ctxOf(admin))[0], false)
    assert.equal(JSON.stringify(deps.store.audit).includes(created.secret), false)
    assert.equal(deps.store.audit.at(-1).action, 'webhook.created')
    const rotated = webhooks.rotateSecret(ctxOf(admin), created.id)
    assert.notEqual(rotated.secret, created.secret)
    assert.equal(deps.store.webhooks[0].secret, rotated.secret)
  })

  it('valida endereço (https, sem metadados da nuvem) e eventos do catálogo; editar só o que veio', () => {
    const { admin, ctxOf, webhooks } = setup()
    assert.throws(
      () => webhooks.create(ctxOf(admin), { name: 'X', url: 'https://169.254.169.254/latest', events: ['auth.login'] }),
      (err) => err.details.fields.url === 'blocked_host' && err.details.fields.events === 'invalid_option',
    )
    const w = webhooks.create(ctxOf(admin), { name: 'CRM', url: 'https://hooks.x.com', events: ['task.*'] })
    assert.equal(webhooks.update(ctxOf(admin), w.id, { active: false }).active, false)
    assert.equal(codeOf(() => webhooks.update(ctxOf(admin), 'nao-existe', { active: false })), 'WEBHOOK_NOT_FOUND')
  })
})

describe('application/webhooks — entregas', () => {
  function ready() {
    const s = setup()
    s.hook = s.webhooks.create(s.ctxOf(s.admin), { name: 'CRM', url: 'https://hooks.x.com/kamban', events: ['task.*', 'comment.added'] })
    s.other = s.webhooks.create(s.ctxOf(s.admin), { name: 'Docs', url: 'https://docs.x.com/hook', events: ['doc_page.published'] })
    return s
  }

  it('ação do catálogo vira entrega só para quem assina; fora do catálogo nunca; webhook desligado não recebe', () => {
    const { deps, webhooks, admin, ctxOf, hook } = ready()
    assert.equal(enqueueForEntry(deps, entry('task.created'), deps.clock.now()), 1)
    assert.equal(enqueueForEntry(deps, entry('auth.login'), deps.clock.now()), 0)
    assert.equal(enqueueForEntry(deps, entry('user.password_reset'), deps.clock.now()), 0)
    webhooks.update(ctxOf(admin), hook.id, { active: false })
    assert.equal(enqueueForEntry(deps, entry('task.updated'), deps.clock.now()), 0)
    assert.equal(deps.store.webhookDeliveries.length, 1)
    assert.equal(deps.store.webhookDeliveries[0].event, 'task.created')
  })

  it('envio assinado: corpo JSON com o id da entrega, cabeçalhos e HMAC de "timestamp.corpo"; 2xx = sucesso', () => {
    const { deps, webhooks, hook } = ready()
    enqueueForEntry(deps, entry('task.updated', { oldValue: { title: 'A' }, newValue: { title: 'B' } }), deps.clock.now())
    assert.deepEqual(webhooks.flush(), { sent: 1, failed: 0, retrying: 0 })
    const request = deps.httpClient.requests[0]
    assert.equal(request.url, 'https://hooks.x.com/kamban')
    const body = JSON.parse(request.body)
    const delivery = deps.store.webhookDeliveries[0]
    assert.equal(body.id, delivery.id)
    assert.equal(body.event, 'task.updated')
    assert.deepEqual(body.data, { title: 'B' })
    assert.deepEqual(body.previous, { title: 'A' })
    assert.equal(request.headers['X-Kamban-Event'], 'task.updated')
    assert.equal(request.headers['X-Kamban-Delivery'], delivery.id)
    const ts = request.headers['X-Kamban-Timestamp']
    assert.equal(ts, String(Math.floor(new Date('2026-10-01T12:00:00Z').getTime() / 1000)))
    assert.equal(request.headers['X-Kamban-Signature'], `sha256=hmac(${deps.store.webhooks[0].secret}|${ts}.${request.body})`)
    assert.equal(request.timeout, 10)
    assert.equal(delivery.status, 'success')
    assert.equal(deps.store.webhooks.find((w) => w.id === hook.id).lastStatus, 200)
  })

  it('falha: tenta de novo em 1 minuto, depois desiste na 6ª; 20 falhas seguidas desligam o webhook', () => {
    const { deps, webhooks, hook } = ready()
    deps.httpClient.respond(500, 'erro')
    enqueueForEntry(deps, entry('task.created'), deps.clock.now())
    assert.deepEqual(webhooks.flush(), { sent: 0, failed: 0, retrying: 1 })
    const delivery = deps.store.webhookDeliveries[0]
    assert.equal(delivery.nextAttemptAt.toISOString(), '2026-10-01T12:01:00.000Z')
    assert.equal(delivery.error, 'HTTP 500')
    assert.deepEqual(webhooks.flush(), { sent: 0, failed: 0, retrying: 0 })
    for (let i = 0; i < 5; i++) {
      deps.clock.advanceMinutes(720)
      webhooks.flush()
    }
    assert.equal(delivery.status, 'failed')
    assert.equal(delivery.attempts, 6)

    // não conecta (lança): conta como falha também; 20 seguidas desligam
    deps.httpClient.fail('connection refused')
    for (let i = 0; i < 14; i++) enqueueForEntry(deps, entry('task.created'), deps.clock.now())
    webhooks.flush()
    const saved = deps.store.webhooks.find((w) => w.id === hook.id)
    assert.equal(saved.consecutiveFailures, 20)
    assert.equal(saved.active, false)
    assert.equal(deps.store.audit.at(-1).action, 'webhook.disabled')
  })

  it('teste envia webhook.ping na hora e devolve o resultado; reenviar tenta de novo do zero', () => {
    const { deps, webhooks, admin, gestor, ctxOf, hook } = ready()
    assert.equal(codeOf(() => webhooks.test(ctxOf(gestor), hook.id)), 'FORBIDDEN')
    const result = webhooks.test(ctxOf(admin), hook.id)
    assert.equal(result.event, 'webhook.ping')
    assert.equal(result.status, 'success')
    assert.equal(result.response_status, 200)
    deps.httpClient.respond(503, 'fora')
    const failed = webhooks.test(ctxOf(admin), hook.id)
    assert.equal(failed.status, 'failed')
    deps.httpClient.respond(200, 'ok')
    assert.equal(webhooks.redeliver(ctxOf(admin), failed.id).status, 'success')
    assert.equal(webhooks.deliveries(ctxOf(admin), hook.id).length, 2)
  })

  it('entregas com mais de 30 dias saem na limpeza', () => {
    const { deps, webhooks } = ready()
    enqueueForEntry(deps, entry('task.created'), deps.clock.now())
    webhooks.flush()
    deps.clock.advanceMinutes(31 * 24 * 60)
    webhooks.flush()
    assert.equal(deps.store.webhookDeliveries.length, 0)
  })
})
