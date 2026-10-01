import type { UserSummary } from './projects'

export const NOTIFICATION_TYPES = ['mention', 'assigned', 'comment', 'status_changed', 'due_soon', 'overdue', 'plan_mention', 'plan_reply'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface AppNotification {
  id: string
  type: NotificationType
  /** Notificação de tarefa (null nas do quadro de gerenciamento). */
  task: { id: string; code: string; title: string } | null
  /** Notificação de elemento do quadro (GP-3). */
  planItem: { id: string; projectId: string; name: string; projectName: string } | null
  /** Quem fez a ação (null em lembretes automáticos). */
  actor: UserSummary | null
  /** comment (trecho), status, due_date — conforme o tipo. */
  data: { comment?: string; status?: string; due_date?: string }
  read: boolean
  createdAt: Date | null
}

/** Aba da tarefa que a notificação deve abrir. */
export function notificationTab(type: NotificationType): 'comments' | 'details' {
  return type === 'mention' || type === 'comment' ? 'comments' : 'details'
}

/** Endereço que a notificação abre: a tarefa (na aba certa) ou o painel do elemento no quadro. */
export function notificationLink(notification: AppNotification): string | null {
  if (notification.planItem) return `/projects/${encodeURIComponent(notification.planItem.projectId)}?tab=plan&item=${encodeURIComponent(notification.planItem.id)}`
  if (!notification.task) return null
  return `/tasks/${notification.task.id}${notificationTab(notification.type) === 'comments' ? '?tab=comments' : ''}`
}
