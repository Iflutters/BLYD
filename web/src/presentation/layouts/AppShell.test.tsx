import { beforeAll, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/core/i18n'
import { GuestOnly, RequireAuth } from '@/features/auth/guards'
import { env } from '@/core/config/env'
import { DEFAULT_PLATFORM_INFO } from '@/domain/platform'
import { fakeRepositories, makeCurrentUser, renderRoutes } from '@/test/utils'
import { AppShell } from './AppShell'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

describe('AppShell — sair', () => {
  it('"Sair" encerra a sessão e leva ao login (sem voltar para a página anterior)', async () => {
    let signedIn = true
    const repositories = fakeRepositories({
      auth: {
        me: async () => (signedIn ? makeCurrentUser(['tasks.view']) : null),
        logout: async () => {
          signedIn = false
        },
      },
    })
    const { router } = renderRoutes(
      [
        { path: '/login', element: <GuestOnly>Tela de login</GuestOnly> },
        {
          path: '/',
          element: (
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          ),
          children: [{ path: 'planning', element: <p>Planejamento aberto</p> }],
        },
      ],
      { repositories, initialPath: '/planning' },
    )
    expect(await screen.findByText('Planejamento aberto')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Menu da conta' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sair' }))
    expect(await screen.findByText('Tela de login')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toBe('')
  })
})

describe('AppShell — rodapé do menu', () => {
  it('mostra a versão do produto (package.json) e o copyright com o nome da plataforma', async () => {
    // gravada no build a partir do package.json (vite.config.ts)
    const version = env.appVersion
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
    const repositories = fakeRepositories({
      auth: { me: async () => makeCurrentUser(['tasks.view']) },
      platform: { getInfo: () => Promise.resolve({ ...DEFAULT_PLATFORM_INFO, name: 'Portal da Obra' }) },
    })
    renderRoutes([{ path: '/', element: <RequireAuth><AppShell /></RequireAuth>, children: [{ path: 'planning', element: <p>Planejamento aberto</p> }] }], {
      repositories,
      initialPath: '/planning',
    })
    expect(await screen.findByText(`Versão ${version}`)).toBeInTheDocument()
    expect(await screen.findByText(`© ${new Date().getFullYear()} Portal da Obra`)).toBeInTheDocument()
  })
})
