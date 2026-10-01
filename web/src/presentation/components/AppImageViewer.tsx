import { useState, type KeyboardEvent } from 'react'
import { Dialog } from 'radix-ui'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Download, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/core/utils/cn'

export interface ViewerImage {
  id: string
  src: string
  name: string
  /** Link de download (padrão: `src`). */
  downloadUrl?: string
}

export interface AppImageViewerProps {
  images: ViewerImage[]
  /** Índice aberto; null = fechado. */
  index: number | null
  onIndexChange: (index: number | null) => void
}

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3]

/**
 * Visualizador de imagens em tela cheia: zoom, navegação entre imagens (setas do teclado e botões),
 * download e contador. Esc fecha.
 */
export function AppImageViewer({ images, index, onIndexChange }: AppImageViewerProps) {
  const { t } = useTranslation()
  const [zoom, setZoom] = useState<number | null>(null) // null = ajustar à tela
  const [shownIndex, setShownIndex] = useState(index)
  const open = index !== null && images.length > 0
  const current = open ? images[Math.min(index, images.length - 1)] : undefined

  // Nova imagem: volta a ajustar à tela (ajuste durante a renderização, sem efeito).
  if (shownIndex !== index) {
    setShownIndex(index)
    setZoom(null)
  }

  const go = (delta: number) => {
    if (index === null || images.length < 2) return
    onIndexChange((index + delta + images.length) % images.length)
  }
  const zoomBy = (direction: 1 | -1) => {
    const currentZoom = zoom ?? 1
    const next = direction > 0 ? ZOOMS.find((z) => z > currentZoom) : [...ZOOMS].reverse().find((z) => z < currentZoom)
    setZoom(next ?? currentZoom)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight') go(1)
    else if (event.key === 'ArrowLeft') go(-1)
    else if (event.key === '+' || event.key === '=') zoomBy(1)
    else if (event.key === '-') zoomBy(-1)
    else if (event.key === '0') setZoom(null)
    else return
    event.preventDefault()
  }

  const tool = 'inline-flex size-9 items-center justify-center rounded-md text-white/90 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40'

  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85 animate-fade-in" />
        <Dialog.Content onKeyDown={onKeyDown} aria-describedby={undefined} className="fixed inset-0 z-50 flex flex-col focus:outline-none">
          <div className="flex items-center gap-2 bg-black/70 px-3 py-2 text-white">
            <Dialog.Title className="min-w-0 flex-1 truncate text-sm font-medium">{current?.name}</Dialog.Title>
            {images.length > 1 && (
              <span className="text-xs text-white/70 tabular-nums">{t('viewer.counter', { current: (index ?? 0) + 1, total: images.length })}</span>
            )}
            <button type="button" className={tool} onClick={() => zoomBy(-1)} aria-label={t('viewer.zoomOut')} title={t('viewer.zoomOut')}>
              <ZoomOut className="size-4" />
            </button>
            <span className="w-12 text-center text-xs text-white/80 tabular-nums">{zoom === null ? t('viewer.fit') : `${Math.round(zoom * 100)}%`}</span>
            <button type="button" className={tool} onClick={() => zoomBy(1)} aria-label={t('viewer.zoomIn')} title={t('viewer.zoomIn')}>
              <ZoomIn className="size-4" />
            </button>
            <button type="button" className={tool} onClick={() => setZoom(null)} aria-label={t('viewer.fitScreen')} title={t('viewer.fitScreen')}>
              <Maximize2 className="size-4" />
            </button>
            {current && (
              <a className={tool} href={current.downloadUrl ?? current.src} download={current.name} aria-label={t('viewer.download')} title={t('viewer.download')}>
                <Download className="size-4" />
              </a>
            )}
            <Dialog.Close className={tool} aria-label={t('common.close')}>
              <X className="size-5" />
            </Dialog.Close>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {images.length > 1 && (
              <button type="button" className={cn(tool, 'absolute left-3 z-10 size-11 rounded-full bg-black/40')} onClick={() => go(-1)} aria-label={t('viewer.previous')}>
                <ChevronLeft className="size-6" />
              </button>
            )}
            <div className={cn('size-full', zoom === null ? 'flex items-center justify-center p-4' : 'overflow-auto')}>
              {current && (
                <img
                  key={current.id}
                  src={current.src}
                  alt={current.name}
                  className={cn('select-none', zoom === null ? 'max-h-full max-w-full object-contain' : 'm-auto block max-w-none')}
                  style={zoom === null ? undefined : { width: `${zoom * 100}%` }}
                  draggable={false}
                />
              )}
            </div>
            {images.length > 1 && (
              <button type="button" className={cn(tool, 'absolute right-3 z-10 size-11 rounded-full bg-black/40')} onClick={() => go(1)} aria-label={t('viewer.next')}>
                <ChevronRight className="size-6" />
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
