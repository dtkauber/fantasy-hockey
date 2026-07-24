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
    total_points: float
    points_per_game: float


class TeamOut(BaseModel):
    team_id: int
    abbrev: str
    name: str

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
