import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { wbdService } from '../../services/wbdService';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import { formatDateTime, extractError } from '../../utils/format';
import api from '../../services/api';

export default function WbdApprovalsPage() {
  const { isDireksi } = useAuth();
  if (!isDireksi()) return <Navigate to="/projects" />;

  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null); // versionId
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pendingQ = useQuery({
    queryKey: ['wbd-pending-approvals'],
    queryFn: () => api.get('/wbd-versions/pending').then((r) => r.data),
  });

  const pending = pendingQ.data?.data ?? [];

  const handleApprove = async (_projectId: string, versionId: string) => {
    setActionLoading(versionId);
    setError('');
    try {
      await wbdService.approveVersion(versionId);
      queryClient.invalidateQueries({ queryKey: ['wbd-pending-approvals'] });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setActionLoading(rejectTarget);
    setError('');
    try {
      await wbdService.rejectVersion(rejectTarget, rejectReason);
      setRejectTarget(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['wbd-pending-approvals'] });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Persetujuan WBD</h1>
        <p>Daftar WBD yang menunggu persetujuan Direksi</p>
      </div>

      {error && <div className="error-state" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        <div className="card-header">
          <div className="card-title">WBD Menunggu Persetujuan</div>
          <span className="badge badge-warning">{pending.length} Pending</span>
        </div>

        {pendingQ.isLoading ? <LoadingState /> : pending.length === 0 ? (
          <EmptyState title="Tidak ada WBD yang perlu disetujui" message="Semua WBD telah diproses." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Proyek</th>
                  <th>Kode Proyek</th>
                  <th>Versi WBD</th>
                  <th>Diajukan Oleh</th>
                  <th>Waktu Submit</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((v: any) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.project?.project_name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.project?.project_code}</td>
                    <td>
                      <span className="badge badge-secondary">v{v.version_number}</span>
                    </td>
                    <td>{v.submitted_by_user?.full_name ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{formatDateTime(v.updated_at)}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-success"
                          disabled={actionLoading === v.id}
                          onClick={() => handleApprove(v.project_id, v.id)}
                        >
                          {actionLoading === v.id ? '...' : '✓ Setujui'}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          disabled={actionLoading === v.id}
                          onClick={() => { setRejectTarget(v.id); setRejectReason(''); }}
                        >
                          ✗ Tolak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={rejectTarget !== null}
        onClose={() => { setRejectTarget(null); setRejectReason(''); }}
        title="Tolak WBD"
      >
        <div className="form-group">
          <label className="form-label">Alasan Penolakan <span className="required">*</span></label>
          <textarea
            className="form-control"
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Tuliskan alasan penolakan..."
          />
        </div>
        <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
            Batal
          </button>
          <button
            className="btn btn-danger"
            disabled={!rejectReason.trim() || !!actionLoading}
            onClick={handleReject}
          >
            {actionLoading ? 'Memproses...' : 'Tolak WBD'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
