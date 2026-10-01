import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildDocTree, flattenDocTree, moveTarget, type DocMoveTarget, type DocTreePage } from '@/domain/docs'
import { AppButton, AppDialog, AppSelect } from '@/presentation/components'

const ROOT = '__root__'

export interface MovePageDialogProps {
  page: DocTreePage | null
  pages: DocTreePage[]
  onOpenChange: (open: boolean) => void
  onMove: (id: string, target: DocMoveTarget) => void
  pending?: boolean
}

/** Mover pelo teclado: escolhe a nova página-mãe (a página vai para o fim das subpáginas dela). */
export function MovePageDialog({ page, pages, onOpenChange, onMove, pending }: MovePageDialogProps) {
  const { t } = useTranslation()
  const [parent, setParent] = useState<string>(ROOT)
  const [shownFor, setShownFor] = useState<string | null>(null)
  if (page && shownFor !== page.id) {
    setShownFor(page.id)
    setParent(page.parentId ?? ROOT)
  }

  // destinos possíveis: raiz do espaço ou qualquer página que não seja ela mesma nem uma subpágina sua
  const options = useMemo(() => {
    if (!page) return []
    const rows = flattenDocTree(buildDocTree(pages), new Set())
    return [
      { value: ROOT, label: t('docs.move.root') },
      ...rows
        .filter((row) => moveTarget(pages, page.id, row.id, 'inside'))
        .map((row) => ({ value: row.id, label: `${' '.repeat(row.depth - 1)}${row.title}` })),
    ]
  }, [page, pages, t])

  const unchanged = (page?.parentId ?? ROOT) === parent
  return (
    <AppDialog
      open={!!page}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('docs.move.title', { title: page?.title ?? '' })}
      description={t('docs.move.hint')}
      footer={
        <>
          <AppButton variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </AppButton>
          <AppButton loading={pending} disabled={unchanged} onClick={() => page && onMove(page.id, { parentId: parent === ROOT ? null : parent })}>
            {t('docs.move.confirm')}
          </AppButton>
        </>
      }
    >
      <AppSelect label={t('docs.move.parent')} value={parent} onValueChange={setParent} options={options} />
    </AppDialog>
  )
}
