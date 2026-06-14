import StatusBadge from '../../components/ui/StatusBadge';
import LoadingState from '../../components/ui/LoadingState';
import { formatDateTime } from '../../utils/format';
import type { WbdVersion } from '../../types';

interface Props {
  versions: WbdVersion[];
  isLoading: boolean;
  selectedVersionId?: string;
  onSelect: (v: WbdVersion) => void;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  canManage: boolean;
  canApprove: boolean;
}

export default function WbdVersionList({
  versions, isLoading, selectedVersionId, onSelect,
  onSubmit, onApprove, onReject, canManage, canApprove,
}: Props) {
  if (isLoading) return <LoadingState />;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Riwayat Versi WBD</div>
      </div>
      {versions.length === 0 ? (
        <div className="empty-state">
          <p>Belum ada versi WBD. Buat draft versi baru untuk memulai.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Versi</th>
                <th>Status</th>
                <th>Baseline</th>
                <th>Diajukan Oleh</th>
                <th>Waktu Ajuan</th>
                <th>Disetujui Oleh</th>
                <th>Waktu Persetujuan</th>
                <th>Alasan Tolak</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} style={{ background: v.id === selectedVersionId ? 'var(--primary-light)' : '' }}>
                  <td style={{ fontWeight: 600 }}>Version {v.version_number}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td>
                    {v.is_active
                      ? <span className="badge badge-success">✓ Aktif</span>
                      : '—'
                    }
                  </td>
                  <td>{v.submitted_by?.full_name ?? '—'}</td>
                  <td style={{ fontSize: 12 }}>{v.submitted_at ? formatDateTime(v.submitted_at) : '—'}</td>
                  <td>{v.approved_by?.full_name ?? '—'}</td>
                  <td style={{ fontSize: 12 }}>{v.approved_at ? formatDateTime(v.approved_at) : '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--danger)', maxWidth: 200 }}>
                    {v.rejection_reason ?? '—'}
                  </td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-sm btn-secondary" onClick={() => onSelect(v)}>
                        Lihat
                      </button>
                      {canManage && v.status === 'DRAFT' && (
                        <button className="btn btn-sm btn-primary" onClick={() => onSubmit(v.id)}>
                          Ajukan
                        </button>
                      )}
                      {canApprove && v.status === 'PENDING_DIRECTOR_APPROVAL' && (
                        <>
                          <button className="btn btn-sm btn-success" onClick={() => onApprove(v.id)}>
                            Setujui
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => onReject(v.id)}>
                            Tolak
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
