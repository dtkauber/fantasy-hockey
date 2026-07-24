import type { SortDir } from '../hooks/useSort';

export function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className={active ? 'sortable active' : 'sortable'} onClick={onClick}>
      {label}
      <span className="sort-arrow">{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
    </th>
  );
}
