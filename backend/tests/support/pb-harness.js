/**
 * Sobe uma instância isolada do PocketBase (diretório temporário, porta livre)
 * com as migrations e hooks reais, para testes de API ponta a ponta.
 */

const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const { serveArgs: productionServeArgs } = require('../../scripts/env')

const ROOT = path.resolve(__dirname, '..', '..')
const BIN = path.join(ROOT, 'bin', process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase')

const ADMIN = { email: 'admin@kamban.test', password: 'AdminTest12345', name: 'Admin Teste' }
const SUPERUSER = { email: 'root@kamban.test', password: 'RootTest12345' }

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
    server.on('error', reject)
  })
}

function pbArgs(dataDir, migrationsDir) {
  return [`--dir=${dataDir}`, `--hooksDir=${path.join(ROOT, 'pb_hooks')}`, `--migrationsDir=${migrationsDir || path.join(ROOT, 'pb_migrations')}`]
}

/** Cópia das migrations reais + as do teste (`[{ name, content }]`), para semear o que a API não cria. */
function migrationsWith(extra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kamban-migrations-'))
  const source = path.join(ROOT, 'pb_migrations')
  fs.readdirSync(source).forEach((name) => fs.copyFileSync(path.join(source, name), path.join(dir, name)))
  extra.forEach((m) => fs.writeFileSync(path.join(dir, m.name), m.content))
  return dir
}

async function waitForHealth(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/health`)
      if (res.ok) return
    } catch (_) {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('PocketBase não respondeu a tempo')
}

/**
 * `options.publicDir`: pasta do build do front para servir junto (testes de ponta a ponta).
 * `options.extraMigrations`: migrations só do teste, rodadas depois das reais (ex.: dados antigos).
 */
async function startPocketBase(extraEnv, options) {
  if (!fs.existsSync(BIN)) throw new Error(`Binário do PocketBase não encontrado em ${BIN}`)
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kamban-api-'))
  const env = Object.assign({}, process.env, { KAMBAN_ENV: 'test' }, extraEnv || {})
  const migrationsDir = options && options.extraMigrations ? migrationsWith(options.extraMigrations) : undefined
  const args = () => pbArgs(dataDir, migrationsDir)

  execFileSync(BIN, ['migrate', 'up'].concat(args()), { env, stdio: 'pipe' })
  execFileSync(BIN, ['kamban-admin'].concat(args()), {
    env: Object.assign({}, env, {
      KAMBAN_ADMIN_EMAIL: ADMIN.email,
      KAMBAN_ADMIN_PASSWORD: ADMIN.password,
      KAMBAN_ADMIN_NAME: ADMIN.name,
    }),
    stdio: 'pipe',
  })
  execFileSync(BIN, ['superuser', 'upsert', SUPERUSER.email, SUPERUSER.password].concat(args()), { env, stdio: 'pipe' })

  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const serveArgs = ['serve', `--http=127.0.0.1:${port}`].concat(args())
  if (options && options.publicDir) serveArgs.push(`--publicDir=${options.publicDir}`)
  // mesmo pool de VMs do JS da produção (KAMBAN_HOOKS_POOL ajusta, ex.: no teste de carga)
  serveArgs.push(...productionServeArgs(env))
  const child = spawn(BIN, serveArgs, { env, stdio: 'pipe' })
  let output = ''
  child.stdout.on('data', (d) => (output += d))
  child.stderr.on('data', (d) => (output += d))

  try {
    await waitForHealth(baseUrl, 15000)
  } catch (err) {
    child.kill()
    throw new Error(`${err.message}\n${output}`)
  }

  const superToken = await superuserToken(baseUrl)
  const instance = {
    baseUrl,
    api: `${baseUrl}/api/v1`,
    admin: ADMIN,
    output: () => output,
    /** Altera configurações do PocketBase via API de superusuário (ex.: rate limits nos testes). */
    async updateSettings(patch) {
      const res = await fetch(`${baseUrl}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: superToken },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`Falha ao atualizar settings: ${res.status} ${await res.text()}`)
    },
    /** Lê registros de uma collection via API de superusuário (ex.: conferir auditoria). */
    async listRecords(collection, query) {
      const res = await fetch(`${baseUrl}/api/collections/${collection}/records?${query || ''}`, {
        headers: { Authorization: superToken },
      })
      return (await res.json()).items
    },
    async stop() {
      child.kill()
      await new Promise((r) => setTimeout(r, 300))
      fs.rmSync(dataDir, { recursive: true, force: true })
    },
  }
  return instance
}

async function superuserToken(baseUrl) {
  const res = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: SUPERUSER.email, password: SUPERUSER.password }),
  })
  const body = await res.json()
  if (!body.token) throw new Error('Falha ao autenticar superusuário de teste')
  return body.token
}

/** Cliente HTTP mínimo com "cookie jar" de uma única sessão. */
function createClient(api) {
  let cookie = ''
  async function request(method, pathname, body, options) {
    const opts = options || {}
    const headers = { Accept: 'application/json' }
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData
    if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
    if (opts.csrf !== false && method !== 'GET') headers['X-Requested-With'] = 'kamban'
    if (cookie) headers.Cookie = cookie
    if (opts.headers) Object.assign(headers, opts.headers)

    const res = await fetch(`${api}${pathname}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm || typeof body === 'string' ? body : JSON.stringify(body),
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) {
      const pair = setCookie.split(';')[0]
      cookie = pair.endsWith('=') ? '' : pair
    }
    if (opts.raw) return { status: res.status, headers: res.headers, setCookie, bytes: Buffer.from(await res.arrayBuffer()) }
    const text = await res.text()
    return { status: res.status, headers: res.headers, setCookie, body: text ? JSON.parse(text) : null }
  }
  return {
    get: (p, o) => request('GET', p, undefined, o),
    post: (p, b, o) => request('POST', p, b === undefined ? {} : b, o),
    put: (p, b, o) => request('PUT', p, b, o),
    patch: (p, b, o) => request('PATCH', p, b, o),
    del: (p, o) => request('DELETE', p, undefined, o),
    login: (email, password, remember) => request('POST', '/auth/login', { email, password, remember: !!remember }),
    hasSession: () => !!cookie,
    cookie: () => cookie,
  }
}

module.exports = { startPocketBase, createClient }
