import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RealtimeClient, RealtimeEvent, RealtimeListener } from '@/core/realtime/realtime-client'
import { RealtimeContext } from './realtime-context'
import { useLiveProject } from './use-live'

afterEach(() => vi.useRealTimers())

function fakeRealtime() {
  const listeners = new Map<string, Set<RealtimeListener>>()
  const client: RealtimeClient = {
    subscribe(topic, listener) {
      if (!listeners.has(topic)) listeners.set(topic, new Set())
      listeners.get(topic)!.add(listener)
      return () => listeners.get(topic)?.delete(listener)
    },
    getStatus: () => 'live',
    onStatus: () => () => {},
    close: () => {},
  }
  const emit = (topic: string, event: RealtimeEvent) => listeners.get(topic)?.forEach((fn) => fn(event))
  return { client, emit, listeners }
}

function Live({ projectId }: { projectId?: string }) {
  useLiveProject(projectId)
  return null
}

describe('useLiveProject', () => {
  it('assina o tópico do projeto, junta os avisos e atualiza os dados afetados de uma vez; ao sair cancela', async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const realtime = fakeRealtime()
    const view = render(
      <QueryClientProvider client={queryClient}>
        <RealtimeContext.Provider value={realtime.client}>
          <Live projectId="p1" />
        </RealtimeContext.Provider>
      </QueryClientProvider>,
    )
    expect(realtime.listeners.get('project:p1')?.size).toBe(1)
    const base = { action: 'update' as const, projectId: 'p1', itemId: null }
    act(() => {
      realtime.emit('project:p1', { ...base, collection: 'tasks', id: 't1', taskId: 't1' })
      realtime.emit('project:p1', { ...base, collection: 'tasks', id: 't2', taskId: 't2' })
    })
    expect(invalidate).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey))
    expect(keys).toContain(JSON.stringify(['tasks', 'board', 'p1']))
    expect(keys).toContain(JSON.stringify(['tasks', 'detail', 't1']))
    expect(keys).toContain(JSON.stringify(['tasks', 'detail', 't2']))
    // o quadro aparece uma vez só, mesmo com dois avisos
    expect(keys.filter((k) => k === JSON.stringify(['tasks', 'board', 'p1']))).toHaveLength(1)
    view.unmount()
    expect(realtime.listeners.get('project:p1')?.size).toBe(0)
  })

  it('com uma alteração da própria pessoa em andamento, espera ela terminar (evita o cartão "voltar")', async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    let mutating = 1
    vi.spyOn(queryClient, 'isMutating').mockImplementation(() => mutating)
    const realtime = fakeRealtime()
    render(
      <QueryClientProvider client={queryClient}>
        <RealtimeContext.Provider value={realtime.client}>
          <Live projectId="p1" />
        </RealtimeContext.Provider>
      </QueryClientProvider>,
    )
    act(() => realtime.emit('project:p1', { collection: 'plan_items', action: 'update', id: 'i1', projectId: 'p1', taskId: null, itemId: 'i1' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(invalidate).not.toHaveBeenCalled()
    mutating = 0
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['plan', 'p1'] })
  })

  it('sem projeto não assina nada', () => {
    const realtime = fakeRealtime()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RealtimeContext.Provider value={realtime.client}>
          <Live />
        </RealtimeContext.Provider>
      </QueryClientProvider>,
    )
    expect(realtime.listeners.size).toBe(0)
  })
})
