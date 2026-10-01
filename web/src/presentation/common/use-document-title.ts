import { useEffect } from 'react'
import { usePlatformInfo } from './use-platform'

/** Título da aba: "Página · Nome da plataforma" (nome do Configurador geral). */
export function useDocumentTitle(title: string) {
  const { name } = usePlatformInfo()
  useEffect(() => {
    document.title = title ? `${title} · ${name}` : name
  }, [title, name])
}
