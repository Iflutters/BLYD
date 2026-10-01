import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import { OPTION_COLORS, type FieldType, type OptionColor, type TaskTypeIcon } from '@/domain/task-config'
import { AppFormField } from '@/presentation/components'
import { FIELD_TYPE_ICONS, TASK_TYPE_ICON_COMPONENTS, optionColor, optionTint } from './config-theme'

/** Escolha de cor da paleta fechada (radiogroup acessível). */
export function ColorPicker({ label, value, onChange }: { label: string; value: OptionColor; onChange: (color: OptionColor) => void }) {
  const { t } = useTranslation()
  return (
    <AppFormField label={label}>
      {({ id }) => (
        <div id={id} role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
          {OPTION_COLORS.map((color) => {
            const selected = value === color
            return (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={t(`colors.${color}`)}
                title={t(`colors.${color}`)}
                onClick={() => onChange(color)}
                style={{ backgroundColor: optionColor(color) }}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-surface transition-transform hover:scale-110',
                  selected && 'ring-2 ring-primary',
                )}
              >
                {selected && <Check className="size-3.5" />}
              </button>
            )
          })}
        </div>
      )}
    </AppFormField>
  )
}

/** Bolinha colorida de opção. */
export function ColorDot({ color, className }: { color: OptionColor; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: optionColor(color) }} />
}

/** Ícone do tipo de tarefa, com fundo na cor do tipo. */
export function TaskTypeIconBadge({ icon, color, size = 'md' }: { icon: TaskTypeIcon; color: OptionColor; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = TASK_TYPE_ICON_COMPONENTS[icon]
  const sizes = { sm: 'size-6 rounded-md [&_svg]:size-3.5', md: 'size-9 rounded-lg [&_svg]:size-4', lg: 'size-12 rounded-xl [&_svg]:size-6' }
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center', sizes[size])} style={{ backgroundColor: optionTint(color), color: optionColor(color) }}>
      <Icon />
    </span>
  )
}

/** Tipo do campo com ícone ("Seleção única"). */
export function FieldTypeLabel({ type, className }: { type: FieldType; className?: string }) {
  const { t } = useTranslation()
  const Icon = FIELD_TYPE_ICONS[type]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-fg', className)}>
      <Icon className="size-4 text-subtle" aria-hidden />
      {t(`fields.types.${type}`)}
    </span>
  )
}
