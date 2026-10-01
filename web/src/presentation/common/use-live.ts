import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeStatus } from '@/core/realtime/realtime-client'
import { invalidationKeys, projectTopic, userTopic } from '@/domain/realtime'
import { useRealtime } from './realtime-context'

/** Avisos que chegam juntos (ex.: mover vários cartões) viram uma só busca. */
const BATCH_MS = 250

/** Enquanto a tela está aberta, assina o tópico e atualiza os dados afetados pelos avisos. */
function useLiveTopic(topic: string | null) {
  const realtime = useRealtime()
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!topic) return
    const pending = new Map<string, readonly unknown[]>()
    let timer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      // alteração da própria pessoa em andamento (ex.: arrastar um cartão): buscar agora traria o estado
      // de antes e o cartão "voltaria"; a alteração atualiza a tela ao terminar, e depois vem o resto
      if (queryClient.isMutating() > 0) {
        timer = setTimeout(flush, BATCH_MS)
        return
      }
      timer = null
      pending.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }))
      pending.clear()
    }
    const off = realtime.subscribe(topic, (event) => {
      invalidationKeys(event).forEach((key) => pending.set(JSON.stringify(key), key))
      if (!timer) timer = setTimeout(flush, BATCH_MS)
    })
    return () => {
      off()
      if (timer) clearTimeout(timer)
    }
  }, [topic, realtime, queryClient])
}

/** Quadro, lista ou tarefa de um projeto aberta: atualiza sozinha quando alguém muda algo. */
export function useLiveProject(projectId: string | null | undefined) {
  useLiveTopic(projectId ? projectTopic(projectId) : null)
}

/** Notificações da pessoa (sino) em tempo real. */
export function useLiveNotifications(userId: string | null | undefined) {
  useLiveTopic(userId ? userTopic(userId) : null)
}

export function useRealtimeStatus(): RealtimeStatus {
  const realtime = useRealtime()
  return useSyncExternalStore(
    (onChange) => realtime.onStatus(onChange),
    () => realtime.getStatus(),
    () => 'idle',
  )
}
