import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CheckCircle2, EyeOff, Pencil, Plus, Power, RotateCcw, Save, SearchX, Trash2 } from 'lucide-react'
import { isAppError } from '@/core/errors/app-error'
import { cn } from '@/core/utils/cn'
import { isRequiredIn, valueIssue, type CustomField, type FieldValue, type TaskTypeDetail } from '@/domain/task-config'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppDialog,
  AppDragHandle,
  AppEmptyState,
  AppErrorState,
  AppIconButton,
  AppMultiSelect,
  AppSearch,
  AppSelect,
  AppSkeleton,
  AppSortableList,
  AppSwitch,
  AppTabs,
  AppTextField,
  notify,
} from '@/presentation/components'
import { useDocumentTitle } from '@/presentation/common/use-document-title'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { AuditTimeline } from '@/features/audit/AuditTimeline'
import { useStatuses } from '@/features/workflow/queries'
import { ColorDot, FieldTypeLabel, TaskTypeIconBadge } from './config-visuals'
import { CustomFieldFormDialog } from './CustomFieldFormDialog'
import { CustomFieldInput } from './CustomFieldInput'
import { TaskTypeFormDialog } from './TaskTypesPage'
import { useCustomFields, useTaskType, useTaskTypeHistory, useTaskTypeMutations } from './queries'

interface LinkDraft {
  field: CustomField
  required: boolean
  visible: boolean
  showOnCard: boolean
  /** Status em que o campo passa a ser exigido (além de "Obrigatório", que vale em todos). */
  requiredStatusIds: string[]
}

/** Lista por status que vale de fato: obrigatório sempre ou oculto tornam a lista irrelevante. */
const effectiveStatuses = (l: LinkDraft) => (l.required || !l.visible ? [] : l.requiredStatusIds)

export function TaskTypeDetailPage() {
  const { typeId } = useParams()
  const { t } = useTranslation()
  const type = useTaskType(typeId)
  useDocumentTitle(type.data?.name ?? t('taskTypes.title'))

  if (type.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <AppSkeleton className="h-24 rounded-2xl" />
        <AppSkeleton className="h-96 rounded-2xl" />
      </div>
    )
  }
  if (type.isError) {
    if (isAppError(type.error) && type.error.code === 'TASK_TYPE_NOT_FOUND') {
      return (
        <AppEmptyState
          icon={<SearchX />}
          title={t('taskTypes.notFound')}
          action={
            <AppButton asChild variant="secondary">
              <Link to="/settings/task-types">{t('taskTypes.backToList')}</Link>
            </AppButton>
          }
        />
      )
    }
    return <AppErrorState onRetry={() => void type.refetch()} />
  }
  return <TaskTypeDetailView type={type.data} />
}

function signature(type: TaskTypeDetail): string {
  return type.fields.map((f) => `${f.field.id}:${f.required}:${f.visible}:${f.showOnCard}:${f.requiredStatusIds.join(',')}:${f.field.updatedAt?.getTime()}`).join('|')
}

function TaskTypeDetailView({ type }: { type: TaskTypeDetail }) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const { update } = useTaskTypeMutations()
  const [editing, setEditing] = useState(false)

  function toggleActive() {
    update.mutate(
      { id: type.id, data: { isActive: !type.isActive } },
      {
        onSuccess: () => notify.success(type.isActive ? t('taskTypes.deactivated', { name: type.name }) : t('taskTypes.activated', { name: type.name })),
        onError: (error) => notify.error(errorMessage(error)),
      },
    )
  }

  return (
    <>
      <Link to="/settings/task-types" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> {t('taskTypes.backToList')}
      </Link>
      <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <TaskTypeIconBadge icon={type.icon} color={type.color} size="lg" />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-fg">
              {type.name}
              {!type.isActive && <AppBadge>{t('taskTypes.inactive')}</AppBadge>}
            </h1>
            <p className="font-mono text-xs text-muted">{type.key}</p>
            {type.description && <p className="mt-1 text-sm text-muted">{type.description}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AppButton variant="secondary" leftIcon={<Pencil />} onClick={() => setEditing(true)}>
            {t('common.edit')}
          </AppButton>
          <AppButton variant="secondary" leftIcon={<Power />} loading={update.isPending} onClick={toggleActive}>
            {type.isActive ? t('taskTypes.deactivate') : t('taskTypes.activate')}
          </AppButton>
        </div>
      </section>

      <AppTabs
        aria-label={type.name}
        tabs={[
          { value: 'fields', label: t('taskTypes.tabs.fields', { count: type.fields.length }), content: <FieldsEditor key={signature(type)} type={type} /> },
          { value: 'history', label: t('taskTypes.tabs.history'), content: <TypeHistory typeId={type.id} /> },
        ]}
      />
      <TaskTypeFormDialog open={editing} type={type} onOpenChange={setEditing} />
    </>
  )
}

function FieldsEditor({ type }: { type: TaskTypeDetail }) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const { setFields } = useTaskTypeMutations()
  const initial: LinkDraft[] = useMemo(
    () => type.fields.map((f) => ({ field: f.field, required: f.required, visible: f.visible, showOnCard: f.showOnCard, requiredStatusIds: f.requiredStatusIds })),
    [type.fields],
  )
  const [draft, setDraft] = useState<LinkDraft[]>(initial)
  const [adding, setAdding] = useState(false)
  const [creatingField, setCreatingField] = useState(false)
  const statuses = useStatuses(false)
  const statusOptions = (statuses.data ?? []).map((st) => ({ value: st.id, label: st.name, prefix: <ColorDot color={st.color} /> }))

  const serialize = (list: LinkDraft[]) => JSON.stringify(list.map((l) => [l.field.id, l.required, l.visible, l.showOnCard, effectiveStatuses(l)]))
  const dirty = serialize(draft) !== serialize(initial)
  const patch = (id: string, change: Partial<LinkDraft>) =>
    setDraft((list) =>
      list.map((l) => {
        if (l.field.id !== id) return l
        const next = { ...l, ...change }
        // campo oculto não pode ser obrigatório nem aparecer no card
        if (change.visible === false) Object.assign(next, { required: false, showOnCard: false })
        if (change.required || change.showOnCard || (change.requiredStatusIds && change.requiredStatusIds.length > 0)) next.visible = true
        return next
      }),
    )

  function save() {
    setFields.mutate(
      { id: type.id, fields: draft.map((l) => ({ fieldId: l.field.id, required: l.required, visible: l.visible, showOnCard: l.showOnCard, requiredStatusIds: effectiveStatuses(l) })) },
      {
        onSuccess: () => notify.success(t('taskTypes.fieldsSaved', { name: type.name })),
        onError: (error) => notify.error(errorMessage(error)),
      },
    )
  }

  const addField = (field: CustomField) => setDraft((list) => (list.some((l) => l.field.id === field.id) ? list : [...list, { field, required: false, visible: true, showOnCard: false, requiredStatusIds: [] }]))

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <AppCard
        title={t('taskTypes.fieldsTitle')}
        description={t('taskTypes.fieldsDescription')}
        actions={
          <>
            <AppButton variant="ghost" size="sm" leftIcon={<RotateCcw />} disabled={!dirty || setFields.isPending} onClick={() => setDraft(initial)}>
              {t('common.discard')}
            </AppButton>
            <AppButton size="sm" leftIcon={<Save />} disabled={!dirty} loading={setFields.isPending} onClick={save}>
              {t('common.save')}
            </AppButton>
          </>
        }
      >
        {dirty && (
          <p role="status" className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning-soft-fg">
            {t('taskTypes.unsaved')}
          </p>
        )}
        {draft.length === 0 ? (
          <AppEmptyState compact title={t('taskTypes.noFields')} description={t('taskTypes.noFieldsHint')} />
        ) : (
          <AppSortableList
            items={draft}
            getId={(l) => l.field.id}
            getLabel={(l) => l.field.label}
            onReorder={setDraft}
            renderItem={(link, { handle }) => (
              <div className={cn('flex flex-col gap-2 rounded-xl border border-border bg-surface p-2.5', !link.visible && 'bg-surface-2')}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <AppDragHandle handle={handle} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-fg" title={link.field.label}>
                      {link.field.label}
                      {link.required && <span className="text-danger" aria-label={t('taskTypes.required')}>*</span>}
                      {!link.visible && <EyeOff className="size-3.5 text-subtle" aria-label={t('taskTypes.hidden')} />}
                    </p>
                    <FieldTypeLabel type={link.field.type} className="text-xs text-muted [&_svg]:size-3.5" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-9 sm:pl-0">
                  <AppSwitch size="sm" checked={link.required} onCheckedChange={(required) => patch(link.field.id, { required })} label={<span className="text-xs">{t('taskTypes.required')}</span>} />
                  <AppSwitch size="sm" checked={link.visible} onCheckedChange={(visible) => patch(link.field.id, { visible })} label={<span className="text-xs">{t('taskTypes.visible')}</span>} />
                  <AppSwitch size="sm" checked={link.showOnCard} onCheckedChange={(showOnCard) => patch(link.field.id, { showOnCard })} label={<span className="text-xs">{t('taskTypes.onCard')}</span>} />
                  <AppIconButton size="sm" variant="danger" label={t('taskTypes.removeField', { name: link.field.label })} icon={<Trash2 />} onClick={() => setDraft((list) => list.filter((l) => l.field.id !== link.field.id))} />
                </div>
                </div>
                {link.visible && (
                  <div className="pl-9">
                    {link.required ? (
                      <p className="text-xs text-muted">{t('taskTypes.requiredAlways')}</p>
                    ) : (
                      <AppMultiSelect
                        label={<span className="text-xs">{t('taskTypes.requiredIn')}</span>}
                        value={link.requiredStatusIds.filter((id) => statusOptions.some((o) => o.value === id))}
                        onValueChange={(requiredStatusIds) => patch(link.field.id, { requiredStatusIds })}
                        options={statusOptions}
                        placeholder={t('taskTypes.requiredInPlaceholder')}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          />
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <AppButton variant="secondary" size="sm" leftIcon={<Plus />} onClick={() => setAdding(true)}>
            {t('taskTypes.addField')}
          </AppButton>
          <AppButton variant="ghost" size="sm" leftIcon={<Plus />} onClick={() => setCreatingField(true)}>
            {t('taskTypes.createField')}
          </AppButton>
        </div>
      </AppCard>

      <FormPreview links={draft} typeName={type.name} statuses={(statuses.data ?? []).map((st) => ({ value: st.id, label: st.name }))} />

      <AddFieldDialog open={adding} onOpenChange={setAdding} selectedIds={draft.map((l) => l.field.id)} onAdd={addField} />
      <CustomFieldFormDialog open={creatingField} onOpenChange={setCreatingField} onSaved={addField} />
    </div>
  )
}

/** Pré-visualização do formulário dinâmico do tipo (mesmo componente usado nas tarefas). */
function FormPreview({ links, typeName, statuses }: { links: LinkDraft[]; typeName: string; statuses: Array<{ value: string; label: string }> }) {
  const { t } = useTranslation()
  // o formulário exige o que vale no status escolhido (obrigatório sempre + exigidos nele)
  const [statusId, setStatusId] = useState<string | undefined>(undefined)
  const current = statusId ?? statuses[0]?.value
  const requiredNow = (link: LinkDraft) => isRequiredIn({ required: link.required, visible: link.visible, requiredStatusIds: effectiveStatuses(link) }, current)
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [validated, setValidated] = useState(false)
  const visible = links.filter((l) => l.visible)
  const hidden = links.length - visible.length
  // o que não foi preenchido ainda usa o valor padrão do campo
  const valueOf = (link: LinkDraft) => values[link.field.id] ?? link.field.defaultValue

  function validate() {
    const found: Record<string, string> = {}
    visible.forEach((l) => {
      const issue = valueIssue(l.field, valueOf(l), requiredNow(l))
      if (issue) found[l.field.id] = issue
    })
    setErrors(found)
    setValidated(Object.keys(found).length === 0)
  }

  return (
    <AppCard title={t('taskTypes.previewTitle')} description={t('taskTypes.previewDescription', { name: typeName })} highlight>
      <div className="flex flex-col gap-4">
        {statuses.length > 0 && (
          <AppSelect
            label={t('taskTypes.previewStatus')}
            hint={t('taskTypes.previewStatusHint')}
            value={current}
            onValueChange={(value) => {
              setStatusId(value)
              setErrors({})
              setValidated(false)
            }}
            options={statuses}
          />
        )}
        <AppTextField label={t('taskTypes.previewTaskTitle')} required placeholder={t('taskTypes.previewTaskTitlePlaceholder')} />
        {visible.map((link) => (
          <CustomFieldInput
            key={link.field.id}
            field={link.field}
            required={requiredNow(link)}
            value={valueOf(link)}
            error={errors[link.field.id]}
            onChange={(value) => {
              setValues((v) => ({ ...v, [link.field.id]: value }))
              setValidated(false)
              setErrors(({ [link.field.id]: _removed, ...rest }) => rest)
            }}
          />
        ))}
        {hidden > 0 && <p className="text-xs text-subtle">{t('taskTypes.hiddenCount', { count: hidden })}</p>}
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <AppButton variant="soft" size="sm" onClick={validate}>
            {t('taskTypes.validatePreview')}
          </AppButton>
          {validated && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
              <CheckCircle2 className="size-4" aria-hidden /> {t('taskTypes.previewValid')}
            </span>
          )}
        </div>
      </div>
    </AppCard>
  )
}

function AddFieldDialog({
  open,
  onOpenChange,
  selectedIds,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  onAdd: (field: CustomField) => void
}) {
  const { t } = useTranslation()
  const fields = useCustomFields()
  const [search, setSearch] = useState('')
  const available = (fields.data ?? []).filter(
    (f) => !selectedIds.includes(f.id) && (!search || f.label.toLowerCase().includes(search.toLowerCase()) || f.name.includes(search.toLowerCase())),
  )
  return (
    <AppDialog open={open} onOpenChange={onOpenChange} title={t('taskTypes.addFieldTitle')} description={t('taskTypes.addFieldDescription')}>
      <div className="flex flex-col gap-3">
        <AppSearch value={search} onSearch={setSearch} placeholder={t('fields.searchPlaceholder')} />
        <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {fields.isPending && (
            <li className="p-3">
              <AppSkeleton className="h-10" />
            </li>
          )}
          {!fields.isPending && available.length === 0 && (
            <li>
              <AppEmptyState compact title={t('taskTypes.noAvailableFields')} />
            </li>
          )}
          {available.map((field) => (
            <li key={field.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{field.label}</p>
                <FieldTypeLabel type={field.type} className="text-xs text-muted [&_svg]:size-3.5" />
              </div>
              <AppButton size="sm" variant="soft" onClick={() => onAdd(field)}>
                {t('projects.add')}
              </AppButton>
            </li>
          ))}
        </ul>
      </div>
    </AppDialog>
  )
}

function TypeHistory({ typeId }: { typeId: string }) {
  const history = useTaskTypeHistory(typeId)
  if (history.isPending) return <AppSkeleton className="h-24" />
  if (history.isError) return <AppErrorState onRetry={() => void history.refetch()} />
  return (
    <AppCard>
      <AuditTimeline entries={history.data.items} />
    </AppCard>
  )
}
