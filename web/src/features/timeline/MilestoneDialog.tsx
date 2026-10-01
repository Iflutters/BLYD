import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { isAppError } from '@/core/errors/app-error'
import type { Milestone } from '@/domain/timeline'
import { AppButton, AppConfirmDialog, AppDatePicker, AppDialog, AppSwitch, AppTextField, AppTextarea, notify } from '@/presentation/components'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { useMilestoneMutations } from './queries'

export type MilestoneDialogState = { mode: 'create'; dueDate?: string } | { mode: 'edit'; milestone: Milestone } | null

/** Criar, editar ou excluir um marco (gestor do projeto). */
export function MilestoneDialog({ projectId, state, onClose }: { projectId: string; state: MilestoneDialogState; onClose: () => void }) {
  if (!state) return null
  return <MilestoneForm key={state.mode === 'edit' ? state.milestone.id : 'new'} projectId={projectId} state={state} onClose={onClose} />
}

function MilestoneForm({ projectId, state, onClose }: { projectId: string; state: Exclude<MilestoneDialogState, null>; onClose: () => void }) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const { create, update, remove } = useMilestoneMutations(projectId)
  const editing = state.mode === 'edit' ? state.milestone : null
  const [name, setName] = useState(editing?.name ?? '')
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? (state.mode === 'create' ? (state.dueDate ?? '') : ''))
  const [description, setDescription] = useState(editing?.description ?? '')
  const [done, setDone] = useState(editing?.state === 'done')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)
  const pending = create.isPending || update.isPending || remove.isPending

  function submit() {
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'required'
    if (!dueDate) found.due_date = 'required'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const input = { name: name.trim(), dueDate, description: description.trim(), state: done ? ('done' as const) : ('pending' as const) }
    const onError = (error: unknown) => {
      if (isAppError(error) && error.code === 'VALIDATION_ERROR') return setErrors(error.fieldErrors())
      notify.error(errorMessage(error))
    }
    const onSuccess = () => {
      notify.success(editing ? t('timeline.milestones.updated', { name: input.name }) : t('timeline.milestones.created', { name: input.name }))
      onClose()
    }
    if (editing) update.mutate({ id: editing.id, input }, { onSuccess, onError })
    else create.mutate(input, { onSuccess, onError })
  }

  return (
    <>
      <AppDialog
        open
        onOpenChange={(open) => !open && !pending && onClose()}
        size="md"
        closeOnOutsideClick={false}
        title={editing ? t('timeline.milestones.editTitle') : t('timeline.milestones.createTitle')}
        description={t('timeline.milestones.description')}
        footer={
          <>
            {editing && (
              <AppButton variant="ghost" leftIcon={<Trash2 />} className="mr-auto text-danger" onClick={() => setConfirming(true)} disabled={pending}>
                {t('common.delete')}
              </AppButton>
            )}
            <AppButton variant="secondary" onClick={onClose} disabled={pending}>
              {t('common.cancel')}
            </AppButton>
            <AppButton onClick={submit} loading={create.isPending || update.isPending}>
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
          <AppTextField label={t('timeline.milestones.fields.name')} required maxLength={120} autoComplete="off" value={name} error={errors.name} onChange={(event) => setName(event.target.value)} />
          <AppDatePicker label={t('timeline.milestones.fields.date')} required value={dueDate} error={errors.due_date} onValueChange={setDueDate} />
          <AppTextarea label={t('timeline.milestones.fields.description')} rows={3} maxLength={1000} value={description} error={errors.description} onChange={(event) => setDescription(event.target.value)} />
          <AppSwitch checked={done} onCheckedChange={setDone} label={t('timeline.milestones.fields.done')} description={t('timeline.milestones.doneHint')} />
        </form>
      </AppDialog>
      <AppConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('timeline.milestones.deleteTitle', { name: editing?.name ?? '' })}
        description={t('timeline.milestones.deleteDescription')}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          editing &&
          remove.mutate(editing.id, {
            onSuccess: () => {
              notify.success(t('timeline.milestones.deleted', { name: editing.name }))
              setConfirming(false)
              onClose()
            },
            onError: (error) => notify.error(errorMessage(error)),
          })
        }
      />
    </>
  )
}
