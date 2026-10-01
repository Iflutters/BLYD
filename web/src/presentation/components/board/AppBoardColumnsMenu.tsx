import { useTranslation } from 'react-i18next'
import { Columns3, RotateCcw } from 'lucide-react'
import { AppButton } from '../AppButton'
import { AppDropdown, type AppDropdownItem } from '../AppDropdown'
import type { BoardColumnDef } from './board-columns'
import type { BoardColumnsApi } from './use-board-columns'

/** Menu "Colunas" do quadro: mostra/oculta colunas e restaura o padrão (ordem, larguras, ordenação). */
export function AppBoardColumnsMenu({ api, columns }: { api: BoardColumnsApi; columns: Array<BoardColumnDef & { label: string }> }) {
  const { t } = useTranslation()
  const items: AppDropdownItem[] = [
    { type: 'label', key: 'title', label: t('table.visibleColumns') },
    ...columns
      .filter((c) => !c.pinned && c.hideable !== false)
      .map<AppDropdownItem>((c) => ({
        type: 'checkbox',
        key: c.id,
        label: c.label,
        checked: !api.state.hidden.includes(c.id),
        onCheckedChange: (checked) => api.setHidden(c.id, !checked),
      })),
    { type: 'separator', key: 'sep' },
    { key: 'reset', label: t('table.resetColumns'), icon: <RotateCcw />, onSelect: api.reset },
  ]
  const hidden = api.state.hidden.length
  return (
    <AppDropdown
      align="end"
      items={items}
      trigger={
        <AppButton variant="secondary" leftIcon={<Columns3 />}>
          {hidden > 0 ? t('board.columnsHidden', { count: hidden }) : t('table.columns')}
        </AppButton>
      }
    />
  )
}
