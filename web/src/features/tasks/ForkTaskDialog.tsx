import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { isAppError } from '@/core/errors/app-error'
import { FORK_COPY_DEFAULTS, FORK_COPY_KEYS, type ForkCopy } from '@/domain/relations'
import type { TaskDetail } from '@/domain/tasks'
import { AppButton, AppCheckbox, AppDialog, AppSelect, AppTextField, notify } from '@/presentation/components'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { useProjects } from '@/features/projects/queries'
import { useRelationMutations } from './queries'

const PROJECT_QUERY = { view: 'all' as const, page: 1, perPage: 100, sort: { id: 'name', direction: 'asc' as const }, search: '', filters: {} }

export function ForkTaskDialog({ task, open, onOpenChange }: { task: TaskDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  return open ? <ForkForm key={task.id} task={task} onOpenChange={onOpenChange} /> : null
}

function ForkForm({ task, onOpenChange }: { task: TaskDetail; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorMessage = useErrorMessage()
  const { fork } = useRelationMutations(task.id)
  const projects = useProjects(PROJECT_QUERY)
  const [title, setTitle] = useState(task.title)
  const [projectId, setProjectId] = useState(task.project?.id ?? '')
  const [copy, setCopy] = useState<ForkCopy>(FORK_COPY_DEFAULTS)
  const [error, setError] = useState<string | undefined>()

  // destino: projetos em que a pessoa trabalha (não leitor) e não arquivados
  const destinations = (projects.data?.items ?? []).filter((p) => (p.myRole !== 'viewer' && !p.archivedAt) || p.id === task.project?.id)

  function submit() {
    if (!title.trim()) return setError('required')
    fork.mutate(
      { title: title.trim(), projectId: projectId || undefined, copy },
      {
        onSuccess: (created) => {
          notify.success(t('relations.forked', { code: created.code, source: task.code }))
          onOpenChange(false)
          void navigate(`/tasks/${created.id}`)
        },
        onError: (err) => {
          if (isAppError(err) && err.code === 'VALIDATION_ERROR') {
            const fields = err.fieldErrors()
            if (fields.title) return setError(fields.title)
            if (Object.keys(fields).some((key) => key.startsWith('custom_values.'))) return notify.error(t('relations.forkRequiredFields'))
          }
          notify.error(errorMessage(err))
        },
      },
    )
  }

  return (
    <AppDialog
      open
      onOpenChange={onOpenChange}
      title={t('relations.forkTitle', { code: task.code })}
      description={t('relations.forkDescription')}
      footer={
        <>
          <AppButton variant="secondary" onClick={() => onOpenChange(false)} disabled={fork.isPending}>
            {t('common.cancel')}
          </AppButton>
          <AppButton onClick={submit} loading={fork.isPending}>
            {t('relations.forkConfirm')}
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
          label={t('tasks.fields.title')}
          required
          maxLength={200}
          value={title}
          error={error}
          onChange={(event) => {
            setTitle(event.target.value)
            setError(undefined)
          }}
        />
        <AppSelect
          label={t('tasks.fields.project')}
          value={projectId || undefined}
          onValueChange={setProjectId}
          options={destinations.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
        />
        <fieldset className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium text-fg">{t('relations.forkCopy')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FORK_COPY_KEYS.map((key) => (
              <AppCheckbox key={key} checked={copy[key]} onCheckedChange={(checked) => setCopy((c) => ({ ...c, [key]: checked }))} label={t(`relations.copy.${key}`)} />
            ))}
          </div>
          <p className="text-xs text-muted">{t('relations.forkCopyHint')}</p>
        </fieldset>
        <button type="submit" hidden />
      </form>
    </AppDialog>
  )
}
