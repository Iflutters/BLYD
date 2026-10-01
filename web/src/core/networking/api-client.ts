import { AppError } from '../errors/app-error'

/**
 * Cliente HTTP da API /api/v1.
 *
 * - Autenticação por cookie HttpOnly (mesma origem) — nenhum token fica acessível ao JavaScript.
 * - Header anti-CSRF em métodos que alteram estado.
 * - Correlation ID por requisição (rastreabilidade ponta a ponta).
 * - Converte o envelope { data, meta, error } em retorno tipado ou AppError.
 */

export type QueryValue = string | number | boolean | null | undefined
export type Query = Record<string, QueryValue>

export interface ApiResult<T, M = Record<string, unknown>> {
  data: T
  meta: M
}

export interface RequestOptions {
  query?: Query
  signal?: AbortSignal
  /** Sobrescreve o tempo limite padrão (ex.: uploads). */
  timeoutMs?: number
}

export interface ApiClient {
  get<T, M = Record<string, unknown>>(path: string, options?: RequestOptions): Promise<ApiResult<T, M>>
  post<T, M = Record<string, unknown>>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<T, M>>
  put<T, M = Record<string, unknown>>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<T, M>>
  patch<T, M = Record<string, unknown>>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResult<T, M>>
  del<T, M = Record<string, unknown>>(path: string, options?: RequestOptions): Promise<ApiResult<T, M>>
  /** Envio multipart (arquivos). O navegador define o Content-Type com o boundary. */
  postForm<T, M = Record<string, unknown>>(path: string, form: FormData, options?: RequestOptions): Promise<ApiResult<T, M>>
}

export interface ApiClientConfig {
  baseUrl: string
  fetch?: typeof fetch
  timeoutMs?: number
  /** Chamado quando a API responde 401 por sessão ausente/expirada. */
  onUnauthorized?: (code: string) => void
  /** Idioma atual da tela (Accept-Language): a API devolve cadastros traduzidos nele. */
  getLanguage?: () => string
}

const CSRF_HEADER = 'X-Requested-With'
const CSRF_VALUE = 'kamban'
const SESSION_CODES = new Set(['UNAUTHENTICATED', 'SESSION_EXPIRED'])

interface Envelope {
  data: unknown
  meta?: Record<string, unknown>
  error: { code: string; message: string; details?: Record<string, unknown> } | null
}

function isEnvelope(value: unknown): value is Envelope {
  return !!value && typeof value === 'object' && 'data' in value && 'error' in value
}

export function buildQuery(query?: Query): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.append(key, String(value))
  }
  const serialized = params.toString()
  return serialized ? `?${serialized}` : ''
}

function correlationId(): string {
  const random = globalThis.crypto?.randomUUID?.()
  return random ?? `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const doFetch = config.fetch ?? globalThis.fetch.bind(globalThis)
  const timeoutMs = config.timeoutMs ?? 20000

  async function request<T, M>(method: string, path: string, body: unknown, options: RequestOptions = {}) {
    const headers = new Headers({ Accept: 'application/json', 'X-Correlation-Id': correlationId() })
    if (method !== 'GET') headers.set(CSRF_HEADER, CSRF_VALUE)
    const language = config.getLanguage?.()
    if (language) headers.set('Accept-Language', language)
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData
    if (body !== undefined && !isForm) headers.set('Content-Type', 'application/json')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs)
    options.signal?.addEventListener('abort', () => controller.abort(), { once: true })

    let response: Response
    try {
      response = await doFetch(`${config.baseUrl}${path}${buildQuery(options.query)}`, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
        credentials: 'same-origin',
        signal: controller.signal,
      })
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      if (aborted && options.signal?.aborted) throw error // cancelamento pedido pelo chamador
      throw new AppError({
        code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: aborted ? 'Request timed out' : 'Network error',
        status: 0,
      })
    } finally {
      clearTimeout(timer)
    }

    if (response.status === 204) return { data: null as T, meta: {} as M }

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!isEnvelope(payload)) {
      throw new AppError({ code: 'UNEXPECTED_RESPONSE', message: 'Unexpected response', status: response.status })
    }

    const meta = (payload.meta ?? {}) as Record<string, unknown>
    if (payload.error || !response.ok) {
      const error = payload.error ?? { code: 'UNEXPECTED_RESPONSE', message: 'Unexpected response' }
      const appError = new AppError({
        code: error.code,
        message: error.message,
        status: response.status,
        details: error.details ?? {},
        correlationId: typeof meta.correlationId === 'string' ? meta.correlationId : undefined,
      })
      if (response.status === 401 && SESSION_CODES.has(appError.code)) config.onUnauthorized?.(appError.code)
      throw appError
    }

    return { data: payload.data as T, meta: meta as M }
  }

  return {
    get: (path, options) => request('GET', path, undefined, options),
    post: (path, body, options) => request('POST', path, body ?? {}, options),
    put: (path, body, options) => request('PUT', path, body ?? {}, options),
    patch: (path, body, options) => request('PATCH', path, body ?? {}, options),
    del: (path, options) => request('DELETE', path, undefined, options),
    postForm: (path, form, options) => request('POST', path, form, { timeoutMs: 120000, ...options }),
  }
}
