import { useEffect, useMemo, useState } from 'react';
import { fetchPlayers, fetchTeams } from '../api/client';
import type { Player, Team } from '../api/types';
import { PositionBadge } from './PositionBadge';

const POSITIONS = ['All', 'C', 'L', 'R', 'D', 'G'];

export function PlayerPool() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamsById, setTeamsById] = useState<Record<number, Team>>({});
  const [position, setPosition] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams()
      .then((teams) => {
        setTeamsById(Object.fromEntries(teams.map((t) => [t.team_id, t])));
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPlayers({
      position: position === 'All' ? undefined : position,
      search: search.trim() || undefined,
    })
      .then(setPlayers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [position, search]);

  const rows = useMemo(
    () =>
      players.map((p) => ({
        ...p,
        teamAbbrev: p.team_id ? teamsById[p.team_id]?.abbrev ?? '—' : '—',
      })),
    [players, teamsById],
  );

  return (
    <div className="player-pool">
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
      {loading && <p>Loading players…</p>}

      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Pos</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.player_id}>
                <td>{p.full_name}</td>
                <td>
                  <PositionBadge position={p.position} />
                </td>
                <td>{p.teamAbbrev}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3}>No players found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
