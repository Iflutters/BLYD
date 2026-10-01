import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CustomFieldInput, TaskTypeFieldInput, TaskTypeInput } from '@/domain/repositories'
import { useRepositories } from '@/presentation/common/repositories-context'

export const configKeys = {
  fields: ['task-config', 'fields'] as const,
  types: (includeInactive: boolean) => ['task-config', 'types', includeInactive] as const,
  type: (id: string) => ['task-config', 'type', id] as const,
  typeHistory: (id: string) => ['task-config', 'type-history', id] as const,
}

export function useCustomFields() {
  const { customFields } = useRepositories()
  return useQuery({ queryKey: configKeys.fields, queryFn: () => customFields.list() })
}

export function useTaskTypes(includeInactive = false) {
  const { taskTypes } = useRepositories()
  return useQuery({ queryKey: configKeys.types(includeInactive), queryFn: () => taskTypes.list({ includeInactive }) })
}

export function useTaskType(id: string | undefined) {
  const { taskTypes } = useRepositories()
  return useQuery({ queryKey: configKeys.type(id ?? ''), queryFn: () => taskTypes.get(id as string), enabled: !!id })
}

export function useTaskTypeHistory(id: string) {
  const { taskTypes } = useRepositories()
  return useQuery({ queryKey: configKeys.typeHistory(id), queryFn: () => taskTypes.history(id) })
}

function useInvalidateConfig() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: ['task-config'] })
}

export function useCustomFieldMutations() {
  const { customFields } = useRepositories()
  const invalidate = useInvalidateConfig()
  return {
    create: useMutation({ mutationFn: (data: CustomFieldInput) => customFields.create(data), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<CustomFieldInput> }) => customFields.update(id, data),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => customFields.remove(id), onSuccess: invalidate }),
  }
}

export function useTaskTypeMutations() {
  const { taskTypes } = useRepositories()
  const invalidate = useInvalidateConfig()
  return {
    create: useMutation({ mutationFn: (data: TaskTypeInput & { key: string }) => taskTypes.create(data), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<TaskTypeInput> }) => taskTypes.update(id, data),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => taskTypes.remove(id), onSuccess: invalidate }),
    reorder: useMutation({ mutationFn: (ids: string[]) => taskTypes.reorder(ids), onSuccess: invalidate }),
    setFields: useMutation({
      mutationFn: ({ id, fields }: { id: string; fields: TaskTypeFieldInput[] }) => taskTypes.setFields(id, fields),
      onSuccess: invalidate,
    }),
  }
}
