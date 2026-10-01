import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AppSelect } from '@/presentation/components'
import { useProjects } from './queries'

const PROJECT_QUERY = { view: 'all' as const, page: 1, perPage: 100, sort: { id: 'name', direction: 'asc' as const }, search: '', filters: {} }

/** Troca o projeto de uma visão por projeto (Kanban, Backlog): navega para `${basePath}/:id`. */
export function ProjectSwitcher({ projectId, basePath, className }: { projectId?: string; basePath: string; className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const projects = useProjects(PROJECT_QUERY)
  const options = (projects.data?.items ?? []).filter((p) => !p.archivedAt || p.id === projectId).map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))
  return (
    <AppSelect
      className={className ?? 'w-full sm:w-72'}
      aria-label={t('projects.switcher')}
      value={projectId}
      placeholder={t('projects.chooseProject')}
      onValueChange={(id) => void navigate(`${basePath}/${encodeURIComponent(id)}`)}
      options={options}
    />
  )
}
