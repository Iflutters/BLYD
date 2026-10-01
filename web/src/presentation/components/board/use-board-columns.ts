import { useCallback, useMemo, useState } from 'react'
import { readJson, writeJson } from '@/core/storage/safe-storage'
import {
  clampWidth,
  moveColumn,
  normalizeColumns,
  placeAfter as place,
  setCollapsed as collapse,
  setHidden as hide,
  shiftColumn,
  canShift as canShiftColumn,
  type BoardColumnDef,
  type BoardColumnsState,
} from './board-columns'

export interface BoardSortState {
  column: string
  direction: 'asc' | 'desc'
}

export interface BoardColumnsApi {
  defs: BoardColumnDef[]
  state: BoardColumnsState
  sort: BoardSortState | null
  move: (id: string, targetId: string, after?: boolean) => void
  /** Põe `id` depois de `afterId` (vale também para coluna que ainda vai aparecer). */
  placeAfter: (id: string, afterId: string) => void
  shift: (id: string, step: -1 | 1) => void
  canShift: (id: string, step: -1 | 1) => boolean
  resize: (id: string, width: number | null) => void
  setHidden: (id: string, hidden: boolean) => void
  setCollapsed: (id: string, collapsed: boolean) => void
  setSort: (sort: BoardSortState | null) => void
  reset: () => void
}

interface Stored extends Partial<BoardColumnsState> {
  sort?: BoardSortState | null
}

/**
 * Colunas do quadro compartilhadas por todos os grupos (ordem, largura, ocultas, recolhidas e
 * ordenação), salvas por pessoa no navegador em `storageKey`.
 */
export function useBoardColumns(storageKey: string, defs: BoardColumnDef[]): BoardColumnsApi {
  const [stored, setStored] = useState<Stored>(() => readJson<Stored>(storageKey, {}))
  const state = useMemo(() => normalizeColumns(defs, stored), [defs, stored])
  const sort = stored.sort && defs.some((d) => d.id === stored.sort?.column) ? stored.sort : null

  const save = useCallback(
    (next: Stored) => {
      setStored(next)
      writeJson(storageKey, next)
    },
    [storageKey],
  )
  const apply = useCallback((next: BoardColumnsState) => save({ ...next, sort }), [save, sort])

  return {
    defs,
    state,
    sort,
    move: (id, targetId, after) => apply(moveColumn(state, defs, id, targetId, after)),
    placeAfter: (id, afterId) => apply(place(state, id, afterId)),
    shift: (id, step) => apply(shiftColumn(state, defs, id, step)),
    canShift: (id, step) => canShiftColumn(state, defs, id, step),
    resize: (id, width) => {
      const def = defs.find((d) => d.id === id)
      if (!def) return
      const widths = { ...state.widths }
      if (width === null) delete widths[id]
      else widths[id] = clampWidth(def, width)
      apply({ ...state, widths })
    },
    setHidden: (id, hidden) => apply(hide(state, id, hidden)),
    setCollapsed: (id, collapsed) => apply(collapse(state, id, collapsed)),
    setSort: (next) => save({ ...state, sort: next }),
    reset: () => save({}),
  }
}
