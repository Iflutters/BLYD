import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, FolderInput, Minus, Plus, Tags, Trash2, Users, X } from 'lucide-react'
import type { Plan, PlanBulkInput } from '@/domain/plan'
import { groupTitle } from '@/domain/plan-view'
import { AppButton, AppConfirmDialog, AppIconButton, AppPopover } from '@/presentation/components'
import { ResourceChip, StatusBlock } from './cells'

/**
 * Barra da seleção em massa (como no Monday): "5 selecionados" → status, recursos (acrescentar ou
 * tirar), mover de grupo, duplicar e excluir (com confirmação). Tudo ou nada no servidor.
 */
export function BulkBar({
  plan,
  ids,
  pending,
  onApply,
  onClear,
}: {
  plan: Plan
  ids: string[]
  pending: boolean
  onApply: (input: PlanBulkInput) => Promise<unknown>
  onClear: () => void
}) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  if (ids.length === 0) return null
  const subitems = plan.items.filter((i) => i.parentId && ids.includes(i.parentId)).length
  const apply = (input: PlanBulkInput, close?: () => void) => {
    close?.()
    void onApply(input).catch(() => undefined)
  }
  const byParent = new Map(plan.groups.map((g) => [g.id, g]))
  const groupLabel = (id: string) => {
    const g = byParent.get(id)
    if (!g) return ''
    const parent = g.parentId ? byParent.get(g.parentId) : null
    return parent ? `${groupTitle(parent)} | ${groupTitle(g)}` : groupTitle(g)
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label={t('plan.bulk.toolbar', { count: ids.length })}
        className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-fit flex-wrap items-center gap-1 rounded-xl border border-border bg-surface p-2 shadow-float sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
      >
        <span className="px-2 text-sm font-semibold">{t('plan.bulk.selected', { count: ids.length })}</span>
        <AppPopover
          label={t('plan.bulk.status')}
          className="w-56"
          trigger={
            <AppButton variant="ghost" size="sm" leftIcon={<Tags />} disabled={pending}>
              {t('plan.columns.status')}
            </AppButton>
          }
        >
          {(close) => (
            <div className="flex flex-col gap-1">
              {[...plan.statuses, null].map((status) => (
                <button
                  key={status?.id ?? 'blank'}
                  type="button"
                  onClick={() => apply({ ids, action: 'update', statusId: status?.id ?? null }, close)}
                  className="relative h-8 overflow-hidden rounded-md hover:brightness-110 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <StatusBlock status={status} className="min-h-8" />
                  {!status && <span className="absolute inset-0 flex items-center justify-center text-xs text-muted">{t('plan.statusBlank')}</span>}
                </button>
              ))}
            </div>
          )}
        </AppPopover>
        <AppPopover
          label={t('plan.bulk.resources')}
          className="w-72"
          trigger={
            <AppButton variant="ghost" size="sm" leftIcon={<Users />} disabled={pending || plan.resources.length === 0}>
              {t('plan.columns.resources')}
            </AppButton>
          }
        >
          {(close) => (
            <div className="flex flex-col gap-1">
              <p className="px-1 pb-1 text-xs text-muted">{t('plan.bulk.resourcesHint')}</p>
              {plan.resources.map((r) => (
                <div key={r.id} className="flex items-center gap-1">
                  <span className="min-w-0 flex-1">
                    <ResourceChip resource={r} />
                  </span>
                  <AppIconButton size="sm" variant="ghost" icon={<Plus />} label={t('plan.bulk.addResource', { name: r.name })} onClick={() => apply({ ids, action: 'update', addResourceIds: [r.id] }, close)} />
                  <AppIconButton size="sm" variant="ghost" icon={<Minus />} label={t('plan.bulk.removeResource', { name: r.name })} onClick={() => apply({ ids, action: 'update', removeResourceIds: [r.id] }, close)} />
                </div>
              ))}
            </div>
          )}
        </AppPopover>
        <AppPopover
          label={t('plan.bulk.move')}
          className="w-72"
          trigger={
            <AppButton variant="ghost" size="sm" leftIcon={<FolderInput />} disabled={pending || plan.groups.length < 2}>
              {t('plan.move')}
            </AppButton>
          }
        >
          {(close) => (
            <div className="flex max-h-72 flex-col gap-0.5 overflow-auto">
              {plan.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => apply({ ids, action: 'move', groupId: g.id }, close)}
                  className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {groupLabel(g.id)}
                </button>
              ))}
            </div>
          )}
        </AppPopover>
        <AppButton variant="ghost" size="sm" leftIcon={<Copy />} disabled={pending} onClick={() => apply({ ids, action: 'duplicate' })}>
          {t('plan.duplicate')}
        </AppButton>
        <AppButton variant="ghost" size="sm" leftIcon={<Trash2 />} className="text-danger" disabled={pending} onClick={() => setConfirming(true)}>
          {t('common.delete')}
        </AppButton>
        <AppIconButton size="sm" variant="ghost" icon={<X />} label={t('plan.bulk.clear')} onClick={onClear} />
      </div>
      <AppConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('plan.bulk.deleteTitle', { count: ids.length })}
        description={subitems ? t('plan.bulk.deleteWithSubitems', { count: subitems }) : t('plan.bulk.deleteDescription')}
        confirmLabel={t('common.delete')}
        loading={pending}
        onConfirm={() => {
          setConfirming(false)
          apply({ ids, action: 'delete' })
        }}
      />
    </>
  )
}
