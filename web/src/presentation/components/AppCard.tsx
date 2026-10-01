import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/core/utils/cn'

export interface AppCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Destaque com gradiente sutil (cards especiais). */
  highlight?: boolean
  padded?: boolean
}

export function AppCard({ title, description, actions, highlight, padded = true, className, children, ...props }: AppCardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-surface shadow-card',
        highlight && 'bg-subtle-gradient',
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <header className="flex flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && 'p-5', (title || actions) && padded && 'pt-3')}>{children}</div>
    </section>
  )
}
