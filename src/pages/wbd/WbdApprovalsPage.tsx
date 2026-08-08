import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { wbdService } from '../../services/wbdService';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import { formatDateTime, formatCurrency, extractError } from '../../utils/format';
import api from '../../services/api';
import type { WbdRevisionDecisionInput, WbdRevisionDecisionValue } from '../../types';

type DecisionState = Record<string, { decision: WbdRevisionDecisionValue; reason: string }>;

export default function WbdApprovalsPage() {
  const { isDireksi } = useAuth();
  if (!isDireksi()) return <Navigate to="/projects" />;

  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null); // versionId
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [diffVersion, setDiffVersion] = useState<{ id: string; version_number: number; project_name?: string } | null>(null);
  const [decisions, setDecisions] = useState<DecisionState>({});
  const [finalizeError, setFinalizeError] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  const pendingQ = useQuery({
    queryKey: ['wbd-pending-approvals'],
    queryFn: () => api.get('/wbd-versions/pending').then((r) => r.data),
  });

  const pending = pendingQ.data?.data ?? [];

  const diffQ = useQuery({
    queryKey: ['wbd-revision-diff', diffVersion?.id],
    queryFn: () => wbdService.getDiff(diffVersion!.id),
    enabled: !!diffVersion,
  });

  const diff = (diffQ.data as any)?.data as {
    modified: any[];
    added: any[];
    removed: any[];
    removed_blocked: any[];
  } | undefined;

  function openDiffModal(v: any) {
    setDiffVersion({ id: v.id, version_number: v.version_number, project_name: v.project?.project_name });
    setFinalizeError('');
    setDecisions({});
  }

  function closeDiffModal() {
    setDiffVersion(null);
    setDecisions({});
    setFinalizeError('');
  }

  // Seed default decisions (APPROVED) once diff loads, for any code not yet decided.
  if (diff) {
    const decidableCodes = [
      ...diff.modified.map((i) => i.code),
      ...diff.added.map((i) => i.code),
      ...diff.removed.map((i) => i.code),
    ];
    const missing = decidableCodes.filter((c) => !decisions[c]);
    if (missing.length > 0) {
      setDecisions((prev) => {
        const next = { ...prev };
        missing.forEach((c) => { next[c] = { decision: 'APPROVED', reason: '' }; });
        return next;
      });
    }
  }

  function setDecision(code: string, decision: WbdRevisionDecisionValue) {
    setDecisions((prev) => ({ ...prev, [code]: { decision, reason: prev[code]?.reason ?? '' } }));
  }

  function setReason(code: string, reason: string) {
    setDecisions((prev) => ({ ...prev, [code]: { decision: prev[code]?.decision ?? 'REJECTED', reason } }));
  }

  const approvedCount = Object.values(decisions).filter((d) => d.decision === 'APPROVED').length;
  const rejectedCount = Object.values(decisions).filter((d) => d.decision === 'REJECTED').length;

  async function handleFinalize() {
    if (!diffVersion) return;
    setFinalizing(true);
    setFinalizeError('');
    try {
      const payload: WbdRevisionDecisionInput[] = Object.entries(decisions).map(([code, d]) => ({
        code,
        decision: d.decision,
        reason: d.reason || undefined,
      }));
      await wbdService.finalize(diffVersion.id, payload);
      queryClient.invalidateQueries({ queryKey: ['wbd-pending-approvals'] });
      closeDiffModal();
    } catch (err) {
      setFinalizeError(extractError(err));
    } finally {
      setFinalizing(false);
    }
  }

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

  const fieldLabels: Record<string, string> = {
    name: 'Nama',
    description: 'Deskripsi',
    unit: 'Satuan',
    volume: 'Volume',
    rate: 'Harga Satuan',
    planned_cost: 'Rencana Biaya',
    start_date: 'Tanggal Mulai',
    duration_days: 'Durasi (hari)',
    end_date: 'Tanggal Akhir',
    sort_order: 'Urutan',
  };

  function formatFieldValue(field: string, value: any): string {
    if (value === null || value === undefined || value === '') return '—';
    if (field === 'planned_cost' || field === 'rate') return formatCurrency(Number(value));
    return String(value);
  }

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
                      {v.is_baseline_revision ? (
                        <span className="badge badge-secondary" title="Revisi baseline in-place">
                          Revisi v{v.version_number}
                        </span>
                      ) : (
                        <span className="badge badge-secondary">v{v.version_number}</span>
                      )}
                    </td>
                    <td>{v.submitted_by_user?.full_name ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{formatDateTime(v.updated_at)}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>
                      {v.is_baseline_revision ? (
                        <div className="btn-group">
                          <button
                            className="btn btn-sm"
                            disabled={actionLoading === v.id}
                            onClick={() => openDiffModal(v)}
                          >
                            🔍 Lihat & Putuskan Perubahan
                          </button>
                          <button
                            className="btn btn-sm btn-success"
                            disabled={actionLoading === v.id}
                            title="Setujui seluruh perubahan tanpa meninjau per item"
                            onClick={() => handleApprove(v.project_id, v.id)}
                          >
                            {actionLoading === v.id ? '...' : 'Setujui Semua'}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            disabled={actionLoading === v.id}
                            title="Tolak seluruh perubahan — baseline tidak berubah"
                            onClick={() => { setRejectTarget(v.id); setRejectReason(''); }}
                          >
                            Tolak Semua
                          </button>
                        </div>
                      ) : (
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
                      )}
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
        <div className="form-grid field">
          <label>Alasan Penolakan <span className="required">*</span></label>
          <textarea
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

      {/* Modal Review Diff Revisi Baseline */}
      {diffVersion && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeDiffModal(); }}>
          <div className="modal-window" style={{ maxWidth: 860, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              <div>
                <h4>Tinjau Revisi Baseline — {diffVersion.project_name}</h4>
                <p>Revisi dari Baseline v{diffVersion.version_number} — putuskan per item sebelum diterapkan.</p>
              </div>
              <button className="modal-close" onClick={closeDiffModal}>×</button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              {diffQ.isLoading ? (
                <LoadingState />
              ) : !diff ? (
                <div className="error-state">Gagal memuat perubahan.</div>
              ) : (
                <>
                  <div className="summary-bar" style={{ marginBottom: 16 }}>
                    <div className="summary-item"><span>Akan Disetujui</span><strong style={{ color: 'var(--success, #16a34a)' }}>{approvedCount}</strong></div>
                    <div className="summary-item"><span>Akan Ditolak</span><strong style={{ color: 'var(--danger, #dc2626)' }}>{rejectedCount}</strong></div>
                    <div className="summary-item"><span>Tidak Bisa Diubah</span><strong>{diff.removed_blocked.length}</strong></div>
                  </div>

                  {diff.modified.length === 0 && diff.added.length === 0 && diff.removed.length === 0 && diff.removed_blocked.length === 0 && (
                    <EmptyState title="Tidak ada perubahan" message="Revisi ini tidak mengandung perubahan apa pun." />
                  )}

                  {diff.modified.map((item) => {
                    const d = decisions[item.code] ?? { decision: 'APPROVED', reason: '' };
                    return (
                      <div key={item.code} className="card" style={{ marginBottom: 12, padding: 14, border: `1px solid ${d.decision === 'APPROVED' ? 'var(--success-border, #86efac)' : 'var(--danger-border, #fca5a5)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div>
                            <span className="badge badge-secondary" style={{ marginRight: 8 }}>Diubah</span>
                            <strong>{item.code}</strong> — {item.name}
                          </div>
                          <div className="btn-group">
                            <button
                              className={`btn btn-sm ${d.decision === 'APPROVED' ? 'btn-success' : 'btn-outline'}`}
                              onClick={() => setDecision(item.code, 'APPROVED')}
                            >
                              ✓ Setujui
                            </button>
                            <button
                              className={`btn btn-sm ${d.decision === 'REJECTED' ? 'btn-danger' : 'btn-outline'}`}
                              onClick={() => setDecision(item.code, 'REJECTED')}
                            >
                              ✗ Tolak
                            </button>
                          </div>
                        </div>

                        <table className="table" style={{ marginTop: 10, fontSize: 13 }}>
                          <thead>
                            <tr><th>Field</th><th>Sebelum</th><th>Sesudah</th></tr>
                          </thead>
                          <tbody>
                            {Object.entries(item.changes).map(([field, change]: [string, any]) => (
                              <tr key={field}>
                                <td>{fieldLabels[field] ?? field}</td>
                                <td>{formatFieldValue(field, change.before)}</td>
                                <td style={{ fontWeight: 600 }}>{formatFieldValue(field, change.after)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {item.status_impact && (
                          <div className="danger-box" style={{ marginTop: 10, fontSize: 13 }}>
                            ⚠ Status akan berubah: <strong>{item.status_impact.status_before}</strong> → <strong>{item.status_impact.status_after}</strong>
                            {item.status_impact.new_remaining_volume !== null && (
                              <> — sisa volume baru: <strong>{item.status_impact.new_remaining_volume}</strong></>
                            )}
                            {item.status_impact.new_remaining_cost !== null && (
                              <> — sisa biaya baru: <strong>{formatCurrency(item.status_impact.new_remaining_cost)}</strong></>
                            )}
                          </div>
                        )}

                        {d.decision === 'REJECTED' && (
                          <div className="field" style={{ marginTop: 10 }}>
                            <label>Alasan Penolakan (opsional)</label>
                            <textarea
                              rows={2}
                              value={d.reason}
                              onChange={(e) => setReason(item.code, e.target.value)}
                              placeholder="Jelaskan alasan menolak perubahan item ini..."
                              style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)', padding: '8px 12px', font: 'inherit', fontSize: 13 }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {diff.added.map((item) => {
                    const d = decisions[item.code] ?? { decision: 'APPROVED', reason: '' };
                    return (
                      <div key={item.code} className="card" style={{ marginBottom: 12, padding: 14, border: `1px solid ${d.decision === 'APPROVED' ? 'var(--success-border, #86efac)' : 'var(--danger-border, #fca5a5)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div>
                            <span className="badge badge-success" style={{ marginRight: 8 }}>Item Baru</span>
                            <strong>{item.code}</strong> — {item.name}
                            {item.volume !== null && <span style={{ marginLeft: 8, color: 'var(--muted)' }}>Vol: {item.volume} {item.unit ?? ''}</span>}
                            {item.planned_cost !== null && <span style={{ marginLeft: 8, color: 'var(--muted)' }}>{formatCurrency(item.planned_cost)}</span>}
                          </div>
                          <div className="btn-group">
                            <button
                              className={`btn btn-sm ${d.decision === 'APPROVED' ? 'btn-success' : 'btn-outline'}`}
                              onClick={() => setDecision(item.code, 'APPROVED')}
                            >
                              ✓ Setujui
                            </button>
                            <button
                              className={`btn btn-sm ${d.decision === 'REJECTED' ? 'btn-danger' : 'btn-outline'}`}
                              onClick={() => setDecision(item.code, 'REJECTED')}
                            >
                              ✗ Tolak
                            </button>
                          </div>
                        </div>
                        {d.decision === 'REJECTED' && (
                          <div className="field" style={{ marginTop: 10 }}>
                            <label>Alasan Penolakan (opsional)</label>
                            <textarea
                              rows={2}
                              value={d.reason}
                              onChange={(e) => setReason(item.code, e.target.value)}
                              placeholder="Jelaskan alasan menolak item baru ini..."
                              style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)', padding: '8px 12px', font: 'inherit', fontSize: 13 }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {diff.removed.map((item) => {
                    const d = decisions[item.code] ?? { decision: 'APPROVED', reason: '' };
                    return (
                      <div key={item.code} className="card" style={{ marginBottom: 12, padding: 14, border: `1px solid ${d.decision === 'APPROVED' ? 'var(--success-border, #86efac)' : 'var(--danger-border, #fca5a5)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div>
                            <span className="badge badge-danger" style={{ marginRight: 8 }}>Dihapus</span>
                            <strong>{item.code}</strong> — {item.name}
                            {item.volume !== null && <span style={{ marginLeft: 8, color: 'var(--muted)' }}>Vol: {item.volume}</span>}
                          </div>
                          <div className="btn-group">
                            <button
                              className={`btn btn-sm ${d.decision === 'APPROVED' ? 'btn-success' : 'btn-outline'}`}
                              onClick={() => setDecision(item.code, 'APPROVED')}
                              title="Setuju artinya item ini benar-benar dihapus dari baseline"
                            >
                              ✓ Setujui Hapus
                            </button>
                            <button
                              className={`btn btn-sm ${d.decision === 'REJECTED' ? 'btn-danger' : 'btn-outline'}`}
                              onClick={() => setDecision(item.code, 'REJECTED')}
                              title="Tolak artinya item ini dipertahankan di baseline"
                            >
                              ✗ Pertahankan
                            </button>
                          </div>
                        </div>
                        {d.decision === 'REJECTED' && (
                          <div className="field" style={{ marginTop: 10 }}>
                            <label>Alasan Mempertahankan Item (opsional)</label>
                            <textarea
                              rows={2}
                              value={d.reason}
                              onChange={(e) => setReason(item.code, e.target.value)}
                              placeholder="Jelaskan alasan mempertahankan item ini..."
                              style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)', padding: '8px 12px', font: 'inherit', fontSize: 13 }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {diff.removed_blocked.length > 0 && (
                    <div className="info-box" style={{ marginTop: 8 }}>
                      <strong>{diff.removed_blocked.length} item tidak bisa dihapus:</strong>
                      <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: 13 }}>
                        {diff.removed_blocked.map((item) => (
                          <li key={item.code}>{item.code} — {item.name} (sudah punya progres realisasi, tidak bisa dihapus)</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {finalizeError && <div className="error-state" style={{ marginTop: 12 }}>{finalizeError}</div>}
            </div>

            <div className="modal-foot">
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {approvedCount} item akan disetujui, {rejectedCount} item akan ditolak
              </div>
              <div className="cluster">
                <button className="btn secondary" onClick={closeDiffModal}>Batal</button>
                <button
                  className="btn"
                  disabled={finalizing || !diff}
                  onClick={handleFinalize}
                >
                  {finalizing ? 'Menerapkan...' : 'Terapkan Keputusan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
