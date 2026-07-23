export interface Player {
  player_id: number;
  full_name: string;
  position: string;
  team_id: number | null;
}

export interface Team {
  team_id: number;
  abbrev: string;
  name: string;
}
