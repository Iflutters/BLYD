import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { compareDays, parseDay } from '@/core/utils/calendar'
import { AppCalendar } from './AppCalendar'

export interface AppDateRange {
  /** AAAA-MM-DD ou '' */
  start: string
  end: string
}

export interface AppRangeCalendarProps {
  value: AppDateRange
  onChange: (range: AppDateRange) => void
  focusOnMount?: boolean
  className?: string
}

/** Dias corridos do intervalo, contando as duas pontas. */
function daysBetween(range: AppDateRange): number {
  const a = parseDay(range.start || range.end)
  const b = parseDay(range.end || range.start)
  if (!a || !b) return 0
  const toTime = (d: typeof a) => Date.UTC(d.year, d.month, d.day)
  return Math.round((toTime(b) - toTime(a)) / 86400000) + 1
}

/**
 * Calendário de intervalo (cronograma): o 1º clique marca um dia; o 2º fecha o intervalo
 * (em qualquer ordem). Rodapé com "N dias selecionados" e "Limpar".
 */
export function AppRangeCalendar({ value, onChange, focusOnMount, className }: AppRangeCalendarProps) {
  const { t } = useTranslation()
  const [anchor, setAnchor] = useState<string | null>(null)
  const days = daysBetween(value)

  function pick(day: string) {
    if (!day) return
    if (!anchor) {
      setAnchor(day)
      onChange({ start: day, end: day })
      return
    }
    const a = parseDay(anchor)
    const b = parseDay(day)
    const ordered = a && b && compareDays(b, a) < 0 ? { start: day, end: anchor } : { start: anchor, end: day }
    setAnchor(null)
    onChange(ordered)
  }

  return (
    <div className={className}>
      <AppCalendar value={value.start} rangeEnd={value.end && value.end !== value.start ? value.end : undefined} onChange={pick} showFooter={false} focusOnMount={focusOnMount} />
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2">
        <span className="text-xs text-muted" aria-live="polite">
          {days > 0 ? t('calendar.daysSelected', { count: days }) : t('calendar.pickRange')}
        </span>
        <button
          type="button"
          disabled={!value.start && !value.end}
          onClick={() => {
            setAnchor(null)
            onChange({ start: '', end: '' })
          }}
          className="rounded-lg px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
        >
          {t('calendar.clear')}
        </button>
      </div>
    </div>
  )
}
