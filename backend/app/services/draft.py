"""
Snake draft logic. Turn order reverses every round:
Round 1: team 1, 2, 3, ... N
Round 2: team N, N-1, ..., 1
Round 3: team 1, 2, 3, ... N  (etc.)

This module is pure logic (no DB writes) plus one function that validates
and records a pick -- kept separate so the ordering math is easy to unit test.
"""
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..models import DraftPick, FantasyTeam, League


def pick_number_to_team_index(pick_number: int, num_teams: int) -> int:
    """
    Overall pick_number (1-indexed) -> 0-indexed team slot in draft order.
    """
    round_number = (pick_number - 1) // num_teams  # 0-indexed
    position_in_round = (pick_number - 1) % num_teams  # 0-indexed
    if round_number % 2 == 0:
        return position_in_round
    return num_teams - 1 - position_in_round


def pick_number_to_round(pick_number: int, num_teams: int) -> int:
    """1-indexed round number for a given overall pick number."""
    return (pick_number - 1) // num_teams + 1


def get_next_pick_number(db: Session, league_id: int) -> int:
    last_pick = (
        db.query(DraftPick)
        .filter(DraftPick.league_id == league_id)
        .order_by(DraftPick.pick_number.desc())
        .first()
    )
    return (last_pick.pick_number + 1) if last_pick else 1


def get_team_on_the_clock(db: Session, league_id: int) -> FantasyTeam | None:
    teams = (
        db.query(FantasyTeam)
        .filter(FantasyTeam.league_id == league_id)
        .order_by(FantasyTeam.draft_position)
        .all()
    )
    if not teams:
        return None
    next_pick_number = get_next_pick_number(db, league_id)
    team_index = pick_number_to_team_index(next_pick_number, len(teams))
    return teams[team_index]


class DraftError(Exception):
    pass


def make_pick(db: Session, league_id: int, fantasy_team_id: int, player_id: int) -> DraftPick:
    """
    Validates it's this team's turn, the player is undrafted in this league,
    and records the pick. Raises DraftError on any violation.
    """
    on_the_clock = get_team_on_the_clock(db, league_id)
    if on_the_clock is None:
        raise DraftError("No teams found for this league.")
    if on_the_clock.fantasy_team_id != fantasy_team_id:
        raise DraftError(
            f"It's not your turn. {on_the_clock.team_name} is currently on the clock."
        )

    num_teams = db.query(FantasyTeam).filter(FantasyTeam.league_id == league_id).count()
    pick_number = get_next_pick_number(db, league_id)
    round_number = pick_number_to_round(pick_number, num_teams)

    pick = DraftPick(
        league_id=league_id,
        fantasy_team_id=fantasy_team_id,
        player_id=player_id,
        round_number=round_number,
        pick_number=pick_number,
    )
    db.add(pick)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DraftError("That player has already been drafted in this league.")
    db.refresh(pick)
    return pick
