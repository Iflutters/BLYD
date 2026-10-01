/**
 * Carrega os dados de demonstração no servidor em execução (`npm run dev` ou produção).
 * Usa KAMBAN_ADMIN_EMAIL / KAMBAN_ADMIN_PASSWORD (de backend/.env ou do ambiente) e KAMBAN_HTTP
 * (padrão 127.0.0.1:8090); a senha das pessoas de exemplo vem de KAMBAN_DEMO_PASSWORD (opcional).
 * Uso: npm run demo
 */

const { loadEnv } = require('./env')
const { seedDemo } = require('./demo-data')

function createClient(base) {
  let cookie = ''
  async function request(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: Object.assign({ 'Content-Type': 'application/json', 'X-Requested-With': 'kamban', 'Accept-Language': 'pt-BR' }, cookie ? { Cookie: cookie } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    const session = setCookie.find((c) => c.startsWith('kb_session='))
    if (session) cookie = session.split(';')[0]
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null }
  }
  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body === undefined ? {} : body),
    patch: (path, body) => request('PATCH', path, body),
    put: (path, body) => request('PUT', path, body === undefined ? {} : body),
  }
}

async function main() {
  const env = loadEnv()
  if (!env.KAMBAN_ADMIN_EMAIL || !env.KAMBAN_ADMIN_PASSWORD) throw new Error('Defina KAMBAN_ADMIN_EMAIL e KAMBAN_ADMIN_PASSWORD (em backend/.env ou no ambiente).')
  const api = createClient(`http://${env.KAMBAN_HTTP || '127.0.0.1:8090'}/api/v1`)
  const login = await api.post('/auth/login', { email: env.KAMBAN_ADMIN_EMAIL, password: env.KAMBAN_ADMIN_PASSWORD })
  if (login.status !== 200) throw new Error(`Login do administrador falhou (${login.status}). O servidor está rodando?`)
  const result = await seedDemo(api, { password: env.KAMBAN_DEMO_PASSWORD })
  if (!result.created) return console.log('O projeto de demonstração (DEMO) já existe; nada foi alterado.')
  console.log(`Projeto de demonstração criado: ${result.project.name} (${result.project.key}).`)
  console.log(`Pessoas de exemplo: ${result.users.map((u) => u.email).join(', ')} — senha: ${result.password}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
