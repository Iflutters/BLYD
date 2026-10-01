import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/core/utils/format'
import type { ApiToken, ApiTokenState } from '@/domain/api-tokens'
import { AppBadge, type DataTableColumn } from '@/presentation/components'

export const ALL_TOKENS_KEY = ['api-tokens', 'all'] as const

const STATE_TONE: Record<ApiTokenState, 'success' | 'neutral' | 'danger'> = { active: 'success', expired: 'neutral', revoked: 'danger' }

/** Colunas da lista de tokens (a do Admin acrescenta a pessoa). */
export function useTokenColumns(withUser: boolean): DataTableColumn<ApiToken>[] {
  const { t, i18n } = useTranslation()
  return useMemo<DataTableColumn<ApiToken>[]>(
    () => [
      ...(withUser ? [{ id: 'user', header: t('apiTokens.columns.user'), cell: (row: ApiToken) => row.user?.name ?? '—' }] : []),
      { id: 'name', header: t('apiTokens.columns.name'), cell: (row) => <span className="font-medium text-fg">{row.name}</span> },
      { id: 'prefix', header: t('apiTokens.columns.prefix'), cell: (row) => <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{row.prefix}…</code> },
      { id: 'state', header: t('apiTokens.columns.state'), cell: (row) => <AppBadge tone={STATE_TONE[row.state]}>{t(`apiTokens.states.${row.state}`)}</AppBadge> },
      { id: 'lastUsed', header: t('apiTokens.columns.lastUsed'), cell: (row) => (row.lastUsedAt ? formatDateTime(row.lastUsedAt, i18n.language) : t('apiTokens.neverUsed')) },
      { id: 'expires', header: t('apiTokens.columns.expires'), cell: (row) => (row.expiresAt ? formatDateTime(row.expiresAt, i18n.language) : t('apiTokens.noExpiry')) },
    ],
    [t, i18n.language, withUser],
  )
}
