/**
 * Sobe o PocketBase local com hooks e migrations do projeto.
 * Uso: npm run dev
 */

const { spawn } = require('node:child_process')
const { BIN, loadEnv, pbArgs, assertBinary } = require('./env')

assertBinary()
const env = loadEnv()
const http = env.KAMBAN_HTTP || '127.0.0.1:8090'

const child = spawn(BIN, ['serve', `--http=${http}`].concat(pbArgs(env)), { env, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code || 0))
process.on('SIGINT', () => child.kill('SIGINT'))
