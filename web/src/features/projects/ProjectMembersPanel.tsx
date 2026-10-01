import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Crown, UserPlus, UserMinus } from 'lucide-react'
import { formatDateTime } from '@/core/utils/format'
import { MEMBER_ROLES, type MemberRole, type Project, type ProjectMember } from '@/domain/projects'
import {
  AppAvatar,
  AppBadge,
  AppButton,
  AppConfirmDialog,
  AppDialog,
  AppEmptyState,
  AppErrorState,
  AppIconButton,
  AppSearch,
  AppSelect,
  AppSkeleton,
  notify,
} from '@/presentation/components'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { useSession } from '@/features/auth/session'
import { useMemberCandidates, useMemberMutations, useProjectMembers } from './queries'

/** Membros do projeto: lista, papéis, adicionar e remover (respeitando as capacidades do usuário). */
export function ProjectMembersPanel({ project }: { project: Project }) {
  const { t, i18n } = useTranslation()
  const { current } = useSession()
  const errorMessage = useErrorMessage()
  const members = useProjectMembers(project.id)
  const mutations = useMemberMutations(project.id)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<ProjectMember | null>(null)
  const canManage = project.capabilities.manageMembers

  const roleOptions = MEMBER_ROLES.map((role) => ({ value: role, label: t(`projects.roles.${role}`) }))

  if (members.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <AppSkeleton className="h-14" />
        <AppSkeleton className="h-14" />
      </div>
    )
  }
  if (members.isError) return <AppErrorState onRetry={() => void members.refetch()} />

  const isSelf = (member: ProjectMember) => member.user.id === current?.user.id

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t('projects.membersCount', { count: members.data.length })}</p>
        {canManage && (
          <AppButton leftIcon={<UserPlus />} onClick={() => setAdding(true)}>
            {t('projects.addMember')}
          </AppButton>
        )}
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {members.data.map((member) => (
          <li key={member.user.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <AppAvatar name={member.user.name} src={member.user.avatarUrl} size="sm" />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                  <span className="truncate">{member.user.name}</span>
                  {member.isOwner && (
                    <AppBadge tone="warning">
                      <Crown /> {t('projects.roles.owner')}
                    </AppBadge>
                  )}
                  {isSelf(member) && <AppBadge>{t('projects.you')}</AppBadge>}
                  {member.user.status === 'disabled' && <AppBadge tone="danger">{t('users.status.disabled')}</AppBadge>}
                </p>
                <p className="truncate text-xs text-muted">
                  {member.user.email} · {t('projects.joinedAt', { date: formatDateTime(member.joinedAt, i18n.language) })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManage && !member.isOwner ? (
                <AppSelect
                  size="sm"
                  aria-label={t('projects.memberRole', { name: member.user.name })}
                  value={member.role}
                  onValueChange={(role) =>
                    mutations.changeRole.mutate(
                      { userId: member.user.id, role: role as MemberRole },
                      {
                        onSuccess: () => notify.success(t('projects.roleChanged', { name: member.user.name })),
                        onError: (error) => notify.error(errorMessage(error)),
                      },
                    )
                  }
                  options={roleOptions}
                  triggerClassName="w-32"
                />
              ) : (
                <AppBadge tone="primary">{t(`projects.roles.${member.role}`)}</AppBadge>
              )}
              {!member.isOwner && (canManage || isSelf(member)) && (
                <AppIconButton
                  variant="danger"
                  size="sm"
                  label={isSelf(member) ? t('projects.leave') : t('projects.removeMember')}
                  icon={<UserMinus />}
                  onClick={() => setRemoving(member)}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-subtle">{t('projects.rolesHint')}</p>

      {canManage && <AddMemberDialog project={project} open={adding} onOpenChange={setAdding} />}
      <AppConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing && isSelf(removing) ? t('projects.leaveTitle', { name: project.name }) : t('projects.removeMemberTitle', { name: removing?.user.name ?? '' })}
        description={t('projects.removeMemberDescription')}
        confirmLabel={removing && isSelf(removing) ? t('projects.leave') : t('projects.removeMember')}
        loading={mutations.remove.isPending}
        onConfirm={() =>
          removing &&
          mutations.remove.mutate(removing.user.id, {
            onSuccess: () => {
              notify.success(isSelf(removing) ? t('projects.left', { name: project.name }) : t('projects.memberRemoved', { name: removing.user.name }))
              setRemoving(null)
            },
            onError: (error) => notify.error(errorMessage(error)),
          })
        }
      />
    </div>
  )
}

function AddMemberDialog({ project, open, onOpenChange }: { project: Project; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<MemberRole>('member')
  const candidates = useMemberCandidates(project.id, search, open)
  const { add } = useMemberMutations(project.id)

  return (
    <AppDialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value)
        if (!value) setSearch('')
      }}
      title={t('projects.addMemberTitle')}
      description={t('projects.addMemberDescription', { name: project.name })}
      size="md"
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
          <AppSearch value={search} onSearch={setSearch} placeholder={t('projects.searchPeople')} />
          <AppSelect
            aria-label={t('projects.fields.role')}
            value={role}
            onValueChange={(value) => setRole(value as MemberRole)}
            options={MEMBER_ROLES.map((r) => ({ value: r, label: t(`projects.roles.${r}`) }))}
          />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
          {candidates.isPending ? (
            <div className="flex flex-col gap-2 p-3">
              <AppSkeleton className="h-10" />
              <AppSkeleton className="h-10" />
            </div>
          ) : !candidates.data || candidates.data.length === 0 ? (
            <AppEmptyState compact title={t('projects.noCandidates')} description={t('projects.noCandidatesHint')} />
          ) : (
            <ul className="divide-y divide-border">
              {candidates.data.map((user) => (
                <li key={user.id} className="flex items-center gap-3 px-3 py-2">
                  <AppAvatar name={user.name} src={user.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <AppButton
                    size="sm"
                    variant="soft"
                    loading={add.isPending && add.variables?.userId === user.id}
                    onClick={() =>
                      add.mutate(
                        { userId: user.id, role },
                        {
                          onSuccess: () => notify.success(t('projects.memberAdded', { name: user.name, role: t(`projects.roles.${role}`) })),
                          onError: (error) => notify.error(errorMessage(error)),
                        },
                      )
                    }
                  >
                    {t('projects.add')}
                  </AppButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppDialog>
  )
}
