import type { ReactNode } from 'react'
import { cn } from '@/core/utils/cn'

/** Dica visual de atalho de teclado. */
export function AppKbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1 font-sans text-[10px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
