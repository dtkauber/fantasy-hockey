from pydantic import BaseModel
from datetime import date


class PlayerOut(BaseModel):
    player_id: int
    full_name: str
    position: str
    team_id: int | None = None

    class Config:
        from_attributes = True


class PlayerRankingOut(BaseModel):
    player_id: int
    full_name: str
    position: str
    team_id: int | None = None
    games_played: int
    goals: int
    assists: int
    points: int
    shots: int
    hits: int
    blocks: int
    pim: int
    total_points: float
    points_per_game: float
    consistency_stddev: float
    boom_bust_ratio: float


class PlayerProjectionOut(BaseModel):
    player_id: int
    full_name: str
    position: str
    team_id: int | None = None
    games_played: int
    projected_goals_per_82: float
    projected_assists_per_82: float
    projected_points_per_82: float
    projected_shots_per_82: float
    projected_hits_per_82: float
    projected_blocks_per_82: float
    projected_pim_per_82: float
    projected_fantasy_points_per_82: float
    projected_fantasy_points_per_game: float


class TeamOut(BaseModel):
    team_id: int
    abbrev: str
    name: str
    conference: str | None = None
    division: str | None = None

    class Config:
        from_attributes = True


class LeagueCreate(BaseModel):
    name: str
    commissioner_id: int | None = None
    max_teams: int = 10


class LeagueOut(BaseModel):
    league_id: int
    name: str
    commissioner_id: int | None = None
    max_teams: int
    draft_status: str

    class Config:
        from_attributes = True


class FantasyTeamCreate(BaseModel):
    league_id: int
    owner_id: int | None = None
    team_name: str


class FantasyTeamOut(BaseModel):
    fantasy_team_id: int
    league_id: int
    owner_id: int | None = None
    team_name: str
    draft_position: int | None = None

    class Config:
        from_attributes = True


class DraftPickCreate(BaseModel):
    league_id: int
    fantasy_team_id: int
    player_id: int


class DraftPickOut(BaseModel):
    pick_id: int
    fantasy_team_id: int
    player_id: int
    round_number: int
    pick_number: int

    class Config:
        from_attributes = True
