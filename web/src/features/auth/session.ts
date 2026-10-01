import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { env } from '@/core/config/env'
import type { CurrentUser } from '@/domain/entities'
import { can, canAny, type PermissionCode } from '@/domain/permissions'
import type { LoginCredentials } from '@/domain/repositories'
import { useRepositories } from '@/presentation/common/repositories-context'
import { useSessionStore } from './session-store'
import { applyUserPreferences } from '@/features/preferences/use-preferences'

export const SESSION_QUERY_KEY = ['auth', 'me'] as const

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous'

/** Usuário autenticado (server state). Rechecado periodicamente e ao focar a janela. */
export function useSession(): { current: CurrentUser | null; status: SessionStatus } {
  const { auth } = useRepositories()
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: () => auth.me(),
    staleTime: 60_000,
    refetchInterval: env.sessionCheckIntervalMs,
    refetchOnWindowFocus: true,
    retry: false,
  })
  if (query.isPending) return { current: null, status: 'loading' }
  const current = query.data ?? null
  return { current, status: current ? 'authenticated' : 'anonymous' }
}

export function useCan(permission: PermissionCode): boolean {
  const { current } = useSession()
  return !!current && can(current.permissions, permission)
}

export function useCanAny(permissions: readonly PermissionCode[]): boolean {
  const { current } = useSession()
  return !!current && canAny(current.permissions, permissions)
}

export function useLogin() {
  const { auth } = useRepositories()
  const queryClient = useQueryClient()
  const clearEndReason = useSessionStore((s) => s.clearEndReason)
  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      await auth.login(credentials)
      return auth.me()
    },
    onSuccess: (current) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, current)
      clearEndReason()
      if (current) applyUserPreferences(current.user)
    },
  })
}

export function useLogout() {
  const { auth } = useRepositories()
  const queryClient = useQueryClient()
  const markSignedOut = useSessionStore((s) => s.markSignedOut)
  return useMutation({
    mutationFn: () => auth.logout(),
    onSettled: async () => {
      markSignedOut()
      // Primeiro a sessão vira "anônima" na MESMA consulta que as telas observam (um clear() antes
      // desligava as telas da sessão e elas não percebiam a saída). Depois some todo o resto do
      // cache: nenhum dado do usuário anterior pode sobreviver ao logout.
      await queryClient.cancelQueries()
      queryClient.setQueryData(SESSION_QUERY_KEY, null)
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0] })
      // a rota protegida (RequireAuth) leva ao login sem guardar a página atual como destino
    },
  })
}

/** Aceita apenas caminhos internos (evita open redirect via ?next=). */
export function safeRedirect(next: string | null): string {
  if (!next) return '/dashboard'
  try {
    const decoded = decodeURIComponent(next)
    if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) return '/dashboard'
    return decoded
  } catch {
    return '/dashboard'
  }
}
