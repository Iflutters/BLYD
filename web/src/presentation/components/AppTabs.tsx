import type { ReactNode } from 'react'
import { Tabs } from 'radix-ui'
import { cn } from '@/core/utils/cn'

export interface AppTab {
  value: string
  label: ReactNode
  content: ReactNode
  disabled?: boolean
}

export interface AppTabsProps {
  tabs: AppTab[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  'aria-label'?: string
}

export function AppTabs({ tabs, value, defaultValue, onValueChange, className, ...rest }: AppTabsProps) {
  return (
    <Tabs.Root
      value={value}
      defaultValue={defaultValue ?? tabs[0]?.value}
      onValueChange={onValueChange}
      className={cn('flex flex-col gap-4', className)}
    >
      <Tabs.List aria-label={rest['aria-label']} className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted transition-colors',
              'hover:text-fg data-[state=active]:border-primary data-[state=active]:text-fg disabled:opacity-50',
            )}
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content key={tab.value} value={tab.value} className="focus:outline-none">
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  )
}
