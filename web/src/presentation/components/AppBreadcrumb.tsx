import { Fragment } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface BreadcrumbItem {
  label: string
  to?: string
}

export function AppBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const { t } = useTranslation()
  if (items.length === 0) return null
  return (
    <nav aria-label={t('common.breadcrumb')} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <Fragment key={`${item.label}-${index}`}>
              {/* no celular só a página atual cabe; os níveis acima aparecem a partir de sm */}
              <li className={last ? 'min-w-0' : 'hidden min-w-0 sm:block'}>
                {item.to && !last ? (
                  <Link to={item.to} className="block truncate text-muted hover:text-fg">
                    {item.label}
                  </Link>
                ) : (
                  <span className="block truncate font-medium text-fg" aria-current={last ? 'page' : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden className="hidden shrink-0 text-subtle sm:block">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
