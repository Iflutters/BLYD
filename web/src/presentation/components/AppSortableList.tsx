import type { CSSProperties, ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Announcements,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils/cn'

export interface SortableHandleProps {
  /** Espalhe no elemento que serve de alça de arraste (já inclui rótulo acessível). */
  handle: Record<string, unknown>
  isDragging: boolean
}

export interface AppSortableListProps<T> {
  items: T[]
  getId: (item: T) => string
  /** Rótulo do item para leitores de tela ("Severidade"). */
  getLabel: (item: T) => string
  onReorder: (items: T[]) => void
  renderItem: (item: T, sortable: SortableHandleProps) => ReactNode
  disabled?: boolean
  className?: string
}

/**
 * Lista reordenável por arrastar e soltar (mouse, toque e teclado: espaço para pegar,
 * setas para mover, espaço para soltar, Esc para cancelar). Anúncios traduzidos para leitores de tela.
 */
export function AppSortableList<T>({ items, getId, getLabel, onReorder, renderItem, disabled, className }: AppSortableListProps<T>) {
  const { t } = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = items.map(getId)
  const labelOf = (id: string | number) => {
    const item = items.find((i) => getId(i) === id)
    return item ? getLabel(item) : String(id)
  }
  const position = (id: string | number) => ids.indexOf(String(id)) + 1

  const announcements: Announcements = {
    onDragStart: ({ active }) => t('sortable.picked', { item: labelOf(active.id), position: position(active.id), total: ids.length }),
    onDragOver: ({ active, over }) => (over ? t('sortable.moved', { item: labelOf(active.id), position: position(over.id) }) : undefined),
    onDragEnd: ({ active, over }) => (over ? t('sortable.dropped', { item: labelOf(active.id), position: position(over.id) }) : undefined),
    onDragCancel: ({ active }) => t('sortable.cancelled', { item: labelOf(active.id) }),
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onReorder(arrayMove(items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t('sortable.instructions') } }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ul className={cn('flex flex-col gap-2', className)}>
          {items.map((item) => (
            <SortableRow key={getId(item)} id={getId(item)} label={getLabel(item)} disabled={disabled}>
              {(sortable) => renderItem(item, sortable)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  label,
  disabled,
  children,
}: {
  id: string
  label: string
  disabled?: boolean
  children: (sortable: SortableHandleProps) => ReactNode
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }
  return (
    <li ref={setNodeRef} style={style} className={cn('relative', isDragging && 'opacity-80 shadow-float')}>
      {children({
        isDragging,
        handle: { ref: setActivatorNodeRef, ...attributes, ...listeners, 'aria-label': t('sortable.handle', { item: label }) },
      })}
    </li>
  )
}

/** Alça padrão de arraste (ícone de "grip"). */
export function AppDragHandle({ handle, disabled }: { handle: Record<string, unknown>; disabled?: boolean }) {
  return (
    <button
      type="button"
      {...handle}
      disabled={disabled}
      className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  )
}
