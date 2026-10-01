import { Navigate, useParams } from 'react-router'
import { useSession } from '@/features/auth/session'
import { visibleNavItems } from '@/presentation/navigation/nav-items'

/** /backlog/:id → /planning/:id (a tela se chamava Backlog). */
export function LegacyBacklogRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/planning/${encodeURIComponent(projectId ?? '')}`} replace />
}

/** /settings → a primeira tela de Configurações que a pessoa pode abrir (na ordem do menu). */
export function SettingsIndexRedirect() {
  const { current } = useSession()
  const settings = visibleNavItems(current?.permissions ?? []).find((item) => item.id === 'settings')
  return <Navigate to={settings?.children?.[0]?.to ?? '/dashboard'} replace />
}
