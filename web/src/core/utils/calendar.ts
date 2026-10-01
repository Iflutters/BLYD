/**
 * Utilitários de calendário para datas "somente dia" (AAAA-MM-DD), sem fuso horário.
 * Tudo é calculado em UTC para não sofrer deslocamento de fuso (ex.: Brasil, UTC-3).
 */

export interface Day {
  year: number
  /** 0–11 */
  month: number
  day: number
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDay(value: string | null | undefined): Day | null {
  const match = value ? DAY_PATTERN.exec(value) : null
  if (!match) return null
  const day = { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
  return isValidDay(day) ? day : null
}

export function isValidDay(day: Day): boolean {
  const date = new Date(Date.UTC(day.year, day.month, day.day))
  return date.getUTCFullYear() === day.year && date.getUTCMonth() === day.month && date.getUTCDate() === day.day
}

export function formatDayValue(day: Day): string {
  const pad = (n: number, size = 2) => String(n).padStart(size, '0')
  return `${pad(day.year, 4)}-${pad(day.month + 1)}-${pad(day.day)}`
}

export function toUtcDate(day: Day): Date {
  return new Date(Date.UTC(day.year, day.month, day.day))
}

export function fromDate(date: Date): Day {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }
}

export function today(now: Date = new Date()): Day {
  return fromDate(now)
}

export function addDays(day: Day, amount: number): Day {
  const date = toUtcDate(day)
  date.setUTCDate(date.getUTCDate() + amount)
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() }
}

/** Soma meses mantendo o dia quando possível (31/jan + 1 mês = 28 ou 29/fev). */
export function addMonths(day: Day, amount: number): Day {
  const total = day.year * 12 + day.month + amount
  const year = Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const last = daysInMonth(year, month)
  return { year, month, day: Math.min(day.day, last) }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export function compareDays(a: Day, b: Day): number {
  return toUtcDate(a).getTime() - toUtcDate(b).getTime()
}

export function isSameDay(a: Day | null, b: Day | null): boolean {
  return !!a && !!b && a.year === b.year && a.month === b.month && a.day === b.day
}

export function dayOfWeek(day: Day): number {
  return toUtcDate(day).getUTCDay()
}

/** Grade de 6 semanas (42 dias) do mês, começando em `weekStart` (0 = domingo, 1 = segunda). */
export function monthGrid(year: number, month: number, weekStart: number): Day[] {
  const first = { year, month, day: 1 }
  const offset = (dayOfWeek(first) - weekStart + 7) % 7
  const start = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

/** Primeiro dia da semana do idioma (Intl.Locale.weekInfo quando disponível). */
export function weekStartFor(locale: string): number {
  try {
    const info = (new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } })
    const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay
    if (firstDay) return firstDay % 7 // Intl usa 1 = segunda … 7 = domingo
  } catch {
    // ambiente sem suporte: usa o padrão abaixo
  }
  return locale.startsWith('es') ? 1 : 0
}

/** Nomes curtos dos dias da semana a partir de `weekStart`. */
export function weekdayNames(locale: string, weekStart: number, style: 'narrow' | 'short' | 'long' = 'short'): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' })
  // 4/jan/1970 foi um domingo
  return Array.from({ length: 7 }, (_, index) => formatter.format(new Date(Date.UTC(1970, 0, 4 + ((weekStart + index) % 7)))))
}

export function monthNames(locale: string, style: 'long' | 'short' = 'long'): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_, month) => formatter.format(new Date(Date.UTC(2026, month, 1))))
}

export function formatMonthYear(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month, 1)))
}

export function formatLongDay(day: Day, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(toUtcDate(day))
}

export type DatePart = 'day' | 'month' | 'year'

/** Ordem dos componentes da data no idioma (pt-BR: dia/mês/ano; en: mês/dia/ano). */
export function dateOrder(locale: string): DatePart[] {
  const parts = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
    .formatToParts(new Date(Date.UTC(2026, 10, 22)))
    .map((p) => p.type)
    .filter((type): type is DatePart => type === 'day' || type === 'month' || type === 'year')
  return parts.length === 3 ? parts : ['day', 'month', 'year']
}

/** Máscara de digitação do idioma (ex.: "dd/mm/aaaa"). */
export function inputPattern(locale: string, labels: Record<DatePart, string>): string {
  return dateOrder(locale)
    .map((part) => labels[part])
    .join('/')
}

/** Texto digitado (no formato do idioma) -> Day, ou null se inválido/incompleto. */
export function parseTyped(text: string, locale: string): Day | null {
  const pieces = text.split(/[^0-9]+/).filter(Boolean)
  if (pieces.length !== 3) return null
  const order = dateOrder(locale)
  const values: Partial<Record<DatePart, number>> = {}
  order.forEach((part, index) => {
    values[part] = Number(pieces[index])
  })
  const year = values.year ?? NaN
  if (String(pieces[order.indexOf('year')]).length !== 4) return null
  const day = { year, month: (values.month ?? 0) - 1, day: values.day ?? 0 }
  return isValidDay(day) ? day : null
}

/** Day -> texto no formato de digitação do idioma (ex.: 01/09/2026). */
export function formatTyped(day: Day, locale: string): string {
  const values: Record<DatePart, string> = {
    day: String(day.day).padStart(2, '0'),
    month: String(day.month + 1).padStart(2, '0'),
    year: String(day.year).padStart(4, '0'),
  }
  return dateOrder(locale)
    .map((part) => values[part])
    .join('/')
}

/** Aplica a máscara de digitação (insere "/" automaticamente). */
export function maskTyped(text: string, locale: string): string {
  const digits = text.replace(/[^0-9]/g, '').slice(0, 8)
  const sizes = dateOrder(locale).map((part) => (part === 'year' ? 4 : 2))
  const out: string[] = []
  let cursor = 0
  for (const size of sizes) {
    if (cursor >= digits.length) break
    out.push(digits.slice(cursor, cursor + size))
    cursor += size
  }
  return out.join('/')
}
