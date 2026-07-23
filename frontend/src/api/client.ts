import type { Player, Team } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function fetchPlayers(params: { position?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (params.position) query.set('position', params.position);
  if (params.search) query.set('search', params.search);
  query.set('limit', '200');
  return get<Player[]>(`/players?${query.toString()}`);
}

export function fetchTeams() {
  return get<Team[]>('/teams');
}
