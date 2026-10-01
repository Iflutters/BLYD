import { createContext, useContext } from 'react'

/**
 * Listas arrastáveis do quadro, por contêiner:
 * - `g:<grupo>` elementos do grupo (podem ir para outro grupo);
 * - `s:<elemento>` subelementos (só dentro do mesmo elemento);
 * - `roots` fases e `subs:<fase>` subgrupos (grupos têm id `grp:<id>`; só dentro do mesmo nível).
 */
export type Containers = Record<string, string[]>

export const itemContainer = (groupId: string) => `g:${groupId}`
export const subContainer = (parentId: string) => `s:${parentId}`
export const groupDragId = (groupId: string) => `grp:${groupId}`
export const ROOTS = 'roots'
export const subgroupsContainer = (rootId: string) => `subs:${rootId}`

export interface ItemTarget {
  groupId?: string
  prevId?: string
  nextId?: string
}

export interface GroupTarget {
  parentId: string | null
  prevId?: string
  nextId?: string
}

export const OrderContext = createContext<Containers>({})

/** Ordem atual dos contêineres (durante e logo depois do arraste, a da tela). */
export function useBoardOrder(): Containers {
  return useContext(OrderContext)
}
