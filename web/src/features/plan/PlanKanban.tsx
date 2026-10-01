import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { MessageSquare, MoreHorizontal } from 'lucide-react'
import type { Plan, PlanItem, PlanStatus } from '@/domain/plan'
import { groupTitle, kanbanColumns, type KanbanColumn } from '@/domain/plan-view'
import { AppBadge, AppDropdown, AppIconButton, AppKanbanCard, AppKanbanColumnHeader, AppKanbanDropZone, AppSearch, notify } from '@/presentation/components'
import { optionColor, optionText } from '@/features/task-config/config-theme'
import { ProgressBar, ResourceChip, SchedulePill } from './cells'
import { usePlanMutations } from './queries'
import { usePlanError } from './use-plan-error'

const BLANK = 'blank'
const columnId = (status: PlanStatus | null) => `col:${status ? status.id : BLANK}`

/**
 * Kanban do quadro (GP-4): uma coluna por etiqueta de status ("Feito / 47") e "Em branco"; os cards
 * são os elementos. Arrastar o card (ou "Mover para…" no menu dele, pelo teclado) muda o status do
 * elemento — a mesma fonte do quadro principal, com a regra de dependências do quadro.
 */
export function PlanKanban({ plan, onOpen }: { plan: Plan; onOpen: (itemId: string) => void }) {
  const { t } = useTranslation()
  const planError = usePlanError()
  const mutations = usePlanMutations(plan.project.id)
  const canEdit = plan.capabilities.edit
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const columns = useMemo(() => kanbanColumns(plan, query), [plan, query])
  const itemById = useMemo(() => new Map(plan.items.map((i) => [i.id, i])), [plan.items])
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }))

  function move(item: PlanItem, status: PlanStatus | null) {
    const statusId = status ? status.id : null
    if ((item.statusId ?? null) === statusId) return
    mutations.updateItem.mutate(
      { id: item.id, input: { statusId } },
      {
        onSuccess: () => notify.success(t('plan.kanban.moved', { name: item.name, status: status?.name ?? t('plan.statusBlank') })),
        onError: (error) => notify.error(planError(error)),
      },
    )
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    const item = itemById.get(String(active.id))
    const target = over ? columns.find((c) => columnId(c.status) === over.id) : undefined
    if (item && target) move(item, target.status)
  }

  const active = activeId ? itemById.get(activeId) : undefined
  const total = columns.reduce((sum, c) => sum + c.items.length, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full sm:w-72">
          <AppSearch value={query} onSearch={setQuery} placeholder={t('plan.searchPlaceholder')} />
        </div>
        {!canEdit && <AppBadge>{t('kanban.readOnly')}</AppBadge>}
        <p className="ml-auto text-xs text-muted" aria-live="polite">
          {t('plan.kanban.summary', { count: total })}
        </p>
      </div>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={({ active: a }: DragStartEvent) => setActiveId(String(a.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0" data-testid="plan-kanban">
          <div className="grid min-w-full gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(16rem, 1fr))` }}>
            {columns.map((column) => (
              <Column key={columnId(column.status)} column={column}>
                {column.items.map((item) => (
                  <Card key={item.id} item={item} plan={plan} canEdit={canEdit} onOpen={onOpen} onMove={(status) => move(item, status)} />
                ))}
              </Column>
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <AppKanbanCard overlay className="w-72">
              <CardContent item={active} plan={plan} />
            </AppKanbanCard>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

function Column({ column, children }: { column: KanbanColumn; children: ReactNode }) {
  const { t } = useTranslation()
  const { setNodeRef, isOver } = useDroppable({ id: columnId(column.status) })
  const name = column.status?.name ?? t('plan.statusBlank')
  return (
    <section aria-label={t('plan.kanban.column', { name, count: column.items.length })} className="flex min-w-0 flex-col gap-2">
      <AppKanbanColumnHeader
        title={
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-surface-3" style={column.status ? { backgroundColor: optionColor(column.status.color) } : undefined} />
            {name}
          </span>
        }
        accent={column.status ? optionColor(column.status.color) : undefined}
        count={column.items.length}
        countLabel={t('plan.kanban.count', { count: column.items.length })}
      />
      <AppKanbanDropZone ref={setNodeRef} over={isOver} className="max-h-[calc(100dvh-17rem)] min-h-40 overflow-y-auto">
        {children}
        {column.items.length === 0 && <p className="py-6 text-center text-xs text-subtle">{t('plan.kanban.empty')}</p>}
      </AppKanbanDropZone>
    </section>
  )
}

function Card({ item, plan, canEdit, onOpen, onMove }: { item: PlanItem; plan: Plan; canEdit: boolean; onOpen: (id: string) => void; onMove: (status: PlanStatus | null) => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id, disabled: !canEdit })
  const targets: Array<PlanStatus | null> = [...plan.statuses, null].filter((s) => (s ? s.id : null) !== (item.statusId ?? null))
  return (
    <AppKanbanCard ref={setNodeRef} dragging={isDragging} locked={!canEdit} {...listeners} {...attributes} role={undefined} tabIndex={undefined} aria-roledescription={undefined}>
      <div className="flex items-start gap-1">
        <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-ring" aria-label={t('plan.kanban.open', { name: item.name })}>
          <CardContent item={item} plan={plan} />
        </button>
        {canEdit && (
          <AppDropdown
            align="end"
            trigger={<AppIconButton size="sm" variant="ghost" icon={<MoreHorizontal />} label={t('plan.kanban.actions', { name: item.name })} />}
            items={targets.map((status) => ({ key: status ? status.id : BLANK, label: t('plan.kanban.moveTo', { status: status?.name ?? t('plan.statusBlank') }), onSelect: () => onMove(status) }))}
          />
        )}
      </div>
    </AppKanbanCard>
  )
}

function CardContent({ item, plan }: { item: PlanItem; plan: Plan }) {
  const { t } = useTranslation()
  const group = plan.groups.find((g) => g.id === item.groupId)
  const resources = item.resourceIds.map((id) => plan.resources.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r)
  return (
    <span className="flex flex-col gap-2">
      {group && (
        <span className="truncate text-[11px] font-semibold" style={{ color: optionText(group.color) }}>
          {groupTitle(group)}
        </span>
      )}
      <span className="line-clamp-2 text-sm font-medium text-fg">{item.name}</span>
      {(item.startDate || item.endDate || resources.length > 0) && (
        <span className="flex flex-wrap items-center gap-1">
          {(item.startDate || item.endDate) && group && <SchedulePill start={item.startDate} end={item.endDate} color={group.color} />}
          {resources.slice(0, 2).map((r) => (
            <ResourceChip key={r.id} resource={r} />
          ))}
          {resources.length > 2 && <span className="text-xs text-muted">+{resources.length - 2}</span>}
        </span>
      )}
      <span className="flex items-center gap-2">
        <ProgressBar value={item.progress.value} label={t('plan.progressOf', { name: item.name })} className="min-w-0 flex-1" />
        {item.updates > 0 && (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted" title={t('plan.panel.open', { name: item.name, count: item.updates })}>
            <MessageSquare className="size-3.5" aria-hidden />
            {item.updates}
          </span>
        )}
      </span>
    </span>
  )
}
