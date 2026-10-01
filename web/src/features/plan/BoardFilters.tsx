import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Filter, UserRound, X } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import type { ProjectMember } from '@/domain/projects'
import type { Plan } from '@/domain/plan'
import { DEPENDENCY_FILTERS, EMPTY_FILTERS, NONE, PROGRESS_BUCKETS, activeFilterCount, groupTitle, type DependencyFilter, type PlanFilters } from '@/domain/plan-view'
import { AppAvatar, AppButton, AppCheckbox, AppDatePicker, AppPopover, AppSelect, SELECT_ALL } from '@/presentation/components'
import type { FilterFocus } from './use-plan-columns'

const toggle = (list: string[], value: string, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((x) => x !== value))

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <fieldset id={id} className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-subtle">{title}</legend>
      {children}
    </fieldset>
  )
}

/**
 * "Filtro" do quadro: status, recursos, grupo, período, progresso, atrasados e dependências
 * (combináveis; "Filtros (3)"). O menu de cada coluna abre direto na parte dela (`focus`).
 */
export function FilterButton({
  plan,
  filters,
  onChange,
  open,
  onOpenChange,
  focus,
}: {
  plan: Plan
  filters: PlanFilters
  onChange: (filters: PlanFilters) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  focus: FilterFocus | null
}) {
  const { t } = useTranslation()
  const count = activeFilterCount(filters)
  const panel = useRef<HTMLDivElement>(null)
  const set = (patch: Partial<PlanFilters>) => onChange({ ...filters, ...patch })

  // aberto pelo menu da coluna: rola até a parte dela e foca o primeiro campo
  useEffect(() => {
    if (!open || !focus) return
    const frame = requestAnimationFrame(() => {
      const target = panel.current?.querySelector<HTMLElement>(`#plan-filter-${focus}`)
      target?.scrollIntoView({ block: 'nearest' })
      target?.querySelector<HTMLElement>('button, input')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open, focus])

  const checkbox = (key: string, label: ReactNode, checked: boolean, onToggle: (on: boolean) => void) => <AppCheckbox key={key} checked={checked} onCheckedChange={onToggle} label={label} />

  return (
    <AppPopover
      label={t('plan.filters.title')}
      open={open}
      onOpenChange={onOpenChange}
      dismissOnFocusOutside={false}
      className="w-[min(92vw,40rem)] p-4"
      trigger={
        <AppButton variant={count ? 'soft' : 'secondary'} leftIcon={<Filter />}>
          {count ? t('plan.filters.active', { count }) : t('plan.filters.button')}
        </AppButton>
      }
    >
      <div ref={panel} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Section id="plan-filter-status" title={t('plan.columns.status')}>
            {[...plan.statuses.map((s) => ({ id: s.id, name: s.name })), { id: NONE, name: t('plan.statusBlank') }].map((s) =>
              checkbox(s.id || 'blank', s.name, filters.statusIds.includes(s.id), (on) => set({ statusIds: toggle(filters.statusIds, s.id, on) })),
            )}
          </Section>
          <Section id="plan-filter-resources" title={t('plan.columns.resources')}>
            {[...plan.resources.map((r) => ({ id: r.id, name: r.name })), { id: NONE, name: t('plan.filters.noResource') }].map((r) =>
              checkbox(r.id || 'none', r.name, filters.resourceIds.includes(r.id), (on) => set({ resourceIds: toggle(filters.resourceIds, r.id, on) })),
            )}
          </Section>
          <Section id="plan-filter-groups" title={t('plan.filters.groups')}>
            {plan.groups.map((g) => checkbox(g.id, <span className={cn(g.parentId && 'pl-3')}>{groupTitle(g)}</span>, filters.groupIds.includes(g.id), (on) => set({ groupIds: toggle(filters.groupIds, g.id, on) })))}
          </Section>
          <div className="flex flex-col gap-4">
            <Section id="plan-filter-period" title={t('plan.filters.period')}>
              <div className="grid grid-cols-2 gap-2">
                <AppDatePicker
                  label={t('plan.filters.from')}
                  value={filters.period?.start ?? ''}
                  onValueChange={(start) => set({ period: start || filters.period?.end ? { start: start || (filters.period?.end ?? ''), end: filters.period?.end ?? start } : null })}
                />
                <AppDatePicker
                  label={t('plan.filters.to')}
                  value={filters.period?.end ?? ''}
                  min={filters.period?.start}
                  onValueChange={(end) => set({ period: end || filters.period?.start ? { start: filters.period?.start ?? end, end: end || (filters.period?.start ?? '') } : null })}
                />
              </div>
            </Section>
            <Section id="plan-filter-progress" title={t('plan.columns.progress')}>
              {PROGRESS_BUCKETS.map((b) => checkbox(b, t(`plan.filters.progress.${b}`), filters.progress.includes(b), (on) => set({ progress: on ? [...new Set([...filters.progress, b])] : filters.progress.filter((x) => x !== b) })))}
            </Section>
            <Section id="plan-filter-dependency" title={t('plan.columns.dependency')}>
              <AppSelect
                size="sm"
                aria-label={t('plan.columns.dependency')}
                value={filters.dependency ?? SELECT_ALL}
                onValueChange={(value) => set({ dependency: value === SELECT_ALL ? null : (value as DependencyFilter) })}
                options={[{ value: SELECT_ALL, label: t('plan.filters.dependency.all') }, ...DEPENDENCY_FILTERS.map((d) => ({ value: d, label: t(`plan.filters.dependency.${d}`) }))]}
              />
              {checkbox('overdue', t('plan.filters.overdue'), filters.overdue, (on) => set({ overdue: on }))}
            </Section>
          </div>
        </div>
        <div className="flex justify-end border-t border-border pt-3">
          <AppButton variant="ghost" size="sm" leftIcon={<X />} disabled={count === 0} onClick={() => onChange({ ...EMPTY_FILTERS, ownerIds: filters.ownerIds })}>
            {t('plan.filters.clear')}
          </AppButton>
        </div>
      </div>
    </AppPopover>
  )
}

/** "Pessoa": mostra só os subelementos de quem é responsável (e os elementos deles). */
export function PersonButton({ members, filters, onChange }: { members: ProjectMember[]; filters: PlanFilters; onChange: (filters: PlanFilters) => void }) {
  const { t } = useTranslation()
  const chosen = members.filter((m) => filters.ownerIds.includes(m.user.id))
  const people = members.filter((m) => m.user.status === 'active')
  return (
    <AppPopover
      label={t('plan.filters.person')}
      className="w-64"
      trigger={
        <AppButton variant={chosen.length ? 'soft' : 'secondary'} leftIcon={chosen.length === 1 && chosen[0] ? <span aria-hidden className="flex">
              <AppAvatar name={chosen[0].user.name} src={chosen[0].user.avatarUrl} size="xs" />
            </span> : <UserRound />}>
          {chosen.length === 1 && chosen[0] ? chosen[0].user.name : chosen.length > 1 ? t('plan.filters.people', { count: chosen.length }) : t('plan.filters.person')}
        </AppButton>
      }
    >
      <div className="flex flex-col gap-1">
        <p className="px-2 pb-1 text-xs text-muted">{t('plan.filters.personHint')}</p>
        {people.map((m) => {
          const on = filters.ownerIds.includes(m.user.id)
          return (
            <button
              key={m.user.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...filters, ownerIds: toggle(filters.ownerIds, m.user.id, !on) })}
              className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2', on && 'bg-primary-soft text-primary-soft-fg')}
            >
              <span aria-hidden className="flex">
                <AppAvatar name={m.user.name} src={m.user.avatarUrl} size="xs" />
              </span>
              <span className="truncate">{m.user.name}</span>
            </button>
          )
        })}
        {chosen.length > 0 && (
          <AppButton variant="ghost" size="sm" leftIcon={<X />} className="mt-1 self-start" onClick={() => onChange({ ...filters, ownerIds: [] })}>
            {t('plan.filters.clearPerson')}
          </AppButton>
        )}
      </div>
    </AppPopover>
  )
}
