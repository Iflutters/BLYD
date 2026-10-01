import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { Compass, Lock, Rocket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppButton, AppCard, AppEmptyState, AppErrorState } from '@/presentation/components'
import { PageHeader } from '@/presentation/layouts/PageHeader'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <AppEmptyState
      icon={<Compass />}
      title={t('pages.notFound.title')}
      description={t('pages.notFound.description')}
      action={
        <AppButton asChild variant="secondary">
          <Link to="/dashboard">{t('pages.backToDashboard')}</Link>
        </AppButton>
      }
    />
  )
}

export function ForbiddenPage() {
  const { t } = useTranslation()
  return (
    <AppEmptyState
      icon={<Lock />}
      title={t('pages.forbidden.title')}
      description={t('pages.forbidden.description')}
      action={
        <AppButton asChild variant="secondary">
          <Link to="/dashboard">{t('pages.backToDashboard')}</Link>
        </AppButton>
      }
    />
  )
}

/** Página de módulo ainda não entregue (mostra em qual fase do roadmap ele chega). */
export function ComingSoonPage({ titleKey, phase }: { titleKey: string; phase: number }) {
  const { t } = useTranslation()
  const title = t(titleKey)
  return (
    <>
      <PageHeader title={title} />
      <AppCard>
        <AppEmptyState
          icon={<Rocket />}
          title={t('pages.comingSoon.title', { module: title })}
          description={t('pages.comingSoon.description', { phase })}
        />
      </AppCard>
    </>
  )
}

/** Erro inesperado de rota (errorElement). */
export function RouteErrorPage() {
  const { t } = useTranslation()
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <AppErrorState title={t('states.errorTitle')} onRetry={() => window.location.reload()} />
    </div>
  )
}
