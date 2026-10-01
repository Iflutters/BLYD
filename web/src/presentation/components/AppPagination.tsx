import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/core/utils/format'
import { PAGE_SIZES, pageRange } from '@/domain/pagination'
import { AppIconButton } from './AppIconButton'
import { AppSelect } from './AppSelect'

export interface AppPaginationProps {
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
  onPerPageChange?: (perPage: number) => void
}

export function AppPagination({ page, perPage, total, onPageChange, onPerPageChange }: AppPaginationProps) {
  const { t, i18n } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const { from, to } = pageRange(page, perPage, total)
  const n = (value: number) => formatNumber(value, i18n.language)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted">
      <p aria-live="polite">
        {total === 0 ? t('table.noResults') : t('table.range', { from: n(from), to: n(to), total: n(total) })}
      </p>
      <div className="flex items-center gap-3">
        {onPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">{t('table.perPage')}</span>
            <AppSelect
              size="sm"
              aria-label={t('table.perPage')}
              value={String(perPage)}
              onValueChange={(value) => onPerPageChange(Number(value))}
              options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
              triggerClassName="w-18"
            />
          </div>
        )}
        <span className="whitespace-nowrap">{t('table.pageOf', { page: n(page), pages: n(totalPages) })}</span>
        <div className="flex items-center gap-1">
          <AppIconButton
            variant="secondary"
            size="sm"
            label={t('table.previousPage')}
            icon={<ChevronLeft />}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          />
          <AppIconButton
            variant="secondary"
            size="sm"
            label={t('table.nextPage')}
            icon={<ChevronRight />}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          />
        </div>
      </div>
    </div>
  )
}
