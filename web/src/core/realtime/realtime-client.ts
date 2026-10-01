/**
 * Cliente do tempo real (regras de negócio §19): uma conexão SSE com o servidor (/api/realtime, do
 * PocketBase) por aba, aberta na primeira assinatura e fechada quando ninguém mais assina. Os avisos
 * trazem só identificadores — quem recebe busca os dados de novo pela API.
 */

export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'reconnecting'

export interface RealtimeEvent {
  collection: string
  action: 'create' | 'update' | 'delete'
  id: string
  projectId: string | null
  taskId: string | null
  itemId: string | null
}

export type RealtimeListener = (event: RealtimeEvent) => void

/** O mínimo do EventSource do navegador (permite trocar nos testes). */
export interface EventSourceLike {
  addEventListener(name: string, fn: (event: { data: string }) => void): void
  removeEventListener(name: string, fn: (event: { data: string }) => void): void
  close(): void
  onerror: (() => void) | null
}

export interface RealtimeClient {
  /** Assina o tópico; devolve a função que cancela. */
  subscribe(topic: string, listener: RealtimeListener): () => void
  getStatus(): RealtimeStatus
  onStatus(listener: (status: RealtimeStatus) => void): () => void
  close(): void
}

export interface RealtimeClientOptions {
  url: string
  /** Envia a lista completa de tópicos da conexão (o servidor confere a sessão). */
  postSubscriptions: (clientId: string, topics: string[]) => Promise<void>
  createEventSource?: (url: string) => EventSourceLike
  /** Sem assinaturas por esse tempo, a conexão fecha (padrão: 15 s). */
  idleCloseMs?: number
}

interface EventDto {
  collection: string
  action: RealtimeEvent['action']
  id: string
  project_id?: string | null
  task_id?: string | null
  item_id?: string | null
}

function toEvent(dto: EventDto): RealtimeEvent {
  return { collection: dto.collection, action: dto.action, id: dto.id, projectId: dto.project_id ?? null, taskId: dto.task_id ?? null, itemId: dto.item_id ?? null }
}

export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const create = options.createEventSource ?? ((url: string) => new EventSource(url) as unknown as EventSourceLike)
  const idleCloseMs = options.idleCloseMs ?? 15_000
  const topics = new Map<string, Set<RealtimeListener>>()
  const handlers = new Map<string, (event: { data: string }) => void>()
  const statusListeners = new Set<(status: RealtimeStatus) => void>()
  let source: EventSourceLike | null = null
  let clientId: string | null = null
  let status: RealtimeStatus = 'idle'
  let syncTimer: ReturnType<typeof setTimeout> | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  function setStatus(next: RealtimeStatus) {
    if (next === status) return
    status = next
    statusListeners.forEach((fn) => fn(next))
  }

  function sync() {
    if (syncTimer) clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      syncTimer = null
      if (source && clientId) void options.postSubscriptions(clientId, [...topics.keys()]).catch(() => {})
    }, 50)
  }

  function attach(topic: string) {
    if (!source || handlers.has(topic)) return
    const handler = (message: { data: string }) => {
      let event: RealtimeEvent
      try {
        event = toEvent(JSON.parse(message.data) as EventDto)
      } catch {
        return
      }
      topics.get(topic)?.forEach((fn) => fn(event))
    }
    handlers.set(topic, handler)
    source.addEventListener(topic, handler)
  }

  function open() {
    if (source) return
    setStatus('connecting')
    source = create(options.url)
    source.addEventListener('PB_CONNECT', (message) => {
      try {
        clientId = (JSON.parse(message.data) as { clientId: string }).clientId
      } catch {
        return
      }
      setStatus('live')
      sync()
    })
    // o EventSource tenta de novo sozinho; o servidor manda um clientId novo ao voltar
    source.onerror = () => setStatus('reconnecting')
    topics.forEach((_listeners, topic) => attach(topic))
  }

  function close() {
    if (idleTimer) clearTimeout(idleTimer)
    if (syncTimer) clearTimeout(syncTimer)
    idleTimer = null
    syncTimer = null
    source?.close()
    source = null
    clientId = null
    handlers.clear()
    setStatus('idle')
  }

  function subscribe(topic: string, listener: RealtimeListener) {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    const isNew = !topics.has(topic)
    if (isNew) topics.set(topic, new Set())
    topics.get(topic)!.add(listener)
    open()
    attach(topic)
    if (isNew) sync()
    return () => {
      const set = topics.get(topic)
      if (!set) return
      set.delete(listener)
      if (set.size > 0) return
      topics.delete(topic)
      const handler = handlers.get(topic)
      if (handler && source) source.removeEventListener(topic, handler)
      handlers.delete(topic)
      sync()
      if (topics.size === 0) idleTimer = setTimeout(close, idleCloseMs)
    }
  }

  return {
    subscribe,
    getStatus: () => status,
    onStatus(listener) {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    close,
  }
}

/** Cliente que não conecta (testes e ambientes sem tempo real). */
export function createNoopRealtimeClient(): RealtimeClient {
  return { subscribe: () => () => {}, getStatus: () => 'idle', onStatus: () => () => {}, close: () => {} }
}
