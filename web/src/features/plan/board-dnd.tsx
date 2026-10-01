import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { neighbors } from '@/domain/kanban'
import { OrderContext, ROOTS, type Containers, type GroupTarget, type ItemTarget } from './board-order'

/** Arrastar e soltar do quadro (elementos, subelementos e grupos), sobre os contêineres de board-order.ts. */
export function BoardDnd({
  containers,
  labelOf,
  containerLabel,
  onMoveItem,
  onMoveGroup,
  children,
}: {
  containers: Containers
  labelOf: (id: string) => string
  containerLabel: (containerId: string) => string
  onMoveItem: (id: string, target: ItemTarget) => void
  onMoveGroup: (id: string, target: GroupTarget) => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ items: Containers; base: Containers; origin: string } | null>(null)
  // depois de soltar, a ordem da tela fica até o quadro recarregar (sem "piscar")
  if (drag && !activeId && drag.base !== containers) setDrag(null)
  const current = drag ? drag.items : containers

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const containerOf = (id: UniqueIdentifier, from: Containers = current): string | undefined => {
    const key = String(id)
    if (key in from) return key
    return Object.keys(from).find((k) => from[k]?.includes(key))
  }
  const sameFamily = (origin: string, other: string) => (origin.startsWith('g:') ? other.startsWith('g:') : other === origin)

  // Prefere o item mais próximo da mesma família; um grupo vazio só vale sob o ponteiro.
  const collision: CollisionDetection = (args) => {
    const origin = containerOf(args.active.id, containers)
    if (!origin) return []
    const candidates = args.droppableContainers.filter((d) => {
      const container = String(d.id) in current ? String(d.id) : (d.data.current as { container?: string } | undefined)?.container
      return !!container && sameFamily(origin, container)
    })
    const nearest = closestCenter({ ...args, droppableContainers: candidates.filter((d) => !(String(d.id) in current)) })
    if (!origin.startsWith('g:')) return nearest
    const empty = pointerWithin({ ...args, droppableContainers: candidates }).find((c) => String(c.id) in current && (current[String(c.id)] ?? []).length === 0)
    return empty ? [empty] : nearest
  }

  function onDragStart({ active }: DragStartEvent) {
    const origin = containerOf(active.id, containers)
    if (!origin) return
    setActiveId(String(active.id))
    setDrag({ items: Object.fromEntries(Object.entries(containers).map(([k, v]) => [k, [...v]])), base: containers, origin })
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !drag || !drag.origin.startsWith('g:')) return
    const from = containerOf(active.id)
    const to = containerOf(over.id)
    if (!from || !to || from === to || !to.startsWith('g:')) return
    setDrag((state) => {
      if (!state) return state
      const source = (state.items[from] ?? []).filter((id) => id !== String(active.id))
      const target = [...(state.items[to] ?? [])]
      const overIndex = target.indexOf(String(over.id))
      const translated = active.rect.current.translated
      const below = !!translated && translated.top > over.rect.top + over.rect.height / 2
      target.splice(overIndex < 0 ? target.length : overIndex + (below ? 1 : 0), 0, String(active.id))
      return { ...state, items: { ...state.items, [from]: source, [to]: target } }
    })
  }

  function cancel() {
    setDrag(null)
    setActiveId(null)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const state = drag
    const id = String(active.id)
    if (!state || !over) return cancel()
    const container = containerOf(id, state.items)
    if (!container || !sameFamily(state.origin, container)) return cancel()
    let list = state.items[container] ?? []
    if (containerOf(over.id, state.items) === container && over.id !== active.id && !(String(over.id) in state.items)) {
      list = arrayMove(list, list.indexOf(id), list.indexOf(String(over.id)))
    }
    const unchanged = container === state.origin && list.join('|') === (containers[state.origin] ?? []).join('|')
    if (unchanged) return cancel()
    setDrag({ ...state, items: { ...state.items, [container]: list } })
    setActiveId(null)
    const near = neighbors(list, id)
    if (id.startsWith('grp:')) {
      const strip = (x?: string) => (x ? x.slice(4) : undefined)
      onMoveGroup(id.slice(4), { parentId: container === ROOTS ? null : container.slice('subs:'.length), prevId: strip(near.prevId), nextId: strip(near.nextId) })
      return
    }
    onMoveItem(id, { ...(container !== state.origin && container.startsWith('g:') ? { groupId: container.slice(2) } : {}), ...near })
  }

  const positionIn = (id: UniqueIdentifier) => {
    const key = containerOf(id)
    return key ? (current[key] ?? []).indexOf(String(id)) + 1 : 0
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('plan.announce.picked', { item: labelOf(String(active.id)), group: containerLabel(containerOf(active.id) ?? ''), position: positionIn(active.id) }),
    onDragOver: ({ active, over }) => (over ? t('plan.announce.over', { item: labelOf(String(active.id)), group: containerLabel(containerOf(over.id) ?? ''), position: positionIn(active.id) }) : undefined),
    onDragEnd: ({ active, over }) => (over ? t('plan.announce.dropped', { item: labelOf(String(active.id)), group: containerLabel(containerOf(over.id) ?? '') }) : undefined),
    onDragCancel: ({ active }) => t('plan.announce.cancelled', { item: labelOf(String(active.id)) }),
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={cancel}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('plan.announce.instructions') } }}
    >
      <OrderContext.Provider value={current}>{children}</OrderContext.Provider>
      <DragOverlay dropAnimation={null}>
        {activeId ? <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium shadow-float">{labelOf(activeId)}</div> : null}
      </DragOverlay>
    </DndContext>
  )
}
