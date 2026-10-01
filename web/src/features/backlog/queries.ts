import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rankInBacklog, type BacklogView } from '@/domain/backlog'
import type { SprintInput, SprintRef } from '@/domain/sprints'
import { useRepositories } from '@/presentation/common/repositories-context'
import { taskKeys } from '@/features/tasks/queries'

/** Sob `tasks`: qualquer mutação de tarefa também atualiza o backlog. */
export const backlogKeys = {
  detail: (projectId: string) => ['tasks', 'backlog', projectId] as const,
}
export const sprintKeys = {
  all: ['sprints'] as const,
  list: (projectId: string) => ['sprints', projectId] as const,
}

export function useBacklog(projectId: string | undefined) {
  const { backlog } = useRepositories()
  return useQuery({ queryKey: backlogKeys.detail(projectId ?? ''), queryFn: () => backlog.get(projectId as string), enabled: !!projectId })
}

export interface RankInput {
  taskId: string
  prevId?: string
  nextId?: string
  /** Presente = troca a sprint (null tira da sprint). */
  sprint?: SprintRef | null
}

/** Priorização com atualização otimista; em erro, o backlog volta ao estado anterior. */
export function useRankTask(projectId: string) {
  const { backlog } = useRepositories()
  const queryClient = useQueryClient()
  const key = backlogKeys.detail(projectId)
  return useMutation({
    mutationFn: ({ taskId, prevId, nextId, sprint }: RankInput) =>
      backlog.rank(taskId, { prevId, nextId, ...(sprint === undefined ? {} : { sprintId: sprint?.id ?? null }) }),
    onMutate: async ({ taskId, prevId, nextId, sprint }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BacklogView>(key)
      if (previous) {
        const current = previous.items.find((i) => i.id === taskId)?.sprint ?? null
        queryClient.setQueryData<BacklogView>(key, rankInBacklog(previous, taskId, sprint === undefined ? current : sprint, prevId, nextId))
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (task) => queryClient.setQueryData(taskKeys.detail(task.id), task),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

/** "Transformar em tarefa ativa": move para um status fora do backlog (mesma regra do Kanban). */
export function useActivateTask() {
  const { board } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, statusId }: { taskId: string; statusId: string }) => board.move(taskId, { statusId }),
    onSuccess: (task) => queryClient.setQueryData(taskKeys.detail(task.id), task),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}

export function useSprints(projectId: string | undefined, includeClosed = false) {
  const { sprints } = useRepositories()
  return useQuery({
    queryKey: [...sprintKeys.list(projectId ?? ''), includeClosed],
    queryFn: () => sprints.list(projectId as string, { includeClosed }),
    enabled: !!projectId,
  })
}

export function useSprintMutations(projectId: string) {
  const { sprints } = useRepositories()
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) })
    // itens do backlog e das listas mostram a sprint
    void queryClient.invalidateQueries({ queryKey: taskKeys.all })
  }
  return {
    create: useMutation({ mutationFn: (data: SprintInput & { name: string }) => sprints.create(projectId, data), onSuccess: invalidate }),
    update: useMutation({ mutationFn: ({ id, data }: { id: string; data: SprintInput }) => sprints.update(id, data), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => sprints.remove(id), onSuccess: invalidate }),
    reorder: useMutation({ mutationFn: (ids: string[]) => sprints.reorder(projectId, ids), onSuccess: invalidate }),
  }
}
