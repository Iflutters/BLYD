import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import { formatDateTime, formatRelative } from '@/core/utils/format'
import type { Role, User } from '@/domain/entities'
import { AppAvatar, AppBadge, AppButton, AppDrawer, AppErrorState, AppSkeleton, AppTabs } from '@/presentation/components'
import { AuditTimeline } from '@/features/audit/AuditTimeline'
import { useUserHistory } from '@/features/audit/queries'
import { UserStatusBadge } from './UserStatusBadge'

export interface UserDetailsDrawerProps {
  user: User | null
  role: Role | undefined
  roles: Role[]
  onOpenChange: (open: boolean) => void
  onEdit?: (user: User) => void
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-fg sm:text-right">{children}</dd>
    </div>
  )
}

/** "Visualizar" de usuário: detalhes e histórico em painel lateral, sem sair da listagem. */
export function UserDetailsDrawer({ user, role, roles, onOpenChange, onEdit }: UserDetailsDrawerProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  return (
    <AppDrawer
      open={!!user}
      onOpenChange={onOpenChange}
      title={t('users.detailsTitle')}
      size="lg"
      headerActions={
        user && onEdit ? (
          <AppButton variant="secondary" size="sm" leftIcon={<Pencil />} onClick={() => onEdit(user)}>
            {t('common.edit')}
          </AppButton>
        ) : undefined
      }
    >
      {user && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <AppAvatar name={user.name} src={user.avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-fg">{user.name}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <UserStatusBadge status={user.status} />
                {role && <AppBadge tone="primary">{role.name}</AppBadge>}
              </div>
            </div>
          </div>
          <AppTabs
            aria-label={t('users.detailsTitle')}
            tabs={[
              {
                value: 'details',
                label: t('users.tabs.details'),
                content: (
                  <dl className="divide-y divide-border rounded-lg border border-border px-4">
                    <Detail label={t('users.fields.role')}>{role?.name ?? '—'}</Detail>
                    <Detail label={t('users.fields.locale')}>{t(`language.${user.locale}`)}</Detail>
                    <Detail label={t('users.fields.lastLogin')}>
                      {user.lastLoginAt ? (
                        <time dateTime={user.lastLoginAt.toISOString()} title={formatDateTime(user.lastLoginAt, locale)}>
                          {formatRelative(user.lastLoginAt, locale)}
                        </time>
                      ) : (
                        t('users.neverLoggedIn')
                      )}
                    </Detail>
                    <Detail label={t('users.fields.createdAt')}>{formatDateTime(user.createdAt, locale)}</Detail>
                    <Detail label={t('users.fields.updatedAt')}>{formatDateTime(user.updatedAt, locale)}</Detail>
                  </dl>
                ),
              },
              {
                value: 'history',
                label: t('users.tabs.history'),
                content: <UserHistory userId={user.id} roles={roles} />,
              },
            ]}
          />
        </div>
      )}
    </AppDrawer>
  )
}

function UserHistory({ userId, roles }: { userId: string; roles: Role[] }) {
  const history = useUserHistory(userId)
  if (history.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <AppSkeleton className="h-12" />
        <AppSkeleton className="h-12" />
      </div>
    )
  }
  if (history.isError) return <AppErrorState onRetry={() => void history.refetch()} />
  const roleNames = new Map(roles.map((r) => [r.id, r.name]))
  return (
    <AuditTimeline
      entries={history.data.items}
      resolve={(field, value) => (field === 'role_id' ? roleNames.get(value) : undefined)}
    />
  )
}
