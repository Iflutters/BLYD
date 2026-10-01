import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { AuditQuery } from '@/domain/repositories'
import { useRepositories } from '@/presentation/common/repositories-context'

export function useAuditLogs(query: AuditQuery) {
  const { audit } = useRepositories()
  return useQuery({
    queryKey: ['audit', 'list', query],
    queryFn: () => audit.list(query),
    placeholderData: keepPreviousData,
  })
}

export function useUserHistory(userId: string | null, perPage = 50) {
  const { users } = useRepositories()
  return useQuery({
    queryKey: ['users', 'history', userId, perPage],
    queryFn: () => users.history(userId as string, { page: 1, perPage }),
    enabled: !!userId,
  })
}
