import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/core/utils/cn'
import { AppFormField } from './AppFormField'

export interface AppTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  error?: string | undefined
  hint?: ReactNode
  fieldClassName?: string
}

/** Texto longo simples. (Editor rico — AppRichTextEditor — chega com comentários/tarefas.) */
export const AppTextarea = forwardRef<HTMLTextAreaElement, AppTextareaProps>(function AppTextarea(
  { label, error, hint, required, className, fieldClassName, rows = 4, ...props },
  ref,
) {
  return (
    <AppFormField label={label} error={error} hint={hint} required={required} className={fieldClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            'w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-xs placeholder:text-subtle',
            'hover:border-border-strong focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-ring',
            'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger',
            className,
          )}
          {...props}
        />
      )}
    </AppFormField>
  )
})
