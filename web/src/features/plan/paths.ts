/** Endereço da Gestão de projetos (item próprio do menu lateral). */
export const MANAGEMENT_PATH = '/project-management'

/** Gestão de projetos de um projeto, com os parâmetros da tela (visão, painel do elemento…). */
export function managementLink(projectId: string, params?: URLSearchParams | Record<string, string>): string {
  const search = new URLSearchParams(params).toString()
  return `${MANAGEMENT_PATH}/${encodeURIComponent(projectId)}${search ? `?${search}` : ''}`
}
