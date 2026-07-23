from sqlalchemy import (
    Column, Integer, BigInteger, String, SmallInteger, Boolean, Numeric,
    Date, DateTime, ForeignKey, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from .database import Base


class Team(Base):
    __tablename__ = "teams"
    team_id = Column(Integer, primary_key=True)
    abbrev = Column(String(5), nullable=False)
    name = Column(String(100), nullable=False)
    conference = Column(String(20))
    division = Column(String(20))

    players = relationship("Player", back_populates="team")


class Player(Base):
    __tablename__ = "players"
    player_id = Column(Integer, primary_key=True)
    full_name = Column(String(100), nullable=False)
    position = Column(String(5), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.team_id"))
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, server_default=func.now())

    team = relationship("Team", back_populates="players")


class Game(Base):
    __tablename__ = "games"
    game_id = Column(BigInteger, primary_key=True)
    game_date = Column(Date, nullable=False)
    home_team_id = Column(Integer, ForeignKey("teams.team_id"))
    away_team_id = Column(Integer, ForeignKey("teams.team_id"))
    season = Column(String(9), nullable=False)


class PlayerGameStat(Base):
    __tablename__ = "player_game_stats"
    stat_id = Column(BigInteger, primary_key=True, autoincrement=True)
    player_id = Column(Integer, ForeignKey("players.player_id"))
    game_id = Column(BigInteger, ForeignKey("games.game_id"))
    goals = Column(SmallInteger, default=0)
    assists = Column(SmallInteger, default=0)
    plus_minus = Column(SmallInteger, default=0)
    pim = Column(SmallInteger, default=0)
    shots = Column(SmallInteger, default=0)
    hits = Column(SmallInteger, default=0)
    blocks = Column(SmallInteger, default=0)
    toi_seconds = Column(Integer, default=0)
    saves = Column(SmallInteger, nullable=True)
    goals_against = Column(SmallInteger, nullable=True)
    is_win = Column(Boolean, nullable=True)
    is_shutout = Column(Boolean, nullable=True)

    __table_args__ = (UniqueConstraint("player_id", "game_id"),)


class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class League(Base):
    __tablename__ = "leagues"
    league_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    commissioner_id = Column(Integer, ForeignKey("users.user_id"))
    max_teams = Column(SmallInteger, default=10)
    draft_status = Column(String(20), default="not_started")
    created_at = Column(DateTime, server_default=func.now())

    scoring_rules = relationship("ScoringRule", back_populates="league")
    fantasy_teams = relationship("FantasyTeam", back_populates="league")


class ScoringRule(Base):
    __tablename__ = "scoring_rules"
    rule_id = Column(Integer, primary_key=True, autoincrement=True)
    league_id = Column(Integer, ForeignKey("leagues.league_id", ondelete="CASCADE"))
    stat_name = Column(String(30), nullable=False)
    points_per = Column(Numeric(5, 2), nullable=False)

    league = relationship("League", back_populates="scoring_rules")
    __table_args__ = (UniqueConstraint("league_id", "stat_name"),)


class FantasyTeam(Base):
    __tablename__ = "fantasy_teams"
    fantasy_team_id = Column(Integer, primary_key=True, autoincrement=True)
    league_id = Column(Integer, ForeignKey("leagues.league_id", ondelete="CASCADE"))
    owner_id = Column(Integer, ForeignKey("users.user_id"))
    team_name = Column(String(100), nullable=False)
    draft_position = Column(SmallInteger, nullable=True)

    league = relationship("League", back_populates="fantasy_teams")
    __table_args__ = (UniqueConstraint("league_id", "owner_id"),)


class DraftPick(Base):
    __tablename__ = "draft_picks"
    pick_id = Column(Integer, primary_key=True, autoincrement=True)
    league_id = Column(Integer, ForeignKey("leagues.league_id", ondelete="CASCADE"))
    fantasy_team_id = Column(Integer, ForeignKey("fantasy_teams.fantasy_team_id"))
    player_id = Column(Integer, ForeignKey("players.player_id"))
    round_number = Column(SmallInteger, nullable=False)
    pick_number = Column(Integer, nullable=False)
    picked_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("league_id", "player_id"),
        UniqueConstraint("league_id", "pick_number"),
    )


class RosterSlot(Base):
    __tablename__ = "roster_slots"
    roster_slot_id = Column(Integer, primary_key=True, autoincrement=True)
    fantasy_team_id = Column(Integer, ForeignKey("fantasy_teams.fantasy_team_id", ondelete="CASCADE"))
    player_id = Column(Integer, ForeignKey("players.player_id"))
    slot_type = Column(String(10), nullable=False)
    week_start = Column(Date, nullable=False)

    __table_args__ = (UniqueConstraint("fantasy_team_id", "player_id", "week_start"),)


class WeeklyScore(Base):
    __tablename__ = "weekly_scores"
    fantasy_team_id = Column(Integer, ForeignKey("fantasy_teams.fantasy_team_id", ondelete="CASCADE"), primary_key=True)
    week_start = Column(Date, primary_key=True)
    total_points = Column(Numeric(8, 2), default=0)
