import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowDownUp, ArrowUp, Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, FileUp, FolderPlus, Group, MoreHorizontal, Plus, X } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import { GROUP_BY, type PlanGroupBy } from '@/domain/plan-view'
import { AppButton, AppDropdown, AppIconButton, AppSearch, type AppDropdownItem, type BoardColumnsApi } from '@/presentation/components'

/**
 * Barra do quadro (diretriz §5.1): Criar elemento ▾ (grupo, importar) · Pesquisar · Pessoa · Filtro ·
 * Ordenar · Agrupar por · expandir/recolher tudo · Colunas · mais ações.
 */
export function BoardToolbar({
  canEdit,
  canManage,
  createDisabled,
  onCreateItem,
  onCreateGroup,
  onImport,
  search,
  onSearch,
  person,
  filter,
  sortColumns,
  sortApi,
  groupBy,
  onGroupBy,
  onExpandAll,
  onCollapseAll,
  canExpand,
  canCollapse,
  columnsMenu,
  moreItems,
}: {
  canEdit: boolean
  canManage: boolean
  createDisabled: boolean
  onCreateItem: () => void
  onCreateGroup: () => void
  onImport: () => void
  search: string
  onSearch: (value: string) => void
  person: ReactNode
  filter: ReactNode
  sortColumns: Array<{ id: string; label: string }>
  sortApi: BoardColumnsApi
  groupBy: PlanGroupBy
  onGroupBy: (value: PlanGroupBy) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  canExpand: boolean
  canCollapse: boolean
  columnsMenu: ReactNode
  moreItems: AppDropdownItem[]
}) {
  const { t } = useTranslation()
  const createMenu: AppDropdownItem[] = [
    ...(canManage ? [{ key: 'group', label: t('plan.createGroup'), icon: <FolderPlus />, onSelect: onCreateGroup }] : []),
    { key: 'import', label: t('plan.import.menu'), icon: <FileUp />, onSelect: onImport },
  ]
  const sort = sortApi.sort
  const sortItems: AppDropdownItem[] = [
    { type: 'label', key: 'by', label: t('plan.sort.by') },
    // itens comuns (o menu fecha ao escolher); o atual leva a marca
    ...sortColumns.map<AppDropdownItem>((c) => ({
      key: c.id,
      label: c.label,
      icon: sort?.column === c.id ? <Check /> : <span className="inline-block size-4" />,
      onSelect: () => sortApi.setSort({ column: c.id, direction: sort?.direction ?? 'asc' }),
    })),
    { type: 'separator', key: 'sep' },
    { key: 'asc', label: t('board.sortAsc'), icon: <ArrowUp />, disabled: !sort || sort.direction === 'asc', onSelect: () => sort && sortApi.setSort({ ...sort, direction: 'asc' }) },
    { key: 'desc', label: t('board.sortDesc'), icon: <ArrowDown />, disabled: !sort || sort.direction === 'desc', onSelect: () => sort && sortApi.setSort({ ...sort, direction: 'desc' }) },
    { key: 'clear', label: t('board.clearSort'), icon: <X />, disabled: !sort, onSelect: () => sortApi.setSort(null) },
  ]
  const sortLabel = sort ? sortColumns.find((c) => c.id === sort.column)?.label : null
  const groupItems: AppDropdownItem[] = GROUP_BY.map((value) => ({
    key: value,
    label: t(`plan.groupBy.${value}`),
    icon: groupBy === value ? <Check /> : <span className="inline-block size-4" />,
    onSelect: () => onGroupBy(value),
  }))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <div className="flex">
          <AppButton leftIcon={<Plus />} className="rounded-r-none" disabled={createDisabled} onClick={onCreateItem}>
            {t('plan.createItem')}
          </AppButton>
          <AppDropdown
            align="start"
            items={createMenu}
            trigger={
              <button
                type="button"
                aria-label={t('plan.createOptions')}
                className="flex h-9 items-center rounded-r-lg border-l border-primary-fg/25 bg-primary px-2 text-primary-fg hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-4"
              >
                <ChevronDown />
              </button>
            }
          />
        </div>
      )}
      <AppSearch value={search} onSearch={onSearch} placeholder={t('plan.searchPlaceholder')} aria-label={t('plan.search')} className="w-full sm:w-64" />
      {person}
      {filter}
      <AppDropdown
        align="start"
        items={sortItems}
        trigger={
          <AppButton variant={sort ? 'soft' : 'secondary'} leftIcon={<ArrowDownUp />}>
            {sortLabel ? t('plan.sort.active', { name: sortLabel }) : t('plan.sort.button')}
          </AppButton>
        }
      />
      <AppDropdown
        align="start"
        items={groupItems}
        trigger={
          <AppButton variant={groupBy !== 'group' ? 'soft' : 'secondary'} leftIcon={<Group />}>
            {groupBy === 'group' ? t('plan.groupBy.button') : t('plan.groupBy.active', { name: t(`plan.groupBy.${groupBy}`) })}
          </AppButton>
        }
      />
      <AppIconButton variant="secondary" icon={<ChevronsUpDown />} label={t('plan.expandAll')} onClick={onExpandAll} disabled={!canExpand} />
      <AppIconButton variant="secondary" icon={<ChevronsDownUp />} label={t('plan.collapseAll')} onClick={onCollapseAll} disabled={!canCollapse} />
      <div className={cn('ml-auto flex items-center gap-2')}>
        {columnsMenu}
        <AppDropdown align="end" items={moreItems} trigger={<AppIconButton variant="secondary" icon={<MoreHorizontal />} label={t('plan.moreActions')} />} />
      </div>
    </div>
  )
}
