import React, { useEffect, useState } from 'react';
import { createFantasyTeam, createLeague, fetchLeagueTeams, fetchLeagues } from '../api/client';
import type { FantasyTeam, League } from '../api/types';
import { DraftBoard } from './DraftBoard';

export function LeagueManager() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newMaxTeams, setNewMaxTeams] = useState(10);
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function loadLeagues() {
    fetchLeagues().then(setLeagues).catch((err) => setError(err.message));
  }

  useEffect(loadLeagues, []);

  useEffect(() => {
    if (selectedLeagueId == null) {
      setTeams([]);
      return;
    }
    fetchLeagueTeams(selectedLeagueId).then(setTeams).catch((err) => setError(err.message));
  }, [selectedLeagueId]);

  async function handleCreateLeague(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      const league = await createLeague({ name: newLeagueName, max_teams: newMaxTeams });
      setNewLeagueName('');
      loadLeagues();
      setSelectedLeagueId(league.league_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleAddTeam(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedLeagueId == null) return;
    setError(null);
    try {
      await createFantasyTeam({ league_id: selectedLeagueId, team_name: newTeamName });
      setNewTeamName('');
      const updated = await fetchLeagueTeams(selectedLeagueId);
      setTeams(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const selectedLeague = leagues.find((l) => l.league_id === selectedLeagueId) ?? null;

  return (
    <div className="league-manager">
      {error && <p className="error">{error}</p>}

      <div className="league-picker">
        <h3>Leagues</h3>
        <ul className="league-list">
          {leagues.map((l) => (
            <li key={l.league_id}>
              <button
                className={l.league_id === selectedLeagueId ? 'active' : ''}
                onClick={() => setSelectedLeagueId(l.league_id)}
              >
                {l.name} ({l.max_teams} teams max)
              </button>
            </li>
          ))}
          {leagues.length === 0 && <li>No leagues yet — create one below.</li>}
        </ul>

        <form onSubmit={handleCreateLeague} className="create-league-form">
          <input
            type="text"
            placeholder="League name"
            value={newLeagueName}
            onChange={(e) => setNewLeagueName(e.target.value)}
            required
          />
          <input
            type="number"
            min={2}
            max={32}
            value={newMaxTeams}
            onChange={(e) => setNewMaxTeams(Number(e.target.value))}
          />
          <button type="submit">Create League</button>
        </form>
      </div>

      {selectedLeague && (
        <div className="league-detail">
          <h3>{selectedLeague.name}</h3>

          <h4>Teams</h4>
          <ul>
            {teams.map((t) => (
              <li key={t.fantasy_team_id}>
                #{t.draft_position} {t.team_name}
              </li>
            ))}
            {teams.length === 0 && <li>No teams yet — add at least two to start drafting.</li>}
          </ul>

          <form onSubmit={handleAddTeam} className="add-team-form">
            <input
              type="text"
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              required
            />
            <button type="submit">Add Team</button>
          </form>

          {teams.length >= 2 && <DraftBoard leagueId={selectedLeague.league_id} teams={teams} />}
        </div>
      )}
    </div>
  );
}
