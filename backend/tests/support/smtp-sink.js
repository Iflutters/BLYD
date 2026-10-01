/**
 * Servidor SMTP mínimo para os testes: aceita qualquer mensagem (sem TLS; AUTH PLAIN/LOGIN aceita e
 * registra as credenciais em `auth`), guarda e
 * decodifica o MIME (quoted-printable, base64 e assunto codificado) para os testes lerem assunto, texto
 * e HTML. `failNext()` faz o próximo envio ser recusado (simula servidor fora do ar).
 */

const net = require('node:net')

function decodeQuotedPrintable(input) {
  const text = input.replace(/=\r?\n/g, '')
  const bytes = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      Buffer.from(text[i], 'utf8').forEach((b) => bytes.push(b))
    }
  }
  return Buffer.from(bytes).toString('utf8')
}

function decodeWords(value) {
  return value
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([QBqb])\?([^?]*)\?=/g, (_m, _charset, encoding, text) =>
      encoding.toUpperCase() === 'B' ? Buffer.from(text, 'base64').toString('utf8') : decodeQuotedPrintable(text.replace(/_/g, ' ')),
    )
}

function parseHeaders(block) {
  const headers = {}
  block
    .replace(/\r\n[ \t]+/g, ' ')
    .split('\r\n')
    .forEach((line) => {
      const i = line.indexOf(':')
      if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim()
    })
  return headers
}

function decodeBody(headers, body) {
  const encoding = (headers['content-transfer-encoding'] || '').toLowerCase()
  if (encoding === 'quoted-printable') return decodeQuotedPrintable(body)
  if (encoding === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8')
  return body
}

/** Junta as partes text/plain e text/html (recursivo para multipart aninhado). */
function collect(headers, body, out) {
  const type = headers['content-type'] || 'text/plain'
  const boundary = /boundary="?([^";]+)"?/i.exec(type)
  if (/^multipart\//i.test(type) && boundary) {
    body
      .split(`--${boundary[1]}`)
      .slice(1)
      .forEach((part) => {
        if (part.startsWith('--')) return
        const split = part.indexOf('\r\n\r\n')
        if (split < 0) return
        collect(parseHeaders(part.slice(0, split).replace(/^\r\n/, '')), part.slice(split + 4).replace(/\r\n$/, ''), out)
      })
    return
  }
  const decoded = decodeBody(headers, body)
  if (/text\/html/i.test(type)) out.html += decoded
  else out.text += decoded
}

function parseMessage(envelope, raw) {
  const data = raw.replace(/\r\n\.\./g, '\r\n.')
  const split = data.indexOf('\r\n\r\n')
  const headers = parseHeaders(data.slice(0, split))
  const out = { html: '', text: '' }
  collect(headers, data.slice(split + 4), out)
  return { from: envelope.from, to: envelope.to, subject: decodeWords(headers.subject || ''), headers, text: out.text, html: out.html }
}

function startSmtpSink() {
  const messages = []
  const auth = []
  let failNext = false
  const server = net.createServer((socket) => {
    socket.setEncoding('utf8')
    let buffer = ''
    let inData = false
    let envelope = null
    // AUTH em várias etapas: 'plain' (espera a credencial) | 'login-user' | 'login-pass'
    let authStep = null
    let login = {}
    const reply = (line) => socket.write(`${line}\r\n`)
    reply('220 kamban-test ESMTP')
    socket.on('data', (chunk) => {
      buffer += chunk
      for (;;) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n')
          if (end < 0) return
          const raw = buffer.slice(0, end)
          buffer = buffer.slice(end + 5)
          inData = false
          messages.push(parseMessage(envelope, raw))
          reply('250 OK queued')
          continue
        }
        const index = buffer.indexOf('\r\n')
        if (index < 0) return
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 2)
        const decode = (b64) => Buffer.from(b64, 'base64').toString('utf8')
        if (authStep === 'plain') {
          const parts = decode(line).split('\u0000')
          auth.push({ username: parts[1], password: parts[2] })
          authStep = null
          reply('235 Authentication successful')
          continue
        }
        if (authStep === 'login-user') {
          login = { username: decode(line) }
          authStep = 'login-pass'
          reply('334 UGFzc3dvcmQ6')
          continue
        }
        if (authStep === 'login-pass') {
          auth.push({ username: login.username, password: decode(line) })
          authStep = null
          reply('235 Authentication successful')
          continue
        }
        const command = line.slice(0, 4).toUpperCase()
        if (command === 'AUTH') {
          const [, method, initial] = line.split(' ')
          if (String(method).toUpperCase() === 'LOGIN') {
            authStep = 'login-user'
            reply('334 VXNlcm5hbWU6')
          } else if (initial) {
            const parts = decode(initial).split('\u0000')
            auth.push({ username: parts[1], password: parts[2] })
            reply('235 Authentication successful')
          } else {
            authStep = 'plain'
            reply('334 ')
          }
        } else if (command === 'EHLO') socket.write('250-kamban-test\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n')
        else if (command === 'HELO') reply('250 kamban-test')
        else if (command === 'MAIL') {
          if (failNext) {
            failNext = false
            reply('451 Servidor de teste fora do ar')
          } else {
            envelope = { from: (/<([^>]*)>/.exec(line) || [])[1] || '', to: [] }
            reply('250 OK')
          }
        } else if (command === 'RCPT') {
          envelope.to.push((/<([^>]*)>/.exec(line) || [])[1] || '')
          reply('250 OK')
        } else if (command === 'DATA') {
          inData = true
          reply('354 End data with <CR><LF>.<CR><LF>')
        } else if (command === 'QUIT') {
          reply('221 Bye')
          socket.end()
        } else reply('250 OK')
      }
    })
    socket.on('error', () => {})
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        port: server.address().port,
        messages,
        auth,
        failNext: () => {
          failNext = true
        },
        /** Espera chegar uma mensagem que satisfaça `predicate`. */
        async waitFor(predicate, timeoutMs) {
          const deadline = Date.now() + (timeoutMs || 5000)
          while (Date.now() < deadline) {
            const found = messages.find(predicate)
            if (found) return found
            await new Promise((r) => setTimeout(r, 50))
          }
          throw new Error('mensagem não chegou ao SMTP de teste')
        },
        stop: () => new Promise((r) => server.close(() => r())),
      })
    })
  })
}

module.exports = { startSmtpSink }
