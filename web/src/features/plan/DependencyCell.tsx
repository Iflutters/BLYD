import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Link2, Plus, Settings2, X } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import { LINK_KINDS, type Plan, type PlanItem, type PlanLinkKind } from '@/domain/plan'
import { dependenciesOf, linkCandidates, type LinkedItem } from '@/domain/plan-view'
import { AppPopover, AppSelect } from '@/presentation/components'

/**
 * Coluna "Dependência": de quem o elemento depende, quem ele bloqueia e relacionados; aviso quando
 * depende de elemento ainda aberto. O seletor liga/desliga e mostra a regra do quadro.
 */
export function DependencyCell({
  item,
  plan,
  readOnly,
  canManage,
  onLink,
  onUnlink,
  onOpenRule,
}: {
  item: PlanItem
  plan: Plan
  readOnly: boolean
  canManage: boolean
  onLink: (kind: PlanLinkKind, otherId: string) => Promise<unknown>
  onUnlink: (linkId: string) => void
  onOpenRule: () => void
}) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<PlanLinkKind>('depends_on')
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const deps = dependenciesOf(item.id, plan)
  const total = deps.dependsOn.length + deps.blocks.length + deps.relates.length
  const first = deps.dependsOn[0] ?? deps.blocks[0] ?? deps.relates[0]
  const summary =
    total === 0
      ? t('plan.dependency.none')
      : [
          deps.dependsOn.length ? t('plan.dependency.dependsOnCount', { count: deps.dependsOn.length }) : null,
          deps.blocks.length ? t('plan.dependency.blocksCount', { count: deps.blocks.length }) : null,
          deps.relates.length ? t('plan.dependency.relatesCount', { count: deps.relates.length }) : null,
        ]
          .filter(Boolean)
          .join(', ')

  const face = (
    <span className="flex min-w-0 items-center justify-center gap-1 text-xs">
      {item.blocked && <AlertTriangle aria-hidden className="size-3.5 shrink-0 text-warning-soft-fg" />}
      {first && (
        <>
          <Link2 aria-hidden className="size-3.5 shrink-0 text-subtle" />
          <span className="truncate">{first.item.name}</span>
          {total > 1 && <span className="shrink-0 rounded-full bg-surface-3 px-1.5 text-muted">+{total - 1}</span>}
        </>
      )}
    </span>
  )
  const label = t('plan.dependency.of', { name: item.name, value: item.blocked ? `${summary} — ${t('plan.dependency.pending')}` : summary })
  const rule = plan.settings.dependencyRule

  // leitor sem dependências: célula vazia (sem texto repetido para o leitor de tela)
  if (readOnly && total === 0) return null
  const candidates = linkCandidates(item.id, plan, query).slice(0, 30)

  async function add(otherId: string) {
    if (pending) return
    setPending(true)
    try {
      await onLink(kind, otherId)
      setQuery('')
    } catch {
      // a mensagem já foi mostrada
    } finally {
      setPending(false)
    }
  }

  const list = (title: string, entries: LinkedItem[]) =>
    entries.length > 0 && (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">{title}</span>
        {entries.map(({ link, item: other }) => (
          <span key={link.id} className="flex items-center gap-2 rounded-md bg-surface-2 px-2 py-1 text-sm">
            <span className="min-w-0 flex-1 truncate">{other.name}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onUnlink(link.id)}
                aria-label={t('plan.dependency.remove', { name: other.name })}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-surface-3 hover:text-fg [&_svg]:size-3.5"
              >
                <X />
              </button>
            )}
          </span>
        ))}
      </div>
    )

  return (
    <AppPopover
      label={t('plan.dependency.title', { name: item.name })}
      className="w-80"
      onOpenChange={(open) => {
        if (!open) setQuery('')
      }}
      trigger={
        <button type="button" aria-label={label} title={summary} className={cn('group/cell flex h-full min-h-9 w-full items-center justify-center px-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', item.blocked && 'bg-warning-soft')}>
          {total ? face : <Plus aria-hidden className="size-4 text-subtle opacity-0 group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100" />}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {item.blocked && <p className="rounded-md bg-warning-soft px-2 py-1.5 text-xs text-warning-soft-fg">{t('plan.dependency.pendingHint')}</p>}
        {list(t('plan.dependency.dependsOn'), deps.dependsOn)}
        {list(t('plan.dependency.blocks'), deps.blocks)}
        {list(t('plan.dependency.relates'), deps.relates)}
        {total === 0 && <p className="text-sm text-muted">{t('plan.dependency.empty')}</p>}
        {!readOnly && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <AppSelect
              size="sm"
              aria-label={t('plan.dependency.kind')}
              value={kind}
              onValueChange={(value) => setKind(value as PlanLinkKind)}
              options={LINK_KINDS.map((k) => ({ value: k, label: t(`plan.linkTypes.${k}`) }))}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={t('plan.dependency.search')}
              placeholder={t('plan.dependency.search')}
              className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <div className="flex max-h-48 flex-col gap-0.5 overflow-auto">
              {candidates.map((other) => (
                <button
                  key={other.id}
                  type="button"
                  disabled={pending}
                  onClick={() => void add(other.id)}
                  className="rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                >
                  {other.name}
                </button>
              ))}
              {candidates.length === 0 && <p className="px-2 py-1.5 text-sm text-subtle">{t('plan.dependency.noCandidates')}</p>}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted">
          <span>{t('plan.dependencyRule.current', { rule: t(`plan.dependencyRule.${rule}`) })}</span>
          {canManage && (
            <button type="button" onClick={onOpenRule} className="flex items-center gap-1 font-medium hover:text-fg [&_svg]:size-3.5">
              <Settings2 />
              {t('plan.dependency.changeRule')}
            </button>
          )}
        </div>
      </div>
    </AppPopover>
  )
}
