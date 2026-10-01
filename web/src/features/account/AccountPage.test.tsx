import { beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/core/i18n'
import { AppError } from '@/core/errors/app-error'
import { fakeRepositories, makeCurrentUser, renderRoutes } from '@/test/utils'
import { AccountPage } from './AccountPage'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

function setup(changePassword = vi.fn().mockResolvedValue({ otherSessionsRevoked: 2 })) {
  const repositories = fakeRepositories({ auth: { me: async () => makeCurrentUser([]), changePassword } })
  renderRoutes([{ path: '/account', element: <AccountPage /> }], { repositories, initialPath: '/account' })
  return { changePassword }
}

async function fill(current: string, next: string, confirm: string) {
  await userEvent.type(await screen.findByLabelText(/^Senha atual/), current)
  await userEvent.type(screen.getByLabelText(/^Nova senha/), next)
  await userEvent.type(screen.getByLabelText(/^Confirme a nova senha/), confirm)
  await userEvent.click(screen.getByRole('button', { name: 'Trocar senha' }))
}

describe('Minha conta — troca de senha', () => {
  it('valida confirmação e política antes de chamar a API', async () => {
    const { changePassword } = setup()
    await fill('SenhaAtual123', 'NovaSenha123', 'Diferente123')
    expect(await screen.findByText('As senhas não conferem')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('envia a troca e limpa o formulário', async () => {
    const { changePassword } = setup()
    await fill('SenhaAtual123', 'NovaSenha123', 'NovaSenha123')
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('SenhaAtual123', 'NovaSenha123'))
    await waitFor(() => expect(screen.getByLabelText(/^Senha atual/)).toHaveValue(''))
  })

  it('mostra no campo o erro de senha atual incorreta vindo da API', async () => {
    setup(
      vi.fn().mockRejectedValue(
        new AppError({ code: 'VALIDATION_ERROR', message: 'x', status: 400, details: { fields: { current_password: 'incorrect' } } }),
      ),
    )
    await fill('Errada12345', 'NovaSenha123', 'NovaSenha123')
    expect(await screen.findByText('Senha atual incorreta')).toBeInTheDocument()
  })
})
