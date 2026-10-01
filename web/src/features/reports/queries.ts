import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { ReportMetric, ReportQuery } from '@/domain/reports'
import { useRepositories } from '@/presentation/common/repositories-context'

/** Sob `tasks`: mudanças em tarefas também atualizam os indicadores. */
export const reportKeys = {
  detail: (query: ReportQuery) =>
    ['tasks', 'reports', { ...query, from: query.from.toISOString(), to: query.to.toISOString() }] as const,
  tasks: (query: ReportQuery, metric: ReportMetric, page: { page: number; perPage: number }) =>
    ['tasks', 'reports', 'tasks', metric, page, { ...query, from: query.from.toISOString(), to: query.to.toISOString(), groupBy: undefined }] as const,
}

export function useReport(query: ReportQuery | null, enabled = true) {
  const { reports } = useRepositories()
  return useQuery({
    queryKey: query ? reportKeys.detail(query) : ['tasks', 'reports', 'none'],
    queryFn: () => reports.get(query as ReportQuery),
    enabled: enabled && !!query,
    placeholderData: keepPreviousData,
  })
}

/** Detalhamento de um indicador (paginado; mesmo período e filtros do relatório). */
export function useReportTasks(query: ReportQuery, metric: ReportMetric, page: { page: number; perPage: number }) {
  const { reports } = useRepositories()
  return useQuery({
    queryKey: reportKeys.tasks(query, metric, page),
    queryFn: () => reports.listTasks(query, metric, page),
    placeholderData: keepPreviousData,
  })
}
