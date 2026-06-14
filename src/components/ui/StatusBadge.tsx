import type { WbdVersionStatus, ProgressStatus, CostStatus, ProjectStatus } from '../../types';

type AnyStatus = WbdVersionStatus | ProgressStatus | CostStatus | ProjectStatus | string;

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  // Project
  ACTIVE: { label: 'Aktif', cls: 'badge-success' },
  COMPLETED: { label: 'Selesai', cls: 'badge-info' },
  ON_HOLD: { label: 'Ditahan', cls: 'badge-warning' },
  CANCELLED: { label: 'Dibatalkan', cls: 'badge-danger' },
  // WBD Version
  DRAFT: { label: 'Draft', cls: 'badge-secondary' },
  PENDING_DIRECTOR_APPROVAL: { label: 'Menunggu Direksi', cls: 'badge-warning' },
  FINAL_APPROVED: { label: 'Final Approved', cls: 'badge-success' },
  REJECTED: { label: 'Ditolak', cls: 'badge-danger' },
  SUPERSEDED: { label: 'Digantikan', cls: 'badge-secondary' },
  // Progress
  PENDING_PM_APPROVAL: { label: 'Menunggu PM', cls: 'badge-warning' },
  AUTO_APPROVED: { label: 'Auto-Approved', cls: 'badge-success' },
  APPROVED: { label: 'Disetujui', cls: 'badge-success' },
  // Cost
  REVIEW: { label: 'Review Finance', cls: 'badge-warning' },
  // File
  ARCHIVED: { label: 'Diarsipkan', cls: 'badge-secondary' },
  FINAL: { label: 'Final', cls: 'badge-success' },
};

interface Props {
  status: AnyStatus;
}

export default function StatusBadge({ status }: Props) {
  const config = STATUS_MAP[status] ?? { label: status, cls: 'badge-secondary' };
  return <span className={`badge ${config.cls}`}>{config.label}</span>;
}
