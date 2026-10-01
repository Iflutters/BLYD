import type { ReactNode } from 'react'
import { Dialog } from 'radix-ui'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils/cn'

export interface AppDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Conteúdo à direita do título (ex.: ações rápidas). */
  headerActions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
  /** Lado de onde o painel entra. Padrão: direita (detalhes); esquerda para navegação (ex.: árvore de páginas). */
  side?: 'right' | 'left'
}

const SIZES = { md: 'sm:max-w-md', lg: 'sm:max-w-xl', xl: 'sm:max-w-3xl' }

/**
 * Painel lateral para detalhes/edição sem perder o contexto da página (ex.: "Visualizar" das DataTables).
 * Em telas pequenas ocupa a largura inteira.
 */
export function AppDrawer({ open, onOpenChange, title, description, headerActions, children, footer, size = 'md', side = 'right' }: AppDrawerProps) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 z-50 flex w-full flex-col border-border bg-surface shadow-float focus:outline-none',
            side === 'right' ? 'right-0 border-l animate-slide-in-right' : 'left-0 border-r animate-slide-in-left',
            SIZES[size],
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold text-fg">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-0.5 text-sm text-muted">{description}</Dialog.Description>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
              <Dialog.Close className="rounded-md p-1.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label={t('common.close')}>
                <X className="size-4" />
              </Dialog.Close>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
