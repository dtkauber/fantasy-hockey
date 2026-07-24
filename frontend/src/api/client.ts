import type { DraftPick, FantasyTeam, League, OnTheClock, Player, PlayerProjection, PlayerRanking, Team } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function fetchPlayers(
  params: { position?: string; search?: string; undraftedInLeague?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.position) query.set('position', params.position);
  if (params.search) query.set('search', params.search);
  if (params.undraftedInLeague) query.set('undrafted_in_league', String(params.undraftedInLeague));
  query.set('limit', '200');
  return get<Player[]>(`/players?${query.toString()}`);
}

export function fetchTeams() {
  return get<Team[]>('/teams');
}

export function fetchRankings(params: { position?: string; search?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (params.position) query.set('position', params.position);
  if (params.search) query.set('search', params.search);
  query.set('limit', String(params.limit ?? 150));
  return get<PlayerRanking[]>(`/players/rankings?${query.toString()}`);
}

export function fetchProjections(params: { position?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (params.position) query.set('position', params.position);
  if (params.search) query.set('search', params.search);
  query.set('limit', '150');
  return get<PlayerProjection[]>(`/players/projections?${query.toString()}`);
}

export function fetchPlayer(playerId: number) {
  return get<Player>(`/players/${playerId}`);
}

export function fetchLeagues() {
  return get<League[]>('/leagues');
}

export function createLeague(params: { name: string; max_teams: number }) {
  return post<League>('/leagues', params);
}

export function fetchLeagueTeams(leagueId: number) {
  return get<FantasyTeam[]>(`/leagues/${leagueId}/teams`);
}

export function createFantasyTeam(params: { league_id: number; team_name: string }) {
  return post<FantasyTeam>('/leagues/teams', params);
}

export function fetchDraftBoard(leagueId: number) {
  return get<DraftPick[]>(`/draft/${leagueId}/board`);
}

export function fetchOnTheClock(leagueId: number) {
  return get<OnTheClock>(`/draft/${leagueId}/on-the-clock`);
}

export function makePick(params: { league_id: number; fantasy_team_id: number; player_id: number }) {
  return post<DraftPick>('/draft/pick', params);
}
