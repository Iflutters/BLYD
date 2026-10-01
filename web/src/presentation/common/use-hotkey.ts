import { useEffect, useRef } from 'react'

export interface HotkeyOptions {
  /** Exige Ctrl (Windows/Linux) ou ⌘ (macOS). */
  mod?: boolean
  shift?: boolean
  /** Dispara mesmo com foco em campos de texto. */
  allowInInputs?: boolean
  enabled?: boolean
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/** Registra um atalho global de teclado. */
export function useHotkey(key: string, handler: (event: KeyboardEvent) => void, options: HotkeyOptions = {}) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  const { mod = false, shift = false, allowInInputs = false, enabled = true } = options
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== key.toLowerCase()) return
      if (mod !== (event.ctrlKey || event.metaKey)) return
      if (shift !== event.shiftKey) return
      if (!allowInInputs && !mod && isTypingTarget(event.target)) return
      event.preventDefault()
      handlerRef.current(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, mod, shift, allowInInputs, enabled])
}
