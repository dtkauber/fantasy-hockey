export interface Player {
  player_id: number;
  full_name: string;
  position: string;
  team_id: number | null;
}

export interface PlayerRanking {
  player_id: number;
  full_name: string;
  position: string;
  team_id: number | null;
  games_played: number;
  total_points: number;
  points_per_game: number;
}

export interface Team {
  team_id: number;
  abbrev: string;
  name: string;
}

export interface League {
  league_id: number;
  name: string;
  commissioner_id: number | null;
  max_teams: number;
  draft_status: string;
}

export interface FantasyTeam {
  fantasy_team_id: number;
  league_id: number;
  owner_id: number | null;
  team_name: string;
  draft_position: number | null;
}

export interface DraftPick {
  pick_id: number;
  fantasy_team_id: number;
  player_id: number;
  round_number: number;
  pick_number: number;
}

export interface OnTheClock {
  fantasy_team_id: number;
  team_name: string;
  next_pick_number: number;
}
