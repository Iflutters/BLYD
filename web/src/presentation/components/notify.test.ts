import { describe, expect, it } from 'vitest'
import { TOAST_MIN_DURATION, toastDuration } from './notify'

describe('notify — duração dos toasts', () => {
  it('usa o padrão por tipo', () => {
    expect(toastDuration('success')).toBe(8000)
    expect(toastDuration('warning')).toBe(10000)
    expect(toastDuration('error')).toBe(12000)
    expect(toastDuration('info', { undo: { label: 'Desfazer', onClick: () => {} } })).toBe(12000)
  })

  it('nunca fica abaixo de 3 segundos', () => {
    expect(TOAST_MIN_DURATION).toBe(3000)
    expect(toastDuration('success', { autoClose: 1000 })).toBe(3000)
    expect(toastDuration('success', { autoClose: 4500 })).toBe(4500)
  })

  it('false mantém aberto até o usuário fechar', () => {
    expect(toastDuration('error', { autoClose: false })).toBe(false)
  })
})
