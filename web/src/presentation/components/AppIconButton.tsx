import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/core/utils/cn'
import { AppTooltip } from './AppTooltip'

const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 ' +
    'disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring',
  {
    variants: {
      variant: {
        ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
        secondary: 'border border-border bg-surface text-fg hover:bg-surface-2',
        danger: 'text-danger hover:bg-danger-soft',
      },
      size: {
        sm: 'size-7 [&_svg]:size-3.5',
        md: 'size-9 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'md' },
  },
)

export interface AppIconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof iconButtonVariants> {
  /** Obrigatório: nome acessível do botão (também usado como tooltip). */
  label: string
  icon: ReactNode
  showTooltip?: boolean
}

export const AppIconButton = forwardRef<HTMLButtonElement, AppIconButtonProps>(function AppIconButton(
  { label, icon, variant, size, className, showTooltip = true, type, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      {icon}
    </button>
  )
  return (
    <AppTooltip content={label} enabled={showTooltip}>
      {button}
    </AppTooltip>
  )
})
