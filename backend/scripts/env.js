/**
 * Carrega backend/.env (formato CHAVE=valor) sem dependências externas.
 * Variáveis já definidas no ambiente têm prioridade.
 */

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const BIN = path.join(ROOT, 'bin', process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase')

function loadEnv() {
  const file = path.join(ROOT, '.env')
  const env = Object.assign({}, process.env)
  if (!fs.existsSync(file)) return env
  fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (!match || line.trim().startsWith('#')) return
      const value = match[2].replace(/^(['"])(.*)\1$/, '$2')
      if (env[match[1]] === undefined) env[match[1]] = value
    })
  return env
}

function pbArgs(env) {
  return [
    `--dir=${path.resolve(ROOT, env.KAMBAN_DATA_DIR || 'pb_data')}`,
    `--hooksDir=${path.join(ROOT, 'pb_hooks')}`,
    `--migrationsDir=${path.join(ROOT, 'pb_migrations')}`,
    `--publicDir=${path.join(ROOT, 'pb_public')}`,
  ]
}

function assertBinary() {
  if (!fs.existsSync(BIN)) {
    console.error('PocketBase não encontrado. Rode: npm run setup')
    process.exit(1)
  }
}

module.exports = { ROOT, BIN, loadEnv, pbArgs, assertBinary }
