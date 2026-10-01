import { toast } from 'react-toastify'
import { ToastBody } from './ToastBody'

export interface NotifyOptions {
  description?: string | undefined
  /** Ação de desfazer quando tecnicamente possível. */
  undo?: { label: string; onClick: () => void } | undefined
  /** Duração em ms (padrão por tipo; `false` mantém até fechar). */
  autoClose?: number | false
}

type Kind = 'success' | 'error' | 'info' | 'warning'

/** Tempo de permanência por tipo (ms): erros e mensagens com "Desfazer" ficam mais tempo. */
export const TOAST_DURATION: Record<Kind | 'undo', number> = {
  success: 8000,
  info: 8000,
  warning: 10000,
  error: 12000,
  undo: 12000,
}

/** Nenhum toast fecha antes de 3 segundos. */
export const TOAST_MIN_DURATION = 3000

/** Duração efetiva: padrão por tipo, respeitando o mínimo; `false` mantém aberto até fechar. */
export function toastDuration(kind: Kind, options?: NotifyOptions): number | false {
  const requested = options?.autoClose ?? (options?.undo ? TOAST_DURATION.undo : TOAST_DURATION[kind])
  return requested === false ? false : Math.max(TOAST_MIN_DURATION, requested)
}

function show(kind: Kind, message: string, options?: NotifyOptions) {
  return toast[kind](ToastBody, {
    data: { title: message, description: options?.description, undo: options?.undo },
    autoClose: toastDuration(kind, options),
  })
}

/**
 * API única de notificações (React-Toastify). Features nunca chamam a biblioteca diretamente.
 * Tipos: success, error, info, warning e promise (pendente → sucesso/erro).
 */
export const notify = {
  success: (message: string, options?: NotifyOptions) => show('success', message, options),
  error: (message: string, options?: NotifyOptions) => show('error', message, options),
  info: (message: string, options?: NotifyOptions) => show('info', message, options),
  warning: (message: string, options?: NotifyOptions) => show('warning', message, options),

  /** Toast de operação em andamento que vira sucesso ou erro ao terminar. */
  promise<T>(
    promise: Promise<T>,
    messages: { pending: string; success: string | ((data: T) => string); error: string | ((error: unknown) => string) },
  ): Promise<T> {
    return toast.promise(promise, {
      pending: messages.pending,
      success: { render: ({ data }) => (typeof messages.success === 'function' ? messages.success(data as T) : messages.success) },
      error: { render: ({ data }) => (typeof messages.error === 'function' ? messages.error(data) : messages.error) },
    })
  },

  dismissAll: () => toast.dismiss(),
}
