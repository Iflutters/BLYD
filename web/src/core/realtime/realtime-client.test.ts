import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRealtimeClient, type EventSourceLike } from './realtime-client'

class FakeEventSource implements EventSourceLike {
  static last: FakeEventSource | null = null
  listeners = new Map<string, Set<(e: { data: string }) => void>>()
  onerror: (() => void) | null = null
  closed = false
  constructor(public url: string) {
    FakeEventSource.last = this
  }
  addEventListener(name: string, fn: (e: { data: string }) => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set())
    this.listeners.get(name)!.add(fn)
  }
  removeEventListener(name: string, fn: (e: { data: string }) => void) {
    this.listeners.get(name)?.delete(fn)
  }
  close() {
    this.closed = true
  }
  emit(name: string, data: unknown) {
    this.listeners.get(name)?.forEach((fn) => fn({ data: JSON.stringify(data) }))
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeEventSource.last = null
})
afterEach(() => vi.useRealTimers())

function setup() {
  const post = vi.fn<(clientId: string, topics: string[]) => Promise<void>>(() => Promise.resolve())
  const client = createRealtimeClient({ url: '/api/realtime', postSubscriptions: post, createEventSource: (url) => new FakeEventSource(url), idleCloseMs: 1000 })
  return { client, post }
}

describe('core/realtime — cliente', () => {
  it('conecta na primeira assinatura e envia os tópicos quando recebe o clientId', async () => {
    const { client, post } = setup()
    expect(FakeEventSource.last).toBeNull()
    client.subscribe('project:p1', () => {})
    const es = FakeEventSource.last!
    expect(es.url).toBe('/api/realtime')
    expect(client.getStatus()).toBe('connecting')
    es.emit('PB_CONNECT', { clientId: 'c1' })
    await vi.advanceTimersByTimeAsync(100)
    expect(post).toHaveBeenCalledWith('c1', ['project:p1'])
    expect(client.getStatus()).toBe('live')
  })

  it('entrega o aviso (camelCase) a quem assina o tópico; tópico novo reenvia a lista', async () => {
    const { client, post } = setup()
    const onP1 = vi.fn()
    client.subscribe('project:p1', onP1)
    const es = FakeEventSource.last!
    es.emit('PB_CONNECT', { clientId: 'c1' })
    await vi.advanceTimersByTimeAsync(100)
    es.emit('project:p1', { collection: 'tasks', action: 'update', id: 't1', project_id: 'p1', task_id: 't1', item_id: null })
    expect(onP1).toHaveBeenCalledWith({ collection: 'tasks', action: 'update', id: 't1', projectId: 'p1', taskId: 't1', itemId: null })
    client.subscribe('user:u1', () => {})
    await vi.advanceTimersByTimeAsync(100)
    expect(post).toHaveBeenLastCalledWith('c1', ['project:p1', 'user:u1'])
  })

  it('reconexão: ao cair mostra "reconectando" e, com o novo clientId, assina de novo', async () => {
    const { client, post } = setup()
    const statuses: string[] = []
    client.onStatus((s) => statuses.push(s))
    client.subscribe('project:p1', () => {})
    const es = FakeEventSource.last!
    es.emit('PB_CONNECT', { clientId: 'c1' })
    await vi.advanceTimersByTimeAsync(100)
    es.onerror?.()
    expect(client.getStatus()).toBe('reconnecting')
    es.emit('PB_CONNECT', { clientId: 'c2' })
    await vi.advanceTimersByTimeAsync(100)
    expect(post).toHaveBeenLastCalledWith('c2', ['project:p1'])
    expect(statuses).toEqual(['connecting', 'live', 'reconnecting', 'live'])
  })

  it('sem assinaturas por um tempo, fecha a conexão', async () => {
    const { client } = setup()
    const off = client.subscribe('project:p1', () => {})
    const es = FakeEventSource.last!
    es.emit('PB_CONNECT', { clientId: 'c1' })
    await vi.advanceTimersByTimeAsync(100)
    off()
    await vi.advanceTimersByTimeAsync(1100)
    expect(es.closed).toBe(true)
    expect(client.getStatus()).toBe('idle')
  })
})
