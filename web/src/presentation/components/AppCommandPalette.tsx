import type { ReactNode } from 'react'
import { Command } from 'cmdk'
import { Dialog } from 'radix-ui'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppKbd } from './AppKbd'

export interface CommandItem {
  id: string
  label: string
  icon?: ReactNode
  hint?: string
  keywords?: string[]
  disabled?: boolean
  onSelect: () => void
}

export interface CommandGroup {
  heading: string
  items: CommandItem[]
}

export interface AppCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: CommandGroup[]
  search: string
  onSearchChange: (value: string) => void
  /** Conteúdo adicional (ex.: resultados remotos) renderizado após os grupos. */
  children?: ReactNode
  placeholder?: string
}

/** Paleta de comandos genérica (Ctrl/⌘ + K). O conteúdo é fornecido por quem a usa. */
export function AppCommandPalette({ open, onOpenChange, groups, search, onSearchChange, children, placeholder }: AppCommandPaletteProps) {
  const { t } = useTranslation()

  function run(item: CommandItem) {
    onOpenChange(false)
    item.onSelect()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-float animate-scale-in focus:outline-none"
        >
          <Dialog.Title className="sr-only">{t('commandPalette.title')}</Dialog.Title>
          <Command label={t('commandPalette.title')} loop className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-subtle" aria-hidden />
              <Command.Input
                value={search}
                onValueChange={onSearchChange}
                placeholder={placeholder ?? t('commandPalette.placeholder')}
                className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
              />
              <AppKbd>Esc</AppKbd>
            </div>
            <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-muted">{t('commandPalette.empty')}</Command.Empty>
              {groups
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <Command.Group
                    key={group.heading}
                    heading={group.heading}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-subtle"
                  >
                    {group.items.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={`${item.label} ${item.id}`}
                        keywords={item.keywords}
                        disabled={item.disabled}
                        onSelect={() => run(item)}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-fg data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-subtle"
                      >
                        {item.icon}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.hint && <span className="text-xs text-subtle">{item.hint}</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              {children}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
