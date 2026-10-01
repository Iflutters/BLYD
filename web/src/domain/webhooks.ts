/**
 * Webhooks (regras de negócio §18): a plataforma avisa outros sistemas, com um POST assinado, quando
 * algo do catálogo acontece. A assinatura de eventos aceita o grupo inteiro ("task.*") ou eventos avulsos.
 */

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed'

export interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  active: boolean
  lastStatus: number | null
  lastDeliveryAt: Date | null
  consecutiveFailures: number
  createdAt: Date | null
}

export interface CreatedWebhook extends Webhook {
  /** Segredo de assinatura — só na criação (e ao gerar outro). */
  secret: string
}

export interface WebhookInput {
  name: string
  url: string
  events: string[]
  active: boolean
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  event: string
  status: WebhookDeliveryStatus
  attempts: number
  responseStatus: number | null
  responseBody: string | null
  error: string | null
  durationMs: number | null
  nextAttemptAt: Date | null
  deliveredAt: Date | null
  createdAt: Date | null
}

export interface WebhookCatalog {
  events: string[]
  groups: string[]
}

export function groupOf(event: string): string {
  return event.split('.')[0] ?? event
}

/** Eventos agrupados, na ordem do catálogo. */
export function groupsOf(catalog: readonly string[]): { group: string; events: string[] }[] {
  const out: { group: string; events: string[] }[] = []
  catalog.forEach((event) => {
    const group = groupOf(event)
    const current = out.find((g) => g.group === group)
    if (current) current.events.push(event)
    else out.push({ group, events: [event] })
  })
  return out
}

export function isSelected(selection: readonly string[], event: string): boolean {
  return selection.includes(event) || selection.includes(`${groupOf(event)}.*`)
}

/** Marca/desmarca o grupo inteiro ("grupo.*" substitui os avulsos do grupo). */
export function toggleGroup(selection: readonly string[], group: string, on: boolean): string[] {
  const rest = selection.filter((e) => groupOf(e) !== group)
  return on ? [...rest, `${group}.*`] : rest
}

/**
 * Marca/desmarca um evento. Desmarcar um evento de um grupo inteiro marcado vira os demais avulsos
 * (`catalog` dá a lista do grupo).
 */
export function toggleEvent(selection: readonly string[], event: string, on: boolean, catalog: readonly string[] = []): string[] {
  const group = groupOf(event)
  const wildcard = `${group}.*`
  if (on) return selection.includes(event) || selection.includes(wildcard) ? [...selection] : [...selection, event]
  if (selection.includes(wildcard)) {
    const others = catalog.filter((e) => groupOf(e) === group && e !== event)
    return [...selection.filter((e) => e !== wildcard), ...others]
  }
  return selection.filter((e) => e !== event)
}

/** Grupos inteiros assinados e quantos eventos do catálogo isso cobre. */
export function eventSummary(selection: readonly string[], catalog: readonly string[]): { groups: string[]; count: number } {
  const groups = selection.filter((e) => e.endsWith('.*')).map((e) => e.slice(0, -2))
  return { groups, count: catalog.filter((e) => isSelected(selection, e)).length }
}
