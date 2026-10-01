import { useEffect, useState } from 'react'

/**
 * Só fica `true` se `flag` permanecer verdadeiro por `delayMs`.
 * Evita "piscar" indicadores de carregamento em requisições rápidas.
 */
export function useDelayedFlag(flag: boolean, delayMs = 400): boolean {
  const [delayed, setDelayed] = useState(false)
  useEffect(() => {
    if (!flag) return
    const timer = setTimeout(() => setDelayed(true), delayMs)
    return () => {
      clearTimeout(timer)
      setDelayed(false)
    }
  }, [flag, delayMs])
  return flag && delayed
}
