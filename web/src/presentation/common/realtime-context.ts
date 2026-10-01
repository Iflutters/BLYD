import { createContext, useContext } from 'react'
import { createNoopRealtimeClient, type RealtimeClient } from '@/core/realtime/realtime-client'

/**
 * Cliente do tempo real injetado pelo App (testes e telas fora do app usam o que não conecta).
 */
export const RealtimeContext = createContext<RealtimeClient>(createNoopRealtimeClient())

export function useRealtime(): RealtimeClient {
  return useContext(RealtimeContext)
}
