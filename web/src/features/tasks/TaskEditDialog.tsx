import { useTask } from './queries'
import { TaskFormDialog } from './TaskFormDialog'

/** Edição a partir de uma listagem: carrega o detalhe (campos e valores) e abre o formulário. */
export function TaskEditDialog({ taskId, onOpenChange }: { taskId: string | null; onOpenChange: (open: boolean) => void }) {
  const task = useTask(taskId ?? undefined)
  return <TaskFormDialog open={!!taskId && !!task.data} task={task.data ?? null} onOpenChange={onOpenChange} />
}
