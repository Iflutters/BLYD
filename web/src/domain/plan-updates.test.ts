import { describe, expect, it } from 'vitest'
import { updateUploadIssue } from './plan-updates'

const file = (size: number) => ({ name: 'a.png', size })

describe('domain/plan-updates', () => {
  it('arquivos que seguem com a atualização: até 10 e 50 MB no total (como o servidor)', () => {
    expect(updateUploadIssue([])).toBeNull()
    expect(updateUploadIssue([file(10), file(20)])).toBeNull()
    expect(updateUploadIssue(Array.from({ length: 11 }, () => file(1)))).toBe('too_many')
    expect(updateUploadIssue([file(20 * 1024 * 1024), file(20 * 1024 * 1024), file(11 * 1024 * 1024)])).toBe('upload_too_large')
  })
})
