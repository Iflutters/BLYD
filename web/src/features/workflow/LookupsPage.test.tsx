import { beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/core/i18n'
import type { LookupRepository } from '@/domain/repositories'
import type { TaskStatus } from '@/domain/workflow'
import { fakeRepositories, renderRoutes } from '@/test/utils'
import { StatusesPage } from './LookupsPage'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

function status(overrides: Partial<TaskStatus>): TaskStatus {
  return {
    id: 's1',
    key: 'BACKLOG',
    name: 'Backlog',
    description: '',
    color: 'gray',
    order: 0,
    isActive: true,
    isDefault: false,
    category: 'backlog',
    createdAt: null,
    updatedAt: null,
    ...overrides,
  }
}

const backlog = status({ isDefault: true })
const dev = status({ id: 's2', key: 'DEV', name: 'Desenvolvimento', category: 'in_progress', color: 'amber', order: 1 })

function setup(overrides: Partial<LookupRepository<TaskStatus>> = {}) {
  const update = vi.fn<LookupRepository<TaskStatus>['update']>(() => Promise.resolve(dev))
  const create = vi.fn<LookupRepository<TaskStatus>['create']>(() => Promise.resolve(dev))
  const repositories = fakeRepositories({ statuses: { list: () => Promise.resolve([backlog, dev]), update, create, ...overrides } })
  renderRoutes([{ path: '/settings/statuses', element: <StatusesPage /> }], { repositories, initialPath: '/settings/statuses' })
  return { update, create }
}

describe('StatusesPage', () => {
  it('lista com o padrão marcado e a categoria de cada status', async () => {
    setup()
    expect(await screen.findByText('Desenvolvimento')).toBeInTheDocument()
    expect(screen.getByText('Padrão')).toBeInTheDocument()
    expect(screen.getByText('Em andamento')).toBeInTheDocument()
  })

  it('o padrão não oferece desativar/excluir; outro item pode virar padrão', async () => {
    const { update } = setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Ações de Backlog' }))
    let menu = await screen.findByRole('menu')
    expect(within(menu).queryByRole('menuitem', { name: 'Excluir' })).not.toBeInTheDocument()
    expect(within(menu).queryByRole('menuitem', { name: 'Desativar' })).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')

    await userEvent.click(screen.getByRole('button', { name: 'Ações de Desenvolvimento' }))
    menu = await screen.findByRole('menu')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Tornar padrão' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith('s2', { isDefault: true }))
  })

  it('cria status com chave derivada do nome e categoria', async () => {
    const { create } = setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Novo status' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^Nome/), 'Em revisão')
    expect(within(dialog).getByLabelText(/^Chave/)).toHaveValue('EM_REVISAO')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    expect(create.mock.calls[0]?.[0]).toMatchObject({ key: 'EM_REVISAO', name: 'Em revisão', category: 'todo', isActive: true, isDefault: false })
  })

  it('Kanban: limite WIP e destinos permitidos (sem o próprio status)', async () => {
    const { update } = setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Ações de Backlog' }))
    await userEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Editar' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^Limite WIP/), '3x')
    expect(within(dialog).getByLabelText(/^Limite WIP/)).toHaveValue('3')
    await userEvent.click(within(dialog).getByRole('combobox', { name: /^Pode ir para/ }))
    const listbox = await screen.findByRole('listbox')
    expect(within(listbox).queryByRole('option', { name: 'Backlog' })).not.toBeInTheDocument()
    await userEvent.click(within(within(listbox).getByRole('option', { name: 'Desenvolvimento' })).getByRole('button'))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(update).toHaveBeenCalledOnce())
    expect(update.mock.calls[0]?.[1]).toMatchObject({ wipLimit: 3, allowedNext: ['s2'] })
  })

  it('marcar como padrão liga "Ativo" e trava o interruptor', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Novo status' }))
    const dialog = await screen.findByRole('dialog')
    const active = within(dialog).getByRole('switch', { name: /^Ativo/ })
    await userEvent.click(active)
    expect(active).not.toBeChecked()
    await userEvent.click(within(dialog).getByRole('switch', { name: /^Padrão/ }))
    expect(active).toBeChecked()
    expect(active).toBeDisabled()
  })
})
