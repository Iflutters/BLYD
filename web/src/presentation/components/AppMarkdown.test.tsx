import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppMarkdown } from './AppMarkdown'

describe('AppMarkdown', () => {
  it('formata negrito, itálico, código e listas', () => {
    const { container } = render(<AppMarkdown text={'Texto **forte** e *leve* com `code`\n\n- um\n- dois\n\n1. primeiro'} />)
    expect(screen.getByText('forte').tagName).toBe('STRONG')
    expect(screen.getByText('leve').tagName).toBe('EM')
    expect(screen.getByText('code').tagName).toBe('CODE')
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelectorAll('ol li')).toHaveLength(1)
  })

  it('links só com http(s); nunca HTML cru', () => {
    const { container } = render(<AppMarkdown text={'[site](https://kamban.dev) [mal](javascript:alert(1)) <img src=x onerror=alert(1)>'} />)
    const link = screen.getByRole('link', { name: 'site' })
    expect(link).toHaveAttribute('href', 'https://kamban.dev')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('link', { name: 'mal' })).not.toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('menções viram destaque com o nome', () => {
    render(<AppMarkdown text="Oi @[Carla Mendes](u7), veja" />)
    expect(screen.getByText('@Carla Mendes')).toBeInTheDocument()
  })
})
