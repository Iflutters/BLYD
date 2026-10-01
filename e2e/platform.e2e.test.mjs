/**
 * Configurador geral no navegador (PocketBase isolado, build de produção): o Admin troca o nome,
 * envia logo e ícone e endurece a senha; o nome e o logo aparecem no menu, no título e na tela de login;
 * a troca de senha mostra e aplica as exigências; o Gestor não acessa a tela.
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, launchBrowser, login, seedBase, startApp } from './support.mjs'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

describe('E2E — Configurador geral', { timeout: 240000 }, () => {
  let app
  let browser
  const contexts = []

  before(async () => {
    app = await startApp()
    browser = await launchBrowser()
    await seedBase(app.admin)
  })

  after(async () => {
    for (const context of contexts) await context.close().catch(() => {})
    if (browser) await browser.close()
    if (app) await app.pb.stop()
  })

  async function signIn(email, password, options) {
    const session = await login(browser, app.baseUrl, email, password, options)
    contexts.push(session.context)
    return session
  }

  it('Admin troca nome, logo e ícone e endurece a senha; aparece no menu, no título, no login e na troca de senha', async () => {
    const { page, errors } = await signIn(ADMIN.email, ADMIN.password)
    await page.goto(`${app.baseUrl}/settings/general`)
    await page.getByRole('heading', { name: 'Configurações gerais' }).waitFor()
    // o item "Geral" está no menu de Configurações
    await page.getByRole('link', { name: 'Geral' }).waitFor()

    const name = page.getByLabel(/^Nome da plataforma/)
    await name.fill('Portal da Obra')
    await page.getByRole('switch', { name: 'Exigir um símbolo (ex.: ! @ # $)' }).click()
    const saved = page.waitForResponse((r) => r.url().endsWith('/api/v1/settings/platform') && r.request().method() === 'PATCH')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    assert.equal((await saved).status(), 200)
    await page.getByText('Configurações salvas.').waitFor()
    await page.getByText('Portal da Obra', { exact: true }).first().waitFor()
    await page.waitForFunction(() => document.title.endsWith('· Portal da Obra'))

    // logo (tema claro) e ícone do navegador
    const inputs = page.locator('input[type=file]')
    const logo = page.waitForResponse((r) => r.url().includes('/settings/platform/branding/logo_light'))
    await inputs.nth(0).setInputFiles({ name: 'marca.png', mimeType: 'image/png', buffer: PNG })
    assert.equal((await logo).status(), 200)
    const icon = page.waitForResponse((r) => r.url().includes('/settings/platform/branding/favicon'))
    await inputs.nth(2).setInputFiles({ name: 'icone.png', mimeType: 'image/png', buffer: PNG })
    assert.equal((await icon).status(), 200)
    await page.waitForFunction(() => !!document.querySelector('img[src*="/api/v1/platform/branding/logo_light"]'))
    await page.waitForFunction(() => (document.querySelector('link[rel="icon"]')?.getAttribute('href') ?? '').includes('/api/v1/platform/branding/favicon'))

    // a troca de senha mostra a exigência nova e recusa senha sem símbolo
    await page.goto(`${app.baseUrl}/account`)
    await page.getByText('Mínimo de 10 caracteres, com letras e números e um símbolo.').waitFor()
    await page.getByLabel(/^Senha atual/).fill(ADMIN.password)
    await page.getByLabel(/^Nova senha/).fill('SemSimbolo1234')
    await page.getByLabel(/^Confirme a nova senha/).fill('SemSimbolo1234')
    await page.getByRole('button', { name: 'Trocar senha' }).click()
    await page.getByText('Inclua um símbolo (ex.: ! @ # $)').waitFor()
    assert.deepEqual(errors, [])

    // tela de login (sem sessão) com o nome e o logo
    const guest = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    contexts.push(guest)
    const loginPage = await guest.newPage()
    await loginPage.goto(`${app.baseUrl}/login`)
    await loginPage.getByText('Portal da Obra').first().waitFor()
    await loginPage.waitForFunction(() => document.title.endsWith('· Portal da Obra'))
    await loginPage.waitForFunction(() => !!document.querySelector('img[src*="/api/v1/platform/branding/logo_light"]'))
  })

  it('Gestor não vê o item nem abre a tela; a API recusa', async () => {
    const roles = (await app.admin.get('/roles')).body.data
    await app.admin.post('/users', { name: 'Gil Gestor', email: 'gil@kamban.test', password: 'SenhaTeste123#', role_id: roles.find((r) => r.code === 'MANAGER').id })
    const { page, errors } = await signIn('gil@kamban.test', 'SenhaTeste123#')
    await page.goto(`${app.baseUrl}/settings/general`)
    await page.getByText('Acesso restrito').waitFor()
    assert.equal(await page.getByRole('link', { name: 'Geral' }).count(), 0)
    assert.deepEqual(errors, [])
  })
})
