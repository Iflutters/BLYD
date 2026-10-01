import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { datesIssue, type TaskSummary } from '@/domain/tasks'
import { AppButton, AppDatePicker, AppDialog } from '@/presentation/components'

/** "Definir datas" (alternativa ao arraste, inclusive pelo teclado e no celular). */
export function ScheduleDialog({
  task,
  initial,
  onClose,
  onSave,
}: {
  task: TaskSummary | null
  initial: { startDate: string; dueDate: string }
  onClose: () => void
  onSave: (task: TaskSummary, dates: { startDate: string; dueDate: string }) => void
}) {
  if (!task) return null
  return <ScheduleForm key={task.id} task={task} initial={initial} onClose={onClose} onSave={onSave} />
}

function ScheduleForm({ task, initial, onClose, onSave }: { task: TaskSummary; initial: { startDate: string; dueDate: string }; onClose: () => void; onSave: (task: TaskSummary, dates: { startDate: string; dueDate: string }) => void }) {
  const { t } = useTranslation()
  const [startDate, setStartDate] = useState(initial.startDate)
  const [dueDate, setDueDate] = useState(initial.dueDate)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function submit() {
    const found: Record<string, string> = {}
    if (!startDate) found.start_date = 'required'
    if (!dueDate) found.due_date = 'required'
    const issue = datesIssue(startDate, dueDate)
    if (issue) found.start_date = issue
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSave(task, { startDate, dueDate })
    onClose()
  }

  return (
    <AppDialog
      open
      onOpenChange={(open) => !open && onClose()}
      size="sm"
      title={t('timeline.schedule.title', { code: task.code })}
      description={task.title}
      footer={
        <>
          <AppButton variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </AppButton>
          <AppButton onClick={submit}>{t('common.save')}</AppButton>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <AppDatePicker label={t('tasks.fields.startDate')} required value={startDate} error={errors.start_date} onValueChange={setStartDate} />
        <AppDatePicker label={t('tasks.fields.dueDate')} required value={dueDate} min={startDate || undefined} error={errors.due_date} onValueChange={setDueDate} />
      </div>
    </AppDialog>
  )
}
