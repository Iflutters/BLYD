import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, RotateCcw } from 'lucide-react'
import { isAppError } from '@/core/errors/app-error'
import { downloadText } from '@/core/utils/download'
import { IMPORT_FIELDS, buildImport, guessMapping, importTemplate, parseCsv, type ImportField } from '@/domain/plan-import'
import { AppButton, AppDialog, AppFileDrop, AppSelect, notify } from '@/presentation/components'
import { useErrorMessage } from '@/presentation/common/use-error-message'
import type { PlanMutations } from './queries'

const IGNORE = '__ignore__'
const MAX_LISTED = 12

/** Campo do servidor → coluna da planilha; "não encontrado" ganha mensagem própria. */
const SERVER_FIELDS: Record<string, ImportField> = {
  start_date: 'startDate',
  end_date: 'endDate',
  estimated_hours: 'estimatedHours',
  actual_hours: 'actualHours',
  duration_days: 'durationDays',
  parent: 'name',
}
const NOT_FOUND: Record<string, string> = { group: 'group_not_found', status: 'status_not_found', parent: 'parent_not_found' }

function fromServer(issues: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  Object.entries(issues).forEach(([field, code]) => {
    out[SERVER_FIELDS[field] ?? field] = code === 'invalid_option' && NOT_FOUND[field] ? (NOT_FOUND[field] ?? code) : code
  })
  return out
}

interface Sheet {
  name: string
  table: string[][]
  mapping: Array<ImportField | null>
}

/** "Importar elementos": planilha CSV (modelo para baixar), colunas reconhecidas, conferência por linha. */
export function ImportDialog({ open, onClose, mutations }: { open: boolean; onClose: () => void; mutations: PlanMutations }) {
  if (!open) return null
  return <ImportForm onClose={onClose} mutations={mutations} />
}

function ImportForm({ onClose, mutations }: { onClose: () => void; mutations: PlanMutations }) {
  const { t, i18n } = useTranslation()
  const errorMessage = useErrorMessage()
  const locale = i18n.language
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [serverIssues, setServerIssues] = useState<Record<number, Record<string, string>>>({})
  const pending = mutations.importItems.isPending
  const preview = useMemo(() => (sheet ? buildImport(sheet.table, sheet.mapping, locale) : null), [sheet, locale])

  async function read(files: File[]) {
    const file = files[0]
    if (!file) return
    const table = parseCsv(await file.text())
    setServerIssues({})
    if (table.length < 2) {
      notify.error(t('plan.import.emptyFile'))
      return
    }
    setSheet({ name: file.name, table, mapping: guessMapping(table[0] ?? []) })
  }

  function template() {
    const headers = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, t(`plan.import.fields.${f}`)])) as Record<ImportField, string>
    const en = locale.startsWith('en')
    const day = (d: number, m: number) => (en ? `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/2026` : `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/2026`)
    const num = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(value)
    const sample = t('plan.import.sample', { returnObjects: true }) as Record<string, string>
    const csv = importTemplate(
      headers,
      [
        { group: sample.group, name: sample.element, status: sample.status, startDate: day(26, 1), endDate: day(27, 1), resources: sample.resources, estimatedHours: num(1.5) },
        { group: sample.group, name: sample.element, subitem: sample.subitem, estimatedHours: num(2), progress: '50' },
      ],
      locale,
    )
    downloadText(t('plan.import.templateName'), csv, 'text/csv;charset=utf-8')
  }

  const rows = preview?.rows ?? []
  const issues = rows.flatMap((r, index) => {
    const found = { ...r.issues, ...fromServer(serverIssues[index] ?? {}) }
    return Object.entries(found).map(([field, code]) => ({ line: r.line, field, code }))
  })
  const elements = rows.filter((r) => !r.row.parent).length
  const blocked = !preview || preview.missing.length > 0 || preview.tooMany || rows.length === 0 || issues.length > 0

  function submit() {
    if (!preview || blocked) return
    mutations.importItems.mutate(
      preview.rows.map((r) => r.row),
      {
        onSuccess: (created) => {
          notify.success(t('plan.import.done', { count: created.items + created.subitems }))
          onClose()
        },
        onError: (error) => {
          const details = isAppError(error) ? error.details.rows : undefined
          if (details && typeof details === 'object') setServerIssues(details as Record<number, Record<string, string>>)
          else notify.error(errorMessage(error))
        },
      },
    )
  }

  const fieldLabel = (field: string) => (IMPORT_FIELDS.includes(field as ImportField) ? t(`plan.import.fields.${field}`) : field)
  const issueText = (code: string) => t(`plan.import.issues.${code}`, { defaultValue: t(`validation.${code}`, { defaultValue: code }) })

  return (
    <AppDialog
      open
      onOpenChange={(next) => !next && !pending && onClose()}
      size="xl"
      closeOnOutsideClick={false}
      title={t('plan.import.title')}
      description={t('plan.import.description')}
      footer={
        <>
          {sheet && (
            <AppButton variant="ghost" leftIcon={<RotateCcw />} className="mr-auto" onClick={() => setSheet(null)} disabled={pending}>
              {t('plan.import.otherFile')}
            </AppButton>
          )}
          <AppButton variant="secondary" onClick={onClose} disabled={pending}>
            {t('common.cancel')}
          </AppButton>
          <AppButton onClick={submit} loading={pending} disabled={blocked}>
            {t('plan.import.submit', { count: rows.length })}
          </AppButton>
        </>
      }
    >
      {!sheet ? (
        <div className="flex flex-col gap-4">
          <AppFileDrop multiple={false} accept=".csv,text/csv" onFiles={(files) => void read(files)} hint={t('plan.import.fileHint')} />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
            <span>{t('plan.import.format')}</span>
            <AppButton variant="secondary" size="sm" leftIcon={<Download />} onClick={template}>
              {t('plan.import.template')}
            </AppButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <FileSpreadsheet aria-hidden className="size-4 text-subtle" />
            {sheet.name}
            <span className="font-normal text-muted">· {t('plan.import.rows', { count: rows.length })}</span>
          </p>
          <section aria-label={t('plan.import.mapping')} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t('plan.import.mapping')}</h3>
            <p className="text-xs text-muted">{t('plan.import.mappingHint')}</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sheet.mapping.map((field, index) => (
                <AppSelect
                  key={index}
                  size="sm"
                  label={sheet.table[0]?.[index] || t('plan.import.column', { number: index + 1 })}
                  value={field ?? IGNORE}
                  onValueChange={(value) => {
                    setServerIssues({})
                    setSheet({ ...sheet, mapping: sheet.mapping.map((f, i) => (i === index ? (value === IGNORE ? null : (value as ImportField)) : value !== IGNORE && f === value ? null : f)) })
                  }}
                  options={[{ value: IGNORE, label: t('plan.import.ignore') }, ...IMPORT_FIELDS.map((f) => ({ value: f, label: t(`plan.import.fields.${f}`) }))]}
                />
              ))}
            </div>
          </section>
          {preview && preview.missing.length > 0 && (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
              <AlertCircle aria-hidden className="size-4 shrink-0" />
              {t('plan.import.missing', { fields: preview.missing.map(fieldLabel).join(', ') })}
            </p>
          )}
          {preview?.tooMany && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
              {t('plan.import.tooMany')}
            </p>
          )}
          {issues.length > 0 ? (
            <section aria-label={t('plan.import.problems', { count: issues.length })} className="flex flex-col gap-1 rounded-lg border border-danger-soft p-3">
              <h3 className="text-sm font-semibold text-danger-soft-fg">{t('plan.import.problems', { count: issues.length })}</h3>
              <ul className="flex flex-col gap-0.5 text-sm">
                {issues.slice(0, MAX_LISTED).map((issue) => (
                  <li key={`${issue.line}:${issue.field}`}>{t('plan.import.problem', { line: issue.line, field: fieldLabel(issue.field), message: issueText(issue.code) })}</li>
                ))}
              </ul>
              {issues.length > MAX_LISTED && <p className="text-xs text-muted">{t('plan.import.moreProblems', { count: issues.length - MAX_LISTED })}</p>}
            </section>
          ) : (
            preview &&
            preview.missing.length === 0 &&
            rows.length > 0 && (
              <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success-soft-fg">
                <CheckCircle2 aria-hidden className="size-4 shrink-0" />
                {t('plan.import.ready', { elements, subitems: rows.length - elements })}
              </p>
            )
          )}
          <p className="text-xs text-muted">{t('plan.import.creates')}</p>
        </div>
      )}
    </AppDialog>
  )
}
