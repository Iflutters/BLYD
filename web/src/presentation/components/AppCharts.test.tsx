import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AppBarList } from './AppCharts'

describe('AppBarList', () => {
  it('uma linha por item com o valor formatado; o detalhe fica numa linha própria sob o rótulo', () => {
    render(
      <AppBarList
        label="Recursos"
        items={[
          { key: 'a', label: 'Gerente de Projetos', detail: '2 pendentes · 24 h', value: 4 },
          { key: 'b', label: 'Cliente', value: 3 },
        ]}
        formatValue={(v) => `${v} elementos`}
      />,
    )
    const rows = within(screen.getByRole('list', { name: 'Recursos' })).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(screen.getByText('Gerente de Projetos').parentElement).toContainElement(screen.getByText('2 pendentes · 24 h'))
    expect(screen.getByText('Gerente de Projetos')).not.toContainElement(screen.getByText('2 pendentes · 24 h'))
    expect(within(rows[1]!).getByText('3 elementos')).toBeInTheDocument()
  })

  it('sem valores mostra o vazio', () => {
    render(<AppBarList label="Recursos" items={[{ key: 'a', label: 'X', value: 0 }]} empty="Nada ainda" />)
    expect(screen.getByText('Nada ainda')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
