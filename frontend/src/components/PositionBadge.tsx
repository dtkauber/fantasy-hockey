import { positionLabel } from '../utils/positions';

const POSITION_CLASS: Record<string, string> = {
  C: 'pos-c',
  L: 'pos-w',
  R: 'pos-w',
  D: 'pos-d',
  G: 'pos-g',
  F: 'pos-w',
};

export function PositionBadge({ position }: { position: string }) {
  return <span className={`badge ${POSITION_CLASS[position] ?? 'pos-w'}`}>{positionLabel(position)}</span>;
}
