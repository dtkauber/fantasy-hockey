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
  goals: number;
  assists: number;
  points: number;
  shots: number;
  hits: number;
  blocks: number;
  pim: number;
  total_points: number;
  points_per_game: number;
  consistency_stddev: number;
  boom_bust_ratio: number;
}

export interface PlayerProjection {
  player_id: number;
  full_name: string;
  position: string;
  team_id: number | null;
  games_played: number;
  projected_goals_per_82: number;
  projected_assists_per_82: number;
  projected_points_per_82: number;
  projected_shots_per_82: number;
  projected_hits_per_82: number;
  projected_blocks_per_82: number;
  projected_pim_per_82: number;
  projected_fantasy_points_per_82: number;
  projected_fantasy_points_per_game: number;
}

export interface Team {
  team_id: number;
  abbrev: string;
  name: string;
  conference: string | null;
  division: string | null;
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
