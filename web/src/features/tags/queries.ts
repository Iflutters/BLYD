import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OptionColor } from '@/domain/task-config'
import { useRepositories } from '@/presentation/common/repositories-context'

export const tagKeys = { all: ['tags'] as const }

export function useTags(enabled = true) {
  const { tags } = useRepositories()
  return useQuery({ queryKey: tagKeys.all, queryFn: () => tags.list(), enabled })
}

export function useTagMutations() {
  const { tags } = useRepositories()
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: tagKeys.all })
    // nomes/cores das tags aparecem nas tarefas
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }
  return {
    create: useMutation({ mutationFn: (data: { name: string; color: OptionColor }) => tags.create(data), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: OptionColor } }) => tags.update(id, data),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => tags.remove(id), onSuccess: invalidate }),
  }
}
