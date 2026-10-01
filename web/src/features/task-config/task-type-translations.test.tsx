import { beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/core/i18n'
import type { TaskTypeDetail } from '@/domain/task-config'
import { fakeRepositories, renderRoutes } from '@/test/utils'
import { TaskTypeFormDialog } from './TaskTypesPage'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

// como a API devolve com a tela em espanhol: nome exibido traduzido, versões completas para edição
const suporte: TaskTypeDetail = {
  id: 't1',
  key: 'SUPORTE',
  name: 'Soporte',
  description: 'Atención y dudas',
  translations: {
    'pt-BR': { name: 'Suporte', description: 'Atendimento e dúvidas' },
    en: { name: 'Support', description: '' },
    es: { name: 'Soporte', description: 'Atención y dudas' },
  },
  icon: 'life-buoy',
  color: 'orange',
  order: 0,
  isActive: true,
  fieldCount: 0,
  createdAt: null,
  updatedAt: null,
  fields: [],
}

describe('TaskTypeFormDialog — traduções', () => {
  it('edita o original em português e as traduções opcionais em inglês e espanhol', async () => {
    const update = vi.fn().mockResolvedValue(suporte)
    renderRoutes([{ path: '/', element: <TaskTypeFormDialog open type={suporte} onOpenChange={() => {}} /> }], {
      repositories: fakeRepositories({ taskTypes: { update } }),
      initialPath: '/',
    })

    const dialog = await screen.findByRole('dialog', { name: 'Editar tipo de tarefa' })
    // o campo principal traz o original, não o texto traduzido que está na tela
    expect(within(dialog).getAllByLabelText(/^Nome/)[0]).toHaveValue('Suporte')
    const english = within(dialog).getByRole('group', { name: 'English' })
    const spanish = within(dialog).getByRole('group', { name: 'Español' })
    expect(within(english).getByLabelText(/^Nome/)).toHaveValue('Support')
    // em branco mostra o original como dica
    expect(within(english).getByLabelText(/^Descrição/)).toHaveAttribute('placeholder', 'Atendimento e dúvidas')

    await userEvent.clear(within(spanish).getByLabelText(/^Nome/))
    await userEvent.type(within(spanish).getByLabelText(/^Nome/), 'Soporte técnico')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(update).toHaveBeenCalledOnce())
    expect(update.mock.calls[0]?.[1]).toMatchObject({
      name: 'Suporte',
      description: 'Atendimento e dúvidas',
      translations: { en: { name: 'Support', description: '' }, es: { name: 'Soporte técnico', description: 'Atención y dudas' } },
    })
  })
})
