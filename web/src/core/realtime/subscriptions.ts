/**
 * Envio das assinaturas do tempo real (POST /api/realtime do PocketBase): o cookie da sessão vai junto
 * (mesma origem) e o header de CSRF, como nas mutações da API.
 */

export function realtimeUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/v1\/?$/, '')}/realtime`
}

export function createSubscriptionSender(url: string) {
  return async (clientId: string, topics: string[]): Promise<void> => {
    await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'kamban' },
      body: JSON.stringify({ clientId, subscriptions: topics }),
    })
  }
}
