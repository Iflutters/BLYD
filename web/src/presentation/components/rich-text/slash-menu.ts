/**
 * Menu "/" do editor: digitar "/" abre a lista de blocos (títulos, listas, tabela, imagem…),
 * filtrada pelo que se digita em seguida. Setas escolhem, Enter insere, Esc fecha.
 */
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { exitSuggestion, type SuggestionProps } from '@tiptap/suggestion'
import { filterBlockCommands, type BlockCommand, type BlockCommandContext } from './block-commands'
import { SlashMenuList, type SlashMenuHandle, type SlashMenuListProps } from './SlashMenuList'

export interface SlashCommandOptions {
  /** Nome traduzido do bloco (para o filtro). */
  label: (key: string) => string
  /** Ações do editor que os blocos usam (ex.: abrir o seletor de arquivos). */
  context: () => BlockCommandContext
}

const slashKey = new PluginKey('slashCommand')
const MENU_WIDTH = 288
const MENU_HEIGHT = 320

/** Posiciona o menu junto ao "/" (abaixo; acima se não couber), sem sair da tela. */
function place(element: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return
  const below = rect.bottom + 6
  const top = below + MENU_HEIGHT > window.innerHeight && rect.top - MENU_HEIGHT - 6 > 0 ? rect.top - MENU_HEIGHT - 6 : below
  Object.assign(element.style, {
    position: 'fixed',
    zIndex: '60',
    top: `${top}px`,
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8))}px`,
  })
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',
  addOptions() {
    return { label: (key) => key, context: () => ({ requestUpload: () => undefined }) }
  },
  addProseMirrorPlugins() {
    const options = this.options
    return [
      Suggestion<BlockCommand, BlockCommand>({
        editor: this.editor,
        pluginKey: slashKey,
        char: '/',
        // nada de menu dentro de bloco de código
        allow: ({ state, range }) => state.doc.resolve(range.from).parent.type.name !== 'codeBlock',
        items: ({ query }) => filterBlockCommands(query, options.label),
        command: ({ editor, range, props }) => props.run(editor.chain().focus().deleteRange(range), options.context()),
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle, SlashMenuListProps> | null = null
          const close = () => {
            renderer?.element.remove()
            renderer?.destroy()
            renderer = null
          }
          return {
            onStart: (props: SuggestionProps<BlockCommand, BlockCommand>) => {
              renderer = new ReactRenderer(SlashMenuList, { props: { items: props.items, command: props.command }, editor: props.editor })
              document.body.appendChild(renderer.element)
              place(renderer.element as HTMLElement, props.clientRect?.())
            },
            onUpdate: (props: SuggestionProps<BlockCommand, BlockCommand>) => {
              renderer?.updateProps({ items: props.items, command: props.command })
              if (renderer) place(renderer.element as HTMLElement, props.clientRect?.())
            },
            onKeyDown: ({ event, view }) => {
              if (event.key === 'Escape') {
                exitSuggestion(view, slashKey)
                close()
                return true
              }
              return renderer?.ref?.onKeyDown(event) ?? false
            },
            onExit: close,
          }
        },
      }),
    ]
  },
})
