import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { isAppError } from '@/core/errors/app-error'

/** Traduz qualquer erro para uma mensagem amigável (errors.<CODE>), sem vazar detalhes técnicos. */
export function useErrorMessage() {
  const { t } = useTranslation()
  return useCallback(
    (error: unknown): string => {
      const code = isAppError(error) ? error.code : 'INTERNAL_ERROR'
      return t(`errors.${code}`, { defaultValue: t('errors.INTERNAL_ERROR') })
    },
    [t],
  )
}
