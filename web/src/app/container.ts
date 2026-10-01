import { QueryClient } from '@tanstack/react-query'
import { env } from '@/core/config/env'
import { isAppError } from '@/core/errors/app-error'
import i18n from '@/core/i18n'
import { createApiClient } from '@/core/networking/api-client'
import { createHttpRepositories } from '@/data/http-repositories'
import { SESSION_QUERY_KEY } from '@/features/auth/session'
import { useSessionStore } from '@/features/auth/session-store'

/**
 * Composition root do frontend: instancia cliente HTTP, repositórios e cache de servidor.
 *
 * Estratégia de cache (Server State):
 * - staleTime curto (30s) e refetch ao montar; listas usam keepPreviousData na paginação;
 * - erros 4xx não são repetidos (são respostas definitivas da API);
 * - mutações invalidam as chaves afetadas (ver features/*\/queries.ts).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isAppError(error) && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
    },
    mutations: { retry: false },
  },
})

/** Sessão ausente/expirada detectada em qualquer requisição: limpa dados e volta ao login. */
function handleUnauthorized(code: string) {
  const hadSession = !!queryClient.getQueryData(SESSION_QUERY_KEY)
  if (code === 'SESSION_EXPIRED' || hadSession) useSessionStore.getState().markExpired()
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' })
  queryClient.setQueryData(SESSION_QUERY_KEY, null)
}

export const apiClient = createApiClient({ baseUrl: env.apiBaseUrl, onUnauthorized: handleUnauthorized, getLanguage: () => i18n.language })
export const repositories = createHttpRepositories(apiClient)

// trocar o idioma rebusca os dados: cadastros traduzidos (ex.: tipos de tarefa) vêm no novo idioma
i18n.on('languageChanged', () => void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'auth' }))
