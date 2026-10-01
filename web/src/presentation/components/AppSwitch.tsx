import { useId, type ReactNode } from 'react'
import { Switch } from 'radix-ui'
import { cn } from '@/core/utils/cn'

export interface AppSwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

/** Interruptor liga/desliga do design system (ex.: obrigatório, visível, ativo). */
export function AppSwitch({ checked, onCheckedChange, label, description, disabled, size = 'md', className, ...rest }: AppSwitchProps) {
  const id = useId()
  const control = (
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label ? undefined : rest['aria-label']}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors',
        'bg-surface-3 data-[state=checked]:bg-primary focus-visible:outline-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
      )}
    >
      <Switch.Thumb
        className={cn(
          'block rounded-full bg-white shadow-sm transition-transform',
          size === 'sm' ? 'size-3 translate-x-0.5 data-[state=checked]:translate-x-3.5' : 'size-4 translate-x-0.5 data-[state=checked]:translate-x-[1.125rem]',
        )}
      />
    </Switch.Root>
  )
  if (!label) return <span className={className}>{control}</span>
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <div className="pt-0.5">{control}</div>
      <label htmlFor={id} className={cn('min-w-0 cursor-pointer text-sm', disabled && 'cursor-not-allowed opacity-60')}>
        <span className="block font-medium text-fg">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </label>
    </div>
  )
}
