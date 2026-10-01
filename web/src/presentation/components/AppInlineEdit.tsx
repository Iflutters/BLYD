import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/core/utils/cn'

export interface AppInlineEditProps {
  /** Texto inicial ao entrar em edição. */
  value: string
  /** O que aparece fora da edição (padrão: o próprio valor). */
  display?: ReactNode
  /** Confirma (Enter ou sair do campo). Retorne `false` para manter o valor anterior. */
  onCommit: (text: string) => void | boolean
  /** Nome acessível do botão/campo (ex.: "Editar nome de Kickoff"). */
  label: string
  /** Sem permissão: só mostra. */
  readOnly?: boolean
  placeholder?: string
  maxLength?: number
  inputMode?: 'text' | 'decimal' | 'numeric'
  align?: 'start' | 'center'
  className?: string
  /** Abre já em edição (ex.: logo após criar). */
  autoEdit?: boolean
}

/**
 * Texto que vira campo ao clicar (células do quadro): Enter ou sair confirmam, Esc cancela.
 * Fora da edição é um botão (teclado: Tab + Enter).
 */
export function AppInlineEdit({
  value,
  display,
  onCommit,
  label,
  readOnly,
  placeholder,
  maxLength,
  inputMode = 'text',
  align = 'start',
  className,
  autoEdit,
}: AppInlineEditProps) {
  const [editing, setEditing] = useState(!!autoEdit)
  const [draft, setDraft] = useState(value)
  const input = useRef<HTMLInputElement>(null)
  const done = useRef(false)

  useEffect(() => {
    if (editing) {
      input.current?.focus()
      input.current?.select()
    }
  }, [editing])

  const shown = display ?? (value || <span className="text-subtle">{placeholder}</span>)
  const alignment = align === 'center' ? 'justify-center text-center' : 'justify-start text-left'

  if (readOnly) return <span className={cn('flex min-w-0 items-center truncate', alignment, className)}>{shown}</span>

  function finish(save: boolean) {
    if (done.current) return
    done.current = true
    setEditing(false)
    if (save && draft !== value) onCommit(draft)
  }

  if (!editing)
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          done.current = false
          setDraft(value)
          setEditing(true)
        }}
        className={cn(
          'flex h-full min-h-7 w-full min-w-0 items-center truncate rounded-md px-1 outline-none ring-inset hover:ring-1 hover:ring-border-strong focus-visible:ring-2 focus-visible:ring-ring',
          alignment,
          className,
        )}
      >
        {shown}
      </button>
    )

  return (
    <input
      ref={input}
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      inputMode={inputMode}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          finish(true)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          finish(false)
        }
      }}
      className={cn(
        'h-7 w-full min-w-0 rounded-md border border-primary bg-surface px-1.5 text-sm text-fg outline-none ring-2 ring-ring/30',
        align === 'center' && 'text-center',
        className,
      )}
    />
  )
}
