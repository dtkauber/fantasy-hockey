import { useEffect, useMemo, useState } from 'react';
import { fetchRankings, fetchTeams } from '../api/client';
import type { PlayerRanking, Team } from '../api/types';
import { PositionBadge } from './PositionBadge';
import { SortableTh } from './SortableTh';
import { DraftAssistant } from './DraftAssistant';
import { useSort } from '../hooks/useSort';
import { effectivePosition, positionLabel, type LeagueFormat } from '../utils/positions';

const ASSISTANT_POOL_SIZE = 40;

const SPLIT_DEFAULTS: Record<string, number> = { C: 2, L: 2, R: 2, D: 4, G: 2 };
const FLEX_DEFAULTS: Record<string, number> = { F: 6, D: 4, G: 2 };
const SPLIT_SLOTS = ['C', 'L', 'R', 'D', 'G'];
const FLEX_SLOTS = ['F', 'D', 'G'];

type Row = PlayerRanking & { teamAbbrev: string; effPos: string; vorp: number; vona: number };

function computeReplacementValues(
  players: PlayerRanking[],
  format: LeagueFormat,
  numTeams: number,
  starters: Record<string, number>,
): Record<string, number> {
  const groups: Record<string, number[]> = {};
  for (const p of players) {
    const pos = effectivePosition(p.position, format);
    (groups[pos] ??= []).push(p.total_points);
  }
  const replacement: Record<string, number> = {};
  for (const [pos, values] of Object.entries(groups)) {
    values.sort((a, b) => b - a);
    const idx = Math.min(Math.max(numTeams * (starters[pos] ?? 0), 0), values.length - 1);
    replacement[pos] = values.length ? values[idx] : 0;
  }
  return replacement;
}

export function DraftHelper() {
  const [allPlayers, setAllPlayers] = useState<PlayerRanking[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [format, setFormat] = useState<LeagueFormat>('split');
  const [numTeams, setNumTeams] = useState(12);
  const [starters, setStarters] = useState<Record<string, number>>(SPLIT_DEFAULTS);
  const [draftedIds, setDraftedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('All');

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRankings({ limit: 700 }), fetchTeams()])
      .then(([rankings, teamList]) => {
        setAllPlayers(rankings);
        setTeams(teamList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.team_id, t])), [teams]);
  const slots = format === 'split' ? SPLIT_SLOTS : FLEX_SLOTS;

  function changeFormat(next: LeagueFormat) {
    setFormat(next);
    setStarters(next === 'split' ? SPLIT_DEFAULTS : FLEX_DEFAULTS);
  }

  // VORP: static value over a replacement-level baseline at each position,
  // computed once against the FULL pool -- replacement level is a property
  // of the league's roster construction, not of who's already been picked.
  const replacementValues = useMemo(
    () => computeReplacementValues(allPlayers, format, numTeams, starters),
    [allPlayers, format, numTeams, starters],
  );

  // VONA: value over the next available player at the same position, which
  // by definition depends on who's already been drafted -- recomputed live.
  const vonaByPlayer = useMemo(() => {
    const available = allPlayers.filter((p) => !draftedIds.has(p.player_id));
    const groups: Record<string, PlayerRanking[]> = {};
    for (const p of available) {
      const pos = effectivePosition(p.position, format);
      (groups[pos] ??= []).push(p);
    }
    const result: Record<number, number> = {};
    for (const [pos, list] of Object.entries(groups)) {
      list.sort((a, b) => b.total_points - a.total_points);
      list.forEach((p, i) => {
        const next = list[i + 1]?.total_points ?? replacementValues[pos] ?? 0;
        result[p.player_id] = round1(p.total_points - next);
      });
    }
    return result;
  }, [allPlayers, draftedIds, format, replacementValues]);

  // Full available board with computed values, unfiltered -- the display table
  // narrows this further by position/search, but the chat assistant needs the
  // whole thing regardless of what the user currently has typed into the filters.
  const allAvailableWithValues: Row[] = useMemo(
    () =>
      allPlayers
        .filter((p) => !draftedIds.has(p.player_id))
        .map((p) => {
          const effPos = effectivePosition(p.position, format);
          return {
            ...p,
            teamAbbrev: p.team_id ? teamsById[p.team_id]?.abbrev ?? '—' : '—',
            effPos,
            vorp: round1(p.total_points - (replacementValues[effPos] ?? 0)),
            vona: vonaByPlayer[p.player_id] ?? 0,
          };
        }),
    [allPlayers, draftedIds, format, teamsById, replacementValues, vonaByPlayer],
  );

  const availableRows: Row[] = useMemo(
    () =>
      allAvailableWithValues
        .filter((r) => (posFilter === 'All' ? true : r.effPos === posFilter))
        .filter((r) => (search.trim() ? r.full_name.toLowerCase().includes(search.trim().toLowerCase()) : true)),
    [allAvailableWithValues, posFilter, search],
  );

  const { sorted, sortKey, sortDir, toggleSort } = useSort<Row>(availableRows, 'vorp', 'desc');

  function draft(id: number) {
    setDraftedIds((prev) => new Set(prev).add(id));
  }

  const chatContext = useMemo(() => {
    const drafted = allPlayers
      .filter((p) => draftedIds.has(p.player_id))
      .map((p) => ({
        name: p.full_name,
        position: effectivePosition(p.position, format),
        team: p.team_id ? teamsById[p.team_id]?.abbrev ?? null : null,
      }));

    const available = [...allAvailableWithValues]
      .sort((a, b) => b.vorp - a.vorp)
      .slice(0, ASSISTANT_POOL_SIZE)
      .map((r) => ({
        name: r.full_name,
        position: r.effPos,
        team: r.teamAbbrev,
        vorp: r.vorp,
        vona: r.vona,
        total_points: r.total_points,
        points_per_game: r.points_per_game,
        games_played: r.games_played,
      }));

    return {
      league: { format, num_teams: numTeams, starters },
      drafted,
      available,
    };
  }, [allPlayers, draftedIds, format, numTeams, starters, teamsById, allAvailableWithValues]);

  return (
    <div className="draft-helper">
      <p className="subtitle">
        Ranks available players by Value Over Replacement (VORP) -- fantasy points above what a
        typical replacement-level player at their position would produce in a league this size --
        which accounts for position scarcity instead of just raw points. VONA (Value Over Next
        Available) shows what you lose at that position if you pass now; it updates live as you
        draft players below.
      </p>

      <div className="draft-config">
        <div className="config-group">
          <label>League format</label>
          <div className="format-toggle">
            <button className={format === 'split' ? 'active' : ''} onClick={() => changeFormat('split')}>
              C / LW / RW / D / G
            </button>
            <button className={format === 'flex' ? 'active' : ''} onClick={() => changeFormat('flex')}>
              F / D / G
            </button>
          </div>
        </div>
        <div className="config-group">
          <label># Teams</label>
          <input
            type="number"
            min={2}
            max={20}
            value={numTeams}
            onChange={(e) => setNumTeams(Number(e.target.value))}
          />
        </div>
        {slots.map((s) => (
          <div className="config-group" key={s}>
            <label>{positionLabel(s)} starters</label>
            <input
              type="number"
              min={0}
              max={10}
              value={starters[s] ?? 0}
              onChange={(e) => setStarters((prev) => ({ ...prev, [s]: Number(e.target.value) }))}
            />
          </div>
        ))}
        <button className="reset-draft" onClick={() => setDraftedIds(new Set())}>
          Reset Mock Draft ({draftedIds.size} drafted)
        </button>
      </div>

      <div className="controls">
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
          <option value="All">All positions</option>
          {slots.map((s) => (
            <option key={s} value={s}>
              {positionLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">Error: {error}</p>}
      {loading && <p>Loading player pool…</p>}

      {!loading && !error && (
      <div className="draft-helper-body">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <SortableTh label="Name" active={sortKey === 'full_name'} dir={sortDir} onClick={() => toggleSort('full_name')} />
                <th>Pos</th>
                <th>Team</th>
                <SortableTh label="GP" active={sortKey === 'games_played'} dir={sortDir} onClick={() => toggleSort('games_played')} />
                <SortableTh label="FP" active={sortKey === 'total_points'} dir={sortDir} onClick={() => toggleSort('total_points')} />
                <SortableTh label="FP/GP" active={sortKey === 'points_per_game'} dir={sortDir} onClick={() => toggleSort('points_per_game')} />
                <SortableTh label="VORP" active={sortKey === 'vorp'} dir={sortDir} onClick={() => toggleSort('vorp')} />
                <SortableTh label="VONA" active={sortKey === 'vona'} dir={sortDir} onClick={() => toggleSort('vona')} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 200).map((r, i) => (
                <tr key={r.player_id}>
                  <td>{i + 1}</td>
                  <td>{r.full_name}</td>
                  <td>
                    <PositionBadge position={r.effPos} />
                  </td>
                  <td>{r.teamAbbrev}</td>
                  <td>{r.games_played}</td>
                  <td>{r.total_points.toFixed(1)}</td>
                  <td>{r.points_per_game.toFixed(2)}</td>
                  <td>{r.vorp.toFixed(1)}</td>
                  <td>{r.vona.toFixed(1)}</td>
                  <td>
                    <button onClick={() => draft(r.player_id)}>Draft</button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={10}>No available players match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <DraftAssistant context={chatContext} />
      </div>
      )}
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
