import { useState, type ReactNode } from 'react'
import { Popover } from 'radix-ui'
import { cn } from '@/core/utils/cn'

export interface AppPopoverProps {
  /** Elemento que abre o painel (recebe os atributos do gatilho). */
  trigger: ReactNode
  /** Conteúdo; a função recebe `close` para fechar após uma escolha. */
  children: ReactNode | ((close: () => void) => ReactNode)
  /** Nome acessível do painel (role="dialog"). */
  label: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
  /** Âncora diferente do gatilho (ex.: a célula inteira). */
  anchor?: ReactNode
  /**
   * Fecha quando o foco sai do painel (padrão). Desligue quando o painel é aberto por outro menu,
   * que devolve o foco ao próprio botão ao fechar (clique fora e Esc continuam fechando).
   */
  dismissOnFocusOutside?: boolean
}

/**
 * Painel flutuante do design system (Radix Popover): seletores de célula (status, cronograma,
 * recursos), filtros rápidos. Fecha com Esc ou clique fora e devolve o foco ao gatilho.
 */
export function AppPopover({ trigger, children, label, open, onOpenChange, align = 'start', side = 'bottom', className, anchor, dismissOnFocusOutside = true }: AppPopoverProps) {
  const [inner, setInner] = useState(false)
  const controlled = open !== undefined
  const isOpen = controlled ? open : inner
  const setOpen = (next: boolean) => {
    if (!controlled) setInner(next)
    onOpenChange?.(next)
  }
  return (
    <Popover.Root open={isOpen} onOpenChange={setOpen}>
      {anchor && <Popover.Anchor asChild>{anchor}</Popover.Anchor>}
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          align={align}
          side={side}
          sideOffset={4}
          collisionPadding={8}
          onFocusOutside={dismissOnFocusOutside ? undefined : (event) => event.preventDefault()}
          className={cn(
            'z-50 max-h-[var(--radix-popover-content-available-height)] overflow-auto rounded-lg border border-border bg-surface p-2 text-fg shadow-float animate-scale-in',
            className,
          )}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
