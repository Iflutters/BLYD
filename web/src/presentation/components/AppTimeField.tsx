import { useState, type ReactNode } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import { isValidTime, maskTime } from '@/core/utils/time'
import { AppFormField } from './AppFormField'
import { inputClasses } from './input-styles'

export interface AppTimeFieldProps {
  /** "HH:mm" (24h) ou '' */
  value: string
  onValueChange: (value: string) => void
  label?: ReactNode
  error?: string | undefined
  hint?: ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
}

/** Hora (24h) com máscara HH:mm — sem o controle nativo do navegador. */
export function AppTimeField({ value, onValueChange, label, error, hint, required, disabled, className }: AppTimeFieldProps) {
  const [draft, setDraft] = useState(value)
  const [synced, setSynced] = useState(value)
  const [localError, setLocalError] = useState<string | undefined>(undefined)
  if (synced !== value) {
    setSynced(value)
    setDraft(value)
    setLocalError(undefined)
  }

  return (
    <AppFormField label={label} error={error ?? localError} hint={hint} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="hh:mm"
            value={draft}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(event) => {
              const masked = maskTime(event.target.value)
              setDraft(masked)
              if (!masked) onValueChange('')
              else if (isValidTime(masked)) {
                setLocalError(undefined)
                onValueChange(masked)
              }
            }}
            onBlur={() => setLocalError(draft && !isValidTime(draft) ? 'invalid_time' : undefined)}
            className={cn(inputClasses, 'pr-9 tabular-nums')}
          />
          <Clock className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        </div>
      )}
    </AppFormField>
  )
}
