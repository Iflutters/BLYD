import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import {
  Bold,
  ChevronDown,
  Code,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListChecks,
  Loader2,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Undo2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CALLOUT_TONES, IMAGE_WIDTHS, normalizeDocHref, type RichContent } from '@/domain/docs'
import { cn } from '@/core/utils/cn'
import { AppButton } from '../AppButton'
import { AppDialog } from '../AppDialog'
import { AppDropdown, type AppDropdownItem } from '../AppDropdown'
import { AppIconButton } from '../AppIconButton'
import { AppTextField } from '../AppTextField'
import { BLOCK_COMMANDS, type UploadKind } from './block-commands'
import { richTextExtensions } from './extensions'
import { CALLOUT_ICONS } from './callout-icons'

export interface RichTextUpload {
  url: string
  name: string
  kind: 'image' | 'document'
}

export interface AppRichTextEditorProps {
  /** Conteúdo inicial (o editor é não controlado; troque a `key` para recarregar). */
  defaultValue: RichContent
  onChange: (value: RichContent) => void
  /** Envia arquivos (seletor, colar ou arrastar) e devolve os endereços; imagens entram no texto, demais viram link. */
  onUpload?: (files: File[]) => Promise<RichTextUpload[]>
  /** Nome acessível da área de edição. */
  label: string
  placeholder?: string
  className?: string
}

/** Ações que as extensões (criadas uma vez) chamam — sempre a versão atual, via ref. */
interface EditorActions {
  requestUpload: (kind: UploadKind) => void
  insertFiles: (files: File[], pos?: number) => Promise<void>
  openLink: () => void
}

const HEADINGS = [1, 2, 3, 4] as const
type BlockKind = 'paragraph' | `heading${(typeof HEADINGS)[number]}`

function snapshot(editor: Editor) {
  const heading = HEADINGS.find((level) => editor.isActive('heading', { level }))
  return {
    block: (heading ? `heading${heading}` : 'paragraph') as BlockKind,
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    code: editor.isActive('code'),
    highlight: editor.isActive('highlight'),
    link: editor.isActive('link'),
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    taskList: editor.isActive('taskList'),
    blockquote: editor.isActive('blockquote'),
    callout: editor.isActive('callout'),
    table: editor.isActive('table'),
    image: editor.isActive('image'),
    imageWidth: (editor.getAttributes('image').width as number | null) ?? null,
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    canMerge: editor.can().mergeCells(),
    canSplit: editor.can().splitCell(),
  }
}

/**
 * Editor de documentos (estilo Confluence): títulos, listas, tarefas, citações, código,
 * destaques, tabelas, imagens, anexos, sumário e menu "/". Grava JSON estruturado — o servidor
 * higieniza tudo (nada de HTML cru). Colar ou arrastar imagens envia pelo `onUpload`.
 */
export function AppRichTextEditor({ defaultValue, onChange, onUpload, label, placeholder, className }: AppRichTextEditorProps) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(0)
  const [linkOpen, setLinkOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [accept, setAccept] = useState<UploadKind>('image')
  const onChangeRef = useRef(onChange)
  const onUploadRef = useRef(onUpload)
  const actionsRef = useRef<EditorActions>({ requestUpload: () => undefined, insertFiles: async () => undefined, openLink: () => undefined })
  useEffect(() => {
    onChangeRef.current = onChange
    onUploadRef.current = onUpload
  })

  const editor = useEditor({
    extensions: richTextExtensions({
      editing: {
        placeholder: placeholder ?? t('richText.placeholder'),
        slash: { label: (key) => t(`richText.blocks.${key}.label`), context: () => ({ requestUpload: (kind) => actionsRef.current.requestUpload(kind) }) },
      },
    }),
    content: defaultValue,
    editorProps: {
      attributes: {
        class: 'kb-rich min-h-[50vh] px-4 py-5 sm:px-8',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? [])
        if (!files.length || !onUploadRef.current) return false
        void actionsRef.current.insertFiles(files)
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (moved || !files.length || !onUploadRef.current) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        void actionsRef.current.insertFiles(files, pos)
        return true
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault()
          actionsRef.current.openLink()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: current }) => onChangeRef.current(current.getJSON() as RichContent),
  })

  useEffect(() => {
    actionsRef.current = {
      requestUpload: (kind) => {
        setAccept(kind)
        // o atributo accept precisa estar aplicado antes de abrir o seletor
        requestAnimationFrame(() => fileRef.current?.click())
      },
      insertFiles: async (files, pos) => {
        const upload = onUploadRef.current
        if (!upload || !files.length) return
        setUploading((n) => n + 1)
        try {
          const uploaded = await upload(files)
          const content = uploaded.map((file) =>
            file.kind === 'image'
              ? { type: 'image', attrs: { src: file.url, alt: file.name } }
              : { type: 'paragraph', content: [{ type: 'text', text: file.name, marks: [{ type: 'link', attrs: { href: file.url } }] }] },
          )
          if (!content.length) return
          const chain = editor.chain().focus()
          void (pos === undefined ? chain.insertContent(content) : chain.insertContentAt(pos, content)).run()
          // imagem no fim do bloco fica selecionada — o próximo bloco a substituiria; abre uma linha depois dela
          if (editor.state.selection instanceof NodeSelection) editor.commands.createParagraphNear()
        } finally {
          setUploading((n) => n - 1)
        }
      },
      openLink: () => setLinkOpen(true),
    }
  }, [editor])

  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <Toolbar editor={editor} uploading={uploading > 0} canUpload={!!onUpload} onRequestUpload={(kind) => actionsRef.current.requestUpload(kind)} onLink={() => setLinkOpen(true)} />
      <EditorContent editor={editor} className="min-w-0" />
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept={accept === 'image' ? 'image/png,image/jpeg,image/gif,image/webp' : undefined}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          void actionsRef.current.insertFiles(files)
        }}
      />
      <LinkDialog editor={editor} open={linkOpen} onOpenChange={setLinkOpen} />
    </div>
  )
}

interface ToolbarProps {
  editor: Editor
  uploading: boolean
  canUpload: boolean
  onRequestUpload: (kind: UploadKind) => void
  onLink: () => void
}

function ToolButton({ label, icon, active, disabled, onClick }: { label: string; icon: ReactNode; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <AppIconButton
      size="sm"
      label={label}
      icon={icon}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(active && 'bg-primary-soft text-primary-soft-fg hover:bg-primary-soft hover:text-primary-soft-fg')}
    />
  )
}

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />

function Toolbar({ editor, uploading, canUpload, onRequestUpload, onLink }: ToolbarProps) {
  const { t } = useTranslation()
  const s = useEditorState({ editor, selector: ({ editor: current }) => snapshot(current) })
  const chain = () => editor.chain().focus()
  const backToText = () => editor.commands.focus()

  const blockItems: AppDropdownItem[] = [
    { key: 'paragraph', label: t('richText.blocks.paragraph.label'), onSelect: () => void chain().setParagraph().run() },
    ...HEADINGS.map((level) => ({ key: `h${level}`, label: t('richText.heading', { level }), onSelect: () => void chain().setHeading({ level }).run() })),
  ]
  const insertItems: AppDropdownItem[] = BLOCK_COMMANDS.filter((c) => !['paragraph', 'heading1', 'heading2', 'heading3'].includes(c.key))
    .filter((c) => canUpload || (c.key !== 'image' && c.key !== 'file'))
    .map((command) => {
      const Icon = command.icon
      return { key: command.key, label: t(`richText.blocks.${command.key}.label`), icon: <Icon />, onSelect: () => command.run(chain(), { requestUpload: onRequestUpload }) }
    })
  const tableItems: AppDropdownItem[] = [
    { key: 'rowBefore', label: t('richText.table.rowBefore'), onSelect: () => void chain().addRowBefore().run() },
    { key: 'rowAfter', label: t('richText.table.rowAfter'), onSelect: () => void chain().addRowAfter().run() },
    { key: 'colBefore', label: t('richText.table.colBefore'), onSelect: () => void chain().addColumnBefore().run() },
    { key: 'colAfter', label: t('richText.table.colAfter'), onSelect: () => void chain().addColumnAfter().run() },
    { type: 'separator', key: 's1' },
    { key: 'header', label: t('richText.table.toggleHeader'), onSelect: () => void chain().toggleHeaderRow().run() },
    { key: 'merge', label: t('richText.table.merge'), disabled: !s.canMerge, onSelect: () => void chain().mergeCells().run() },
    { key: 'split', label: t('richText.table.split'), disabled: !s.canSplit, onSelect: () => void chain().splitCell().run() },
    { type: 'separator', key: 's2' },
    { key: 'delRow', label: t('richText.table.deleteRow'), tone: 'danger', onSelect: () => void chain().deleteRow().run() },
    { key: 'delCol', label: t('richText.table.deleteColumn'), tone: 'danger', onSelect: () => void chain().deleteColumn().run() },
    { key: 'delTable', label: t('richText.table.delete'), tone: 'danger', onSelect: () => void chain().deleteTable().run() },
  ]
  const calloutItems: AppDropdownItem[] = [
    ...CALLOUT_TONES.map((tone) => {
      const Icon = CALLOUT_ICONS[tone]
      return { key: tone, label: t(`richText.callout.${tone}`), icon: <Icon />, onSelect: () => void chain().setCallout(tone).run() }
    }),
    { type: 'separator', key: 's' },
    { key: 'remove', label: t('richText.callout.remove'), onSelect: () => void chain().unsetCallout().run() },
  ]
  const imageItems: AppDropdownItem[] = [
    ...IMAGE_WIDTHS.map((width) => ({
      type: 'checkbox' as const,
      key: String(width),
      label: `${width}%`,
      checked: s.imageWidth === width,
      onCheckedChange: () => void chain().updateAttributes('image', { width }).run(),
    })),
    { type: 'checkbox', key: 'auto', label: t('richText.image.original'), checked: s.imageWidth === null, onCheckedChange: () => void chain().updateAttributes('image', { width: null }).run() },
  ]
  const blockLabel = s.block === 'paragraph' ? t('richText.blocks.paragraph.label') : t('richText.heading', { level: Number(s.block.slice(7)) })
  const menuButton = (text: string, icon?: ReactNode) => (
    <AppButton variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} leftIcon={icon} rightIcon={<ChevronDown />}>
      {text}
    </AppButton>
  )

  return (
    <div
      role="toolbar"
      aria-label={t('richText.toolbar')}
      className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-border bg-surface/95 px-2 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-surface/85"
    >
      <ToolButton label={t('richText.undo')} icon={<Undo2 />} disabled={!s.canUndo} onClick={() => void chain().undo().run()} />
      <ToolButton label={t('richText.redo')} icon={<Redo2 />} disabled={!s.canRedo} onClick={() => void chain().redo().run()} />
      <Divider />
      <AppDropdown align="start" onCloseFocus={backToText} trigger={menuButton(blockLabel)} items={blockItems} />
      <Divider />
      <ToolButton label={t('richText.bold')} icon={<Bold />} active={s.bold} onClick={() => void chain().toggleBold().run()} />
      <ToolButton label={t('richText.italic')} icon={<Italic />} active={s.italic} onClick={() => void chain().toggleItalic().run()} />
      <ToolButton label={t('richText.underline')} icon={<Underline />} active={s.underline} onClick={() => void chain().toggleUnderline().run()} />
      <ToolButton label={t('richText.strike')} icon={<Strikethrough />} active={s.strike} onClick={() => void chain().toggleStrike().run()} />
      <ToolButton label={t('richText.highlight')} icon={<Highlighter />} active={s.highlight} onClick={() => void chain().toggleHighlight().run()} />
      <ToolButton label={t('richText.code')} icon={<Code />} active={s.code} onClick={() => void chain().toggleCode().run()} />
      <ToolButton label={t('richText.link.title')} icon={<Link2 />} active={s.link} onClick={onLink} />
      <Divider />
      <ToolButton label={t('richText.blocks.bulletList.label')} icon={<List />} active={s.bulletList} onClick={() => void chain().toggleBulletList().run()} />
      <ToolButton label={t('richText.blocks.orderedList.label')} icon={<ListOrdered />} active={s.orderedList} onClick={() => void chain().toggleOrderedList().run()} />
      <ToolButton label={t('richText.blocks.taskList.label')} icon={<ListChecks />} active={s.taskList} onClick={() => void chain().toggleTaskList().run()} />
      <ToolButton label={t('richText.blocks.quote.label')} icon={<Quote />} active={s.blockquote} onClick={() => void chain().toggleBlockquote().run()} />
      {canUpload && <ToolButton label={t('richText.blocks.image.label')} icon={<ImagePlus />} onClick={() => onRequestUpload('image')} />}
      <ToolButton label={t('richText.blocks.table.label')} icon={<TableIcon />} active={s.table} onClick={() => void chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      <Divider />
      <AppDropdown align="start" onCloseFocus={backToText} trigger={menuButton(t('richText.insert'), <Plus />)} items={insertItems} />
      {s.table && <AppDropdown align="start" onCloseFocus={backToText} trigger={menuButton(t('richText.table.menu'))} items={tableItems} />}
      {s.callout && <AppDropdown align="start" onCloseFocus={backToText} trigger={menuButton(t('richText.callout.menu'))} items={calloutItems} />}
      {s.image && <AppDropdown align="start" onCloseFocus={backToText} trigger={menuButton(t('richText.image.width'))} items={imageItems} />}
      {uploading && (
        <span role="status" className="ml-auto flex items-center gap-1.5 px-2 text-xs text-muted">
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          {t('richText.uploading')}
        </span>
      )}
    </div>
  )
}

function LinkDialog({ editor, open, onOpenChange }: { editor: Editor; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const [href, setHref] = useState('')
  const [error, setError] = useState<string>()
  const [wasOpen, setWasOpen] = useState(open)
  const inputRef = useRef<HTMLInputElement>(null)
  // o campo recebe o foco ao abrir (depois do foco inicial do diálogo)
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])
  // ao abrir, começa com o link atual (se houver)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setHref((editor.getAttributes('link').href as string | undefined) ?? '')
      setError(undefined)
    }
  }
  const apply = () => {
    const value = normalizeDocHref(href)
    if (!value) {
      setError(t('richText.link.invalid'))
      return
    }
    const chain = editor.chain().focus().extendMarkRange('link')
    if (editor.state.selection.empty && !editor.isActive('link')) void chain.insertContent({ type: 'text', text: value, marks: [{ type: 'link', attrs: { href: value } }] }).run()
    else void chain.setLink({ href: value }).run()
    onOpenChange(false)
  }
  const remove = () => {
    void editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onOpenChange(false)
  }
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('richText.link.title')}
      description={t('richText.link.hint')}
      footer={
        <>
          {editor.isActive('link') && (
            <AppButton variant="ghost" onClick={remove} className="mr-auto">
              {t('richText.link.remove')}
            </AppButton>
          )}
          <AppButton variant="secondary" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </AppButton>
          <AppButton onClick={apply}>{t('richText.link.apply')}</AppButton>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          apply()
        }}
      >
        <AppTextField
          ref={inputRef}
          label={t('richText.link.url')}
          value={href}
          onChange={(event) => setHref(event.target.value)}
          placeholder="https://"
          error={error}
        />
      </form>
    </AppDialog>
  )
}
