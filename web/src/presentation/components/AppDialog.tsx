import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils/cn'

export interface AppDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** `xl`/`2xl`: formulários de criação/edição (cabeçalho e rodapé fixos, corpo com rolagem). */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** `false` impede fechar clicando fora (formulários longos; Esc e "Cancelar" continuam fechando). */
  closeOnOutsideClick?: boolean
  /** Ocupa quase toda a altura da tela (conteúdo que cresce, ex.: lista de opções de um campo). */
  tall?: boolean
  className?: string
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-6xl' }

/**
 * Janela sobre a tela (pop-up centralizado). Cresce até a altura da tela; o que passar disso
 * rola dentro do corpo, com título e ações sempre visíveis.
 */
export function AppDialog({ open, onOpenChange, title, description, children, footer, size = 'md', closeOnOutsideClick = true, tall = false, className }: AppDialogProps) {
  const { t } = useTranslation()
  const large = size === 'xl' || size === '2xl'
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'rounded-xl border border-border bg-surface shadow-float animate-scale-in focus:outline-none',
            SIZES[size],
            tall && 'h-[min(calc(100dvh-2rem),56rem)] sm:h-[min(calc(100dvh-4rem),56rem)]',
            className,
          )}
          onInteractOutside={closeOnOutsideClick ? undefined : (event) => event.preventDefault()}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', large && 'border-b border-border pb-4 sm:px-6')}>
            <div className="min-w-0">
              <Dialog.Title className={cn('font-semibold text-fg', large ? 'text-lg' : 'text-base')}>{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="-mr-1 -mt-1 rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label={t('common.close')}>
              <X className="size-4" />
            </Dialog.Close>
          </div>
          {children && <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', large && 'py-5 sm:px-6')}>{children}</div>}
          {footer && <div className={cn('flex justify-end gap-2 border-t border-border px-5 py-3', large && 'sm:px-6')}>{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
