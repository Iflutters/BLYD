import type { ReactNode } from 'react'
import { useDocumentTitle } from '@/presentation/common/use-document-title'

export interface PageHeaderProps {
  title: string
  description?: ReactNode
  actions?: ReactNode
}

/** Cabeçalho padrão de página; também define o título da aba do navegador. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  useDocumentTitle(title)

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
