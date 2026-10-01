import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { History, RotateCcw } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import { formatDateTime } from '@/core/utils/format'
import type { DocPage } from '@/domain/docs'
import { AppButton, AppConfirmDialog, AppDrawer, AppEmptyState, AppErrorState, AppLoading, AppSkeleton, notify } from '@/presentation/components'
import { AppRichTextView } from '@/presentation/components/rich-text'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { useDocVersion, useDocVersions, usePageMutations } from './queries'

export interface VersionsDrawerProps {
  page: DocPage
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Versões publicadas: quem, quando, o conteúdo de cada uma e restaurar (vira a próxima versão). */
export function VersionsDrawer({ page, open, onOpenChange }: VersionsDrawerProps) {
  const { t, i18n } = useTranslation()
  const errorMessage = useErrorMessage()
  const versions = useDocVersions(page.id, open)
  const [selected, setSelected] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const shown = selected ?? versions.data?.[0]?.version ?? null
  const detail = useDocVersion(page.id, open ? shown : null)
  const { restore } = usePageMutations(page.space.key)

  const onRestore = () => {
    if (shown === null) return
    restore.mutate(
      { id: page.id, version: shown },
      {
        onSuccess: (restored) => {
          notify.success(t('docs.versions.restored', { from: shown, version: restored.version }))
          setConfirming(false)
          setSelected(null)
          onOpenChange(false)
        },
        onError: (error) => notify.error(errorMessage(error)),
      },
    )
  }

  return (
    <AppDrawer open={open} onOpenChange={onOpenChange} size="xl" title={t('docs.versions.title')} description={page.title}>
      {versions.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <AppSkeleton key={i} className="h-12" />
          ))}
        </div>
      ) : versions.isError ? (
        <AppErrorState onRetry={() => void versions.refetch()} />
      ) : versions.data.length === 0 ? (
        <AppEmptyState icon={<History />} title={t('docs.versions.empty')} compact />
      ) : (
        <div className="flex flex-col gap-5">
          <ol aria-label={t('docs.versions.list')} className="flex gap-2 overflow-x-auto pb-1">
            {versions.data.map((version) => {
              const active = version.version === shown
              return (
                <li key={version.version} className="shrink-0">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(version.version)}
                    className={cn(
                      'w-44 rounded-lg border px-3 py-2 text-left transition-colors',
                      active ? 'border-primary bg-primary-soft text-primary-soft-fg' : 'border-border hover:bg-surface-2',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                      {t('docs.versions.version', { version: version.version })}
                      {version.version === page.version && <span className="text-xs font-medium">{t('docs.versions.current')}</span>}
                    </span>
                    <span className="block truncate text-xs opacity-80">{formatDateTime(version.createdAt, i18n.language)}</span>
                    <span className="block truncate text-xs opacity-80">{version.author?.name ?? t('audit.system')}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <section aria-label={shown ? t('docs.versions.version', { version: shown }) : undefined} className="min-w-0 rounded-xl border border-border">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <p className="min-w-0 truncate font-semibold text-fg">{detail.data?.title ?? '…'}</p>
              {page.capabilities.edit && shown !== null && shown !== page.version && (
                <AppButton size="sm" variant="secondary" leftIcon={<RotateCcw />} onClick={() => setConfirming(true)}>
                  {t('docs.versions.restore')}
                </AppButton>
              )}
            </header>
            <div className="px-4 py-4">
              {detail.isPending ? <AppLoading /> : detail.isError ? <AppErrorState onRetry={() => void detail.refetch()} /> : <AppRichTextView key={shown ?? 0} content={detail.data.content} />}
            </div>
          </section>
        </div>
      )}
      <AppConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        tone="primary"
        title={t('docs.versions.restoreTitle', { version: shown ?? 0 })}
        description={t('docs.versions.restoreHint', { next: page.version + 1 })}
        confirmLabel={t('docs.versions.restore')}
        loading={restore.isPending}
        onConfirm={onRestore}
      />
    </AppDrawer>
  )
}
