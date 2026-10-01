import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isAppError } from '@/core/errors/app-error'
import { SPRINT_GOAL_MAX, SPRINT_NAME_MAX, sprintIssues, type Sprint } from '@/domain/sprints'
import { AppButton, AppDatePicker, AppDialog, AppTextarea, AppTextField, notify } from '@/presentation/components'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { useSprintMutations } from './queries'

export interface SprintFormDialogProps {
  projectId: string
  /** undefined = fechado; null = novo; sprint = edição. */
  sprint: Sprint | null | undefined
  onOpenChange: (open: boolean) => void
}

/** Remonta a cada abertura (rascunho novo). */
export function SprintFormDialog(props: SprintFormDialogProps) {
  if (props.sprint === undefined) return null
  return <SprintForm key={props.sprint?.id ?? 'new'} {...props} sprint={props.sprint} />
}

function SprintForm({ projectId, sprint, onOpenChange }: SprintFormDialogProps & { sprint: Sprint | null }) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const { create, update } = useSprintMutations(projectId)
  const [name, setName] = useState(sprint?.name ?? '')
  const [goal, setGoal] = useState(sprint?.goal ?? '')
  const [startDate, setStartDate] = useState(sprint?.startDate ?? '')
  const [endDate, setEndDate] = useState(sprint?.endDate ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const pending = create.isPending || update.isPending

  function submit() {
    const found = sprintIssues({ name, goal, startDate, endDate })
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const data = { name: name.trim(), goal, startDate: startDate || null, endDate: endDate || null }
    const onError = (error: unknown) => {
      if (isAppError(error) && error.code === 'VALIDATION_ERROR') return setErrors(error.fieldErrors())
      notify.error(errorMessage(error))
    }
    const onSuccess = () => {
      notify.success(sprint ? t('sprints.updated', { name: data.name }) : t('sprints.created', { name: data.name }))
      onOpenChange(false)
    }
    if (sprint) update.mutate({ id: sprint.id, data }, { onSuccess, onError })
    else create.mutate(data, { onSuccess, onError })
  }

  return (
    <AppDialog
      open
      onOpenChange={onOpenChange}
      title={sprint ? t('sprints.editTitle') : t('sprints.createTitle')}
      description={t('sprints.formDescription')}
      footer={
        <>
          <AppButton variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('common.cancel')}
          </AppButton>
          <AppButton onClick={submit} loading={pending}>
            {t('common.save')}
          </AppButton>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <AppTextField
          label={t('sprints.fields.name')}
          required
          autoComplete="off"
          maxLength={SPRINT_NAME_MAX}
          value={name}
          error={errors.name}
          placeholder={t('sprints.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
        <AppTextarea
          label={t('sprints.fields.goal')}
          rows={3}
          maxLength={SPRINT_GOAL_MAX}
          value={goal}
          error={errors.goal}
          onChange={(event) => setGoal(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <AppDatePicker label={t('sprints.fields.startDate')} value={startDate} onValueChange={setStartDate} error={errors.start_date} clearable />
          <AppDatePicker
            label={t('sprints.fields.endDate')}
            value={endDate}
            onValueChange={setEndDate}
            min={startDate || undefined}
            error={errors.end_date}
            clearable
          />
        </div>
        <button type="submit" hidden />
      </form>
    </AppDialog>
  )
}
