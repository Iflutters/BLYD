/**
 * Acesso ao localStorage tolerante a falhas (modo privado, cota, bloqueio de cookies).
 * Usado apenas para preferências de interface — nunca para tokens ou dados sensíveis.
 */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // indisponível: preferência vale só nesta sessão
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignorado
    }
  },
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = safeStorage.get(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown): void {
  safeStorage.set(key, JSON.stringify(value))
}
