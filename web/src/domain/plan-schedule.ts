/**
 * Cronograma do quadro (Gerenciamento de Projetos, GP-4 — diretriz §13): Gantt dos elementos por grupo,
 * linha de base, ajuste automático da escala, Bateria (distribuição de status) e exportação em CSV.
 * Reaproveita a geometria da Timeline (domain/timeline.ts: dias como números, régua por zoom).
 */
import { formatNumber, statusSegments, type Plan, type PlanGroupSummary, type PlanItem, type PlanStatus, type StatusSegment } from './plan'
import { groupTitle } from './plan-view'
import { PX_PER_DAY, TIMELINE_ZOOMS, dayFromIso, timelineRange, type DaySpan, type TimelineZoom } from './timeline'

/** Marca de UTF-8 no início do CSV (o Excel abre os acentos certos). */
const BOM = String.fromCharCode(0xfeff)

function spanOf(start: string | null, end: string | null): DaySpan | null {
  const first = start ?? end
  const last = end ?? start
  if (!first || !last) return null
  return { start: dayFromIso(first), end: dayFromIso(last) }
}

/** Barra do elemento: início→fim; uma data só = um dia; sem datas = null. */
export const itemSpan = (item: Pick<PlanItem, 'startDate' | 'endDate'>) => spanOf(item.startDate, item.endDate)

/** Linha de base salva pelo gestor (null = sem linha de base para o elemento). */
export const baselineSpan = (item: Pick<PlanItem, 'baselineStart' | 'baselineEnd'>) => spanOf(item.baselineStart, item.baselineEnd)

/** Quantos dias o fim andou desde a linha de base (+ atrasou, − adiantou; null sem base ou sem fim). */
export function slipDays(item: Pick<PlanItem, 'startDate' | 'endDate' | 'baselineStart' | 'baselineEnd'>): number | null {
  const now = itemSpan(item)
  const base = baselineSpan(item)
  return now && base ? now.end - base.end : null
}

/** Período exibido: cronograma, linha de base e hoje (com folga), como na Timeline. */
export function scheduleRange(items: PlanItem[], today: number): DaySpan {
  const days: number[] = []
  items.forEach((item) => {
    ;[itemSpan(item), baselineSpan(item)].forEach((span) => {
      if (span) days.push(span.start, span.end)
    })
  })
  return timelineRange(days, today)
}

/** Ajuste automático: a escala mais detalhada em que o período inteiro cabe na largura. */
export function fitZoom(range: DaySpan, width: number): TimelineZoom {
  const days = range.end - range.start + 1
  return TIMELINE_ZOOMS.find((zoom) => days * PX_PER_DAY[zoom] <= width) ?? 'quarter'
}

/** Bateria do Cronograma: distribuição de status do quadro inteiro e o % na categoria "feito". */
export function battery(summary: PlanGroupSummary | null, statuses: PlanStatus[]): { segments: StatusSegment[]; donePercent: number } {
  const segments = statusSegments(summary, statuses)
  const done = new Set(statuses.filter((s) => s.category === 'done').map((s) => s.id))
  const donePercent = Math.round(segments.filter((s) => s.statusId && done.has(s.statusId)).reduce((sum, s) => sum + s.percent, 0) * 10) / 10
  return { segments, donePercent }
}

export interface ScheduleCsvLabels {
  group: string
  name: string
  status: string
  start: string
  end: string
  duration: string
  estimated: string
  progress: string
  baselineStart: string
  baselineEnd: string
}

/** Exportar o cronograma: um elemento por linha (na ordem dos grupos), com o separador do Excel no idioma. */
export function scheduleCsv(plan: Plan, locale: string, labels: ScheduleCsvLabels): string {
  const delimiter = locale.startsWith('en') ? ',' : ';'
  const escape = (value: string) => (value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)) : '')
  const statusName = new Map(plan.statuses.map((s) => [s.id, s.name]))
  const order = new Map(plan.groups.map((g, index) => [g.id, index]))
  const groupOf = new Map(plan.groups.map((g) => [g.id, g]))
  const rows = plan.items
    .filter((i) => !i.parentId)
    .sort((a, b) => (order.get(a.groupId) ?? 0) - (order.get(b.groupId) ?? 0) || a.position - b.position)
    .map((i) => {
      const group = groupOf.get(i.groupId)
      return [
        group ? groupTitle(group) : '',
        i.name,
        i.statusId ? (statusName.get(i.statusId) ?? '') : '',
        day(i.startDate ?? i.endDate),
        day(i.endDate ?? i.startDate),
        formatNumber(i.durationDays, locale) ?? '',
        formatNumber(i.estimatedHours, locale) ?? '',
        `${i.progress.value}%`,
        day(i.baselineStart),
        day(i.baselineEnd),
      ]
    })
  const head = [labels.group, labels.name, labels.status, labels.start, labels.end, labels.duration, labels.estimated, labels.progress, labels.baselineStart, labels.baselineEnd]
  return `${BOM}${[head, ...rows].map((row) => row.map(escape).join(delimiter)).join('\r\n')}\r\n`
}
