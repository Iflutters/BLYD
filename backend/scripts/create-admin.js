/**
 * Cria/atualiza o SUPER_ADMIN usando KAMBAN_ADMIN_EMAIL, KAMBAN_ADMIN_PASSWORD e KAMBAN_ADMIN_NAME
 * (do ambiente ou de backend/.env). Aplica migrations pendentes antes.
 * Se KAMBAN_SUPERUSER_EMAIL/PASSWORD existirem, cria também o superusuário do painel /_/.
 * Uso: npm run create-admin
 */

const { execFileSync } = require('node:child_process')
const { BIN, loadEnv, pbArgs, assertBinary } = require('./env')

assertBinary()
const env = loadEnv()
if (!env.KAMBAN_ADMIN_EMAIL || !env.KAMBAN_ADMIN_PASSWORD) {
  console.error('Defina KAMBAN_ADMIN_EMAIL e KAMBAN_ADMIN_PASSWORD (em backend/.env ou no ambiente).')
  process.exit(1)
}

execFileSync(BIN, ['kamban-admin'].concat(pbArgs(env)), { env, stdio: 'inherit' })
