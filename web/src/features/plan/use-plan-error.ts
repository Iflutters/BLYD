import { useTranslation } from 'react-i18next'
import { isAppError } from '@/core/errors/app-error'
import { useErrorMessage } from '@/presentation/common/use-error-message'

/** Mensagem dos erros do quadro: dependência pendente com os nomes; ligação e campo inválidos com o motivo. */
export function usePlanError() {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  return (error: unknown): string => {
    if (isAppError(error) && error.code === 'PLAN_DEPENDENCY_PENDING' && Array.isArray(error.details.items)) {
      const names = (error.details.items as unknown[]).map(String)
      return t('plan.dependencyPending', { count: names.length, names: names.join(', ') })
    }
    if (isAppError(error) && error.code === 'VALIDATION_ERROR') {
      const [field, code] = Object.entries(error.fieldErrors())[0] ?? []
      if (field === 'item_id' && code) return t(`plan.linkIssues.${code}`, { defaultValue: errorMessage(error) })
      if (code) return t(`plan.fieldIssues.${code}`, { defaultValue: t(`validation.${code}`, { defaultValue: errorMessage(error) }) })
    }
    return errorMessage(error)
  }
}
