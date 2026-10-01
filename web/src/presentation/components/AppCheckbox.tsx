import type { ReactNode } from 'react'
import { Checkbox } from 'radix-ui'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/core/utils/cn'

export interface AppCheckboxProps {
  checked: boolean | 'indeterminate'
  onCheckedChange?: (checked: boolean) => void
  label?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
  'aria-label'?: string
}

export function AppCheckbox({ checked, onCheckedChange, label, disabled, id, className, ...rest }: AppCheckboxProps) {
  const box = (
    <Checkbox.Root
      id={id}
      checked={checked}
      disabled={disabled}
      aria-label={label ? undefined : rest['aria-label']}
      onCheckedChange={(value) => onCheckedChange?.(value === true)}
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-border-strong bg-surface transition-colors',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary',
        'focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
        !label && className,
      )}
    >
      <Checkbox.Indicator className="text-primary-fg">
        {checked === 'indeterminate' ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
  if (!label) return box
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-fg has-[:disabled]:cursor-not-allowed', className)}>
      {box}
      <span>{label}</span>
    </label>
  )
}
