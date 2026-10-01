import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { moveCardInBoard, type Board } from '@/domain/kanban'
import { useRepositories } from '@/presentation/common/repositories-context'
import { useLiveRefetchInterval } from '@/presentation/common/use-live'
import { taskKeys } from '@/features/tasks/queries'

/** Sob `tasks`: qualquer mutação de tarefa também atualiza o quadro. */
export const boardKeys = {
  detail: (projectId: string) => ['tasks', 'board', projectId] as const,
}

/**
 * Atualização periódica enquanto a aba está visível (pausada durante o arraste) quando o tempo real
 * não está ligado; com ele, só a rede de segurança (`LIVE_SAFETY_NET_MS`).
 */
export const BOARD_REFRESH_MS = 15_000

export function useBoard(projectId: string | undefined, paused = false) {
  const { board } = useRepositories()
  const refreshMs = useLiveRefetchInterval(BOARD_REFRESH_MS)
  return useQuery({
    queryKey: boardKeys.detail(projectId ?? ''),
    queryFn: () => board.get(projectId as string),
    enabled: !!projectId,
    refetchInterval: paused ? false : refreshMs,
  })
}

export interface MoveCardInput {
  taskId: string
  statusId: string
  prevId?: string
  nextId?: string
}

/** Move com atualização otimista; em erro o quadro volta ao estado anterior. */
export function useMoveCard(projectId: string) {
  const { board } = useRepositories()
  const queryClient = useQueryClient()
  const key = boardKeys.detail(projectId)
  return useMutation({
    mutationFn: ({ taskId, statusId, prevId, nextId }: MoveCardInput) => board.move(taskId, { statusId, prevId, nextId }),
    onMutate: async ({ taskId, statusId, prevId }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Board>(key)
      if (previous) queryClient.setQueryData<Board>(key, moveCardInBoard(previous, taskId, statusId, prevId))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (task) => queryClient.setQueryData(taskKeys.detail(task.id), task),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  })
}
