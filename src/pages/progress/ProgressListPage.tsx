import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { progressService } from '../../services/progressService';
import { wbdService } from '../../services/wbdService';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { formatDate, formatDateTime, formatNumber, extractError } from '../../utils/format';
import type { WbdNode } from '../../types';

export default function ProgressListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { canInputProgress, canApproveProgress } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const projectQ = useQuery({ queryKey: ['project', projectId], queryFn: () => projectService.get(projectId!) });
  const progressQ = useQuery({
    queryKey: ['progress', projectId, statusFilter, dateFrom, dateTo, page],
    queryFn: () => progressService.list(projectId!, {
      status: statusFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page, limit: 20,
    }),
  });

  // For the entry form — get active baseline WBD nodes
  const activeVersionId = projectQ.data?.data?.active_wbd_version?.id;
  const nodesQ = useQuery({
    queryKey: ['wbd-nodes', activeVersionId],
    queryFn: () => wbdService.getNodes(activeVersionId!),
    enabled: !!activeVersionId,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => progressService.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['progress', projectId] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => progressService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress', projectId] });
      setRejectModal(null); setRejectReason('');
    },
  });

  const entries = progressQ.data?.data ?? [];
  const meta = progressQ.data?.meta;

  // Flatten nodes for select
  const flattenNodes = (nodes: WbdNode[], prefix = ''): { id: string; label: string }[] =>
    nodes.flatMap((n) => [
      ...(n.node_type === 'ITEM' ? [{ id: n.id, label: `${prefix}${n.code} — ${n.name}` }] : []),
      ...(n.children?.length ? flattenNodes(n.children, prefix + '  ') : []),
    ]);

  const itemNodes = flattenNodes(nodesQ.data?.data ?? []);
  const hasBaseline = projectQ.data?.data?.has_active_baseline;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Progress Pekerjaan</h1>
            <p>Input dan persetujuan progress proyek</p>
          </div>
          {canInputProgress() && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreate(true)}
              disabled={!hasBaseline}
              title={!hasBaseline ? 'Proyek belum memiliki baseline aktif' : ''}
            >
              + Input Progress
            </button>
          )}
        </div>
      </div>

      {!hasBaseline && (
        <div className="warning-box" style={{ marginBottom: 16 }}>
          ⚠️ Proyek belum memiliki baseline WBD aktif. Progress tidak dapat diinput.
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="filter-bar">
            <select className="form-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">Semua Status</option>
              <option value="PENDING_PM_APPROVAL">Menunggu PM</option>
              <option value="AUTO_APPROVED">Auto-Approved</option>
              <option value="APPROVED">Disetujui</option>
              <option value="REJECTED">Ditolak</option>
            </select>
            <input type="date" className="form-control" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} placeholder="Dari tanggal" />
            <input type="date" className="form-control" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} placeholder="Sampai tanggal" />
          </div>
        </div>

        {progressQ.isLoading ? <LoadingState /> : progressQ.error ? (
          <ErrorState message={extractError(progressQ.error)} onRetry={() => progressQ.refetch()} />
        ) : entries.length === 0 ? (
          <EmptyState title="Belum ada progress" message="Input progress untuk mulai memantau." />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Item WBD</th>
                    <th>Tanggal</th>
                    <th>Volume</th>
                    <th>Diinput Oleh</th>
                    <th>Status</th>
                    <th>Disetujui / Ditolak</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{entry.wbd_node?.name ?? '—'}</div>
                        <div className="text-sm text-muted">{entry.wbd_node?.code}</div>
                      </td>
                      <td>{formatDate(entry.progress_date)}</td>
                      <td>
                        {formatNumber(entry.progress_volume)} {entry.wbd_node?.unit ?? ''}
                      </td>
                      <td>
                        <div>{entry.entered_by?.full_name ?? '—'}</div>
                        <div className="text-sm text-muted">{entry.entered_by?.role}</div>
                      </td>
                      <td><StatusBadge status={entry.status} /></td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {entry.approved_by ? (
                          <span className="text-success">✓ {entry.approved_by.full_name}<br />{formatDateTime(entry.approved_at)}</span>
                        ) : entry.rejected_by ? (
                          <span className="text-danger">✕ {entry.rejected_by.full_name}<br />{entry.rejection_reason}</span>
                        ) : '—'}
                      </td>
                      <td>
                        {canApproveProgress() && entry.status === 'PENDING_PM_APPROVAL' && (
                          <div className="btn-group">
                            <button className="btn btn-sm btn-success" onClick={() => approveMut.mutate(entry.id)}>✓</button>
                            <button className="btn btn-sm btn-danger" onClick={() => { setRejectModal({ id: entry.id }); }}>✕</button>
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

      {/* Create Progress Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Input Progress Pekerjaan">
        <ProgressCreateForm
          projectId={projectId!}
          itemNodes={itemNodes}
          onSuccess={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['progress', projectId] }); }}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Tolak Progress"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRejectModal(null)}>Batal</button>
            <button
              className="btn btn-danger"
              disabled={!rejectReason.trim() || rejectMut.isPending}
              onClick={() => rejectModal && rejectMut.mutate({ id: rejectModal.id, reason: rejectReason })}
            >
              Tolak
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Alasan Penolakan <span className="required">*</span></label>
          <textarea className="form-control" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

function ProgressCreateForm({
  projectId, itemNodes, onSuccess, onCancel,
}: { projectId: string; itemNodes: { id: string; label: string }[]; onSuccess: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ wbd_node_id: '', progress_date: '', progress_volume: '', note: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await progressService.create(projectId, {
        wbd_node_id: form.wbd_node_id,
        progress_date: form.progress_date,
        progress_volume: parseFloat(form.progress_volume),
        note: form.note || undefined,
      });
      onSuccess();
    } catch (err) { setError(extractError(err)); }
    finally { setIsLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-group">
        <label className="form-label">Item Pekerjaan <span className="required">*</span></label>
        <select className="form-control" value={form.wbd_node_id} onChange={(e) => setForm((p) => ({ ...p, wbd_node_id: e.target.value }))} required>
          <option value="">Pilih item pekerjaan...</option>
          {itemNodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Tanggal Progress <span className="required">*</span></label>
          <input type="date" className="form-control" value={form.progress_date} onChange={(e) => setForm((p) => ({ ...p, progress_date: e.target.value }))} required />
        </div>
        <div className="form-group">
          <label className="form-label">Volume Progress <span className="required">*</span></label>
          <input type="number" className="form-control" value={form.progress_volume} onChange={(e) => setForm((p) => ({ ...p, progress_volume: e.target.value }))} step="0.0001" min="0.0001" required />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Catatan</label>
        <textarea className="form-control" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} rows={2} />
      </div>
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Menyimpan...' : 'Simpan Progress'}
        </button>
      </div>
    </form>
  );
}
