import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/core/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-3 text-muted',
        primary: 'bg-primary-soft text-primary-soft-fg',
        success: 'bg-success-soft text-success-soft-fg',
        warning: 'bg-warning-soft text-warning-soft-fg',
        danger: 'bg-danger-soft text-danger-soft-fg',
        info: 'bg-info-soft text-info-soft-fg',
      },
      dot: { true: 'before:size-1.5 before:rounded-full before:bg-current before:content-[""]' },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface AppBadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function AppBadge({ tone, dot, className, ...props }: AppBadgeProps) {
  return <span className={cn(badgeVariants({ tone, dot }), className)} {...props} />
}
