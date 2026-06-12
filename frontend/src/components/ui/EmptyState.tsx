import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title?: string;
  message?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title = 'Tidak ada data', message, action }: Props) {
  return (
    <div className="empty-state">
      {icon ?? <span style={{ fontSize: 40 }}>📭</span>}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
