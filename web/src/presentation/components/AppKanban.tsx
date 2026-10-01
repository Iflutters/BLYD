import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/core/utils/cn'

export type AppKanbanWipState = 'none' | 'ok' | 'full' | 'over'

const WIP_TONE: Record<AppKanbanWipState, string> = {
  none: 'bg-surface-3 text-muted',
  ok: 'bg-surface-3 text-muted',
  full: 'bg-warning-soft text-warning-soft-fg',
  over: 'bg-danger-soft text-danger-soft-fg',
}

export interface AppKanbanColumnHeaderProps {
  title: ReactNode
  /** Contagem (ex.: "3" ou "3/5" com limite WIP). */
  count: ReactNode
  countLabel?: string
  wip?: AppKanbanWipState
  /** Barra de cor no topo (cor do status). */
  accent?: string
  actions?: ReactNode
  /** Destino não permitido para o card em arraste. */
  blocked?: boolean
  className?: string
}

/** Cabeçalho da coluna do quadro: nome, contagem/limite WIP e ações. */
export function AppKanbanColumnHeader({ title, count, countLabel, wip = 'none', accent, actions, blocked, className }: AppKanbanColumnHeaderProps) {
  return (
    <div
      className={cn(
        'relative flex min-h-11 items-center gap-2 overflow-hidden rounded-xl border border-border bg-surface px-3 py-2 shadow-card transition-opacity',
        wip === 'over' && 'border-danger',
        blocked && 'opacity-50',
        className,
      )}
    >
      {accent && <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accent }} />}
      <div className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{title}</div>
      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums', WIP_TONE[wip])} title={countLabel}>
        {count}
        {countLabel && <span className="sr-only"> {countLabel}</span>}
      </span>
      {actions}
    </div>
  )
}

export interface AppKanbanDropZoneProps extends HTMLAttributes<HTMLDivElement> {
  /** O card em arraste está sobre esta área. */
  over?: boolean
  /** Destino não permitido (transição bloqueada ou outra raia). */
  blocked?: boolean
}

/** Área de cards de uma coluna (e raia): recebe os cards soltos. */
export const AppKanbanDropZone = forwardRef<HTMLDivElement, AppKanbanDropZoneProps>(function AppKanbanDropZone(
  { over, blocked, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex min-h-24 flex-col gap-2 rounded-xl border border-transparent bg-surface-2 p-2 transition-colors',
        over && !blocked && 'border-primary bg-primary-soft',
        blocked && 'cursor-not-allowed border-dashed border-border-strong opacity-50',
        className,
      )}
      {...props}
    />
  )
})

export interface AppKanbanCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card de origem enquanto é arrastado (fica "fantasma"). */
  dragging?: boolean
  /** Cópia que segue o ponteiro. */
  overlay?: boolean
  /** Sem arrastar (sem permissão). */
  locked?: boolean
}

/** Card do quadro (a feature define o conteúdo). */
export const AppKanbanCard = forwardRef<HTMLDivElement, AppKanbanCardProps>(function AppKanbanCard(
  { dragging, overlay, locked, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'group flex select-none flex-col gap-2 rounded-xl border border-border bg-surface p-3 text-left shadow-card outline-none transition-[box-shadow,opacity]',
        'hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring',
        locked ? 'cursor-pointer' : 'cursor-grab touch-manipulation',
        dragging && 'opacity-40',
        overlay && 'rotate-2 cursor-grabbing shadow-float',
        className,
      )}
      {...props}
    />
  )
})
