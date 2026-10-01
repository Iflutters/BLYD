/**
 * Bloqueio progressivo de conta (diretriz §27; complementa o rate limit por IP).
 *
 * - Falhas contam por e-mail (guardado só como hash) dentro de uma janela; entrar com sucesso zera.
 * - 5 falhas bloqueiam por 5 minutos; a cada 5 novas o tempo dobra, até 60 minutos.
 * - Durante o bloqueio a senha nem é conferida e a tentativa não conta (o prazo não se estende).
 * - E-mails inexistentes seguem a mesma regra: a resposta não revela se a conta existe.
 */

const THRESHOLD = 5
const BASE_MINUTES = 5
const MAX_MINUTES = 60
/** Falhas mais antigas que isso deixam de contar. */
const WINDOW_MINUTES = 24 * 60

function lockMinutes(failures) {
  if (failures < THRESHOLD) return 0
  const level = Math.floor(failures / THRESHOLD) - 1
  return Math.min(MAX_MINUTES, BASE_MINUTES * Math.pow(2, level))
}

/** Até quando a conta fica bloqueada (null = não está). */
function lockedUntil(failures, lastFailureAt) {
  const minutes = lockMinutes(failures)
  if (!minutes || !lastFailureAt) return null
  return new Date(lastFailureAt.getTime() + minutes * 60000)
}

module.exports = { THRESHOLD, WINDOW_MINUTES, lockMinutes, lockedUntil }
