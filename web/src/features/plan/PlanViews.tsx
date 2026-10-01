import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChartColumn, ChartGantt, ClipboardList, SquareKanban, Table2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/core/utils/cn'
import { PLAN_VIEWS, type PlanView } from '@/domain/plan-view'

const ICONS: Record<PlanView, ReactNode> = {
  board: <Table2 />,
  timeline: <ChartGantt />,
  kanban: <SquareKanban />,
  management: <ClipboardList />,
  reports: <ChartColumn />,
}

/** Barra de visões (como as abas de visão do Monday); a escolhida fica no endereço (`?view=`). */
export function PlanViewNav({ value }: { value: PlanView }) {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const hrefOf = (view: PlanView) => {
    const next = new URLSearchParams(params)
    if (view === 'board') next.delete('view')
    else next.set('view', view)
    return `?${next.toString()}`
  }
  return (
    <nav aria-label={t('plan.views.label')} className="-mx-1 overflow-x-auto px-1">
      <ul className="flex w-max gap-1 rounded-xl border border-border bg-surface-2 p-1">
        {PLAN_VIEWS.map((view) => {
          const current = view === value
          return (
            <li key={view}>
              <Link
                to={hrefOf(view)}
                replace
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4',
                  'focus-visible:outline-2 focus-visible:outline-ring',
                  current ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:bg-surface-3 hover:text-fg',
                )}
              >
                <span aria-hidden className="flex">
                  {ICONS[view]}
                </span>
                {t(`plan.views.${view}`)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
