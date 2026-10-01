import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { isAppError } from '@/core/errors/app-error'
import type { User } from '@/domain/entities'
import { resetPasswordSchema, type ResetPasswordInput } from '@/domain/validation'
import { AppButton, AppDialog, AppTextField, notify } from '@/presentation/components'
import { useRepositories } from '@/presentation/common/repositories-context'
import { useErrorMessage } from '@/presentation/common/use-error-message'

/** Redefinição de senha de outro usuário (users.edit). Encerra as sessões dele. */
export function ResetPasswordDialog({ user, onOpenChange }: { user: User | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const { users } = useRepositories()
  const errorMessage = useErrorMessage()
  const { register, handleSubmit, reset, setError, formState } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    if (user) reset()
  }, [user, reset])

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordInput) => users.resetPassword(user!.id, values.password),
    onSuccess: () => {
      notify.success(t('users.passwordReset', { name: user?.name ?? '' }))
      onOpenChange(false)
    },
    onError: (error) => {
      const field = isAppError(error) ? error.fieldErrors().password : undefined
      if (field) setError('password', { message: field })
      else notify.error(errorMessage(error))
    },
  })

  return (
    <AppDialog
      open={!!user}
      onOpenChange={onOpenChange}
      title={t('users.resetPasswordTitle', { name: user?.name ?? '' })}
      description={t('users.resetPasswordDescription')}
      size="sm"
      footer={
        <>
          <AppButton variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t('common.cancel')}
          </AppButton>
          <AppButton type="submit" form="reset-password-form" loading={mutation.isPending}>
            {t('users.resetPassword')}
          </AppButton>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="flex flex-col gap-4">
        <AppTextField
          label={t('account.newPassword')}
          type="password"
          revealable
          required
          autoComplete="new-password"
          hint={t('users.passwordHint')}
          error={formState.errors.password?.message}
          {...register('password')}
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
      </form>
    </AppDialog>
  )
}
