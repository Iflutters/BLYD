import type { ReactNode } from 'react'
import { Tooltip } from 'radix-ui'
import { cn } from '@/core/utils/cn'

export interface AppTooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Quando false, renderiza só o filho (útil para tooltips condicionais). */
  enabled?: boolean
  className?: string
}

export function AppTooltipProvider({ children }: { children: ReactNode }) {
  return <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
}

export function AppTooltip({ content, children, side = 'top', enabled = true, className }: AppTooltipProps) {
  if (!enabled || !content) return <>{children}</>
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-xs rounded-md bg-fg px-2.5 py-1.5 text-xs font-medium text-bg shadow-float animate-fade-in',
            className,
          )}
        >
          {content}
          <Tooltip.Arrow className="fill-fg" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
