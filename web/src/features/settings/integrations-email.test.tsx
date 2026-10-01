import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/core/i18n'
import { AppError } from '@/core/errors/app-error'
import { EMAIL_DEFAULTS, type EmailSettingsView, type OutboxSummary } from '@/domain/email'
import { DEFAULT_PASSWORD_POLICY, DEFAULT_PLATFORM_INFO } from '@/domain/platform'
import type { AuthRepository, EmailRepository, UserRepository } from '@/domain/repositories'
import { notify } from '@/presentation/components'
import { fakeRepositories, makeCurrentUser, makeRole, makeUser, renderRoutes } from '@/test/utils'
import { IntegrationsPage } from './IntegrationsPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { UserFormDialog } from '@/features/users/UserFormDialog'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})
afterEach(() => vi.restoreAllMocks())

const VIEW: EmailSettingsView = {
  values: { ...EMAIL_DEFAULTS, enabled: true, host: 'smtp.empresa.com', senderAddress: 'portal@empresa.com', appUrl: 'https://kamban.empresa.com' },
  hasPassword: true,
}
const OUTBOX: OutboxSummary = {
  counts: { pending: 1, sent: 3, failed: 0 },
  recent: [{ id: 'm1', to: 'ana@empresa.com', kind: 'password_reset', subject: 'Redefinir', status: 'pending', attempts: 1, lastError: '451 fora do ar', createdAt: new Date('2026-10-01T12:00:00Z'), sentAt: null }],
}

function setupIntegrations(email: Partial<EmailRepository> = {}) {
  const updateSettings = vi.fn<EmailRepository['updateSettings']>(() => Promise.resolve(VIEW))
  const repositories = fakeRepositories({
    auth: { me: async () => makeCurrentUser(['integrations.manage']) },
    email: { getSettings: () => Promise.resolve(VIEW), outbox: () => Promise.resolve(OUTBOX), updateSettings, ...email },
  })
  renderRoutes([{ path: '/settings/integrations', element: <IntegrationsPage /> }], { repositories, initialPath: '/settings/integrations' })
  return { updateSettings }
}

describe('Integrações — e-mail', () => {
  it('salva só o que mudou; senha vazia mantém a salva; "Remover senha salva" apaga', async () => {
    const { updateSettings } = setupIntegrations()
    const host = await screen.findByLabelText(/^Servidor/)
    expect(host).toHaveValue('smtp.empresa.com')
    expect(screen.getByLabelText(/^Senha/)).toHaveAttribute('placeholder', '•••••••• (salva)')
    await userEvent.clear(host)
    await userEvent.type(host, 'smtp.novo.com')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ host: 'smtp.novo.com' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover senha salva' }))
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ password: null }))
  })

  it('ligado sem endereço da plataforma não salva', async () => {
    const { updateSettings } = setupIntegrations()
    const url = await screen.findByLabelText(/^Endereço da plataforma/)
    await userEvent.clear(url)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Campo obrigatório')).toBeInTheDocument()
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('teste com falha mostra o motivo do servidor; fila mostra contagens, o erro e envia agora', async () => {
    const error = vi.spyOn(notify, 'error')
    const success = vi.spyOn(notify, 'success')
    const flush = vi.fn<EmailRepository['flush']>(() => Promise.resolve({ sent: 1, failed: 0, retrying: 0 }))
    setupIntegrations({
      sendTest: () => Promise.reject(new AppError({ code: 'EMAIL_SEND_FAILED', message: 'x', status: 502, details: { reason: '535 auth failed' } })),
      flush,
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Enviar e-mail de teste' }))
    await waitFor(() => expect(error).toHaveBeenCalledWith('O servidor de e-mail recusou: 535 auth failed'))
    expect(await screen.findByText('1 na fila')).toBeInTheDocument()
    expect(screen.getByText('3 enviados')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Fila de envio' })
    expect(within(table).getByText('Redefinição de senha')).toBeInTheDocument()
    expect(within(table).getByText('451 fora do ar')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar agora' }))
    await waitFor(() => expect(flush).toHaveBeenCalled())
    await waitFor(() => expect(success).toHaveBeenCalledWith('Fila processada: 1 enviado(s), 0 com falha.'))
  })
})

describe('Esqueci minha senha e nova senha', () => {
  const withEmail = { getInfo: () => Promise.resolve({ ...DEFAULT_PLATFORM_INFO, passwordReset: true }) }

  it('login sem envio de e-mail: "Esqueci minha senha" pede para contatar o administrador', async () => {
    renderRoutes([{ path: '/login', element: <LoginPage /> }], { repositories: fakeRepositories(), initialPath: '/login' })
    await screen.findByRole('button', { name: 'Entrar' })
    expect(screen.queryByRole('link', { name: 'Esqueci minha senha' })).not.toBeInTheDocument()
    expect(screen.queryByText('Contate o administrador para trocar a senha')).not.toBeInTheDocument()
    const forgot = screen.getByRole('button', { name: 'Esqueci minha senha' })
    expect(forgot).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(forgot)
    expect(screen.getByText('Contate o administrador para trocar a senha')).toBeInTheDocument()
    expect(forgot).toHaveAttribute('aria-expanded', 'true')
  })

  it('login com envio de e-mail: "Esqueci minha senha" leva ao pedido do link', async () => {
    renderRoutes([{ path: '/login', element: <LoginPage /> }], { repositories: fakeRepositories({ platform: withEmail }), initialPath: '/login' })
    expect(await screen.findByRole('link', { name: 'Esqueci minha senha' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.queryByRole('button', { name: 'Esqueci minha senha' })).not.toBeInTheDocument()
  })

  it('página do pedido aberta sem envio de e-mail: orienta a falar com o administrador, sem formulário', async () => {
    const requestPasswordReset = vi.fn<AuthRepository['requestPasswordReset']>(() => Promise.resolve())
    renderRoutes([{ path: '/forgot-password', element: <ForgotPasswordPage /> }], { repositories: fakeRepositories({ auth: { requestPasswordReset } }), initialPath: '/forgot-password' })
    expect(await screen.findByText('Contate o administrador para trocar a senha')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar link' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para o login' })).toHaveAttribute('href', '/login')
    expect(requestPasswordReset).not.toHaveBeenCalled()
  })

  it('pedido mostra a mesma confirmação exista ou não a conta', async () => {
    const requestPasswordReset = vi.fn<AuthRepository['requestPasswordReset']>(() => Promise.resolve())
    renderRoutes([{ path: '/forgot-password', element: <ForgotPasswordPage /> }], { repositories: fakeRepositories({ auth: { requestPasswordReset }, platform: withEmail }), initialPath: '/forgot-password' })
    await userEvent.type(await screen.findByLabelText(/^E-mail/), 'ana@empresa.com')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))
    expect(await screen.findByText(/Se ana@empresa\.com tiver uma conta, o link chega em instantes/)).toBeInTheDocument()
    expect(requestPasswordReset).toHaveBeenCalledWith('ana@empresa.com')
  })

  it('link válido: dica pela política, salva e volta ao login; link vencido pede outro', async () => {
    const confirmPasswordReset = vi.fn<AuthRepository['confirmPasswordReset']>(() => Promise.resolve({ purpose: 'invite' }))
    const checkResetToken = vi.fn<AuthRepository['checkResetToken']>((token) =>
      Promise.resolve(
        token === 'bom'
          ? { valid: true, state: 'valid', purpose: 'invite', name: 'Bia', policy: { ...DEFAULT_PASSWORD_POLICY, minLength: 12, requireSymbol: true } }
          : { valid: false, state: 'expired', purpose: null, name: null, policy: null },
      ),
    )
    const repositories = fakeRepositories({ auth: { checkResetToken, confirmPasswordReset }, platform: withEmail })
    const routes = [
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/login', element: <p>tela de login</p> },
    ]
    const { router } = renderRoutes(routes, { repositories, initialPath: '/reset-password?token=bom' })
    expect(await screen.findByRole('heading', { name: 'Crie sua senha' })).toBeInTheDocument()
    expect(screen.getByText('Olá, Bia.')).toBeInTheDocument()
    expect(screen.getByText('Mínimo de 12 caracteres, com letras e números e um símbolo.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'SenhaDaBia1234#')
    await userEvent.type(screen.getByLabelText(/^Confirme a nova senha/), 'SenhaDaBia1234#')
    await userEvent.click(screen.getByRole('button', { name: 'Criar senha' }))
    await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalledWith('bom', 'SenhaDaBia1234#'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))

    renderRoutes(routes, { repositories, initialPath: '/reset-password?token=velho' })
    expect(await screen.findByText('Este link venceu. Peça um novo.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pedir um link novo' })).toHaveAttribute('href', '/forgot-password')
  })
})

describe('Convite na criação do usuário', () => {
  it('com e-mail ligado, o convite vem marcado e dispensa a senha', async () => {
    const create = vi.fn<UserRepository['create']>((data) => Promise.resolve(makeUser({ email: data.email })))
    const repositories = fakeRepositories({
      auth: { me: async () => makeCurrentUser(['users.create', 'users.edit']) },
      users: { create },
      platform: { getInfo: () => Promise.resolve({ ...DEFAULT_PLATFORM_INFO, passwordReset: true }) },
    })
    const role = makeRole({ id: 'role-member', code: 'MEMBER', name: 'Membro' })
    renderRoutes([{ path: '/', element: <UserFormDialog open onOpenChange={() => {}} user={null} roles={[role]} canChangeAccess /> }], { repositories, initialPath: '/' })
    const invite = await screen.findByRole('switch', { name: /Enviar convite por e-mail/ })
    await waitFor(() => expect(invite).toBeChecked())
    expect(screen.queryByLabelText(/^Senha/)).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/^Nome/), 'Bia')
    await userEvent.type(screen.getByLabelText(/^E-mail/), 'bia@empresa.com')
    await userEvent.click(screen.getByRole('button', { name: 'Novo usuário' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ email: 'bia@empresa.com', sendInvite: true, password: undefined })))
  })
})
