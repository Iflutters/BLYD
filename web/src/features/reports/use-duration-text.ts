import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/core/utils/format'
import { durationParts, type Duration } from '@/domain/reports'

/** "3,5 dias" / "12 h" / "—" (sem amostra). */
export function useDurationText() {
  const { t, i18n } = useTranslation()
  return (duration: Duration) => {
    const parts = durationParts(duration.hours)
    if (!parts) return '—'
    return t(`reports.units.${parts.unit}`, { value: formatNumber(parts.value, i18n.language) })
  }
}
