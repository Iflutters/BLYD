import type { ReactNode } from 'react'
import { FilterX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppButton } from './AppButton'

export interface AppFilterBarProps {
  search?: ReactNode
  filters?: ReactNode
  actions?: ReactNode
  hasActiveFilters?: boolean
  onReset?: () => void
}

/** Barra padrão de busca + filtros + ações de uma listagem. */
export function AppFilterBar({ search, filters, actions, hasActiveFilters, onReset }: AppFilterBarProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {search && <div className="w-full sm:w-72">{search}</div>}
        {filters}
        {hasActiveFilters && onReset && (
          <AppButton variant="ghost" size="sm" leftIcon={<FilterX />} onClick={onReset}>
            {t('table.clearFilters')}
          </AppButton>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
