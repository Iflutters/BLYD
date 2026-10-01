import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import { isAppError } from '@/core/errors/app-error'
import { LINK_OPTIONS, type LinkOption } from '@/domain/relations'
import type { TaskDetail, TaskSummary } from '@/domain/tasks'
import { AppButton, AppDialog, AppSearch, AppSelect, AppSkeleton, notify } from '@/presentation/components'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { useRelationMutations, useTaskMutations, useTasksList } from './queries'
import { TaskCode, TaskStatusBadge } from './task-visuals'

export interface LinkTaskDialogProps {
  task: TaskDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tipo já escolhido (ex.: "Adicionar subtarefa existente" = child). */
  initialType?: LinkOption
  /** O que a pessoa pode fazer: relações (tasks.link) e pai/filho (editar). */
  canLink: boolean
  canEdit: boolean
}

/** Remonta a cada abertura (rascunho novo). */
export function LinkTaskDialog(props: LinkTaskDialogProps) {
  return props.open ? <LinkForm key={props.initialType ?? 'any'} {...props} /> : null
}

function LinkForm({ task, onOpenChange, initialType, canLink, canEdit }: LinkTaskDialogProps) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const { create } = useRelationMutations(task.id)
  const { update } = useTaskMutations()
  const options = LINK_OPTIONS.filter((option) => (option === 'parent' || option === 'child' ? canEdit : canLink))
  const [type, setType] = useState<LinkOption>(initialType && options.includes(initialType) ? initialType : (options[0] ?? 'relates'))
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<TaskSummary | null>(null)
  const [error, setError] = useState<string | undefined>()

  // pai e subtarefa só no mesmo projeto; relações podem cruzar projetos visíveis
  const sameProject = type === 'parent' || type === 'child'
  const results = useTasksList(
    { page: 1, perPage: 8, sort: { id: 'updated_at', direction: 'desc' }, search, filters: {} },
    sameProject && task.project ? { projectId: task.project.id } : undefined,
  )
  const items = (results.data?.items ?? []).filter((item) => item.id !== task.id)
  const pending = create.isPending || update.isPending

  function done() {
    notify.success(t('relations.linked', { code: task.code, other: target?.code ?? '' }))
    onOpenChange(false)
  }
  function fail(err: unknown) {
    if (isAppError(err) && err.code === 'VALIDATION_ERROR') {
      const fields = err.fieldErrors()
      const code = fields.parent_task_id ?? fields.target_id ?? fields.type
      if (code) return setError(t(`validation.${code}`))
    }
    notify.error(errorMessage(err))
  }

  function submit() {
    if (!target) return setError(t('relations.pickTask'))
    setError(undefined)
    if (type === 'parent') return update.mutate({ id: task.id, data: { parentTaskId: target.id } }, { onSuccess: done, onError: fail })
    if (type === 'child') return update.mutate({ id: target.id, data: { parentTaskId: task.id } }, { onSuccess: done, onError: fail })
    create.mutate({ type, targetId: target.id }, { onSuccess: done, onError: fail })
  }

  return (
    <AppDialog
      open
      onOpenChange={onOpenChange}
      size="lg"
      title={t('relations.addTitle', { code: task.code })}
      description={t('relations.addDescription')}
      footer={
        <>
          <AppButton variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('common.cancel')}
          </AppButton>
          <AppButton onClick={submit} loading={pending} disabled={!target}>
            {t('relations.add')}
          </AppButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <AppSelect
          label={t('relations.typeLabel', { code: task.code })}
          value={type}
          onValueChange={(value) => {
            setType(value as LinkOption)
            setTarget(null)
          }}
          options={options.map((option) => ({ value: option, label: t(`relations.phrases.${option}`) }))}
          hint={sameProject ? t('relations.sameProjectHint') : undefined}
        />
        <AppSearch value={search} onSearch={setSearch} placeholder={t('relations.searchPlaceholder')} />
        <div role="listbox" aria-label={t('relations.results')} className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-xl border border-border p-1">
          {results.isPending ? (
            <AppSkeleton className="h-24" />
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-subtle">{t('relations.noResults')}</p>
          ) : (
            items.map((item) => {
              const selected = target?.id === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setTarget(item)
                    setError(undefined)
                  }}
                  className={cn(
                    'flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2',
                    selected && 'bg-primary-soft text-primary-soft-fg hover:bg-primary-soft',
                  )}
                >
                  <TaskCode task={item} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.project && item.project.id !== task.project?.id && <span className="shrink-0 text-xs text-muted">{item.project.name}</span>}
                  <TaskStatusBadge status={item.status} />
                  {selected && <Check className="size-4 shrink-0" aria-hidden />}
                </button>
              )
            })
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </AppDialog>
  )
}
