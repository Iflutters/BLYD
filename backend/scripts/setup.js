/**
 * Baixa o binário do PocketBase na versão fixada do projeto para backend/bin.
 * Uso: npm run setup
 */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { ROOT, BIN } = require('./env')

const VERSION = '0.40.4'

function target() {
  const platform = { win32: 'windows', linux: 'linux', darwin: 'darwin' }[process.platform]
  const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch]
  if (!platform || !arch) throw new Error(`Plataforma não suportada: ${process.platform}/${process.arch}`)
  return `pocketbase_${VERSION}_${platform}_${arch}.zip`
}

async function main() {
  if (fs.existsSync(BIN)) {
    const current = execFileSync(BIN, ['--version']).toString().trim()
    if (current.endsWith(VERSION)) return console.log(`PocketBase ${VERSION} já instalado.`)
  }
  const file = target()
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/${file}`
  console.log(`Baixando ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Falha no download: ${res.status}`)

  const zip = path.join(os.tmpdir(), file)
  fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()))
  const binDir = path.join(ROOT, 'bin')
  fs.mkdirSync(binDir, { recursive: true })
  // tar (bsdtar) extrai .zip no Windows 10+, macOS e na maioria das distros Linux
  execFileSync('tar', ['-xf', zip, '-C', binDir])
  fs.rmSync(zip)
  console.log(execFileSync(BIN, ['--version']).toString().trim())
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
