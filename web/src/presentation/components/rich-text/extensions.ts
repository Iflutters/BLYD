import type { AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { isSafeDocHref } from '@/domain/docs'
import { Callout, DocImage, TableOfContents } from './nodes'
import { SlashCommand, type SlashCommandOptions } from './slash-menu'

export interface RichTextExtensionOptions {
  /** Só na edição: texto de ajuda da linha vazia e o menu "/". */
  editing?: { placeholder: string; slash: SlashCommandOptions }
}

/**
 * Mesmo conjunto de blocos na edição e na leitura (a página aparece igual nos dois modos).
 * Só existe o que o servidor aceita — o resto ele removeria ao salvar.
 */
export function richTextExtensions({ editing }: RichTextExtensionOptions = {}): AnyExtension[] {
  const base: AnyExtension[] = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => isSafeDocHref(url),
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
    }),
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    DocImage,
    Callout,
    TableOfContents,
  ]
  if (!editing) return base
  return [...base, Placeholder.configure({ placeholder: editing.placeholder }), SlashCommand.configure(editing.slash)]
}
