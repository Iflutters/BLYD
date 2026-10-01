import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { RichContent } from '@/domain/docs'
import { cn } from '@/core/utils/cn'
import { richTextExtensions } from './extensions'

export interface AppRichTextViewProps {
  content: RichContent
  className?: string
  /** Links internos (/docs/…) navegam dentro da aplicação em vez de abrir outra aba. */
  onNavigate?: (href: string) => void
}

/** Leitura do conteúdo rico: os mesmos blocos do editor, sem edição. */
export function AppRichTextView({ content, className, onNavigate }: AppRichTextViewProps) {
  // na leitura o conteúdo não é um campo: sem o role="textbox" que o TipTap põe por padrão
  const editor = useEditor({ extensions: richTextExtensions(), content, editable: false, editorProps: { attributes: { class: 'kb-rich', role: 'none' } } })
  const shown = useRef(content)
  const navigateRef = useRef(onNavigate)
  useEffect(() => {
    navigateRef.current = onNavigate
  })

  useEffect(() => {
    if (shown.current === content || editor.isDestroyed) return
    shown.current = content
    editor.commands.setContent(content, { emitUpdate: false })
  }, [editor, content])

  useEffect(() => {
    const dom = editor.view.dom
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest('a')
      const href = anchor?.getAttribute('href')
      if (!href || !href.startsWith('/docs/') || !navigateRef.current) return
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      navigateRef.current(href)
    }
    dom.addEventListener('click', onClick)
    return () => dom.removeEventListener('click', onClick)
  }, [editor])

  return <EditorContent editor={editor} className={cn('min-w-0', className)} />
}

