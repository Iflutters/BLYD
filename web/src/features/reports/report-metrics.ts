import { useTranslation } from 'react-i18next'
import type { Report, ReportMetric } from '@/domain/reports'

/** Rótulo de cada indicador (chaves em reports.indicators). */
const LABEL_KEYS: Record<ReportMetric, string> = {
  open: 'open',
  backlog: 'backlog',
  todo: 'todo',
  in_progress: 'inProgress',
  blocked: 'blocked',
  overdue: 'overdue',
  critical_bugs: 'criticalBugs',
  created: 'created',
  completed: 'completed',
  cancelled: 'cancelled',
  lead_time: 'leadTime',
  cycle_time: 'cycleTime',
  bug_resolution: 'bugResolution',
}

/** Nome e explicação (o que entra na conta) de cada indicador. */
export function useMetricText() {
  const { t } = useTranslation()
  return {
    label: (metric: ReportMetric) => t(`reports.indicators.${LABEL_KEYS[metric]}`),
    help: (metric: ReportMetric, report: Pick<Report, 'definitions'>) =>
      t(`reports.metricHelp.${metric}`, {
        priority: report.definitions.criticalPriority?.name ?? '—',
        types: report.definitions.bugTypes.map((type) => type.name).join(', ') || '—',
      }),
  }
}
