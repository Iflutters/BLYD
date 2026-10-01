/**
 * Erro padronizado da aplicação. `code` segue o contrato da API (/api/v1) ou é um código
 * gerado no cliente (NETWORK_ERROR, UNEXPECTED_RESPONSE, TIMEOUT).
 * Mensagens exibidas ao usuário vêm do i18n a partir do `code` (errors.<CODE>).
 */
export type ClientErrorCode = 'NETWORK_ERROR' | 'UNEXPECTED_RESPONSE' | 'TIMEOUT'

export interface AppErrorInit {
  code: string
  message: string
  status: number
  details?: Record<string, unknown>
  correlationId?: string | undefined
}

export class AppError extends Error {
  readonly code: string
  readonly status: number
  readonly details: Record<string, unknown>
  readonly correlationId: string | undefined

  constructor(init: AppErrorInit) {
    super(init.message)
    this.name = 'AppError'
    this.code = init.code
    this.status = init.status
    this.details = init.details ?? {}
    this.correlationId = init.correlationId
  }

  /** Erros de validação por campo ({ campo: codigo }) quando code === VALIDATION_ERROR. */
  fieldErrors(): Record<string, string> {
    const fields = this.details.fields
    return fields && typeof fields === 'object' ? (fields as Record<string, string>) : {}
  }

  get isUnauthorized() {
    return this.status === 401
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
