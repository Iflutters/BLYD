import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import type { ChecklistItem, TaskDetail } from '@/domain/tasks'
import { AppButton, AppCheckbox, AppIconButton, notify } from '@/presentation/components'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { useTaskMutations } from './queries'

/** Checklist da tarefa: marcar, adicionar e remover itens (salva a lista inteira a cada mudança). */
export function TaskChecklist({ task }: { task: TaskDetail }) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const { update } = useTaskMutations()
  const [items, setItems] = useState<ChecklistItem[]>(task.checklist)
  const [synced, setSynced] = useState(task.checklist)
  const [newText, setNewText] = useState('')
  const canEdit = task.capabilities.edit

  // Novo checklist vindo do servidor (ajuste durante a renderização, sem efeito).
  if (synced !== task.checklist) {
    setSynced(task.checklist)
    setItems(task.checklist)
  }

  function save(next: ChecklistItem[]) {
    const previous = items
    setItems(next)
    update.mutate(
      { id: task.id, data: { checklist: next } },
      {
        onError: (error) => {
          setItems(previous)
          notify.error(errorMessage(error))
        },
      },
    )
  }

  function add() {
    const text = newText.trim()
    if (!text) return
    save([...items, { text, done: false }])
    setNewText('')
  }

  const done = items.filter((i) => i.done).length
  const percent = items.length === 0 ? 0 : Math.round((done / items.length) * 100)

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label={t('checklist.progress')}
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-valuenow={done}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
          >
            <div className={cn('h-full rounded-full transition-[width]', percent === 100 ? 'bg-success' : 'bg-primary')} style={{ width: `${percent}%` }} />
          </div>
          <span className="text-xs text-muted tabular-nums">
            {done}/{items.length}
          </span>
        </div>
      )}
      {items.length === 0 && !canEdit && <p className="text-sm text-subtle">{t('checklist.empty')}</p>}
      <ul className="flex flex-col">
        {items.map((item, index) => (
          <li key={item.id ?? `new-${index}`} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-2">
            <AppCheckbox
              checked={item.done}
              disabled={!canEdit}
              onCheckedChange={(checked) => save(items.map((x, i) => (i === index ? { ...x, done: checked === true } : x)))}
              label={<span className={cn('text-sm', item.done ? 'text-muted line-through' : 'text-fg')}>{item.text}</span>}
            />
            {canEdit && (
              <AppIconButton
                size="sm"
                variant="ghost"
                className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                label={t('checklist.remove', { text: item.text })}
                icon={<Trash2 />}
                onClick={() => save(items.filter((_, i) => i !== index))}
              />
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}
        >
          <input
            value={newText}
            onChange={(event) => setNewText(event.target.value)}
            maxLength={300}
            placeholder={t('checklist.addPlaceholder')}
            aria-label={t('checklist.addPlaceholder')}
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-subtle focus:border-primary focus:outline-2 focus:outline-ring"
          />
          <AppButton type="submit" size="sm" variant="secondary" leftIcon={<Plus />} disabled={!newText.trim()}>
            {t('checklist.add')}
          </AppButton>
        </form>
      )}
    </div>
  )
}
