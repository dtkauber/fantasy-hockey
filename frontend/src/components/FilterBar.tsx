import { useMemo } from 'react';
import type { Team } from '../api/types';
import { positionLabel } from '../utils/positions';

export interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  position: string;
  onPositionChange: (v: string) => void;
  positions: string[];
  teams: Team[];
  teamId: string;
  onTeamChange: (v: string) => void;
  division: string;
  onDivisionChange: (v: string) => void;
}

export function FilterBar({
  search,
  onSearchChange,
  position,
  onPositionChange,
  positions,
  teams,
  teamId,
  onTeamChange,
  division,
  onDivisionChange,
}: FilterBarProps) {
  const divisions = useMemo(
    () => Array.from(new Set(teams.map((t) => t.division).filter(Boolean))).sort() as string[],
    [teams],
  );
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);

  return (
    <div className="controls">
      <input
        type="text"
        placeholder="Search players..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select value={position} onChange={(e) => onPositionChange(e.target.value)}>
        {positions.map((pos) => (
          <option key={pos} value={pos}>
            {pos === 'All' ? 'All positions' : positionLabel(pos)}
          </option>
        ))}
      </select>
      <select value={division} onChange={(e) => onDivisionChange(e.target.value)}>
        <option value="All">All divisions</option>
        {divisions.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select value={teamId} onChange={(e) => onTeamChange(e.target.value)}>
        <option value="All">All teams</option>
        {sortedTeams.map((t) => (
          <option key={t.team_id} value={t.team_id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
