import { useEffect, useMemo, useState } from 'react';
import { fetchDraftBoard, fetchOnTheClock, fetchPlayer, fetchPlayers, fetchTeams, makePick } from '../api/client';
import type { DraftPick, FantasyTeam, OnTheClock, Player, Team } from '../api/types';

export function DraftBoard({ leagueId, teams }: { leagueId: number; teams: FantasyTeam[] }) {
  const [board, setBoard] = useState<DraftPick[]>([]);
  const [onClock, setOnClock] = useState<OnTheClock | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftedPlayersById, setDraftedPlayersById] = useState<Record<number, Player>>({});
  const [nhlTeamsById, setNhlTeamsById] = useState<Record<number, Team>>({});
  const [actingAs, setActingAs] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [boardData, clockData, playerData] = await Promise.all([
        fetchDraftBoard(leagueId),
        fetchOnTheClock(leagueId),
        fetchPlayers({ undraftedInLeague: leagueId }),
      ]);
      setBoard(boardData);
      setOnClock(clockData);
      setPlayers(playerData);

      const unresolvedIds = boardData
        .map((pick) => pick.player_id)
        .filter((id) => !draftedPlayersById[id]);
      if (unresolvedIds.length > 0) {
        const fetched = await Promise.all(unresolvedIds.map(fetchPlayer));
        setDraftedPlayersById((prev) => ({
          ...prev,
          ...Object.fromEntries(fetched.map((p) => [p.player_id, p])),
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeams().then((nhlTeams) => {
      setNhlTeamsById(Object.fromEntries(nhlTeams.map((t) => [t.team_id, t])));
    });
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const teamsById = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.fantasy_team_id, t])),
    [teams],
  );

  async function handleDraft(playerId: number) {
    if (!actingAs) {
      setError('Pick which fantasy team you are drafting for first.');
      return;
    }
    setError(null);
    try {
      await makePick({ league_id: leagueId, fantasy_team_id: Number(actingAs), player_id: playerId });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="draft-board">
      <h3>Draft Board</h3>

      {onClock && (
        <p className="on-the-clock">
          On the clock: <strong>{onClock.team_name}</strong> (pick #{onClock.next_pick_number})
        </p>
      )}

      <div className="controls">
        <label>
          Drafting as:{' '}
          <select value={actingAs} onChange={(e) => setActingAs(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Select your team...</option>
            {teams.map((t) => (
              <option key={t.fantasy_team_id} value={t.fantasy_team_id}>
                {t.team_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p>Loading draft state…</p>}

      {!loading && (
        <>
          <h4>Available Players</h4>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Pos</th>
                <th>Team</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.player_id}>
                  <td>{p.full_name}</td>
                  <td>{p.position}</td>
                  <td>{p.team_id ? nhlTeamsById[p.team_id]?.abbrev ?? '—' : '—'}</td>
                  <td>
                    <button onClick={() => handleDraft(p.player_id)}>Draft</button>
                  </td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr>
                  <td colSpan={4}>No undrafted players match.</td>
                </tr>
              )}
            </tbody>
          </table>

          <h4>Pick History</h4>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Round</th>
                <th>Team</th>
                <th>Player</th>
              </tr>
            </thead>
            <tbody>
              {board.map((pick) => (
                <tr key={pick.pick_id}>
                  <td>{pick.pick_number}</td>
                  <td>{pick.round_number}</td>
                  <td>{teamsById[pick.fantasy_team_id]?.team_name ?? pick.fantasy_team_id}</td>
                  <td>{draftedPlayersById[pick.player_id]?.full_name ?? pick.player_id}</td>
                </tr>
              ))}
              {board.length === 0 && (
                <tr>
                  <td colSpan={4}>No picks yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
