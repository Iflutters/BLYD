/**
 * Configuração do frontend. Nenhum segredo aqui: tudo que vai para o bundle é público.
 */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1',
  appVersion: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.1.0',
  /** Intervalo de verificação da sessão (detecta expiração/revogação em outra aba ou dispositivo). */
  sessionCheckIntervalMs: 5 * 60 * 1000,
} as const
