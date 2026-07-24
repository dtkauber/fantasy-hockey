import { useEffect, useMemo, useState } from 'react';
import { fetchRankings, fetchTeams } from '../api/client';
import type { PlayerRanking, Team } from '../api/types';
import { PositionBadge } from './PositionBadge';

const MAX_PLAYERS = 4;

const STAT_ROWS: { key: keyof PlayerRanking; label: string; higherIsBetter: boolean; decimals?: number }[] = [
  { key: 'games_played', label: 'Games Played', higherIsBetter: true },
  { key: 'goals', label: 'Goals', higherIsBetter: true },
  { key: 'assists', label: 'Assists', higherIsBetter: true },
  { key: 'points', label: 'Points', higherIsBetter: true },
  { key: 'shots', label: 'Shots', higherIsBetter: true },
  { key: 'hits', label: 'Hits', higherIsBetter: true },
  { key: 'blocks', label: 'Blocked Shots', higherIsBetter: true },
  { key: 'pim', label: 'Penalty Minutes', higherIsBetter: true },
  { key: 'total_points', label: 'Fantasy Points', higherIsBetter: true, decimals: 1 },
  { key: 'points_per_game', label: 'Fantasy Points / Game', higherIsBetter: true, decimals: 2 },
  { key: 'boom_bust_ratio', label: 'Boom/Bust Ratio (lower = steadier)', higherIsBetter: false, decimals: 2 },
];

export function Compare() {
  const [allPlayers, setAllPlayers] = useState<PlayerRanking[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRankings({ limit: 600 }), fetchTeams()])
      .then(([rankings, teamList]) => {
        setAllPlayers(rankings);
        setTeams(teamList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.team_id, t])), [teams]);
  const playersById = useMemo(() => Object.fromEntries(allPlayers.map((p) => [p.player_id, p])), [allPlayers]);

  const searchResults = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return allPlayers
      .filter((p) => p.full_name.toLowerCase().includes(needle) && !selectedIds.includes(p.player_id))
      .slice(0, 8);
  }, [search, allPlayers, selectedIds]);

  const selectedPlayers = selectedIds.map((id) => playersById[id]).filter(Boolean);

  function addPlayer(id: number) {
    if (selectedIds.length >= MAX_PLAYERS) return;
    setSelectedIds((ids) => [...ids, id]);
    setSearch('');
  }

  function removePlayer(id: number) {
    setSelectedIds((ids) => ids.filter((x) => x !== id));
  }

  function bestId(row: (typeof STAT_ROWS)[number]) {
    if (selectedPlayers.length < 2) return null;
    const sorted = [...selectedPlayers].sort((a, b) =>
      row.higherIsBetter ? (b[row.key] as number) - (a[row.key] as number) : (a[row.key] as number) - (b[row.key] as number),
    );
    return sorted[0].player_id;
  }

  return (
    <div className="compare">
      <p className="subtitle">
        Pick up to {MAX_PLAYERS} players to compare side by side, category by category -- useful for
        sizing up a proposed trade. The best value in each row is highlighted.
      </p>

      {error && <p className="error">Error: {error}</p>}
      {loading && <p>Loading player pool…</p>}

      {!loading && !error && (
        <>
          <div className="compare-picker">
            <input
              type="text"
              placeholder={selectedIds.length >= MAX_PLAYERS ? `Max ${MAX_PLAYERS} players` : 'Search a player to add...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={selectedIds.length >= MAX_PLAYERS}
            />
          </div>

          {searchResults.length > 0 && (
            <ul className="league-list">
              {searchResults.map((p) => (
                <li key={p.player_id}>
                  <button onClick={() => addPlayer(p.player_id)}>
                    {p.full_name} ({p.position}, {p.team_id ? teamsById[p.team_id]?.abbrev : '—'})
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedPlayers.length === 0 && <p>Search above and add players to start comparing.</p>}

          {selectedPlayers.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Stat</th>
                    {selectedPlayers.map((p) => (
                      <th key={p.player_id}>
                        {p.full_name}
                        <button
                          onClick={() => removePlayer(p.player_id)}
                          title="Remove"
                          style={{ marginLeft: '0.5rem', fontWeight: 400 }}
                        >
                          ✕
                        </button>
                        <div>
                          <PositionBadge position={p.position} />{' '}
                          {p.team_id ? teamsById[p.team_id]?.abbrev : '—'}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STAT_ROWS.map((row) => {
                    const winner = bestId(row);
                    return (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        {selectedPlayers.map((p) => {
                          const value = p[row.key] as number;
                          const isWinner = winner === p.player_id;
                          return (
                            <td key={p.player_id} className={isWinner ? 'compare-winner' : ''}>
                              {row.decimals !== undefined ? value.toFixed(row.decimals) : value}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
