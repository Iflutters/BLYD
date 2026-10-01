/** Endereços da documentação na aplicação. */
export const spacePath = (spaceKey: string) => `/docs/${encodeURIComponent(spaceKey)}`
export const pagePath = (spaceKey: string, pageId: string) => `${spacePath(spaceKey)}/${encodeURIComponent(pageId)}`
export const editPath = (spaceKey: string, pageId: string) => `${pagePath(spaceKey, pageId)}/edit`
