import { useEffect } from 'react'
import { Link } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { ArrowRight, KeyRound } from 'lucide-react'
import { isAppError } from '@/core/errors/app-error'
import type { CurrentUser } from '@/domain/entities'
import { changePasswordSchema, type ChangePasswordInput } from '@/domain/validation'
import { AppAvatar, AppBadge, AppButton, AppCard, AppTextField, notify } from '@/presentation/components'
import { PageHeader } from '@/presentation/layouts/PageHeader'
import { useRepositories } from '@/presentation/common/repositories-context'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { SESSION_QUERY_KEY, useSession } from '@/features/auth/session'

const profileSchema = z.object({ name: z.string().trim().min(1, 'required').max(120, 'too_long') })
type ProfileInput = z.infer<typeof profileSchema>

/** Campos da API -> campos do formulário de senha. */
const PASSWORD_FIELDS: Record<string, keyof ChangePasswordInput> = {
  current_password: 'currentPassword',
  new_password: 'newPassword',
}

export function AccountPage() {
  const { t } = useTranslation()
  const { current } = useSession()
  if (!current) return null
  return (
    <>
      <PageHeader title={t('account.title')} description={t('account.description')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard current={current} />
        <PasswordCard />
        <AppCard title={t('account.sessions')} description={t('account.sessionsDescription')} className="lg:col-span-2">
          <AppButton asChild variant="secondary" rightIcon={<ArrowRight />}>
            <Link to="/account/sessions">{t('account.manageSessions')}</Link>
          </AppButton>
        </AppCard>
      </div>
    </>
  )
}

function ProfileCard({ current }: { current: CurrentUser }) {
  const { t } = useTranslation()
  const { users } = useRepositories()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const { register, handleSubmit, reset, formState } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: current.user.name },
  })

  useEffect(() => reset({ name: current.user.name }), [current.user.name, reset])

  const save = useMutation({
    mutationFn: (values: ProfileInput) => users.update(current.user.id, { name: values.name }),
    onSuccess: (user) => {
      queryClient.setQueryData<CurrentUser | null>(SESSION_QUERY_KEY, (prev) => (prev ? { ...prev, user } : prev))
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      notify.success(t('account.profileSaved'))
    },
    onError: (error) => notify.error(errorMessage(error)),
  })

  return (
    <AppCard title={t('account.profile')}>
      <div className="mb-5 flex items-center gap-4">
        <AppAvatar name={current.user.name} src={current.user.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{current.user.email}</p>
          {current.role && (
            <AppBadge tone="primary" className="mt-1">
              {current.role.name}
            </AppBadge>
          )}
        </div>
      </div>
      <form onSubmit={handleSubmit((values) => save.mutate(values))} noValidate className="flex flex-col gap-4">
        <AppTextField label={t('users.fields.name')} required error={formState.errors.name?.message} {...register('name')} />
        <p className="text-xs text-subtle">{t('account.emailHint')}</p>
        <div>
          <AppButton type="submit" loading={save.isPending} disabled={!formState.isDirty}>
            {t('common.save')}
          </AppButton>
        </div>
      </form>
    </AppCard>
  )
}

function PasswordCard() {
  const { t } = useTranslation()
  const { auth } = useRepositories()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const { register, handleSubmit, reset, setError, formState } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const change = useMutation({
    mutationFn: (values: ChangePasswordInput) => auth.changePassword(values.currentPassword, values.newPassword),
    onSuccess: (result) => {
      reset()
      void queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] })
      notify.success(t('account.passwordChanged'), {
        description: result.otherSessionsRevoked > 0 ? t('account.otherSessionsEnded', { count: result.otherSessionsRevoked }) : undefined,
      })
    },
    onError: (error) => {
      if (isAppError(error) && error.code === 'VALIDATION_ERROR') {
        Object.entries(error.fieldErrors()).forEach(([field, code]) => {
          const target = PASSWORD_FIELDS[field]
          if (target) setError(target, { message: code })
        })
        return
      }
      notify.error(errorMessage(error))
    },
  })

  return (
    <AppCard title={t('account.changePassword')} description={t('account.changePasswordDescription')}>
      <form onSubmit={handleSubmit((values) => change.mutate(values))} noValidate className="flex flex-col gap-4">
        <AppTextField
          label={t('account.currentPassword')}
          type="password"
          revealable
          required
          autoComplete="current-password"
          error={formState.errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <AppTextField
          label={t('account.newPassword')}
          type="password"
          revealable
          required
          autoComplete="new-password"
          hint={t('users.passwordHint')}
          error={formState.errors.newPassword?.message}
          {...register('newPassword')}
        />
        <AppTextField
          label={t('account.confirmPassword')}
          type="password"
          revealable
          required
          autoComplete="new-password"
          error={formState.errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <div>
          <AppButton type="submit" leftIcon={<KeyRound />} loading={change.isPending}>
            {t('account.changePassword')}
          </AppButton>
        </div>
      </form>
    </AppCard>
  )
}
