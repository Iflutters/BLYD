import { useEffect, useSyncExternalStore } from 'react'
import { applyTheme, resolveTheme, type ResolvedTheme } from '@/core/theme/theme'
import { useUiStore } from '@/presentation/state/ui-store'

const QUERY = '(prefers-color-scheme: dark)'

function subscribe(callback: () => void) {
  const media = window.matchMedia(QUERY)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}

export function useResolvedTheme(): ResolvedTheme {
  const preference = useUiStore((s) => s.theme)
  return resolveTheme(preference, useSystemPrefersDark())
}

/** Mantém a classe .dark do <html> em sincronia com a preferência e com o sistema. */
export function useThemeSync() {
  const preference = useUiStore((s) => s.theme)
  const prefersDark = useSystemPrefersDark()
  useEffect(() => {
    applyTheme(preference)
  }, [preference, prefersDark])
}
