import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import type { CustomField, FieldValue } from '@/domain/task-config'
import {
  AppDatePicker,
  AppFormField,
  AppMultiSelect,
  AppSelect,
  AppSwitch,
  AppTextField,
  AppTextarea,
  AppTimeField,
} from '@/presentation/components'
import { ColorDot } from './config-visuals'

export interface CustomFieldInputProps {
  field: Pick<CustomField, 'id' | 'label' | 'type' | 'description' | 'config' | 'options'>
  value: FieldValue | undefined
  onChange: (value: FieldValue) => void
  required?: boolean
  /** Código de erro (validation.*) */
  error?: string | null | undefined
  disabled?: boolean
  /** Opções dos campos de pessoas e projeto (na tarefa: membros do projeto). Sem isso, ficam indisponíveis. */
  references?: CustomFieldReferences
}

export interface CustomFieldReferences {
  people?: Array<{ id: string; name: string }>
  projects?: Array<{ id: string; key: string; name: string }>
  /** Anexos da tarefa (campos de imagem/arquivo escolhem entre eles). */
  attachments?: Array<{ id: string; name: string; kind: 'image' | 'document'; url: string }>
}

const NONE = '__none__'

/**
 * Renderizador dinâmico de campo personalizado: escolhe o componente do design system
 * conforme o tipo do campo. Usado na pré-visualização dos tipos e no formulário de tarefas.
 */
export function CustomFieldInput({ field, value, onChange, required, error, disabled, references }: CustomFieldInputProps) {
  const { t } = useTranslation()
  const common = { label: field.label, hint: field.description || undefined, required, error: error ?? undefined, disabled }
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : ''

  switch (field.type) {
    case 'text':
    case 'url':
    case 'email':
    case 'phone':
      return (
        <AppTextField
          {...common}
          type={field.type === 'text' ? 'text' : field.type === 'phone' ? 'tel' : field.type}
          maxLength={field.type === 'text' ? field.config.max_length : undefined}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      )
    case 'textarea':
      return <AppTextarea {...common} rows={3} maxLength={field.config.max_length} value={text} onChange={(event) => onChange(event.target.value)} />
    case 'number':
    case 'decimal':
      return (
        <AppTextField
          {...common}
          inputMode={field.type === 'number' ? 'numeric' : 'decimal'}
          value={text}
          onChange={(event) => onChange(event.target.value.replace(/[^0-9,.-]/g, ''))}
          hint={common.hint ?? rangeHint(t, field.config)}
        />
      )
    case 'boolean':
      return (
        <AppFormField hint={common.hint} error={common.error}>
          {() => <AppSwitch checked={value === true} onCheckedChange={onChange} label={field.label} disabled={disabled} />}
        </AppFormField>
      )
    case 'date':
      return <AppDatePicker {...common} value={text} onValueChange={onChange} />
    case 'datetime': {
      const [datePart = '', timePart = ''] = text.split('T')
      const compose = (date: string, time: string) => onChange(date ? `${date}T${time || '00:00'}` : '')
      return (
        <div className="grid grid-cols-[1fr_7.5rem] gap-2">
          <AppDatePicker {...common} value={datePart} onValueChange={(date) => compose(date, timePart.slice(0, 5))} />
          <AppTimeField label={t('fields.time')} value={timePart.slice(0, 5)} onValueChange={(time) => compose(datePart, time)} disabled={disabled || !datePart} />
        </div>
      )
    }
    case 'select': {
      const options = field.options.filter((o) => o.isActive || o.id === value)
      return (
        <AppSelect
          {...common}
          value={text || (required ? undefined : NONE)}
          placeholder={t('fields.selectPlaceholder')}
          onValueChange={(next) => onChange(next === NONE ? null : next)}
          options={[
            ...(required ? [] : [{ value: NONE, label: t('fields.none') }]),
            ...options.map((o) => ({
              value: o.id,
              label: (
                <span className="inline-flex items-center gap-2">
                  <ColorDot color={o.color} />
                  {o.label}
                </span>
              ),
            })),
          ]}
        />
      )
    }
    case 'multiselect':
      return (
        <AppMultiSelect
          {...common}
          value={Array.isArray(value) ? value : []}
          onValueChange={onChange}
          options={field.options.filter((o) => o.isActive).map((o) => ({ value: o.id, label: o.label, prefix: <ColorDot color={o.color} /> }))}
        />
      )
    case 'user':
    case 'project': {
      const choices =
        field.type === 'user'
          ? references?.people?.map((p) => ({ value: p.id, label: p.name }))
          : references?.projects?.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))
      if (!choices) break
      return (
        <AppSelect
          {...common}
          value={text || (required ? undefined : NONE)}
          placeholder={t('fields.selectPlaceholder')}
          onValueChange={(next) => onChange(next === NONE ? null : next)}
          options={[...(required ? [] : [{ value: NONE, label: t('fields.none') }]), ...choices]}
        />
      )
    }
    case 'users':
      if (!references?.people) break
      return (
        <AppMultiSelect
          {...common}
          value={Array.isArray(value) ? value : []}
          onValueChange={onChange}
          options={references.people.map((p) => ({ value: p.id, label: p.name }))}
        />
      )
    case 'image':
    case 'file': {
      if (!references?.attachments) break
      const choices = references.attachments.filter((a) => field.type === 'file' || a.kind === 'image')
      return (
        <AppMultiSelect
          {...common}
          hint={common.hint ?? t('fields.attachmentHint')}
          value={Array.isArray(value) ? value : []}
          onValueChange={onChange}
          placeholder={choices.length === 0 ? t('fields.noAttachments') : undefined}
          options={choices.map((a) => ({ value: a.id, label: a.name }))}
        />
      )
    }
    default:
      break
  }
  return <Deferred label={field.label} hint={common.hint} required={required} message={t(`fields.deferred.${field.type}`)} />
}

function rangeHint(t: (key: string, options?: Record<string, unknown>) => string, config: CustomField['config']): string | undefined {
  if (config.min !== undefined && config.max !== undefined) return t('fields.range', { min: config.min, max: config.max })
  if (config.min !== undefined) return t('fields.min', { min: config.min })
  if (config.max !== undefined) return t('fields.max', { max: config.max })
  return undefined
}

/** Tipos cujo preenchimento depende de módulos das próximas fases (pessoas, projetos, anexos). */
function Deferred({ label, hint, required, message }: { label: string; hint?: ReactNode; required?: boolean; message: string }) {
  return (
    <AppFormField label={label} hint={hint} required={required}>
      {({ id }) => (
        <div id={id} className="flex h-9 items-center gap-2 rounded-md border border-dashed border-border bg-surface-2 px-3 text-sm text-subtle">
          <Lock className="size-3.5" aria-hidden />
          {message}
        </div>
      )}
    </AppFormField>
  )
}
