import { useState } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/core/i18n'
import { renderWithProviders } from '@/test/utils'
import { AppDatePicker } from './AppDatePicker'

beforeAll(async () => {
  await i18n.changeLanguage('pt-BR')
})

let lastValue = ''

function Harness({ initial = '', min, max }: { initial?: string; min?: string; max?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <AppDatePicker
        label="Entrega"
        value={value}
        min={min}
        max={max}
        onValueChange={(next) => {
          lastValue = next
          setValue(next)
        }}
      />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('AppDatePicker', () => {
  it('digitação com máscara no formato do idioma', async () => {
    renderWithProviders(<Harness />)
    const input = screen.getByLabelText(/^Entrega/)
    expect(input).toHaveAttribute('placeholder', 'dd/mm/aaaa')
    await userEvent.type(input, '15122026')
    expect(input).toHaveValue('15/12/2026')
    expect(screen.getByTestId('value')).toHaveTextContent('2026-12-15')
  })

  it('data inválida mostra erro ao sair do campo e não é aplicada', async () => {
    renderWithProviders(<Harness initial="2026-01-10" />)
    const input = screen.getByLabelText(/^Entrega/)
    await userEvent.clear(input)
    await userEvent.type(input, '31022026')
    await userEvent.tab()
    expect(await screen.findByText('Data inválida')).toBeInTheDocument()
    expect(screen.getByTestId('value')).toBeEmptyDOMElement()
  })

  it('calendário próprio: abre, navega e seleciona o dia', async () => {
    renderWithProviders(<Harness initial="2026-09-28" />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    const grid = await screen.findByRole('grid', { name: /setembro de 2026/i })
    expect(grid).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { selected: true })).toHaveTextContent('28')

    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(await screen.findByRole('grid', { name: /outubro de 2026/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /15 de outubro de 2026/i }))

    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-15')
    await waitFor(() => expect(screen.queryByRole('grid')).not.toBeInTheDocument())
    expect(screen.getByLabelText(/^Entrega/)).toHaveValue('15/10/2026')
  })

  it('teclado: setas movem o foco e Enter seleciona', async () => {
    renderWithProviders(<Harness initial="2026-09-28" />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /28 de setembro de 2026/i })).toHaveFocus())
    await userEvent.keyboard('{ArrowRight}{ArrowDown}{Enter}')
    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-06')
  })

  it('respeita data mínima e máxima', async () => {
    renderWithProviders(<Harness initial="2026-09-15" min="2026-09-10" max="2026-09-20" />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    expect(await screen.findByRole('button', { name: /, 9 de setembro de 2026$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /21 de setembro de 2026/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /20 de setembro de 2026/i })).toBeEnabled()
  })

  it('limpar esvazia o valor', async () => {
    renderWithProviders(<Harness initial="2026-09-15" />)
    await userEvent.click(screen.getByRole('button', { name: 'Limpar data' }))
    expect(screen.getByTestId('value')).toHaveTextContent('')
    expect(lastValue).toBe('')
  })
})
