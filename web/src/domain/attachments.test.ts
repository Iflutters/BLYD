import { describe, expect, it } from 'vitest'
import { acceptAttribute, fileIssue, fitWithin, formatBytes, namePastedFile, shouldCompressImage, MAX_FILE_SIZE } from './attachments'

describe('domain/attachments', () => {
  it('pré-checagem por extensão e tamanho (o servidor confere o conteúdo)', () => {
    expect(fileIssue({ name: 'foto.PNG', size: 10 })).toBeNull()
    expect(fileIssue({ name: 'script.exe', size: 10 })).toBe('unsupported_type')
    expect(fileIssue({ name: 'logo.svg', size: 10 })).toBe('unsupported_type')
    expect(fileIssue({ name: 'a.pdf', size: 0 })).toBe('empty_file')
    expect(fileIssue({ name: 'a.pdf', size: MAX_FILE_SIZE + 1 })).toBe('file_too_large')
    expect(fileIssue({ name: 'contrato.pdf', size: 10 }, true)).toBe('image_required')
    expect(acceptAttribute(true)).toBe('.png,.jpg,.jpeg,.gif,.webp')
  })

  it('comprime só fotos grandes; nunca GIF', () => {
    expect(shouldCompressImage('image/jpeg', 3_000_000, 4000, 3000)).toBe(true)
    expect(shouldCompressImage('image/png', 200_000, 3000, 1000)).toBe(true)
    expect(shouldCompressImage('image/png', 200_000, 1200, 800)).toBe(false)
    expect(shouldCompressImage('image/gif', 9_000_000, 4000, 4000)).toBe(false)
    expect(fitWithin(4000, 3000)).toEqual({ width: 2560, height: 1920 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('imagem colada ("image.png") ganha nome com data e hora; arquivo com nome próprio fica como está', () => {
    const now = new Date(2026, 8, 30, 14, 5, 9)
    const pasted = namePastedFile(new File([new Uint8Array([1])], 'image.png', { type: 'image/png' }), 'imagem-colada', now)
    expect(pasted.name).toBe('imagem-colada-20260930-140509.png')
    expect(pasted.type).toBe('image/png')
    expect(namePastedFile(new File([new Uint8Array([1])], 'image.jpeg', { type: 'image/jpeg' }), 'imagem-colada', now, 1).name).toBe('imagem-colada-20260930-140509-2.jpg')
    const own = new File([new Uint8Array([1])], 'ata.png', { type: 'image/png' })
    expect(namePastedFile(own, 'imagem-colada', now)).toBe(own)
  })

  it('tamanho legível', () => {
    expect(formatBytes(512, 'pt-BR')).toBe('512 B')
    expect(formatBytes(1536, 'pt-BR')).toBe('1,5 KB')
    expect(formatBytes(20 * 1024 * 1024, 'en')).toBe('20 MB')
  })
})
