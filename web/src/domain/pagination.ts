export type SortDirection = 'asc' | 'desc'

export interface SortState {
  id: string
  direction: SortDirection
}

export interface ListQuery {
  page: number
  perPage: number
  sort: SortState | null
  search: string
  filters: Record<string, string>
}

export interface Page<T> {
  items: T[]
  page: number
  perPage: number
  total: number
  totalPages: number
}

export const PAGE_SIZES = [10, 20, 50, 100] as const

/** Converte o estado de ordenação para o parâmetro `sort` da API ("-campo" = desc). */
export function toSortParam(sort: SortState | null): string | undefined {
  if (!sort) return undefined
  return sort.direction === 'desc' ? `-${sort.id}` : sort.id
}

/** Intervalo exibido na paginação: { from, to } (1-based). */
export function pageRange(page: number, perPage: number, total: number): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 }
  const from = (page - 1) * perPage + 1
  return { from, to: Math.min(page * perPage, total) }
}
