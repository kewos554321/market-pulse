export interface EmailRecipient {
  id: string;
  email: string;
  label: string | null;
  created_at: string;
}

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
  getWatchlist: (assetType?: string) => {
    const qs = assetType ? `?asset_type=${assetType}` : '';
    return request<import('../types').WatchlistItem[]>(`/watchlist${qs}`);
  },
  addStock: (symbol: string, name: string, assetType = 'tw_stock') =>
    request<import('../types').WatchlistItem>('/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol, name, asset_type: assetType }),
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
  getSignals: (limit = 50, assetType?: string) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (assetType) qs.set('asset_type', assetType);
    return request<import('../types').Signal[]>(`/signals?${qs}`);
  },
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
  getEmailRecipients: () => request<EmailRecipient[]>('/email-recipients'),
  addEmailRecipient: (email: string, label?: string) =>
    request<EmailRecipient>('/email-recipients', {
      method: 'POST',
      body: JSON.stringify({ email, label }),
    }),
  deleteEmailRecipient: (id: string) =>
    request<{ success: boolean }>(`/email-recipients/${id}`, { method: 'DELETE' }),
  getGroups: () => request<import('../types').Group[]>('/groups'),
  createGroup: (name: string) =>
    request<import('../types').Group>('/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  deleteGroup: (id: string) => request<{ success: boolean }>(`/groups/${id}`, { method: 'DELETE' }),
  setWatchlistGroups: (watchlistId: string, groupIds: string[]) =>
    request<{ success: boolean }>(`/watchlist/${watchlistId}/groups`, {
      method: 'PUT',
      body: JSON.stringify({ groupIds }),
    }),
};
