import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Info, Lock, Mail } from 'lucide-react'
import { isAppError } from '@/core/errors/app-error'
import { loginSchema, type LoginInput } from '@/domain/validation'
import { AppButton, AppCheckbox, AppTextField } from '@/presentation/components'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import { BrandMark } from '@/presentation/navigation/Sidebar'
import { PreferencesQuickBar } from '@/features/preferences/PreferencesQuickBar'
import { safeRedirect, useLogin } from './session'
import { useSessionStore } from './session-store'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const login = useLogin()
  const errorMessage = useErrorMessage()
  const endReason = useSessionStore((s) => s.endReason)

  const {
    register,
    handleSubmit,
    setValue,
    control,
    setFocus,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  })

  useEffect(() => {
    document.title = `${t('auth.title')} · KAMBAN`
    setFocus('email')
  }, [t, setFocus])

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => navigate(safeRedirect(params.get('next')), { replace: true }),
      onError: () => setValue('password', ''),
    }),
  )

  const serverError = login.error
  const fieldErrors = isAppError(serverError) ? serverError.fieldErrors() : {}

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-gradient p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:28px_28px]"
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
              <rect x="6" y="7" width="5" height="18" rx="1.5" fill="#fff" />
              <rect x="13.5" y="7" width="5" height="12" rx="1.5" fill="#fff" opacity=".85" />
              <rect x="21" y="7" width="5" height="8" rx="1.5" fill="#fff" opacity=".7" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">KAMBAN</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">{t('auth.heroTitle')}</h2>
          <p className="mt-3 text-base text-white/80">{t('auth.heroSubtitle')}</p>
        </div>
        <p className="relative text-sm text-white/60">© {new Date().getFullYear()} KAMBAN</p>
      </aside>

      <main className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="absolute right-4 top-4">
          <PreferencesQuickBar />
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{t('auth.title')}</h1>
          <p className="mt-1.5 text-sm text-muted">{t('auth.subtitle')}</p>

          {endReason && !serverError && (
            <div role="status" className="mt-6 flex gap-2 rounded-lg border border-border bg-info-soft px-3 py-2.5 text-sm text-info-soft-fg">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{endReason === 'expired' ? t('auth.sessionExpired') : t('auth.signedOut')}</span>
            </div>
          )}
          {serverError && (
            <div role="alert" className="mt-6 flex gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger-soft-fg">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {isAppError(serverError) && serverError.code === 'ACCOUNT_LOCKED'
                  ? t('auth.lockedFor', { minutes: Math.max(1, Math.ceil(Number(serverError.details.retry_after_seconds ?? 60) / 60)) })
                  : errorMessage(serverError)}
              </span>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
            <AppTextField
              label={t('auth.email')}
              type="email"
              autoComplete="username"
              inputMode="email"
              leftIcon={<Mail />}
              required
              error={errors.email?.message ?? fieldErrors.email}
              {...register('email')}
            />
            <AppTextField
              label={t('auth.password')}
              type="password"
              autoComplete="current-password"
              leftIcon={<Lock />}
              revealable
              required
              error={errors.password?.message ?? fieldErrors.password}
              {...register('password')}
            />
            <Controller
              control={control}
              name="remember"
              render={({ field }) => (
                <AppCheckbox checked={field.value} onCheckedChange={field.onChange} label={t('auth.remember')} />
              )}
            />
            <AppButton type="submit" size="lg" block loading={login.isPending}>
              {t('auth.submit')}
            </AppButton>
          </form>
          <p className="mt-6 text-center text-xs text-subtle">{t('auth.securityNote')}</p>
        </div>
      </main>
    </div>
  )
}
