import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Laptop, LogOut, Smartphone } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import { formatDateTime, formatRelative } from '@/core/utils/format'
import { describeUserAgent } from '@/core/utils/user-agent'
import type { Session } from '@/domain/entities'
import { useRepositories } from '@/presentation/common/repositories-context'
import { AppBadge, AppButton, AppCard, AppConfirmDialog, AppErrorState, AppSkeleton, notify } from '@/presentation/components'
import { PageHeader } from '@/presentation/layouts/PageHeader'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { SESSION_QUERY_KEY } from '@/features/auth/session'
import { useSessionStore } from '@/features/auth/session-store'

const SESSIONS_KEY = ['auth', 'sessions'] as const
/** Duração da animação de saída da linha (ms). */
const LEAVE_MS = 350

export function SessionsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const { auth } = useRepositories()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const markSignedOut = useSessionStore((s) => s.markSignedOut)
  const [revoking, setRevoking] = useState<Session | null>(null)
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [leaving, setLeaving] = useState<string[]>([])

  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: () => auth.listSessions() })
  const others = (sessions.data ?? []).filter((s) => !s.current)

  /** Remove as linhas com animação e só depois recarrega a lista. */
  function animateOut(ids: string[]) {
    setLeaving((prev) => [...prev, ...ids])
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }).then(() => setLeaving((prev) => prev.filter((id) => !ids.includes(id))))
    }, LEAVE_MS)
  }

  function signOutHere() {
    markSignedOut()
    queryClient.clear()
    queryClient.setQueryData(SESSION_QUERY_KEY, null)
  }

  const revoke = useMutation({
    mutationFn: (id: string) => auth.revokeSession(id),
    onSuccess: (result, id) => {
      setRevoking(null)
      if (result.current) return signOutHere()
      notify.success(t('account.sessionRevoked'))
      animateOut([id])
    },
    onError: (error) => notify.error(errorMessage(error)),
  })

  const revokeOthers = useMutation({
    mutationFn: () => auth.revokeOtherSessions(),
    onSuccess: ({ revoked }) => {
      setConfirmOthers(false)
      notify.success(t('account.otherSessionsRevoked', { count: revoked }))
      animateOut(others.map((s) => s.id))
    },
    onError: (error) => notify.error(errorMessage(error)),
  })

  return (
    <>
      <PageHeader
        title={t('account.sessions')}
        description={t('account.sessionsDescription')}
        actions={
          <AppButton variant="secondary" leftIcon={<LogOut />} disabled={others.length === 0} onClick={() => setConfirmOthers(true)}>
            {t('account.revokeOthers')}
          </AppButton>
        }
      />
      <AppCard padded={false}>
        {sessions.isPending ? (
          <div className="flex flex-col gap-3 p-5">
            <AppSkeleton className="h-14" />
            <AppSkeleton className="h-14" />
          </div>
        ) : sessions.isError ? (
          <AppErrorState onRetry={() => void sessions.refetch()} />
        ) : (
          <ul className="divide-y divide-border">
            {sessions.data.map((session) => {
              const device = describeUserAgent(session.userAgent)
              const Icon = device.mobile ? Smartphone : Laptop
              const isLeaving = leaving.includes(session.id)
              return (
                <li
                  key={session.id}
                  aria-hidden={isLeaving || undefined}
                  className={cn(
                    'grid transition-all ease-out',
                    isLeaving ? 'grid-rows-[0fr] -translate-x-4 opacity-0' : 'grid-rows-[1fr] opacity-100',
                  )}
                  style={{ transitionDuration: `${LEAVE_MS}ms` }}
                >
                  <div className="overflow-hidden">
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-5">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                            {device.label}
                            {session.current && (
                              <AppBadge tone="success" dot>
                                {t('account.thisSession')}
                              </AppBadge>
                            )}
                            {session.remember && <AppBadge>{t('account.remembered')}</AppBadge>}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {session.ip || '—'} · {t('account.lastActivity')}{' '}
                            <time title={formatDateTime(session.lastSeenAt, locale)}>{formatRelative(session.lastSeenAt, locale)}</time> ·{' '}
                            {t('account.expires')} {formatDateTime(session.expiresAt, locale)}
                          </p>
                        </div>
                      </div>
                      <AppButton
                        variant={session.current ? 'secondary' : 'ghost'}
                        size="sm"
                        disabled={isLeaving}
                        onClick={() => setRevoking(session)}
                      >
                        {session.current ? t('auth.logout') : t('account.revoke')}
                      </AppButton>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </AppCard>

      <AppConfirmDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={revoking?.current ? t('account.revokeCurrentTitle') : t('account.revokeTitle')}
        description={revoking?.current ? t('account.revokeCurrentDescription') : t('account.revokeDescription')}
        confirmLabel={revoking?.current ? t('auth.logout') : t('account.revoke')}
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
      />
      <AppConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title={t('account.revokeOthersTitle', { count: others.length })}
        description={t('account.revokeOthersDescription')}
        confirmLabel={t('account.revokeOthers')}
        loading={revokeOthers.isPending}
        onConfirm={() => revokeOthers.mutate()}
      />
    </>
  )
}
