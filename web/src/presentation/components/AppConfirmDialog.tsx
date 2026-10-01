import type { ReactNode } from 'react'
import { AlertDialog } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { AppButton } from './AppButton'

export interface AppConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  onConfirm: () => void
}

/** Confirmação para ações destrutivas/irreversíveis. Use apenas quando necessário. */
export function AppConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  loading,
  onConfirm,
}: AppConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-overlay animate-fade-in" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-float animate-scale-in focus:outline-none">
          <AlertDialog.Title className="text-base font-semibold text-fg">{title}</AlertDialog.Title>
          {description ? (
            <AlertDialog.Description className="mt-2 text-sm text-muted">{description}</AlertDialog.Description>
          ) : (
            <AlertDialog.Description className="sr-only">{title}</AlertDialog.Description>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <AppButton variant="secondary" disabled={loading}>
                {cancelLabel ?? t('common.cancel')}
              </AppButton>
            </AlertDialog.Cancel>
            <AppButton variant={tone} loading={loading} onClick={onConfirm}>
              {confirmLabel ?? t('common.confirm')}
            </AppButton>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
