import { useEffect, useMemo, useState } from 'react';
import { fetchRankings, fetchTeams } from '../api/client';
import type { PlayerRanking, Team } from '../api/types';

const POSITIONS = ['All', 'C', 'L', 'R', 'D', 'G'];

export function Rankings() {
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
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
    fetchRankings({ position: position === 'All' ? undefined : position, search: search.trim() || undefined })
      .then(setRankings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [position, search]);

  const rows = useMemo(
    () =>
      rankings.map((r) => ({
        ...r,
        teamAbbrev: r.team_id ? teamsById[r.team_id]?.abbrev ?? '—' : '—',
      })),
    [rankings, teamsById],
  );

  return (
    <div className="rankings">
      <p className="subtitle">
        Ranked by fantasy points scored so far this season (default scoring: 3/goal, 2/assist, 4/win, etc.)
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
      {loading && <p>Loading rankings…</p>}

      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Pos</th>
              <th>Team</th>
              <th>GP</th>
              <th>Pts</th>
              <th>Pts/GP</th>
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
                <td>{r.total_points.toFixed(1)}</td>
                <td>{r.points_per_game.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  No ranked players yet — historical stats may not be synced. Run a season sync first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
