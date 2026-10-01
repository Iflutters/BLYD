import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/core/i18n'
import type { Webhook } from '@/domain/webhooks'
import type { WebhookRepository } from '@/domain/repositories'
import { notify } from '@/presentation/components'
import { fakeRepositories, makeCurrentUser, renderRoutes } from '@/test/utils'
import { IntegrationsPage } from './IntegrationsPage'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})
afterEach(() => vi.restoreAllMocks())

const CATALOG = { events: ['task.created', 'task.updated', 'comment.added'], groups: ['task', 'comment'] }
const HOOK: Webhook = {
  id: 'w1',
  name: 'CRM externo',
  url: 'https://hooks.empresa.com/kamban',
  events: ['task.*'],
  active: true,
  lastStatus: 200,
  lastDeliveryAt: new Date('2026-10-01T12:00:00Z'),
  consecutiveFailures: 0,
  createdAt: null,
}

async function open(webhooks: Partial<WebhookRepository>) {
  const repositories = fakeRepositories({
    auth: { me: async () => makeCurrentUser(['integrations.manage']) },
    email: { getSettings: () => new Promise(() => {}), outbox: () => new Promise(() => {}) },
    webhooks: { catalog: () => Promise.resolve(CATALOG), ...webhooks },
  })
  renderRoutes([{ path: '/settings/integrations', element: <IntegrationsPage /> }], { repositories, initialPath: '/settings/integrations' })
  await userEvent.click(await screen.findByRole('tab', { name: 'Webhooks' }))
}

describe('Integrações — webhooks', () => {
  it('criar: nome, endereço e eventos (grupo inteiro); o segredo aparece uma vez', async () => {
    const create = vi.fn<WebhookRepository['create']>((input) => Promise.resolve({ ...HOOK, ...input, id: 'w2', secret: 'whsec_' + 'a'.repeat(32) }))
    await open({ create })
    await userEvent.click(await screen.findByRole('button', { name: 'Novo webhook' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Novo webhook' }))
    expect(within(dialog).getAllByText('Campo obrigatório').length).toBeGreaterThanOrEqual(2)
    expect(create).not.toHaveBeenCalled()
    await userEvent.type(within(dialog).getByLabelText(/^Nome/), 'CRM externo')
    await userEvent.type(within(dialog).getByLabelText(/^Endereço que recebe/), 'https://hooks.empresa.com/kamban')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Tudo de Tarefas' }))
    expect(within(dialog).getByRole('checkbox', { name: /Criou a tarefa/ })).toBeChecked()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Novo webhook' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'CRM externo', url: 'https://hooks.empresa.com/kamban', events: ['task.*'], active: true }))
    expect(await screen.findByDisplayValue('whsec_' + 'a'.repeat(32))).toBeInTheDocument()
  })

  it('lista com a situação; "Enviar teste" mostra o resultado; entregas com reenvio', async () => {
    const success = vi.spyOn(notify, 'success')
    const test = vi.fn<WebhookRepository['test']>(() =>
      Promise.resolve({ id: 'd9', webhookId: 'w1', event: 'webhook.ping', status: 'success', attempts: 1, responseStatus: 200, responseBody: 'ok', error: null, durationMs: 12, nextAttemptAt: null, deliveredAt: new Date(), createdAt: new Date() }),
    )
    const failed = { id: 'd1', webhookId: 'w1', event: 'task.created', status: 'failed' as const, attempts: 6, responseStatus: 500, responseBody: 'erro', error: 'HTTP 500', durationMs: 30, nextAttemptAt: null, deliveredAt: new Date('2026-10-01T12:00:00Z'), createdAt: new Date('2026-10-01T11:00:00Z') }
    const redeliver = vi.fn<WebhookRepository['redeliver']>(() => Promise.resolve({ ...failed, status: 'success', responseStatus: 200, error: null }))
    await open({ list: () => Promise.resolve([HOOK]), test, deliveries: () => Promise.resolve([failed]), redeliver })
    expect(await screen.findByText('CRM externo')).toBeInTheDocument()
    expect(screen.getByText('2 eventos')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Enviar teste' }))
    await waitFor(() => expect(success).toHaveBeenCalledWith('Teste entregue (HTTP 200).'))
    await userEvent.click(screen.getByRole('button', { name: 'Visualizar' }))
    const drawer = await screen.findByRole('dialog', { name: /Entregas — CRM externo/ })
    expect(await within(drawer).findByText('HTTP 500')).toBeInTheDocument()
    await userEvent.click(within(drawer).getByRole('button', { name: 'Reenviar' }))
    await waitFor(() => expect(redeliver).toHaveBeenCalledWith('d1'))
  })
})
