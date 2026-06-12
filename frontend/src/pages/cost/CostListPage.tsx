import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { costService } from '../../services/costService';
import { progressService } from '../../services/progressService';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { formatDate, formatCurrency, formatDateTime, extractError } from '../../utils/format';

export default function CostListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { canInputCost, canApproveCost } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const costQ = useQuery({
    queryKey: ['costs', projectId, statusFilter, page],
    queryFn: () => costService.list(projectId!, { status: statusFilter || undefined, page, limit: 20 }),
  });

  // For create form — get approved progress entries
  const progressQ = useQuery({
    queryKey: ['progress-approved', projectId],
    queryFn: () => progressService.list(projectId!, { limit: 100 }),
    enabled: showCreate,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => costService.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['costs', projectId] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => costService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costs', projectId] });
      setRejectModal(null); setRejectReason('');
    },
  });

  const costs = costQ.data?.data ?? [];
  const meta = costQ.data?.meta;

  // Only APPROVED/AUTO_APPROVED progress can have costs
  const approvedProgress = (progressQ.data?.data ?? []).filter(
    (p) => p.status === 'APPROVED' || p.status === 'AUTO_APPROVED'
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Biaya Aktual</h1>
            <p>Transaksi biaya aktual proyek</p>
          </div>
          {canInputCost() && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Input Biaya
            </button>
          )}
        </div>
      </div>

      {canApproveCost() && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          💡 Sebagai Finance, Anda dapat menyetujui atau menolak transaksi biaya yang berstatus Review.
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="filter-bar">
            <select className="form-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">Semua Status</option>
              <option value="REVIEW">Review Finance</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
            </select>
          </div>
        </div>

        {costQ.isLoading ? <LoadingState /> : costQ.error ? (
          <ErrorState message={extractError(costQ.error)} onRetry={() => costQ.refetch()} />
        ) : costs.length === 0 ? (
          <EmptyState title="Belum ada transaksi biaya" message="Input biaya aktual yang terkait dengan progress." />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ref Progress</th>
                    <th>Item WBD</th>
                    <th>Tanggal</th>
                    <th>Jumlah</th>
                    <th>Diinput Oleh</th>
                    <th>Status</th>
                    <th>Review Finance</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((cost) => (
                    <tr key={cost.id}>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {cost.progress_entry?.progress_date
                          ? formatDate(cost.progress_entry.progress_date)
                          : '—'}
                      </td>
                      <td>{cost.progress_entry?.wbd_node?.name ?? '—'}</td>
                      <td>{formatDate(cost.transaction_date)}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(cost.amount)}</td>
                      <td>
                        <div>{cost.entered_by?.full_name ?? '—'}</div>
                        <div className="text-sm text-muted">{cost.entered_by?.role}</div>
                      </td>
                      <td><StatusBadge status={cost.status} /></td>
                      <td style={{ fontSize: 12 }}>
                        {cost.reviewed_by ? (
                          <span className="text-success">✓ {cost.reviewed_by.full_name}<br />{formatDateTime(cost.reviewed_at)}</span>
                        ) : cost.rejected_by ? (
                          <span className="text-danger">✕ {cost.rejected_by.full_name}<br />{cost.rejection_reason}</span>
                        ) : '—'}
                      </td>
                      <td>
                        {canApproveCost() && cost.status === 'REVIEW' && (
                          <div className="btn-group">
                            <button className="btn btn-sm btn-success" onClick={() => approveMut.mutate(cost.id)}>✓</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setRejectModal({ id: cost.id })}>✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && (
              <div style={{ padding: '16px 20px' }}>
                <Pagination page={meta.page} total={meta.total} limit={meta.limit} onChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Cost Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Input Biaya Aktual" size="lg">
        <CostCreateForm
          projectId={projectId!}
          approvedProgress={approvedProgress}
          onSuccess={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['costs', projectId] }); }}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Tolak Transaksi Biaya"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>Batal</button>
            <button className="btn btn-danger" disabled={!rejectReason.trim() || rejectMut.isPending}
              onClick={() => rejectModal && rejectMut.mutate({ id: rejectModal.id, reason: rejectReason })}>
              Tolak
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Alasan <span className="required">*</span></label>
          <textarea className="form-control" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

function CostCreateForm({ projectId, approvedProgress, onSuccess, onCancel }: any) {
  const [form, setForm] = useState({ progress_entry_id: '', amount: '', transaction_date: '', description: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await costService.create(projectId, {
        progress_entry_id: form.progress_entry_id,
        amount: parseFloat(form.amount),
        transaction_date: form.transaction_date,
        description: form.description || undefined,
      });
      onSuccess();
    } catch (err) { setError(extractError(err)); }
    finally { setIsLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-group">
        <label className="form-label">Progress Entry <span className="required">*</span></label>
        <select className="form-control" value={form.progress_entry_id} onChange={(e) => setForm((p: any) => ({ ...p, progress_entry_id: e.target.value }))} required>
          <option value="">Pilih progress entry...</option>
          {approvedProgress.map((p: any) => (
            <option key={p.id} value={p.id}>
              [{formatDate(p.progress_date)}] {p.wbd_node?.name} — {p.progress_volume} {p.wbd_node?.unit} ({p.status})
            </option>
          ))}
        </select>
        <div className="form-hint">Hanya progress APPROVED/AUTO_APPROVED yang dapat dikaitkan dengan biaya.</div>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Jumlah (Rp) <span className="required">*</span></label>
          <input type="number" className="form-control" value={form.amount} onChange={(e) => setForm((p: any) => ({ ...p, amount: e.target.value }))} min="1" step="1" required />
        </div>
        <div className="form-group">
          <label className="form-label">Tanggal Transaksi <span className="required">*</span></label>
          <input type="date" className="form-control" value={form.transaction_date} onChange={(e) => setForm((p: any) => ({ ...p, transaction_date: e.target.value }))} required />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Keterangan</label>
        <textarea className="form-control" value={form.description} onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))} rows={2} />
      </div>
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Menyimpan...' : 'Simpan Biaya'}
        </button>
      </div>
    </form>
  );
}
