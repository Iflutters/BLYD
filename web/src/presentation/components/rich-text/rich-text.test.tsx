import { beforeAll, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/core/i18n'
import type { RichContent } from '@/domain/docs'
import { renderWithProviders } from '@/test/utils'
import { filterBlockCommands } from './block-commands'
import { AppRichTextEditor, AppRichTextView } from './index'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

const text = (value: string, marks?: RichContent['marks']): RichContent => (marks ? { type: 'text', text: value, marks } : { type: 'text', text: value })
const paragraph = (...content: RichContent[]): RichContent => ({ type: 'paragraph', content })
const cell = (type: 'tableHeader' | 'tableCell', value: string): RichContent => ({ type, content: [paragraph(text(value))] })

const DOC: RichContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [text('Cadastro')] },
    paragraph(text('Veja o '), text('guia', [{ type: 'link', attrs: { href: '/docs/MANUAL/abc123' } }]), text(' e o '), text('site', [{ type: 'link', attrs: { href: 'https://exemplo.com' } }])),
    { type: 'callout', attrs: { tone: 'warning' }, content: [paragraph(text('Valide o CNPJ antes de salvar.'))] },
    {
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('tableHeader', 'Campo'), cell('tableHeader', 'Regra')] },
        { type: 'tableRow', content: [cell('tableCell', 'CNPJ'), cell('tableCell', 'Obrigatório')] },
      ],
    },
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('Revisado'))] }] },
    { type: 'image', attrs: { src: '/api/v1/docs/files/abcdefghijklmno', alt: 'Tela de cadastro', width: 50 } },
  ],
}

describe('AppRichTextView', () => {
  it('mostra os blocos do documento como no editor (título, aviso, tabela, checklist, imagem)', async () => {
    renderWithProviders(<AppRichTextView content={DOC} />)
    expect(await screen.findByRole('heading', { level: 2, name: 'Cadastro' })).toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'Atenção' })).toHaveTextContent('Valide o CNPJ antes de salvar.')
    expect(screen.getByRole('table')).toHaveTextContent('CampoRegraCNPJObrigatório')
    expect(screen.getByRole('checkbox')).toBeChecked()
    const image = screen.getByRole('img', { name: 'Tela de cadastro' })
    expect(image).toHaveAttribute('src', '/api/v1/docs/files/abcdefghijklmno')
    expect(image).toHaveStyle({ width: '50%' })
    // somente leitura, e não se anuncia como campo de texto
    expect(document.querySelector('[contenteditable="true"]')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('link interno navega dentro da aplicação; externo abre em outra aba sem opener', async () => {
    const onNavigate = vi.fn()
    renderWithProviders(<AppRichTextView content={DOC} onNavigate={onNavigate} />)
    const external = await screen.findByRole('link', { name: 'site' })
    expect(external).toHaveAttribute('target', '_blank')
    expect(external.getAttribute('rel')).toContain('noopener')
    await userEvent.click(screen.getByRole('link', { name: 'guia' }))
    expect(onNavigate).toHaveBeenCalledWith('/docs/MANUAL/abc123')
  })
})

describe('AppRichTextEditor', () => {
  it('barra de ferramentas acessível; formatar pela barra devolve o JSON atualizado', async () => {
    const onChange = vi.fn()
    renderWithProviders(<AppRichTextEditor label="Conteúdo" defaultValue={{ type: 'doc', content: [paragraph(text('Primeiro passo'))] }} onChange={onChange} />)
    expect(await screen.findByRole('textbox', { name: 'Conteúdo' })).toHaveTextContent('Primeiro passo')
    const toolbar = screen.getByRole('toolbar', { name: 'Formatação' })
    expect(toolbar).toBeInTheDocument()
    // sem envio de arquivos, a barra não oferece imagem
    expect(screen.queryByRole('button', { name: 'Imagem' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Lista com marcadores' }))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const doc = onChange.mock.lastCall?.[0] as RichContent
    expect(doc.content?.[0]?.type).toBe('bulletList')
    expect(screen.getByRole('button', { name: 'Lista com marcadores' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('com envio de arquivos, oferece imagem; menu "Inserir" traz tabela, aviso e sumário', async () => {
    const onChange = vi.fn()
    renderWithProviders(<AppRichTextEditor label="Conteúdo" defaultValue={{ type: 'doc', content: [paragraph()] }} onChange={onChange} onUpload={async () => []} />)
    expect(await screen.findByRole('button', { name: 'Imagem' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Inserir' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Tabela' }))
    await waitFor(() => expect(JSON.stringify(onChange.mock.lastCall?.[0])).toContain('"tableHeader"'))
  })
})

describe('sumário (tableOfContents)', () => {
  const TOC_ONLY: RichContent = { type: 'doc', content: [{ type: 'tableOfContents' }, paragraph(text('Texto comum'))] }

  it('sem títulos, explica como criar e cria um Título 2 logo abaixo', async () => {
    const onChange = vi.fn()
    renderWithProviders(<AppRichTextEditor label="Conteúdo" defaultValue={TOC_ONLY} onChange={onChange} />)
    const toc = await screen.findByRole('navigation', { name: 'Sumário' })
    expect(toc).toHaveTextContent('se monta sozinho com os títulos desta página')
    await userEvent.click(within(toc).getByRole('button', { name: 'Adicionar título' }))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const doc = onChange.mock.lastCall?.[0] as RichContent
    expect(doc.content?.map((n) => n.type)).toEqual(['tableOfContents', 'heading', 'paragraph'])
    expect(doc.content?.[1]?.attrs?.level).toBe(2)
  })

  it('lista os títulos da página; na leitura sem títulos não aparece', async () => {
    const withHeadings: RichContent = { type: 'doc', content: [{ type: 'tableOfContents' }, { type: 'heading', attrs: { level: 2 }, content: [text('Instalação')] }, { type: 'heading', attrs: { level: 3 }, content: [text('Requisitos')] }] }
    const { unmount } = renderWithProviders(<AppRichTextView content={withHeadings} />)
    const toc = await screen.findByRole('navigation', { name: 'Sumário' })
    expect(within(toc).getAllByRole('button').map((b) => b.textContent)).toEqual(['Instalação', 'Requisitos'])
    unmount()
    renderWithProviders(<AppRichTextView content={TOC_ONLY} />)
    expect(await screen.findByText('Texto comum')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Sumário' })).toBeNull()
  })
})

describe('menu "/"', () => {
  const label = (key: string) => i18n.t(`richText.blocks.${key}.label`)
  it('filtra pelo nome traduzido e por termos sem acento', () => {
    expect(filterBlockCommands('tab', label).map((c) => c.key)).toEqual(['table'])
    expect(filterBlockCommands('atencao', label).map((c) => c.key)).toContain('calloutWarning')
    expect(filterBlockCommands('', label).length).toBeGreaterThan(10)
    expect(filterBlockCommands('xyz', label)).toEqual([])
  })
})
