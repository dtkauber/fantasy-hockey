// The NHL API (and our DB) stores raw position codes: C, L, R, D, G.
// Displaying "L"/"R" is ambiguous to anyone who watches hockey -- LW/RW is
// the standard notation, so every UI surface should show these labels
// while filtering logic keeps using the raw codes underneath.
export const POSITION_LABELS: Record<string, string> = {
  C: 'C',
  L: 'LW',
  R: 'RW',
  D: 'D',
  G: 'G',
};

export function positionLabel(code: string): string {
  return POSITION_LABELS[code] ?? code;
}

export const SKATER_POSITIONS = ['C', 'L', 'R', 'D'] as const;
export const FORWARD_POSITIONS = ['C', 'L', 'R'] as const;

export type LeagueFormat = 'split' | 'flex';

/**
 * The position bucket a player counts toward for roster/scarcity purposes,
 * given the league's format:
 *  - "split": centers, left wings, and right wings are separate roster slots
 *  - "flex": all forwards share one combined "F" slot
 */
export function effectivePosition(rawPosition: string, format: LeagueFormat): string {
  if (format === 'flex' && (FORWARD_POSITIONS as readonly string[]).includes(rawPosition)) {
    return 'F';
  }
  return rawPosition;
}
