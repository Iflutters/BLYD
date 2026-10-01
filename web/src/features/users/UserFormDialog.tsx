import { useEffect, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { isAppError } from '@/core/errors/app-error'
import { SUPPORTED_LANGUAGES, currentLanguage } from '@/core/i18n'
import type { Role, User } from '@/domain/entities'
import { assignableRoles } from '@/domain/rbac'
import { createUserSchemaFor, updateUserSchema, type CreateUserInput } from '@/domain/validation'
import { AppButton, AppDialog, AppSelect, AppSwitch, AppTextField, notify } from '@/presentation/components'
import { usePlatformInfo } from '@/presentation/common/use-platform'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { usePasswordHint, usePasswordPolicy } from '@/features/auth/use-password-policy'
import { useSession } from '@/features/auth/session'
import { useCreateUser, useUpdateUser } from './queries'

export interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ausente = criação. */
  user?: User | null
  roles: Role[]
  /** Pode alterar perfil/e-mail (false ao editar o próprio usuário sem users.edit). */
  canChangeAccess: boolean
}

/** Campos da API -> campos do formulário (para exibir erros de validação do servidor). */
const SERVER_FIELD_MAP: Record<string, keyof CreateUserInput> = { role_id: 'roleId' }

export function UserFormDialog({ open, onOpenChange, user, roles, canChangeAccess }: UserFormDialogProps) {
  const { t } = useTranslation()
  const { current } = useSession()
  const errorMessage = useErrorMessage()
  const isEdit = !!user
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const mutation = isEdit ? updateUser : createUser

  const roleOptions = useMemo(() => {
    const allowed = assignableRoles(current, roles)
    const list = user && !allowed.some((r) => r.id === user.roleId) ? roles.filter((r) => r.id === user.roleId).concat(allowed) : allowed
    return list.map((role) => ({ value: role.id, label: role.name }))
  }, [current, roles, user])

  const policy = usePasswordPolicy()
  const passwordHint = usePasswordHint(policy)
  // convite por e-mail só quando o envio está ligado (Configurações → Integrações)
  const emailEnabled = usePlatformInfo().passwordReset
  const canInvite = !isEdit && emailEnabled
  const form = useForm<CreateUserInput>({
    // Na edição a senha não é enviada; com convite, também não (a pessoa cria a dela).
    resolver: (values, context, options) =>
      zodResolver((isEdit ? updateUserSchema : createUserSchemaFor(policy, values.sendInvite)) as ReturnType<typeof createUserSchemaFor>)(values, context, options),
    defaultValues: { name: '', email: '', password: '', roleId: '', locale: currentLanguage(), sendInvite: false },
  })
  const { register, handleSubmit, reset, control, setError, formState } = form
  const sendInvite = useWatch({ control, name: 'sendInvite' })

  useEffect(() => {
    if (!open) return
    reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      roleId: user?.roleId ?? roleOptions.find((o) => roles.find((r) => r.id === o.value)?.code === 'MEMBER')?.value ?? '',
      locale: user?.locale ?? currentLanguage(),
      sendInvite: canInvite,
    })
    createUser.reset()
    updateUser.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, canInvite])

  const onSubmit = handleSubmit((values) => {
    const onError = (error: unknown) => {
      if (isAppError(error) && error.code === 'VALIDATION_ERROR') {
        Object.entries(error.fieldErrors()).forEach(([field, code]) => {
          setError(SERVER_FIELD_MAP[field] ?? (field as keyof CreateUserInput), { message: code })
        })
        return
      }
      if (isAppError(error) && error.code === 'EMAIL_ALREADY_IN_USE') {
        setError('email', { message: 'email_in_use' })
        return
      }
      notify.error(errorMessage(error))
    }
    const onSuccess = () => {
      notify.success(isEdit ? t('users.updated') : values.sendInvite ? t('users.invited', { email: values.email }) : t('users.created'))
      onOpenChange(false)
    }

    if (user) {
      updateUser.mutate(
        {
          id: user.id,
          data: {
            name: values.name,
            locale: values.locale,
            ...(canChangeAccess ? { email: values.email, roleId: values.roleId } : {}),
          },
        },
        { onSuccess, onError },
      )
    } else {
      createUser.mutate(values.sendInvite ? { ...values, password: undefined, sendInvite: true } : { ...values, sendInvite: false }, { onSuccess, onError })
    }
  })

  const errors = formState.errors

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      closeOnOutsideClick={false}
      title={isEdit ? t('users.editTitle') : t('users.createTitle')}
      description={isEdit ? user?.email : t('users.createDescription')}
      footer={
        <>
          <AppButton variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t('common.cancel')}
          </AppButton>
          <AppButton type="submit" form="user-form" loading={mutation.isPending}>
            {isEdit ? t('common.save') : t('users.create')}
          </AppButton>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <AppTextField label={t('users.fields.name')} required autoComplete="off" error={errors.name?.message} {...register('name')} />
        <AppTextField
          label={t('users.fields.email')}
          type="email"
          required
          autoComplete="off"
          disabled={isEdit && !canChangeAccess}
          error={errors.email?.message}
          {...register('email')}
        />
        {canInvite && (
          <Controller
            control={control}
            name="sendInvite"
            render={({ field }) => (
              <AppSwitch
                checked={field.value}
                onCheckedChange={field.onChange}
                label={t('users.sendInvite')}
                description={t('users.sendInviteHint')}
                className="sm:col-span-2"
              />
            )}
          />
        )}
        {!isEdit && !sendInvite && (
          <AppTextField
            label={t('users.fields.password')}
            type="password"
            revealable
            required
            autoComplete="new-password"
            hint={passwordHint}
            error={errors.password?.message}
            {...register('password')}
          />
        )}
        <Controller
          control={control}
          name="roleId"
          render={({ field }) => (
            <AppSelect
              label={t('users.fields.role')}
              required
              value={field.value || undefined}
              onValueChange={field.onChange}
              options={roleOptions}
              placeholder={t('users.selectRole')}
              disabled={isEdit && !canChangeAccess}
              hint={isEdit && !canChangeAccess ? t('users.cannotChangeOwnRole') : undefined}
              error={errors.roleId?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="locale"
          render={({ field }) => (
            <AppSelect
              label={t('users.fields.locale')}
              value={field.value}
              onValueChange={field.onChange}
              options={SUPPORTED_LANGUAGES.map((lng) => ({ value: lng, label: t(`language.${lng}`) }))}
              error={errors.locale?.message}
            />
          )}
        />
      </form>
    </AppDialog>
  )
}
