/**
 * Configuração do frontend. Nenhum segredo aqui: tudo que vai para o bundle é público.
 */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1',
  /** Versão do produto (package.json do web, gravada no build). */
  appVersion: __APP_VERSION__,
  /** Intervalo de verificação da sessão (detecta expiração/revogação em outra aba ou dispositivo). */
  sessionCheckIntervalMs: 5 * 60 * 1000,
} as const
