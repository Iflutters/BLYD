import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/presentation/common/repositories-context'

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: ['notifications', 'unread-count'] as const,
  recent: ['notifications', 'recent'] as const,
  list: (unreadOnly: boolean) => ['notifications', 'list', unreadOnly] as const,
}

/** Verifica novas notificações a cada 30 s e ao voltar para a aba. */
const POLL_MS = 30_000

export function useUnreadCount() {
  const { notifications } = useRepositories()
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: () => notifications.unreadCount(),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useRecentNotifications(enabled: boolean) {
  const { notifications } = useRepositories()
  return useQuery({ queryKey: notificationKeys.recent, queryFn: () => notifications.list({ page: 1, perPage: 10 }), enabled })
}

export function useNotificationPages(unreadOnly: boolean) {
  const { notifications } = useRepositories()
  return useInfiniteQuery({
    queryKey: notificationKeys.list(unreadOnly),
    queryFn: ({ pageParam }) => notifications.list({ page: pageParam, perPage: 20, unreadOnly }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  })
}

export function useNotificationMutations() {
  const { notifications } = useRepositories()
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
  return {
    markRead: useMutation({ mutationFn: (id: string) => notifications.markRead(id), onSuccess: invalidate }),
    markAllRead: useMutation({ mutationFn: () => notifications.markAllRead(), onSuccess: invalidate }),
  }
}
