import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Archive, ArchiveRestore, ArrowLeft, Copy, FolderSearch, KanbanSquare, ListTodo, Pencil, Trash2 } from 'lucide-react'
import { isAppError } from '@/core/errors/app-error'
import { cn } from '@/core/utils/cn'
import { formatDateTime, formatDay } from '@/core/utils/format'
import { isOverdue, type Project } from '@/domain/projects'
import {
  AppAvatar,
  AppBadge,
  AppButton,
  AppCard,
  AppConfirmDialog,
  AppEmptyState,
  AppErrorState,
  AppIconButton,
  AppSelect,
  AppSkeleton,
  AppTabs,
  notify,
} from '@/presentation/components'
import { useDocumentTitle } from '@/presentation/common/use-document-title'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { AuditTimeline } from '@/features/audit/AuditTimeline'
import { useCan } from '@/features/auth/session'
import { ProjectTasksPanel } from '@/features/tasks/ProjectTasksPanel'
import { ProjectBoard } from '@/features/plan/ProjectBoard'
import { coverStyle } from './project-theme'
import { ProjectAvatar, ProjectPriorityLabel, ProjectStatusBadge } from './project-visuals'
import { ProjectFormDialog } from './ProjectFormDialog'
import { ProjectMembersPanel } from './ProjectMembersPanel'
import { TimelineView } from '@/features/timeline/TimelineView'
import { useProject, useProjectHistory, useProjectLifecycle, useProjectMembers } from './queries'

export function ProjectDetailPage() {
  const { projectId } = useParams()
  const { t } = useTranslation()
  const project = useProject(projectId)
  useDocumentTitle(project.data?.name ?? t('nav.projects'))

  if (project.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <AppSkeleton className="h-40 rounded-2xl" />
        <AppSkeleton className="h-64 rounded-2xl" />
      </div>
    )
  }
  if (project.isError) {
    if (isAppError(project.error) && project.error.code === 'PROJECT_NOT_FOUND') {
      return (
        <AppEmptyState
          icon={<FolderSearch />}
          title={t('projects.notFoundTitle')}
          description={t('projects.notFoundDescription')}
          action={
            <AppButton asChild variant="secondary">
              <Link to="/projects">{t('projects.backToList')}</Link>
            </AppButton>
          }
        />
      )
    }
    return <AppErrorState onRetry={() => void project.refetch()} />
  }
  return <ProjectDetail project={project.data} />
}

function ProjectDetail({ project }: { project: Project }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const errorMessage = useErrorMessage()
  const lifecycle = useProjectLifecycle()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [params, setParams] = useSearchParams()
  const archived = !!project.archivedAt
  const caps = project.capabilities
  const canViewTasks = useCan('tasks.view')
  const canViewPlan = useCan('plan.view')

  function setArchived(value: boolean) {
    const mutation = value ? lifecycle.archive : lifecycle.unarchive
    mutation.mutate(project.id, {
      onSuccess: () =>
        notify.success(value ? t('projects.archived', { key: project.key }) : t('projects.unarchived', { key: project.key }), {
          undo: value ? { label: t('common.undo'), onClick: () => setArchived(false) } : undefined,
        }),
      onError: (error) => notify.error(errorMessage(error)),
    })
  }

  const tabs = [
    { value: 'overview', label: t('projects.tabs.overview'), content: <Overview project={project} /> },
    ...(canViewTasks ? [{ value: 'tasks', label: t('projects.tabs.tasks'), content: <ProjectTasksPanel project={project} /> }] : []),
    // quadro de gestão do projeto (Gerenciamento de Projetos — módulo à parte das tarefas)
    ...(canViewPlan ? [{ value: 'plan', label: t('projects.tabs.plan'), content: <ProjectBoard project={project} /> }] : []),
    ...(canViewTasks ? [{ value: 'timeline', label: t('projects.tabs.timeline'), content: <TimelineView projectId={project.id} /> }] : []),
    { value: 'members', label: t('projects.tabs.members', { count: project.memberCount }), content: <ProjectMembersPanel project={project} /> },
    { value: 'history', label: t('projects.tabs.history'), content: <ProjectHistory projectId={project.id} /> },
  ]
  if (caps.transfer || caps.archive || caps.delete) {
    tabs.push({
      value: 'settings',
      label: t('projects.tabs.settings'),
      content: <ProjectSettings project={project} onArchive={setArchived} onDelete={() => setDeleting(true)} />,
    })
  }

  return (
    <>
      <Link to={archived ? '/projects/archived' : '/projects'} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> {t('projects.backToList')}
      </Link>

      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="h-24 sm:h-28" style={coverStyle(project.cover)} />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-4">
            <ProjectAvatar icon={project.icon} cover={project.cover} size="lg" className="-mt-8 ring-4 ring-surface" />
            <div className="min-w-0 pb-0.5">
              <h1 className="truncate text-xl font-semibold tracking-tight text-fg sm:text-2xl">{project.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(project.key).then(() => notify.success(t('common.copied')))}
                  className="inline-flex items-center gap-1 rounded font-mono text-xs text-muted hover:text-fg"
                  title={t('projects.copyKey')}
                >
                  {project.key} <Copy className="size-3" aria-hidden />
                </button>
                <ProjectStatusBadge status={project.status} />
                {archived && <AppBadge>{t('projects.archivedBadge')}</AppBadge>}
                {project.myRole && <AppBadge tone="primary">{t(`projects.roles.${project.myRole}`)}</AppBadge>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {caps.edit && (
              <AppButton variant="secondary" leftIcon={<Pencil />} onClick={() => setEditing(true)}>
                {t('common.edit')}
              </AppButton>
            )}
            {caps.archive && (
              <AppButton
                variant="secondary"
                leftIcon={archived ? <ArchiveRestore /> : <Archive />}
                loading={lifecycle.archive.isPending || lifecycle.unarchive.isPending}
                onClick={() => setArchived(!archived)}
              >
                {archived ? t('projects.unarchive') : t('projects.archive')}
              </AppButton>
            )}
            {caps.delete && (
              <AppIconButton variant="danger" label={t('common.delete')} icon={<Trash2 />} onClick={() => setDeleting(true)} />
            )}
          </div>
        </div>
      </section>

      {archived && (
        <div role="status" className="mb-6 rounded-lg border border-border bg-warning-soft px-4 py-3 text-sm text-warning-soft-fg">
          {t('projects.archivedNotice')}
        </div>
      )}

      <AppTabs
        tabs={tabs}
        aria-label={project.name}
        value={tabs.some((tab) => tab.value === params.get('tab')) ? (params.get('tab') as string) : 'overview'}
        // `?tab=tasks` abre direto no plano (links, notificações)
        onValueChange={(value) => setParams(value === 'overview' ? {} : { tab: value }, { replace: true })}
      />

      <ProjectFormDialog open={editing} onOpenChange={setEditing} project={project} />
      <AppConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t('projects.deleteTitle', { name: project.name })}
        description={t('projects.deleteDescription')}
        confirmLabel={t('common.delete')}
        loading={lifecycle.remove.isPending}
        onConfirm={() =>
          lifecycle.remove.mutate(project.id, {
            onSuccess: () => {
              notify.success(t('projects.deleted', { key: project.key }))
              navigate('/projects/archived', { replace: true })
            },
            onError: (error) => notify.error(errorMessage(error)),
          })
        }
      />
    </>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-fg">{children}</dd>
    </div>
  )
}

function Overview({ project }: { project: Project }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const overdue = isOverdue(project)
  const canViewBoard = useCan('kanban.view')
  const canViewTasks = useCan('tasks.view')
  const modules: Array<{ icon: ReactNode; label: string; phase?: number; to?: string; cta?: string }> = [
    ...(canViewTasks ? [{ icon: <ListTodo />, label: t('nav.planning'), to: `/planning/${project.id}`, cta: t('backlog.openBacklog') }] : []),
    ...(canViewBoard ? [{ icon: <KanbanSquare />, label: t('nav.kanban'), to: `/kanban/${project.id}`, cta: t('kanban.openBoard') }] : []),
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <AppCard title={t('projects.fields.description')}>
          {project.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed text-fg">{project.description}</p>
          ) : (
            <p className="text-sm text-subtle">{t('projects.noDescription')}</p>
          )}
        </AppCard>
        <AppCard title={t('projects.workTitle')} description={t('projects.workDescription')}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {modules.map((item) => {
              const body = (
                <>
                  <span className={cn('flex size-9 items-center justify-center rounded-lg [&_svg]:size-4', item.to ? 'bg-primary-soft text-primary-soft-fg' : 'bg-surface-2 text-muted')}>
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{item.label}</span>
                    <span className="block text-xs text-subtle">{item.cta ?? t('pages.comingSoon.badge', { phase: item.phase })}</span>
                  </span>
                </>
              )
              return (
                <li key={item.label}>
                  {item.to ? (
                    <Link to={item.to} className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 transition-colors hover:border-primary hover:bg-surface-2">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-3">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </AppCard>
      </div>
      <AppCard title={t('projects.details')}>
        <dl className="divide-y divide-border">
          <Detail label={t('projects.fields.status')}>
            <ProjectStatusBadge status={project.status} />
          </Detail>
          <Detail label={t('projects.fields.priority')}>
            <ProjectPriorityLabel priority={project.priority} />
          </Detail>
          <Detail label={t('projects.fields.owner')}>
            {project.owner ? (
              <span className="inline-flex items-center gap-2">
                <AppAvatar name={project.owner.name} size="xs" />
                {project.owner.name}
              </span>
            ) : (
              '—'
            )}
          </Detail>
          <Detail label={t('projects.fields.startDate')}>{formatDay(project.startDate, locale)}</Detail>
          <Detail label={t('projects.fields.dueDate')}>
            <span className={cn(overdue && 'text-danger')}>
              {formatDay(project.dueDate, locale)}
              {overdue && <span className="ml-1 text-xs">({t('projects.overdue')})</span>}
            </span>
          </Detail>
          <Detail label={t('users.fields.createdAt')}>{formatDateTime(project.createdAt, locale)}</Detail>
          <Detail label={t('users.fields.updatedAt')}>{formatDateTime(project.updatedAt, locale)}</Detail>
        </dl>
      </AppCard>
    </div>
  )
}

function ProjectHistory({ projectId }: { projectId: string }) {
  const history = useProjectHistory(projectId)
  if (history.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <AppSkeleton className="h-12" />
        <AppSkeleton className="h-12" />
      </div>
    )
  }
  if (history.isError) return <AppErrorState onRetry={() => void history.refetch()} />
  return (
    <AppCard>
      <AuditTimeline entries={history.data.items} hiddenFields={['session_id', 'user_id']} />
    </AppCard>
  )
}

function ProjectSettings({ project, onArchive, onDelete }: { project: Project; onArchive: (value: boolean) => void; onDelete: () => void }) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const members = useProjectMembers(project.id)
  const { transfer } = useProjectLifecycle()
  const [newOwner, setNewOwner] = useState<string | undefined>(undefined)
  const [confirmTransfer, setConfirmTransfer] = useState(false)
  const archived = !!project.archivedAt
  const candidates = (members.data ?? []).filter((m) => !m.isOwner && m.user.status === 'active')
  const target = candidates.find((m) => m.user.id === newOwner)

  return (
    <div className="flex flex-col gap-4">
      {project.capabilities.transfer && (
        <AppCard title={t('projects.transferTitle')} description={t('projects.transferDescription')}>
          {candidates.length === 0 ? (
            <p className="text-sm text-subtle">{t('projects.transferNoCandidates')}</p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <AppSelect
                label={t('projects.newOwner')}
                value={newOwner}
                onValueChange={setNewOwner}
                placeholder={t('projects.selectMember')}
                options={candidates.map((m) => ({ value: m.user.id, label: `${m.user.name} (${m.user.email})` }))}
                className="sm:w-96"
              />
              <AppButton variant="secondary" disabled={!newOwner} onClick={() => setConfirmTransfer(true)}>
                {t('projects.transfer')}
              </AppButton>
            </div>
          )}
        </AppCard>
      )}

      <section className="rounded-xl border border-danger/40 bg-surface p-5">
        <h2 className="text-sm font-semibold text-danger">{t('projects.dangerZone')}</h2>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {project.capabilities.archive && (
            <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-fg">{archived ? t('projects.unarchive') : t('projects.archive')}</p>
                <p className="text-sm text-muted">{archived ? t('projects.unarchiveHint') : t('projects.archiveHint')}</p>
              </div>
              <AppButton variant="secondary" leftIcon={archived ? <ArchiveRestore /> : <Archive />} onClick={() => onArchive(!archived)}>
                {archived ? t('projects.unarchive') : t('projects.archive')}
              </AppButton>
            </div>
          )}
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-fg">{t('projects.deleteProject')}</p>
              <p className="text-sm text-muted">{archived ? t('projects.deleteHint') : t('projects.deleteNeedsArchive')}</p>
            </div>
            <AppButton variant="danger" leftIcon={<Trash2 />} disabled={!project.capabilities.delete} onClick={onDelete}>
              {t('common.delete')}
            </AppButton>
          </div>
        </div>
      </section>

      <AppConfirmDialog
        open={confirmTransfer}
        onOpenChange={setConfirmTransfer}
        tone="primary"
        title={t('projects.transferConfirmTitle', { name: target?.user.name ?? '' })}
        description={t('projects.transferConfirmDescription')}
        confirmLabel={t('projects.transfer')}
        loading={transfer.isPending}
        onConfirm={() =>
          newOwner &&
          transfer.mutate(
            { id: project.id, userId: newOwner },
            {
              onSuccess: () => {
                notify.success(t('projects.transferred', { name: target?.user.name ?? '' }))
                setConfirmTransfer(false)
                setNewOwner(undefined)
              },
              onError: (error) => notify.error(errorMessage(error)),
            },
          )
        }
      />
    </div>
  )
}
