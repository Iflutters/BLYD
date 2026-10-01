import { useState, type ReactNode } from 'react'
import { Popover } from 'radix-ui'
import { Check, ChevronDown, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils/cn'
import { AppFormField } from './AppFormField'

export interface AppMultiSelectOption {
  value: string
  label: string
  /** Elemento à esquerda do rótulo (ex.: bolinha de cor). */
  prefix?: ReactNode
  disabled?: boolean
}

export interface AppMultiSelectProps {
  value: string[]
  onValueChange: (value: string[]) => void
  options: AppMultiSelectOption[]
  label?: ReactNode
  placeholder?: string
  error?: string | undefined
  hint?: ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
}

/** Seleção múltipla com busca e chips removíveis. */
export function AppMultiSelect({ value, onValueChange, options, label, placeholder, error, hint, required, disabled, className }: AppMultiSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const selected = options.filter((o) => value.includes(o.value))
  const visible = options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))

  const toggle = (optionValue: string) =>
    onValueChange(value.includes(optionValue) ? value.filter((v) => v !== optionValue) : [...value, optionValue])

  return (
    <AppFormField label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <Popover.Root
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) setSearch('')
          }}
        >
          <Popover.Trigger asChild>
            <button
              id={id}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-controls={`${id}-listbox`}
              aria-haspopup="listbox"
              disabled={disabled}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              className={cn(
                'flex min-h-9 w-full items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 text-left text-sm shadow-xs',
                'hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring aria-[invalid=true]:border-danger',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                {selected.length === 0 && <span className="px-1 text-subtle">{placeholder ?? t('multiSelect.placeholder')}</span>}
                {selected.map((option) => (
                  <span key={option.value} className="inline-flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-xs font-medium text-fg">
                    {option.prefix}
                    {option.label}
                    {!disabled && (
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label={t('multiSelect.remove', { item: option.label })}
                        onPointerDown={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          toggle(option.value)
                        }}
                        className="rounded text-subtle hover:text-fg"
                      >
                        <X className="size-3" />
                      </span>
                    )}
                  </span>
                ))}
              </span>
              <ChevronDown className="size-4 shrink-0 text-subtle" aria-hidden />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              className="z-50 w-[var(--radix-popover-trigger-width)] min-w-56 rounded-xl border border-border bg-surface p-1 text-fg shadow-float animate-scale-in"
            >
              {options.length > 7 && (
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('common.search')}
                  aria-label={t('common.search')}
                  className="mb-1 h-8 w-full rounded-lg border border-border bg-surface px-2 text-sm outline-none focus:border-primary"
                />
              )}
              <ul id={`${id}-listbox`} role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto">
                {visible.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted">{t('commandPalette.empty')}</li>}
                {visible.map((option) => {
                  const checked = value.includes(option.value)
                  return (
                    <li key={option.value} role="option" aria-selected={checked}>
                      <button
                        type="button"
                        disabled={option.disabled}
                        onClick={() => toggle(option.value)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2 disabled:opacity-50"
                      >
                        <span
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded-[5px] border',
                            checked ? 'border-primary bg-primary text-primary-fg' : 'border-border-strong',
                          )}
                        >
                          {checked && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        {option.prefix}
                        <span className="truncate">{option.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </AppFormField>
  )
}
