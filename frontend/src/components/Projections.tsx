import { useEffect, useMemo, useState } from 'react';
import { fetchProjections, fetchTeams } from '../api/client';
import type { PlayerProjection, Team } from '../api/types';
import { FilterBar } from './FilterBar';
import { PositionBadge } from './PositionBadge';
import { SortableTh } from './SortableTh';
import { useSort } from '../hooks/useSort';

const POSITIONS = ['All', 'C', 'L', 'R', 'D'];

type Row = PlayerProjection & { teamAbbrev: string };

export function Projections() {
  const [projections, setProjections] = useState<PlayerProjection[]>([]);
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
    fetchProjections({ position: position === 'All' ? undefined : position, search: search.trim() || undefined })
      .then(setProjections)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [position, search]);

  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.team_id, t])), [teams]);

  const filteredRows: Row[] = useMemo(
    () =>
      projections
        .map((p) => ({ ...p, teamAbbrev: p.team_id ? teamsById[p.team_id]?.abbrev ?? '—' : '—' }))
        .filter((p) => (teamId === 'All' ? true : String(p.team_id) === teamId))
        .filter((p) => (division === 'All' ? true : teamsById[p.team_id ?? -1]?.division === division)),
    [projections, teamsById, teamId, division],
  );

  const { sorted, sortKey, sortDir, toggleSort } = useSort<Row>(
    filteredRows,
    'projected_fantasy_points_per_82',
    'desc',
  );

  return (
    <div className="projections">
      <p className="subtitle">
        Skaters only. Each stat is this player's own rate blended with their position's league
        average, weighted by games played -- more games played this season means we trust their
        own rate more; a short, injury-shortened season gets pulled harder toward the average.
        Totals assume a full 82-game season. This is a stabilized read on current performance, not
        a forecast of improvement or decline.
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
      {loading && <p>Loading projections…</p>}

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
                <SortableTh
                  label="Proj G"
                  active={sortKey === 'projected_goals_per_82'}
                  dir={sortDir}
                  onClick={() => toggleSort('projected_goals_per_82')}
                />
                <SortableTh
                  label="Proj A"
                  active={sortKey === 'projected_assists_per_82'}
                  dir={sortDir}
                  onClick={() => toggleSort('projected_assists_per_82')}
                />
                <SortableTh
                  label="Proj PTS"
                  active={sortKey === 'projected_points_per_82'}
                  dir={sortDir}
                  onClick={() => toggleSort('projected_points_per_82')}
                />
                <SortableTh
                  label="Proj SOG"
                  active={sortKey === 'projected_shots_per_82'}
                  dir={sortDir}
                  onClick={() => toggleSort('projected_shots_per_82')}
                />
                <SortableTh
                  label="Proj HIT"
                  active={sortKey === 'projected_hits_per_82'}
                  dir={sortDir}
                  onClick={() => toggleSort('projected_hits_per_82')}
                />
                <SortableTh
                  label="Proj BLK"
                  active={sortKey === 'projected_blocks_per_82'}
                  dir={sortDir}
                  onClick={() => toggleSort('projected_blocks_per_82')}
                />
                <SortableTh
                  label="Proj FP"
                  active={sortKey === 'projected_fantasy_points_per_82'}
                  dir={sortDir}
                  onClick={() => toggleSort('projected_fantasy_points_per_82')}
                />
                <SortableTh
                  label="Proj FP/GP"
                  active={sortKey === 'projected_fantasy_points_per_game'}
                  dir={sortDir}
                  onClick={() => toggleSort('projected_fantasy_points_per_game')}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.player_id}>
                  <td>{i + 1}</td>
                  <td>{r.full_name}</td>
                  <td>
                    <PositionBadge position={r.position} />
                  </td>
                  <td>{r.teamAbbrev}</td>
                  <td>{r.games_played}</td>
                  <td>{r.projected_goals_per_82}</td>
                  <td>{r.projected_assists_per_82}</td>
                  <td>{r.projected_points_per_82}</td>
                  <td>{r.projected_shots_per_82}</td>
                  <td>{r.projected_hits_per_82}</td>
                  <td>{r.projected_blocks_per_82}</td>
                  <td>{r.projected_fantasy_points_per_82.toFixed(1)}</td>
                  <td>{r.projected_fantasy_points_per_game.toFixed(2)}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={13}>No projections match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
