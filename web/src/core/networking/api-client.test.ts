import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './api-client'
import { AppError } from '../errors/app-error'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function setup(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  const onUnauthorized = vi.fn()
  const client = createApiClient({ baseUrl: '/api/v1', fetch: fetchMock as unknown as typeof fetch, onUnauthorized })
  return { client, fetchMock, onUnauthorized }
}

describe('ApiClient', () => {
  it('retorna data e meta do envelope de sucesso', async () => {
    const { client } = setup(jsonResponse(200, { data: { id: 1 }, meta: { total: 1 }, error: null }))
    await expect(client.get('/users/1')).resolves.toEqual({ data: { id: 1 }, meta: { total: 1 } })
  })

  it('envia cookies da mesma origem, correlation id e serializa query sem valores vazios', async () => {
    const { client, fetchMock } = setup(jsonResponse(200, { data: [], meta: {}, error: null }))
    await client.get('/users', { query: { page: 2, search: 'ana', status: undefined, role_id: '' } })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/users?page=2&search=ana')
    expect(init.credentials).toBe('same-origin')
    const headers = new Headers(init.headers)
    expect(headers.get('X-Correlation-Id')).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    expect(headers.get('X-Requested-With')).toBeNull()
  })

  it('envia o idioma atual da tela em Accept-Language (cadastros traduzidos)', async () => {
    let language = 'es'
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: [], meta: {}, error: null }))
    const client = createApiClient({ baseUrl: '/api/v1', fetch: fetchMock as unknown as typeof fetch, getLanguage: () => language })
    await client.get('/task-types')
    language = 'en'
    await client.get('/task-types')
    const header = (call: number) => new Headers((fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1].headers).get('Accept-Language')
    expect([header(0), header(1)]).toEqual(['es', 'en'])
  })

  it('mutações enviam JSON e o header anti-CSRF', async () => {
    const { client, fetchMock } = setup(jsonResponse(201, { data: { ok: true }, meta: {}, error: null }))
    await client.post('/users', { name: 'Ana' })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(init.method).toBe('POST')
    expect(headers.get('X-Requested-With')).toBe('kamban')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(init.body).toBe('{"name":"Ana"}')
  })

  it('upload multipart: envia o FormData sem Content-Type fixo (o navegador põe o boundary) e com CSRF', async () => {
    const { client, fetchMock } = setup(jsonResponse(201, { data: [], meta: {}, error: null }))
    const form = new FormData()
    form.append('files', new Blob(['x']), 'a.txt')
    await client.postForm('/tasks/k1/attachments', form)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(init.body).toBe(form)
    expect(headers.get('Content-Type')).toBeNull()
    expect(headers.get('X-Requested-With')).toBe('kamban')
  })

  it('converte envelope de erro em AppError', async () => {
    const { client } = setup(
      jsonResponse(400, {
        data: null,
        meta: { correlationId: 'corr-123456' },
        error: { code: 'VALIDATION_ERROR', message: 'Invalid data', details: { fields: { email: 'required' } } },
      }),
    )
    const error = await client.post('/users', {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
      correlationId: 'corr-123456',
      details: { fields: { email: 'required' } },
    })
    expect((error as AppError).fieldErrors()).toEqual({ email: 'required' })
  })

  it('notifica sessão inválida em 401', async () => {
    const { client, onUnauthorized } = setup(
      jsonResponse(401, { data: null, meta: {}, error: { code: 'SESSION_EXPIRED', message: 'x', details: {} } }),
    )
    await expect(client.get('/auth/me')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(onUnauthorized).toHaveBeenCalledWith('SESSION_EXPIRED')
  })

  it('não notifica sessão inválida quando o login falha', async () => {
    const { client, onUnauthorized } = setup(
      jsonResponse(401, { data: null, meta: {}, error: { code: 'INVALID_CREDENTIALS', message: 'x', details: {} } }),
    )
    await expect(client.post('/auth/login', {})).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('falha de rede vira NETWORK_ERROR', async () => {
    const { client } = setup(new TypeError('Failed to fetch'))
    await expect(client.get('/health')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 })
  })

  it('resposta fora do contrato vira UNEXPECTED_RESPONSE', async () => {
    const { client } = setup(new Response('<html>502</html>', { status: 502 }))
    await expect(client.get('/health')).rejects.toMatchObject({ code: 'UNEXPECTED_RESPONSE', status: 502 })
  })

  it('204 retorna data nula', async () => {
    const { client } = setup(new Response(null, { status: 204 }))
    await expect(client.del('/x')).resolves.toEqual({ data: null, meta: {} })
  })
})
