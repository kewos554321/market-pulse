const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  getWatchlist: () => request<import('../types').WatchlistItem[]>('/watchlist'),
  addStock: (symbol: string, name: string) =>
    request<import('../types').WatchlistItem>('/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol, name }),
    }),
  deleteStock: (id: string) => request<{ success: boolean }>(`/watchlist/${id}`, { method: 'DELETE' }),
  toggleStock: (id: string, enabled: boolean) =>
    request<{ success: boolean }>(`/watchlist/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  getAlgorithm: (id: string) => request<import('../types').Algorithm>(`/watchlist/${id}/algorithm`),
  saveAlgorithm: (id: string, conditions: import('../types').ConditionTree) =>
    request<{ success: boolean }>(`/watchlist/${id}/algorithm`, {
      method: 'PUT',
      body: JSON.stringify({ conditions }),
    }),
  getSignals: (limit = 50) => request<import('../types').Signal[]>(`/signals?limit=${limit}`),
  getSettings: () => request<Record<string, string>>('/settings'),
  saveSettings: (updates: Record<string, string>) =>
    request<{ success: boolean }>('/settings', { method: 'PUT', body: JSON.stringify(updates) }),
  getRecommendations: () => request<import('../types').RecommendationsResponse>('/recommendations'),
  getRecommendationStocks: () => request<import('../types').RecommendationStock[]>('/recommendation-stocks'),
  addRecommendationStock: (symbol: string, name: string) =>
    request<import('../types').RecommendationStock>('/recommendation-stocks', {
      method: 'POST',
      body: JSON.stringify({ symbol, name }),
    }),
  deleteRecommendationStock: (symbol: string) =>
    request<{ success: boolean }>(`/recommendation-stocks/${symbol}`, { method: 'DELETE' }),
};
