import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils/cn'
import { AppFormField } from './AppFormField'
import { inputClasses } from './input-styles'

export interface AppTextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode
  error?: string | undefined
  hint?: ReactNode
  leftIcon?: ReactNode
  /** Exibe botão para mostrar/ocultar senha quando type="password". */
  revealable?: boolean
  fieldClassName?: string
}

export const AppTextField = forwardRef<HTMLInputElement, AppTextFieldProps>(function AppTextField(
  { label, error, hint, leftIcon, revealable, required, className, fieldClassName, type = 'text', ...props },
  ref,
) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && revealed ? 'text' : type

  return (
    <AppFormField label={label} error={error} hint={hint} required={required} className={fieldClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-subtle [&_svg]:size-4">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            type={inputType}
            required={required}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={cn(inputClasses, leftIcon && 'pl-9', isPassword && revealable && 'pr-10', className)}
            {...props}
          />
          {isPassword && revealable && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-subtle hover:text-fg"
              aria-label={revealed ? t('common.hidePassword') : t('common.showPassword')}
              aria-pressed={revealed}
            >
              {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          )}
        </div>
      )}
    </AppFormField>
  )
})
