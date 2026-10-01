import { useMemo, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight, FileText, Home, MoreHorizontal, Plus } from 'lucide-react'
import { cn } from '@/core/utils/cn'
import { readJson, writeJson } from '@/core/storage/safe-storage'
import { buildDocTree, dropZone, flattenDocTree, MAX_DOC_DEPTH, moveTarget, type DocMoveTarget, type DocTreePage, type DropZone } from '@/domain/docs'
import { AppDropdown, AppIconButton } from '@/presentation/components'
import { pagePath } from './docs-paths'

const DRAG_TYPE = 'application/x-kamban-doc-page'

export interface PageTreeProps {
  spaceKey: string
  pages: DocTreePage[]
  currentId: string | null
  canEdit: boolean
  /** Chamado ao abrir uma página pela árvore (ex.: fechar o painel). */
  onNavigate?: () => void
  onAddChild: (parentId: string) => void
  onMove: (id: string, target: DocMoveTarget) => void
  onRequestMove: (page: DocTreePage) => void
  onRequestDelete: (page: DocTreePage) => void
}

const collapsedKey = (spaceKey: string) => `kamban.docs.collapsed.${spaceKey}`

/**
 * Árvore de páginas do espaço. Arrastar uma página: no quarto de cima da linha = antes; no de
 * baixo = depois; no meio = vira subpágina. Destinos inválidos (dentro de si mesma, antes da
 * inicial) nem acendem. Pelo teclado, "Mover…" no menu da página faz o mesmo.
 */
export function PageTree({ spaceKey, pages, currentId, canEdit, onNavigate, onAddChild, onMove, onRequestMove, onRequestDelete }: PageTreeProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(readJson<string[]>(collapsedKey(spaceKey), [])))
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<{ id: string; zone: DropZone } | null>(null)
  const dragRef = useRef<string | null>(null)

  const tree = useMemo(() => buildDocTree(pages), [pages])
  // a página aberta fica sempre visível: seus ancestrais não recolhem
  const ancestors = useMemo(() => {
    const byId = new Map(pages.map((p) => [p.id, p]))
    const out = new Set<string>()
    let parent = currentId ? byId.get(currentId)?.parentId : null
    while (parent && !out.has(parent)) {
      out.add(parent)
      parent = byId.get(parent)?.parentId ?? null
    }
    return out
  }, [pages, currentId])
  const rows = useMemo(() => flattenDocTree(tree, new Set([...collapsed].filter((id) => !ancestors.has(id)))), [tree, collapsed, ancestors])

  const toggle = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeJson(collapsedKey(spaceKey), [...next])
      return next
    })

  const endDrag = () => {
    dragRef.current = null
    setDrag(null)
    setOver(null)
  }
  const onDragOver = (event: DragEvent<HTMLDivElement>, id: string) => {
    const dragged = dragRef.current
    if (!dragged || !event.dataTransfer.types.includes(DRAG_TYPE)) return
    const rect = event.currentTarget.getBoundingClientRect()
    const zone = dropZone(event.clientY - rect.top, rect.height)
    if (!moveTarget(pages, dragged, id, zone)) {
      if (over) setOver(null)
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (over?.id !== id || over.zone !== zone) setOver({ id, zone })
  }
  const onDrop = (event: DragEvent<HTMLDivElement>, id: string) => {
    event.preventDefault()
    const dragged = dragRef.current
    const zone = over?.zone
    endDrag()
    if (!dragged || !zone) return
    const target = moveTarget(pages, dragged, id, zone)
    if (!target) return
    // soltou dentro de uma recolhida: abre para mostrar onde a página foi parar
    if (zone === 'inside' && collapsed.has(id)) toggle(id)
    onMove(dragged, target)
  }

  if (rows.length === 0) return <p className="px-2 py-3 text-sm text-subtle">{t('docs.tree.empty')}</p>

  return (
    <ul className="space-y-px" aria-label={t('docs.tree.label')}>
      {rows.map((node) => {
        const current = node.id === currentId
        const expanded = node.children.length > 0 && (!collapsed.has(node.id) || ancestors.has(node.id))
        const indicator = over?.id === node.id ? over.zone : null
        const Icon = node.isHome ? Home : FileText
        return (
          <li key={node.id}>
            <div
              draggable={canEdit && !node.isHome}
              onDragStart={(event) => {
                dragRef.current = node.id
                setDrag(node.id)
                event.dataTransfer.setData(DRAG_TYPE, node.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={endDrag}
              onDragOver={(event) => onDragOver(event, node.id)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null) && over?.id === node.id) setOver(null)
              }}
              onDrop={(event) => onDrop(event, node.id)}
              style={{ paddingLeft: `${(node.depth - 1) * 0.875 + 0.25}rem` }}
              className={cn(
                'group relative flex h-8 items-center gap-1 rounded-md pr-1 text-sm transition-colors',
                current ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg hover:bg-surface-2',
                drag === node.id && 'opacity-50',
                indicator === 'inside' && 'bg-primary-soft ring-2 ring-primary/50',
                indicator === 'before' && 'before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded-full before:bg-primary',
                indicator === 'after' && 'after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary',
              )}
            >
              {node.children.length > 0 ? (
                <button
                  type="button"
                  onClick={() => toggle(node.id)}
                  aria-expanded={expanded}
                  aria-label={t(expanded ? 'docs.tree.collapse' : 'docs.tree.expand', { title: node.title })}
                  className="flex size-5 shrink-0 items-center justify-center rounded text-subtle hover:bg-surface-3 hover:text-fg"
                >
                  <ChevronRight aria-hidden className={cn('size-3.5 transition-transform', expanded && 'rotate-90')} />
                </button>
              ) : (
                <span aria-hidden className="size-5 shrink-0" />
              )}
              <Link
                to={pagePath(spaceKey, node.id)}
                aria-current={current ? 'page' : undefined}
                draggable={false}
                onClick={onNavigate}
                className="flex min-w-0 flex-1 items-center gap-1.5 py-1 focus-visible:outline-offset-0"
              >
                <Icon aria-hidden className={cn('size-3.5 shrink-0', current ? 'text-primary-soft-fg' : 'text-subtle')} />
                <span className={cn('truncate', node.status === 'draft' && 'italic text-muted')}>{node.title}</span>
                {(node.status === 'draft' || node.hasDraft) && (
                  <span
                    className={cn('ml-auto size-1.5 shrink-0 rounded-full', node.status === 'draft' ? 'bg-warning' : 'bg-primary')}
                    title={node.status === 'draft' ? t('docs.page.draftBadge') : t('docs.page.pendingBadge')}
                  >
                    <span className="sr-only">{node.status === 'draft' ? t('docs.page.draftBadge') : t('docs.page.pendingBadge')}</span>
                  </span>
                )}
              </Link>
              {canEdit && (
                <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100">
                  {node.depth < MAX_DOC_DEPTH && (
                    <AppIconButton size="sm" label={t('docs.page.addChildOf', { title: node.title })} icon={<Plus />} onClick={() => onAddChild(node.id)} className="size-6" />
                  )}
                  {!node.isHome && (
                    <AppDropdown
                      trigger={<AppIconButton size="sm" label={t('docs.page.actionsOf', { title: node.title })} icon={<MoreHorizontal />} className="size-6" />}
                      items={[
                        { key: 'move', label: t('docs.page.move'), onSelect: () => onRequestMove(node) },
                        { key: 'delete', label: t('common.delete'), tone: 'danger', onSelect: () => onRequestDelete(node) },
                      ]}
                    />
                  )}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
