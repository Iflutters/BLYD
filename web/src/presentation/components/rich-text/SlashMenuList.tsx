import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/core/utils/cn'
import type { BlockCommand } from './block-commands'

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

export interface SlashMenuListProps {
  items: BlockCommand[]
  command: (item: BlockCommand) => void
}

export const SlashMenuList = forwardRef<SlashMenuHandle, SlashMenuListProps>(function SlashMenuList({ items, command }, ref) {
  const { t } = useTranslation()
  const [active, setActive] = useState(0)
  const [prevItems, setPrevItems] = useState(items)
  const listRef = useRef<HTMLDivElement>(null)
  // lista nova (outro filtro) → volta para o primeiro
  if (prevItems !== items) {
    setPrevItems(items)
    setActive(0)
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (items.length === 0) return false
      if (event.key === 'ArrowDown') {
        setActive((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        setActive((i) => (i - 1 + items.length) % items.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[active]
        if (item) command(item)
        return true
      }
      return false
    },
  }))

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={t('richText.slash.title')}
      className="max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-surface p-1 text-fg shadow-float animate-scale-in"
    >
      {items.length === 0 ? (
        <p className="px-3 py-2 text-sm text-subtle">{t('richText.slash.empty')}</p>
      ) : (
        items.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              role="option"
              aria-selected={index === active}
              data-index={index}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => command(item)}
              className={cn('flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left', index === active && 'bg-surface-2')}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t(`richText.blocks.${item.key}.label`)}</span>
                <span className="block truncate text-xs text-subtle">{t(`richText.blocks.${item.key}.hint`)}</span>
              </span>
            </button>
          )
        })
      )}
    </div>
  )
})
