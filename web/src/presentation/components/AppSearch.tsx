import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils/cn'
import { inputClasses } from './input-styles'

export interface AppSearchProps {
  value: string
  /** Chamado após o debounce. */
  onSearch: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
  'aria-label'?: string
}

/** Busca com debounce; o valor digitado fica local até estabilizar. */
export function AppSearch({ value, onSearch, placeholder, debounceMs = 300, className, ...rest }: AppSearchProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Valor externo mudou (ex.: "limpar filtros"): ajusta o rascunho durante a renderização.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(value)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  function change(next: string, immediate = false) {
    setDraft(next)
    clearTimeout(timer.current)
    if (immediate) onSearch(next)
    else timer.current = setTimeout(() => onSearch(next), debounceMs)
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        type="search"
        value={draft}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && change(draft, true)}
        placeholder={placeholder ?? t('common.search')}
        aria-label={rest['aria-label'] ?? placeholder ?? t('common.search')}
        className={cn(inputClasses, 'pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden')}
      />
      {draft && (
        <button
          type="button"
          onClick={() => change('', true)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg"
          aria-label={t('common.clearSearch')}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
