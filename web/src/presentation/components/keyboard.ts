export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Tecla modificadora exibida nas dicas de atalho. */
export const modKey = isMac ? '⌘' : 'Ctrl'
