import { useEffect, useMemo, useState } from 'react';
import { fetchRankings, fetchTeams } from '../api/client';
import type { PlayerRanking, Team } from '../api/types';
import { FilterBar } from './FilterBar';
import { PositionBadge } from './PositionBadge';
import { SortableTh } from './SortableTh';
import { useSort } from '../hooks/useSort';

const POSITIONS = ['All', 'C', 'L', 'R', 'D', 'G'];
const RANK_MEDAL = ['rank-1', 'rank-2', 'rank-3'];

type Row = PlayerRanking & { teamAbbrev: string };

export function Rankings() {
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [position, setPosition] = useState('All');
  const [division, setDivision] = useState('All');
  const [teamId, setTeamId] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams().then(setTeams).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRankings({ position: position === 'All' ? undefined : position, search: search.trim() || undefined })
      .then(setRankings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [position, search]);

  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.team_id, t])), [teams]);

  const filteredRows: Row[] = useMemo(
    () =>
      rankings
        .map((r) => ({ ...r, teamAbbrev: r.team_id ? teamsById[r.team_id]?.abbrev ?? '—' : '—' }))
        .filter((r) => (teamId === 'All' ? true : String(r.team_id) === teamId))
        .filter((r) => (division === 'All' ? true : teamsById[r.team_id ?? -1]?.division === division)),
    [rankings, teamsById, teamId, division],
  );

  const { sorted, sortKey, sortDir, toggleSort } = useSort<Row>(filteredRows, 'total_points', 'desc');

  return (
    <div className="rankings">
      <p className="subtitle">
        Ranked by fantasy points scored so far this season (default scoring: 3/goal, 2/assist, 4/win, etc.)
        Click any column to sort.
      </p>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        position={position}
        onPositionChange={setPosition}
        positions={POSITIONS}
        teams={teams}
        teamId={teamId}
        onTeamChange={setTeamId}
        division={division}
        onDivisionChange={setDivision}
      />

      {error && <p className="error">Error: {error}</p>}
      {loading && <p>Loading rankings…</p>}

      {!loading && !error && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <SortableTh label="Name" active={sortKey === 'full_name'} dir={sortDir} onClick={() => toggleSort('full_name')} />
                <th>Pos</th>
                <th>Team</th>
                <SortableTh label="GP" active={sortKey === 'games_played'} dir={sortDir} onClick={() => toggleSort('games_played')} />
                <SortableTh label="G" active={sortKey === 'goals'} dir={sortDir} onClick={() => toggleSort('goals')} />
                <SortableTh label="A" active={sortKey === 'assists'} dir={sortDir} onClick={() => toggleSort('assists')} />
                <SortableTh label="PTS" active={sortKey === 'points'} dir={sortDir} onClick={() => toggleSort('points')} />
                <SortableTh label="SOG" active={sortKey === 'shots'} dir={sortDir} onClick={() => toggleSort('shots')} />
                <SortableTh label="HIT" active={sortKey === 'hits'} dir={sortDir} onClick={() => toggleSort('hits')} />
                <SortableTh label="BLK" active={sortKey === 'blocks'} dir={sortDir} onClick={() => toggleSort('blocks')} />
                <SortableTh label="PIM" active={sortKey === 'pim'} dir={sortDir} onClick={() => toggleSort('pim')} />
                <SortableTh label="FP" active={sortKey === 'total_points'} dir={sortDir} onClick={() => toggleSort('total_points')} />
                <SortableTh label="FP/GP" active={sortKey === 'points_per_game'} dir={sortDir} onClick={() => toggleSort('points_per_game')} />
                <SortableTh
                  label="Boom/Bust"
                  active={sortKey === 'boom_bust_ratio'}
                  dir={sortDir}
                  onClick={() => toggleSort('boom_bust_ratio')}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.player_id}>
                  <td className={RANK_MEDAL[i] ? `rank-medal ${RANK_MEDAL[i]}` : ''}>{i + 1}</td>
                  <td>{r.full_name}</td>
                  <td>
                    <PositionBadge position={r.position} />
                  </td>
                  <td>{r.teamAbbrev}</td>
                  <td>{r.games_played}</td>
                  <td>{r.goals}</td>
                  <td>{r.assists}</td>
                  <td>{r.points}</td>
                  <td>{r.shots}</td>
                  <td>{r.hits}</td>
                  <td>{r.blocks}</td>
                  <td>{r.pim}</td>
                  <td>{r.total_points.toFixed(1)}</td>
                  <td>{r.points_per_game.toFixed(2)}</td>
                  <td title="Coefficient of variation of per-game fantasy points -- lower means more consistent week to week">
                    {r.boom_bust_ratio.toFixed(2)}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={15}>
                    No ranked players match these filters — historical stats may not be synced yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
