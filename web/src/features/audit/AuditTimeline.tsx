import { useTranslation } from 'react-i18next'
import { ArrowRight, History } from 'lucide-react'
import { formatDateTime, formatRelative } from '@/core/utils/format'
import type { AuditEntry } from '@/domain/entities'
import { AppAvatar, AppEmptyState } from '@/presentation/components'
import { actionLabel, describeChanges } from './audit-format'

export interface AuditTimelineProps {
  entries: AuditEntry[]
  /** Traduz IDs em nomes (ex.: role_id -> nome do perfil). */
  resolve?: (field: string, value: string) => string | undefined
  /** Campos técnicos omitidos na linha do tempo (continuam na página de auditoria). */
  hiddenFields?: string[]
}

const DEFAULT_HIDDEN = ['session_id']

/** Linha do tempo de auditoria (histórico de uma entidade). */
export function AuditTimeline({ entries, resolve, hiddenFields = DEFAULT_HIDDEN }: AuditTimelineProps) {
  const { t, i18n } = useTranslation()
  if (entries.length === 0) {
    return <AppEmptyState compact icon={<History />} title={t('audit.noHistory')} />
  }
  return (
    <ol className="relative flex flex-col gap-5 border-l border-border pl-5">
      {entries.map((entry) => {
        const actor = entry.user?.name ?? t('audit.system')
        const changes = describeChanges(t, entry, resolve).filter((c) => !hiddenFields.includes(c.field))
        return (
          <li key={entry.id} className="relative">
            <span className="absolute -left-[29px] top-0.5">
              <AppAvatar name={actor} size="xs" />
            </span>
            <p className="text-sm text-fg">
              <span className="font-medium">{actor}</span>{' '}
              <span className="text-muted">{actionLabel(t, entry.action).toLowerCase()}</span>
            </p>
            <time
              className="text-xs text-subtle"
              dateTime={entry.createdAt?.toISOString()}
              title={formatDateTime(entry.createdAt, i18n.language)}
            >
              {formatRelative(entry.createdAt, i18n.language)}
            </time>
            {changes.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 rounded-md bg-surface-2 px-3 py-2 text-xs">
                {changes.map((change) => (
                  <li key={change.field} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-muted">{change.label}:</span>
                    {change.before && <span className="text-subtle line-through">{change.before}</span>}
                    {change.before && change.after && <ArrowRight className="size-3 text-subtle" aria-hidden />}
                    {change.after && <span className="text-fg">{change.after}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}
