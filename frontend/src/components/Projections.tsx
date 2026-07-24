import { useEffect, useMemo, useState } from 'react';
import { fetchProjections, fetchTeams } from '../api/client';
import type { PlayerProjection, Team } from '../api/types';

const POSITIONS = ['All', 'C', 'L', 'R', 'D'];

export function Projections() {
  const [projections, setProjections] = useState<PlayerProjection[]>([]);
  const [teamsById, setTeamsById] = useState<Record<number, Team>>({});
  const [position, setPosition] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams()
      .then((teams) => setTeamsById(Object.fromEntries(teams.map((t) => [t.team_id, t]))))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProjections({ position: position === 'All' ? undefined : position, search: search.trim() || undefined })
      .then(setProjections)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [position, search]);

  const rows = useMemo(
    () =>
      projections.map((p) => ({
        ...p,
        teamAbbrev: p.team_id ? teamsById[p.team_id]?.abbrev ?? '—' : '—',
      })),
    [projections, teamsById],
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

      <div className="controls">
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={position} onChange={(e) => setPosition(e.target.value)}>
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">Error: {error}</p>}
      {loading && <p>Loading projections…</p>}

      {!loading && !error && (
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Pos</th>
              <th>Team</th>
              <th>GP</th>
              <th>Proj G</th>
              <th>Proj A</th>
              <th>Proj PTS</th>
              <th>Proj SOG</th>
              <th>Proj HIT</th>
              <th>Proj BLK</th>
              <th>Proj FP</th>
              <th>Proj FP/GP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player_id}>
                <td>{i + 1}</td>
                <td>{r.full_name}</td>
                <td>{r.position}</td>
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={13}>No projections available — historical stats may not be synced.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
