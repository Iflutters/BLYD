import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DEFAULT_BRANDING, DEFAULT_PLATFORM_INFO, type PlatformInfo } from '@/domain/platform'
import { useRepositories } from './repositories-context'

export const PLATFORM_INFO_QUERY_KEY = ['platform', 'info'] as const

/** Identidade da plataforma e se ela já chegou (até lá vale o padrão, com o e-mail desligado). */
export function usePlatformInfoState(): { info: PlatformInfo; loaded: boolean } {
  const { platform } = useRepositories()
  const { data, isFetched } = useQuery({ queryKey: PLATFORM_INFO_QUERY_KEY, queryFn: () => platform.getInfo(), staleTime: 5 * 60_000, retry: false })
  return { info: data ?? DEFAULT_PLATFORM_INFO, loaded: isFetched }
}

/** Identidade da plataforma (Configurador geral): nome, logo e ícone — pública, vale até no login. */
export function usePlatformInfo(): PlatformInfo {
  return usePlatformInfoState().info
}

/** Mantém o ícone da aba do navegador igual ao configurado (ou o padrão). */
export function usePlatformFavicon() {
  const { faviconUrl } = usePlatformInfo()
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    const href = faviconUrl ?? DEFAULT_BRANDING.favicon
    if (link.getAttribute('href') === href) return
    link.removeAttribute('type')
    link.href = href
  }, [faviconUrl])
}

/** Componente sem tela para o composition root (precisa dos provedores). */
export function PlatformHead() {
  usePlatformFavicon()
  return null
}
