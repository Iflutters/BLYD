import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/core/i18n'
import type { Attachment } from '@/domain/attachments'
import type { AttachmentRepository } from '@/domain/repositories'
import type { TaskDetail } from '@/domain/tasks'
import { fakeRepositories, renderWithProviders } from '@/test/utils'
import { TaskAttachments } from './TaskAttachments'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

function attachment(overrides: Partial<Attachment>): Attachment {
  return {
    id: 'a1',
    taskId: 'k1',
    commentId: null,
    name: 'tela.png',
    mime: 'image/png',
    kind: 'image',
    size: 2048,
    uploadedBy: { id: 'u1', name: 'Mário', email: 'm@x.com', avatarUrl: null },
    createdAt: new Date('2026-09-28T10:00:00Z'),
    url: '/api/v1/attachments/a1/file',
    capabilities: { delete: true },
    ...overrides,
  }
}

const list = [
  attachment({}),
  attachment({ id: 'a2', name: 'erro.jpg', mime: 'image/jpeg', url: '/api/v1/attachments/a2/file' }),
  attachment({ id: 'a3', name: 'contrato.pdf', mime: 'application/pdf', kind: 'document', size: 1536, url: '/api/v1/attachments/a3/file' }),
]

const task = {
  id: 'k1',
  capabilities: { edit: true, delete: false, assign: true, comment: true },
} as TaskDetail

function setup(detail: TaskDetail = task, overrides: Partial<AttachmentRepository> = {}) {
  const upload = vi.fn<AttachmentRepository['upload']>(() => Promise.resolve([attachment({ id: 'a9' })]))
  renderWithProviders(<TaskAttachments task={detail} />, fakeRepositories({ attachments: { list: () => Promise.resolve(list), upload, ...overrides } }))
  return { upload }
}

describe('TaskAttachments', () => {
  it('separa galeria de imagens e documentos com tamanho e download', async () => {
    setup()
    expect(await screen.findByText('Imagens (2)')).toBeInTheDocument()
    expect(screen.getByText('Documentos (1)')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'tela.png' })).toHaveAttribute('loading', 'lazy')
    expect(screen.getByRole('link', { name: 'Baixar contrato.pdf' })).toHaveAttribute('href', '/api/v1/attachments/a3/file?download=1')
    expect(screen.getByText(/1,5 KB/)).toBeInTheDocument()
  })

  it('envia arquivos válidos e recusa no navegador os de tipo proibido', async () => {
    const { upload } = setup()
    await screen.findByText('Imagens (2)')
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    const pdf = new File(['%PDF-1.4'], 'manual.pdf', { type: 'application/pdf' })
    const exe = new File(['MZ'], 'setup.exe', { type: 'application/octet-stream' })
    fireEvent.change(input, { target: { files: [pdf, exe] } })
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    expect(upload.mock.calls[0]?.[1].name).toBe('manual.pdf')
    expect(await screen.findByText(/Tipo de arquivo não permitido/)).toBeInTheDocument()
  })

  it('erro do servidor aparece no arquivo (ex.: conteúdo diferente da extensão)', async () => {
    const { AppError } = await import('@/core/errors/app-error')
    setup(task, {
      upload: () => Promise.reject(new AppError({ code: 'VALIDATION_ERROR', message: 'x', status: 400, details: { fields: { files: 'type_mismatch' } } })),
    })
    await screen.findByText('Imagens (2)')
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] } })
    expect(await screen.findByText(/não corresponde à extensão/)).toBeInTheDocument()
  })

  it('leitor não vê a área de envio', async () => {
    setup({ ...task, capabilities: { ...task.capabilities, edit: false } })
    await screen.findByText('Imagens (2)')
    expect(screen.queryByRole('button', { name: 'escolha no computador' })).not.toBeInTheDocument()
  })

  it('visualizador: abre na imagem clicada, navega pelas setas e mostra o contador', async () => {
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir erro.jpg' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('2 de 2')).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'erro.jpg' })).toBeInTheDocument()
    await userEvent.keyboard('{ArrowRight}')
    expect(within(dialog).getByRole('img', { name: 'tela.png' })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar zoom' }))
    expect(within(dialog).getByText('150%')).toBeInTheDocument()
  })
})
