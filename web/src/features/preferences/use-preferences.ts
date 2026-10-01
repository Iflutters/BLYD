import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import i18n, { type Language } from '@/core/i18n'
import type { ThemePreference } from '@/core/theme/theme'
import type { CurrentUser, User } from '@/domain/entities'
import { useRepositories } from '@/presentation/common/repositories-context'
import { useUiStore } from '@/presentation/state/ui-store'

const SESSION_KEY = ['auth', 'me'] as const

/** Aplica as preferências salvas no perfil do usuário (após login). */
export function applyUserPreferences(user: Pick<User, 'locale' | 'theme'>) {
  if (i18n.language !== user.locale) void i18n.changeLanguage(user.locale)
  useUiStore.getState().setTheme(user.theme)
}

/**
 * Tema e idioma: aplicados imediatamente na interface e salvos no perfil (melhor esforço),
 * para acompanhar o usuário em outros dispositivos.
 */
export function usePreferences() {
  const { users } = useRepositories()
  const queryClient = useQueryClient()
  const setTheme = useUiStore((s) => s.setTheme)

  const persist = useCallback(
    (patch: { theme?: ThemePreference; locale?: Language }) => {
      const current = queryClient.getQueryData<CurrentUser | null>(SESSION_KEY)
      if (!current) return
      users
        .update(current.user.id, patch)
        .then((user) => queryClient.setQueryData<CurrentUser | null>(SESSION_KEY, (prev) => (prev ? { ...prev, user } : prev)))
        .catch(() => {
          // Preferência já aplicada localmente; falha ao salvar não bloqueia o usuário.
        })
    },
    [queryClient, users],
  )

  const changeTheme = useCallback(
    (theme: ThemePreference) => {
      setTheme(theme)
      persist({ theme })
    },
    [persist, setTheme],
  )

  const changeLanguage = useCallback(
    (locale: Language) => {
      void i18n.changeLanguage(locale)
      persist({ locale })
    },
    [persist],
  )

  return { changeTheme, changeLanguage }
}
