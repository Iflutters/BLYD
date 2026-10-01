/**
 * Webhooks no navegador (PocketBase isolado + receptor HTTP local): o Admin cadastra pela tela, guarda
 * o segredo, envia o teste e vê a entrega; uma tarefa criada chega assinada no receptor. O formulário
 * e o painel de entregas passam pelo axe (as abas não têm endereço próprio na varredura geral).
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import crypto from 'node:crypto'
import { ADMIN, axeViolations, launchBrowser, login, seedBase, startApp } from './support.mjs'

function startReceiver() {
  const requests = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      requests.push({ headers: req.headers, body })
      res.writeHead(200)
      res.end('ok')
    })
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/hook`, requests, stop: () => new Promise((r) => server.close(() => r())) })))
}

/** Igual à varredura geral: espera a rede e as animações de entrada (opacidade confunde o contraste). */
async function settledViolations(page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(450)
  const violations = await axeViolations(page)
  return [violations, [], JSON.stringify(violations)]
}

describe('E2E — Webhooks', { timeout: 180000 }, () => {
  let app
  let browser
  let receiver
  let seed
  const contexts = []

  before(async () => {
    app = await startApp()
    browser = await launchBrowser()
    receiver = await startReceiver()
    seed = await seedBase(app.admin)
  })

  after(async () => {
    for (const context of contexts) await context.close().catch(() => {})
    if (browser) await browser.close()
    if (app) await app.pb.stop()
    if (receiver) await receiver.stop()
  })

  it('cadastra pela tela, guarda o segredo, testa e recebe o evento assinado', async () => {
    const { page, context, errors } = await login(browser, app.baseUrl, ADMIN.email, ADMIN.password, { axe: true })
    contexts.push(context)
    await page.goto(`${app.baseUrl}/settings/integrations`)
    await page.getByRole('tab', { name: 'Webhooks' }).click()
    await page.getByRole('button', { name: 'Novo webhook' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/^Nome/).fill('Receptor de teste')
    await dialog.getByLabel(/^Endereço que recebe/).fill(receiver.url)
    await dialog.getByRole('checkbox', { name: 'Tudo de Tarefas' }).click()
    assert.deepEqual(...(await settledViolations(page)))
    await dialog.getByRole('button', { name: 'Novo webhook' }).click()
    const secret = await page.getByLabel('Segredo', { exact: true }).inputValue()
    assert.match(secret, /^whsec_[A-Za-z0-9]{32}$/)
    await page.getByRole('button', { name: 'Já copiei' }).click()

    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name: 'Enviar teste' }).click()
    await page.getByText('Teste entregue (HTTP 200).').waitFor()
    assert.equal(receiver.requests.at(-1).headers['x-kamban-event'], 'webhook.ping')

    // uma tarefa nova vira entrega; "Reenviar" no painel envia agora (a rotina por minuto também enviaria)
    await app.admin.post('/tasks', { project_id: seed.project.id, task_type_id: seed.doc.id, title: 'Avisar o receptor' })
    await page.getByRole('button', { name: 'Visualizar' }).click()
    const drawer = page.getByRole('dialog', { name: /Entregas — Receptor de teste/ })
    await drawer.getByText('task.created').waitFor()
    assert.deepEqual(...(await settledViolations(page)))
    const row = drawer.getByRole('listitem').filter({ hasText: 'task.created' })
    await row.getByRole('button', { name: 'Reenviar' }).click()
    await page.getByText('Entrega reenviada.').waitFor()
    const request = receiver.requests.find((r) => r.headers['x-kamban-event'] === 'task.created')
    const expected = crypto.createHmac('sha256', secret).update(`${request.headers['x-kamban-timestamp']}.${request.body}`).digest('hex')
    assert.equal(request.headers['x-kamban-signature'], `sha256=${expected}`)
    assert.equal(JSON.parse(request.body).data.title, 'Avisar o receptor')
    assert.deepEqual(errors, [])
  })
})
