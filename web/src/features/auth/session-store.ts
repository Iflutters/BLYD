import { create } from 'zustand'

/**
 * Session State: informações sobre o ciclo de vida da sessão que não são dados do servidor.
 * (Os dados do usuário autenticado ficam no cache do TanStack Query — ver session.ts.)
 */
export type SessionEndReason = 'expired' | 'signed_out'

interface SessionState {
  /** Motivo do último encerramento de sessão (exibido na tela de login). */
  endReason: SessionEndReason | null
  markExpired: () => void
  markSignedOut: () => void
  clearEndReason: () => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  endReason: null,
  markExpired: () => set({ endReason: 'expired' }),
  markSignedOut: () => set({ endReason: 'signed_out' }),
  clearEndReason: () => set({ endReason: null }),
}))
