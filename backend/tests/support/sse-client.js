/**
 * Cliente SSE mínimo para os testes do tempo real: conecta em /api/realtime (com o cookie da sessão),
 * guarda os eventos e permite assinar tópicos como o web faz.
 */

async function connectRealtime(baseUrl, cookie) {
  const controller = new AbortController()
  const response = await fetch(`${baseUrl}/api/realtime`, { headers: cookie ? { Cookie: cookie } : {}, signal: controller.signal })
  const events = []
  let clientId = null
  const decoder = new TextDecoder()
  let buffer = ''
  const reader = response.body.getReader()
  ;(async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let index
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, index)
          buffer = buffer.slice(index + 2)
          const event = { name: 'message', data: '' }
          block.split('\n').forEach((line) => {
            if (line.startsWith('event:')) event.name = line.slice(6).trim()
            else if (line.startsWith('data:')) event.data += line.slice(5).trim()
          })
          if (event.name === 'PB_CONNECT') clientId = JSON.parse(event.data).clientId
          else events.push({ name: event.name, data: event.data ? JSON.parse(event.data) : null })
        }
      }
    } catch (_) {
      // conexão encerrada
    }
  })()

  const deadline = Date.now() + 5000
  while (!clientId && Date.now() < deadline) await new Promise((r) => setTimeout(r, 25))
  if (!clientId) throw new Error('sem PB_CONNECT')

  return {
    clientId,
    events,
    /** POST das assinaturas, como o web (cookie + header de CSRF). */
    subscribe(topics, options) {
      const opts = options || {}
      const headers = { 'Content-Type': 'application/json' }
      if (opts.csrf !== false) headers['X-Requested-With'] = 'kamban'
      if (opts.cookie !== undefined ? opts.cookie : cookie) headers.Cookie = opts.cookie !== undefined ? opts.cookie : cookie
      return fetch(`${baseUrl}/api/realtime`, { method: 'POST', headers, body: JSON.stringify({ clientId: opts.clientId || clientId, subscriptions: topics }) })
    },
    async waitFor(predicate, timeoutMs) {
      const limit = Date.now() + (timeoutMs || 5000)
      while (Date.now() < limit) {
        const found = events.find(predicate)
        if (found) return found
        await new Promise((r) => setTimeout(r, 25))
      }
      throw new Error('aviso em tempo real não chegou')
    },
    close: () => controller.abort(),
  }
}

module.exports = { connectRealtime }
