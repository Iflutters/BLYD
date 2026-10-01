import type { Sprint, SprintRef } from './sprints'
import type { TaskStatusRef, TaskSummary } from './tasks'
import { isClosedCategory, type StatusCategory } from './workflow'

/**
 * Backlog do projeto: o que ainda não começou — status das categorias "backlog" e "a fazer"
 * (já analisadas) —, na ordem de prioridade do time, para priorizar e planejar em sprints.
 */
export interface BacklogView {
  project: { id: string; key: string; name: string; archived: boolean }
  capabilities: { rank: boolean; create: boolean; manageSprints: boolean }
  /** Status ativos planejáveis (backlog e a fazer); o padrão é onde nascem os itens. */
  statuses: Array<TaskStatusRef & { isDefault: boolean }>
  /** Sprints não encerrados. */
  sprints: Sprint[]
  items: TaskSummary[]
  truncated: boolean
}

/** Grupo "sem sprint". */
export const NO_SPRINT = 'none'

export const BACKLOG_SORTS = ['manual', 'priority', 'newest', 'due', 'estimate'] as const
export type BacklogSort = (typeof BACKLOG_SORTS)[number]

export interface BacklogGroup {
  /** ID da sprint ou NO_SPRINT. */
  id: string
  sprint: Sprint | null
  items: TaskSummary[]
  /** Soma das estimativas (horas) e quantos itens estão sem estimativa. */
  estimate: number
  unestimated: number
}

export const groupOf = (item: Pick<TaskSummary, 'sprint'>) => item.sprint?.id ?? NO_SPRINT

function compare(sort: BacklogSort, priorityOrder: readonly string[]) {
  const rank = (item: TaskSummary) => {
    const index = item.priority ? priorityOrder.indexOf(item.priority.id) : -1
    return index < 0 ? priorityOrder.length : index
  }
  return (a: TaskSummary, b: TaskSummary): number => {
    if (sort === 'priority') return rank(a) - rank(b)
    if (sort === 'newest') return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    if (sort === 'due') return (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity)
    if (sort === 'estimate') return (b.estimatedHours ?? -1) - (a.estimatedHours ?? -1)
    return 0
  }
}

/**
 * Grupos do backlog: sprints abertas (na ordem do servidor) e, por último, "sem sprint".
 * Na ordem manual os itens seguem a prioridade do time; nas demais, a ordenação escolhida
 * (desempate pela ordem manual).
 */
export function groupBacklog(
  view: Pick<BacklogView, 'sprints' | 'items'>,
  visible: (item: TaskSummary) => boolean,
  sort: BacklogSort = 'manual',
  priorityOrder: readonly string[] = [],
): BacklogGroup[] {
  const cmp = compare(sort, priorityOrder)
  const build = (id: string, sprint: Sprint | null): BacklogGroup => {
    const items = view.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => groupOf(item) === id && visible(item))
      .sort((a, b) => cmp(a.item, b.item) || a.index - b.index)
      .map(({ item }) => item)
    return {
      id,
      sprint,
      items,
      estimate: Math.round(items.reduce((sum, item) => sum + (item.estimatedHours ?? 0), 0) * 100) / 100,
      unestimated: items.filter((item) => item.estimatedHours === null).length,
    }
  }
  return [...view.sprints.map((sprint) => build(sprint.id, sprint)), build(NO_SPRINT, null)]
}

/**
 * Atualização otimista da priorização: tira o item da posição atual e o coloca depois de `prevId`
 * (ou antes de `nextId`; sem vizinhos, no fim), já na sprint novo.
 */
export function rankInBacklog<T extends Pick<BacklogView, 'items'>>(view: T, taskId: string, sprint: SprintRef | null, prevId?: string, nextId?: string): T {
  const moving = view.items.find((item) => item.id === taskId)
  if (!moving) return view
  const items = view.items.filter((item) => item.id !== taskId)
  const moved = { ...moving, sprint }
  let at = items.length
  if (prevId && items.some((i) => i.id === prevId)) at = items.findIndex((i) => i.id === prevId) + 1
  else if (nextId && items.some((i) => i.id === nextId)) at = items.findIndex((i) => i.id === nextId)
  items.splice(at, 0, moved)
  return { ...view, items }
}

export interface ActivationStatus {
  id: string
  name: string
  /** Status sempre têm categoria; opcional só para aceitar LookupItem. */
  category?: StatusCategory
  order: number
  isActive: boolean
  allowedNext?: string[]
}

/**
 * "Mover para": status para onde o item pode seguir a partir do backlog — ativos, não
 * encerrados, diferentes do atual e permitidos pelas transições do status atual.
 * O item continua na lista até ser encerrado (concluído ou cancelado).
 */
export function moveTargets<S extends ActivationStatus>(statuses: readonly S[], fromStatusId: string | undefined): S[] {
  const from = statuses.find((s) => s.id === fromStatusId)
  const allowed = (id: string) => !from?.allowedNext?.length || from.allowedNext.includes(id)
  return statuses
    .filter((s) => s.isActive && !!s.category && s.id !== fromStatusId && !isClosedCategory(s.category) && allowed(s.id))
    .slice()
    .sort((a, b) => a.order - b.order)
}
