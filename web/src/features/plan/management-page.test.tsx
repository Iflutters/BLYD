import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import i18n from '@/core/i18n'
import type { Plan } from '@/domain/plan'
import { fakeRepositories, makeCurrentUser, renderRoutes } from '@/test/utils'
import { ProjectManagementPage } from './ProjectManagementPage'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})
beforeEach(() => window.localStorage.clear())

const plan: Plan = {
  project: { id: 'p1', key: 'SB', name: 'Somax BR', archived: false },
  capabilities: { edit: true, manage: true },
  statuses: [],
  resources: [],
  groups: [],
  items: [],
  columns: [],
  links: [],
  settings: { dependencyRule: 'warn', baselineAt: null },
  summary: null,
  truncated: false,
}

function setup(initialPath: string) {
  const repositories = fakeRepositories({ auth: { me: async () => makeCurrentUser(['plan.view', 'projects.view']) }, plan: { get: () => Promise.resolve(plan) } })
  const routes = [
    { path: '/project-management', element: <ProjectManagementPage /> },
    { path: '/project-management/:projectId', element: <ProjectManagementPage /> },
  ]
  return renderRoutes(routes, { repositories, initialPath })
}

describe('Gestão de projetos (item próprio do menu)', () => {
  it('sem projeto escolhido: pede para escolher', async () => {
    setup('/project-management')
    expect(await screen.findByRole('heading', { name: 'Escolha um projeto' })).toBeInTheDocument()
  })

  it('mostra o quadro do projeto com o nome no cabeçalho e lembra o último projeto aberto', async () => {
    const first = setup('/project-management/p1')
    expect(await screen.findByRole('heading', { name: 'Gestão de projetos' })).toBeInTheDocument()
    expect(await screen.findByText('Somax BR')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Visões do quadro' })).toBeInTheDocument()
    first.unmount()
    const { router } = setup('/project-management')
    await waitFor(() => expect(router.state.location.pathname).toBe('/project-management/p1'))
  })
})
