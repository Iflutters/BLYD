import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Popover } from 'radix-ui'
import { CalendarDays, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils/cn'
import { compareDays, formatDayValue, formatTyped, inputPattern, maskTyped, parseDay, parseTyped } from '@/core/utils/calendar'
import { AppCalendar } from './AppCalendar'
import { AppFormField } from './AppFormField'
import { inputClasses } from './input-styles'

export interface AppDatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> {
  label?: ReactNode
  error?: string | undefined
  hint?: ReactNode
  /** Valor no formato AAAA-MM-DD ('' = vazio). */
  value: string
  onValueChange: (value: string) => void
  /** Limites (AAAA-MM-DD), inclusivos. */
  min?: string
  max?: string
  /** Exibe botão para limpar a data. */
  clearable?: boolean
  fieldClassName?: string
}

/**
 * Seletor de data do design system: digitação com máscara no formato do idioma
 * (ex.: dd/mm/aaaa) e calendário próprio (AppCalendar) num painel flutuante.
 */
export const AppDatePicker = forwardRef<HTMLInputElement, AppDatePickerProps>(function AppDatePicker(
  { label, error, hint, required, value, onValueChange, min, max, clearable = true, className, fieldClassName, disabled, onBlur, placeholder, ...props },
  ref,
) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => formatValue(value, locale))
  const [synced, setSynced] = useState({ value, locale })
  const [localError, setLocalError] = useState<string | undefined>(undefined)

  // Valor externo (ou idioma) mudou: atualiza o texto exibido durante a renderização.
  if (synced.value !== value || synced.locale !== locale) {
    setSynced({ value, locale })
    setDraft(formatValue(value, locale))
    setLocalError(undefined)
  }

  const minDay = parseDay(min)
  const maxDay = parseDay(max)
  const pattern = inputPattern(locale, {
    day: t('calendar.parts.day'),
    month: t('calendar.parts.month'),
    year: t('calendar.parts.year'),
  })

  function commit(text: string, final: boolean) {
    if (!text) {
      setLocalError(undefined)
      if (value) onValueChange('')
      return
    }
    const day = parseTyped(text, locale)
    if (!day) {
      if (final) setLocalError('invalid_date')
      return
    }
    if ((minDay && compareDays(day, minDay) < 0) || (maxDay && compareDays(day, maxDay) > 0)) {
      setLocalError('out_of_range')
      return
    }
    setLocalError(undefined)
    const next = formatDayValue(day)
    if (next !== value) onValueChange(next)
  }

  return (
    <AppFormField label={label} error={error ?? localError} hint={hint} required={required} className={fieldClassName}>
      {({ id, describedBy, invalid }) => (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Anchor asChild>
            <div className="relative">
              <input
                ref={ref}
                id={id}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={draft}
                placeholder={placeholder ?? pattern}
                disabled={disabled}
                required={required}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                onChange={(event) => {
                  const masked = maskTyped(event.target.value, locale)
                  setDraft(masked)
                  commit(masked, false)
                }}
                onBlur={(event) => {
                  commit(draft, true)
                  onBlur?.(event)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && event.altKey) {
                    event.preventDefault()
                    setOpen(true)
                  }
                }}
                className={cn(inputClasses, 'pr-16 tabular-nums', className)}
                {...props}
              />
              <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
                {clearable && value && !disabled && (
                  <button
                    type="button"
                    onClick={() => onValueChange('')}
                    aria-label={t('common.clearDate')}
                    className="rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={t('calendar.open')}
                    className={cn(
                      'rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50',
                      open && 'bg-primary-soft text-primary-soft-fg',
                    )}
                  >
                    <CalendarDays className="size-4" />
                  </button>
                </Popover.Trigger>
              </div>
            </div>
          </Popover.Anchor>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={6}
              collisionPadding={12}
              onOpenAutoFocus={(event) => event.preventDefault()}
              className="z-50 rounded-xl border border-border bg-surface text-fg shadow-float animate-scale-in focus:outline-none"
            >
              <AppCalendar
                focusOnMount
                value={value}
                min={min}
                max={max}
                clearable={clearable}
                onChange={(next) => {
                  onValueChange(next)
                  setOpen(false)
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </AppFormField>
  )
})

function formatValue(value: string, locale: string): string {
  const day = parseDay(value)
  return day ? formatTyped(day, locale) : ''
}
