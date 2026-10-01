/** Descrição curta do dispositivo a partir do User-Agent (apenas exibição, nunca para segurança). */
export function describeUserAgent(ua: string): { label: string; mobile: boolean } {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  const label = [browser, os].filter(Boolean).join(' · ')
  return { label: label || ua.slice(0, 60) || '—', mobile: /Mobile|Android|iPhone/.test(ua) }
}
