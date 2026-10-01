import { Navigate, useParams } from 'react-router'

/** /backlog/:id → /planning/:id (a tela se chamava Backlog). */
export function LegacyBacklogRedirect() {
  const { projectId } = useParams()
  return <Navigate to={`/planning/${encodeURIComponent(projectId ?? '')}`} replace />
}
