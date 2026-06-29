import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { progressService } from '../../services/progressService';
import { wbdService } from '../../services/wbdService';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, formatDateTime, formatNumber, extractError } from '../../utils/format';
import type { WbdNode } from '../../types';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING_PM_APPROVAL: { label: 'Menunggu PM',   cls: 'delay'   },
  AUTO_APPROVED:       { label: 'Auto Disetujui', cls: 'running' },
  APPROVED:            { label: 'Disetujui',      cls: 'done'    },
  REJECTED:            { label: 'Ditolak',        cls: 'delay'   },
};

const STATUS_FILTERS = [
  { value: '',                    label: 'Semua Status'   },
  { value: 'PENDING_PM_APPROVAL', label: 'Menunggu PM'    },
  { value: 'AUTO_APPROVED',       label: 'Auto Disetujui' },
  { value: 'APPROVED',            label: 'Disetujui'      },
  { value: 'REJECTED',            label: 'Ditolak'        },
];

function flattenNodes(nodes: WbdNode[], prefix = ''): { id: string; label: string; unit: string; volume: number | null; rate: number | null }[] {
  return nodes.flatMap(n => [
    ...(n.node_type === 'ITEM' ? [{ id: n.id, label: `${prefix}${n.code} — ${n.name}`, unit: n.unit ?? '', volume: n.volume ?? null, rate: n.rate ?? null }] : []),
    ...(n.children?.length ? flattenNodes(n.children, prefix + '  ') : []),
  ]);
}

export default function ProgressListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { canInputProgress, canApproveProgress } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [page, setPage]                 = useState(1);
  const [showCreate,   setShowCreate]   = useState(false);
  const [rejectModal,  setRejectModal]  = useState<string | null>(null);
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

  const activeVersionId = (projectQ.data as any)?.data?.active_wbd_version?.id;
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

  const entries   = (progressQ.data as any)?.data ?? [];
  const meta      = (progressQ.data as any)?.meta;
  const itemNodes = flattenNodes((nodesQ.data as any)?.data ?? []);
  const hasBaseline = (projectQ.data as any)?.data?.has_active_baseline;

  const totalVolReal  = entries.reduce((s: number, e: any) => s + Number(e.progress_volume ?? 0), 0);
  const totalCostReal = entries.reduce((s: number, e: any) => s + Number(e.actual_cost ?? 0), 0);
  const updatedToday  = entries.filter((e: any) => formatDate(e.progress_date) === formatDate(new Date().toISOString())).length;
  const pendingCount  = entries.filter((e: any) => e.status === 'PENDING_PM_APPROVAL').length;

  return (
    <div>
      {/* Header */}
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>Input Progress Pekerjaan</h3>
            <p>Rekam realisasi lapangan per item WBD. Progress diakumulasi dan diverifikasi PM sebelum masuk ke S-Curve.</p>
          </div>
          <div className="cluster">
            {!hasBaseline && <span className="chip status-warn">Baseline belum aktif</span>}
            {canInputProgress() && (
              <button
                className="btn"
                onClick={() => setShowCreate(true)}
                disabled={!hasBaseline}
                title={!hasBaseline ? 'Proyek belum memiliki baseline aktif' : ''}
              >
                + Input Progress
              </button>
            )}
          </div>
        </div>

        <div className="summary-bar">
          <div className="summary-item">
            <span>Total Volume Realisasi</span>
            <strong>{formatNumber(totalVolReal)}</strong>
          </div>
          <div className="summary-item">
            <span>Total Biaya Realisasi</span>
            <strong>{formatCurrency(totalCostReal)}</strong>
          </div>
          <div className="summary-item">
            <span>Diupdate Hari Ini</span>
            <strong style={{ color: 'var(--green-700)' }}>{updatedToday}</strong>
          </div>
          <div className="summary-item">
            <span>Menunggu Persetujuan</span>
            <strong style={{ color: 'var(--warning)' }}>{pendingCount}</strong>
          </div>
        </div>
      </div>

      {/* Main table */}
      <div className="section-card glass">
        <div className="toolbar">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            title="Dari tanggal"
          />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>s/d</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            title="Sampai tanggal"
          />
          <div className="stretch" />
          <button className="btn secondary" onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}>
            Reset
          </button>
        </div>

        {progressQ.isLoading ? (
          <div className="loading-state">Memuat data progress...</div>
        ) : progressQ.error ? (
          <div className="danger-box">
            {extractError(progressQ.error)} —{' '}
            <button className="btn secondary" style={{ marginLeft: 8 }} onClick={() => progressQ.refetch()}>Coba Lagi</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            Belum ada data progress.
            {canInputProgress() && hasBaseline && (
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setShowCreate(true)}>+ Input Progress Pertama</button>
              </div>
            )}
            {!hasBaseline && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>Aktifkan baseline WBD terlebih dahulu.</div>}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Uraian Pekerjaan</th>
                    <th>Grup</th>
                    <th>Vol. Rencana</th>
                    <th>Vol. Realisasi</th>
                    <th>Sisa Volume</th>
                    <th>Biaya Rencana</th>
                    <th>Biaya Realisasi</th>
                    <th>Sisa Biaya</th>
                    <th>Lampiran</th>
                    <th>Update Terakhir</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry: any, idx: number) => {
                    const st       = STATUS_MAP[entry.status] ?? { label: entry.status, cls: 'planned' };
                    const volPlan  = Number(entry.wbd_node?.volume ?? 0);
                    const volReal  = Number(entry.progress_volume ?? 0);
                    const isNodeDone = entry.remaining_volume === 0;
                    const volSisa  = isNodeDone
                      ? 0
                      : (entry.remaining_volume != null ? Number(entry.remaining_volume) : Math.max(0, volPlan - volReal));
                    const costPlan = Number(entry.wbd_node?.planned_cost ?? 0);
                    const costReal = Number(entry.actual_cost ?? 0);
                    const costSisa = costPlan - costReal;
                    const isOver   = costReal > costPlan && costPlan > 0;
                    const pct      = volPlan > 0 ? Math.min(100, Math.round((volReal / volPlan) * 100)) : 0;

                    return (
                      <tr key={entry.id}>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{((page - 1) * 20) + idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.wbd_node?.name ?? '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{entry.wbd_node?.code}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{entry.wbd_node?.group_name ?? '—'}</td>
                        <td style={{ fontSize: 12 }}>
                          {formatNumber(volPlan)} <span style={{ color: 'var(--muted)' }}>{entry.wbd_node?.unit}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>
                            {formatNumber(volReal)} <span style={{ color: 'var(--muted)' }}>{entry.wbd_node?.unit}</span>
                          </div>
                          <div style={{ marginTop: 4, height: 5, background: 'var(--line)', borderRadius: 3, width: 80, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${pct}%`,
                              background: isOver
                                ? 'linear-gradient(90deg,var(--soil),var(--danger))'
                                : pct >= 100
                                  ? 'linear-gradient(90deg,var(--green-700),var(--green-500))'
                                  : 'linear-gradient(90deg,var(--green-800),var(--green-600))',
                              borderRadius: 3,
                            }} />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{pct}%</div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {isNodeDone ? (
                            <span className="badge done">Selesai</span>
                          ) : (
                            <span style={{ color: volSisa === 0 ? 'var(--ok)' : 'inherit' }}>
                              {formatNumber(volSisa)} <span style={{ color: 'var(--muted)' }}>{entry.wbd_node?.unit}</span>
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>{formatCurrency(costPlan)}</td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: isOver ? 'var(--danger)' : 'inherit' }}>
                          {formatCurrency(costReal)}
                        </td>
                        <td style={{ fontSize: 12, color: isOver ? 'var(--danger)' : 'inherit' }}>
                          {isOver ? `+${formatCurrency(Math.abs(costSisa))}` : formatCurrency(costSisa)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {entry.attachment_path ? (
                            <button
                              className="chip clickable"
                              style={{ fontSize: 16, padding: '2px 6px' }}
                              title="Lihat lampiran"
                              onClick={async () => {
                                try {
                                  const res = await api.get(`/progress-entries/${entry.id}/attachment`, { responseType: 'blob' });
                                  const url = URL.createObjectURL(res.data);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.target = '_blank';
                                  a.rel = 'noopener noreferrer';
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  setTimeout(() => URL.revokeObjectURL(url), 10000);
                                } catch (err: any) {
                                  let detail = '';
                                  try {
                                    const blob: Blob = err?.response?.data;
                                    if (blob instanceof Blob) {
                                      const text = await blob.text();
                                      const json = JSON.parse(text);
                                      detail = json?.message ?? text;
                                    }
                                  } catch { /* ignore */ }
                                  const status = err?.response?.status ?? 'network error';
                                  console.error('[attachment] error', status, detail);
                                  alert(`Gagal membuka lampiran. (${status}${detail ? ': ' + detail : ''})`);
                                }
                              }}
                            >
                              📎
                            </button>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--muted)' }}>
                          <div>{formatDate(entry.progress_date)}</div>
                          <div>{entry.entered_by?.full_name ?? '—'}</div>
                        </td>
                        <td>
                          <span className={`badge ${st.cls}`}>{st.label}</span>
                          {isOver && <div><span className="badge delay" style={{ marginTop: 3, fontSize: 10 }}>Over Budget</span></div>}
                        </td>
                        <td>
                          <div className="cluster">
                            {canApproveProgress() && entry.status === 'PENDING_PM_APPROVAL' && (
                              <>
                                <button
                                  className="chip clickable"
                                  style={{ color: 'var(--ok)' }}
                                  onClick={() => approveMut.mutate(entry.id)}
                                  disabled={approveMut.isPending}
                                >
                                  ✓ Setujui
                                </button>
                                <button
                                  className="chip clickable"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={() => setRejectModal(entry.id)}
                                >
                                  ✕ Tolak
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {meta && meta.total > meta.limit && (
              <div style={{ display: 'flex', gap: 8, padding: '14px 0 0', alignItems: 'center', fontSize: 13 }}>
                <button className="btn secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                <span style={{ color: 'var(--muted)' }}>Halaman {meta.page} dari {Math.ceil(meta.total / meta.limit)}</span>
                <button className="btn secondary" disabled={page >= Math.ceil(meta.total / meta.limit)} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Activity log + status legend */}
      <div className="editor-layout" style={{ marginTop: 18 }}>
        <div className="editor-card glass">
          <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--green-800)' }}>Log Aktivitas Progress</h4>
          {entries.length === 0 ? (
            <div className="empty-state">Belum ada aktivitas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.slice(0, 8).map((entry: any) => {
                const st = STATUS_MAP[entry.status] ?? { label: entry.status, cls: 'planned' };
                return (
                  <div key={entry.id} className="panel-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{entry.wbd_node?.name ?? '—'}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {entry.entered_by?.full_name} · {formatDateTime(entry.created_at ?? entry.progress_date)}
                      </div>
                    </div>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section-card glass" style={{ margin: 0 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--green-800)' }}>Logika Status Otomatis</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              {[
                { cls: 'delay',   label: 'Menunggu PM',    desc: 'Progress baru diinput, menunggu verifikasi Project Manager.' },
                { cls: 'running', label: 'Auto Disetujui', desc: 'Disetujui otomatis jika volume < 5% rencana dan Admin Proyek yang input.' },
                { cls: 'done',    label: 'Disetujui',      desc: 'PM sudah memverifikasi dan menyetujui realisasi lapangan.' },
                { cls: 'delay',   label: 'Ditolak',        desc: 'PM menolak — data harus diperbaiki dan diinput ulang.' },
              ].map((s, i) => (
                <div key={i} className="panel-block" style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className={`badge ${s.cls}`} style={{ marginTop: 1, flexShrink: 0 }}>{s.label}</span>
                  <span style={{ color: 'var(--muted)' }}>{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card glass" style={{ margin: 0 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--green-800)' }}>Catatan Penting</h4>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="panel-block">Progress yang disetujui masuk ke kalkulasi S-Curve dan Cost Analysis.</div>
              <div className="panel-block">
                Volume realisasi melebihi rencana akan ditandai{' '}
                <span className="badge delay" style={{ fontSize: 10 }}>Over Budget</span>.
              </div>
              <div className="panel-block">Data yang sudah disetujui tidak dapat diedit — input ulang jika ada koreksi.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Input Progress Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="modal-window" style={{ maxWidth: 620 }}>
            <div className="modal-head">
              <div>
                <h4>Input Progress Pekerjaan</h4>
                <p>Rekam realisasi volume dan biaya untuk item WBD dari lapangan.</p>
              </div>
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="modal-body">
              <ProgressCreateForm
                projectId={projectId!}
                itemNodes={itemNodes}
                onSuccess={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['progress', projectId] }); }}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setRejectModal(null); }}>
          <div className="modal-window" style={{ maxWidth: 500 }}>
            <div className="modal-head">
              <div>
                <h4>Tolak Progress</h4>
                <p>Berikan alasan agar tim lapangan dapat memperbaiki data.</p>
              </div>
              <button className="modal-close" onClick={() => setRejectModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Alasan Penolakan *</label>
                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Jelaskan alasan penolakan progress ini..."
                  style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)', padding: '10px 14px', font: 'inherit', fontSize: 13 }}
                />
              </div>
            </div>
            <div className="modal-foot">
              <div />
              <div className="cluster">
                <button className="btn secondary" onClick={() => setRejectModal(null)}>Batal</button>
                <button
                  className="btn danger"
                  disabled={!rejectReason.trim() || rejectMut.isPending}
                  onClick={() => rejectMut.mutate({ id: rejectModal, reason: rejectReason })}
                >
                  Tolak Progress
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressCreateForm({
  projectId, itemNodes, onSuccess, onCancel,
}: { projectId: string; itemNodes: { id: string; label: string; unit: string; volume: number | null; rate: number | null }[]; onSuccess: () => void; onCancel: () => void }) {
  const [form, setForm]             = useState({ wbd_node_id: '', progress_date: '', progress_volume: '', actual_cost: '', note: '' });
  const [remainingVolume, setRemainingVolume]   = useState('');
  const [remainingCost, setRemainingCost]       = useState('');
  const [remainingOverridden, setRemainingOverridden] = useState(false);
  const [remainingCostOverridden, setRemainingCostOverridden] = useState(false);
  const [preview, setPreview]       = useState<{ label: string; unit: string; volume: number | null; rate: number | null } | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState('');

  const planVolume    = preview?.volume ?? 0;
  const realVolume    = parseFloat(form.progress_volume) || 0;
  const remainVol     = parseFloat(remainingVolume) || 0;
  const autoRemaining = planVolume > 0 ? Math.max(0, planVolume - realVolume) : 0;
  const isOverBudget  = planVolume > 0 && (realVolume + remainVol) > planVolume;
  const isMarkedDone  = remainingVolume === '0' || remainingVolume.trim() === '0';

  function handleNodeSelect(id: string) {
    const node = itemNodes.find(n => n.id === id);
    setForm(p => ({ ...p, wbd_node_id: id }));
    setPreview(node ? { label: node.label, unit: node.unit, volume: node.volume, rate: node.rate } : null);
    setRemainingOverridden(false);
    setRemainingCostOverridden(false);
    const newRemVol = node?.volume != null ? Math.max(0, node.volume - realVolume) : null;
    setRemainingVolume(newRemVol != null ? String(newRemVol) : '');
    setRemainingCost(newRemVol != null && node?.rate != null ? String(Math.round(newRemVol * node.rate)) : '');
  }

  function handleProgressVolumeChange(val: string) {
    setForm(p => ({ ...p, progress_volume: val }));
    const parsed = parseFloat(val) || 0;
    if (!remainingOverridden && planVolume > 0) {
      const newRemVol = Math.max(0, planVolume - parsed);
      setRemainingVolume(String(newRemVol));
      if (!remainingCostOverridden && preview?.rate != null) {
        setRemainingCost(String(Math.round(newRemVol * preview.rate)));
      }
    }
  }

  function handleRemainingChange(val: string) {
    setRemainingVolume(val);
    setRemainingOverridden(true);
    if (!remainingCostOverridden && preview?.rate != null) {
      setRemainingCost(String(Math.round((parseFloat(val) || 0) * preview.rate)));
    }
  }

  function handleRemainingCostChange(val: string) {
    setRemainingCost(val);
    setRemainingCostOverridden(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (isOverBudget && !form.note.trim()) {
      setError('Catatan lapangan wajib diisi karena estimasi total melebihi volume rencana.');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('wbd_node_id', form.wbd_node_id);
      formData.append('progress_date', form.progress_date);
      formData.append('progress_volume', form.progress_volume);
      if (form.actual_cost) formData.append('actual_cost', form.actual_cost);
      if (form.note) formData.append('note', form.note);
      if (attachedFile) formData.append('attachment', attachedFile);
      if (remainingVolume !== '') formData.append('remaining_volume', remainingVolume);
      if (remainingCost !== '') formData.append('remaining_cost', remainingCost);
      await progressService.create(projectId, formData);
      onSuccess();
    } catch (err) { setError(extractError(err)); }
    finally { setIsLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="danger-box" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="field">
        <label>Item Pekerjaan *</label>
        <select value={form.wbd_node_id} onChange={e => handleNodeSelect(e.target.value)} required style={{ width: '100%' }}>
          <option value="">Pilih item pekerjaan WBD...</option>
          {itemNodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
      </div>

      {preview && (
        <div className="panel-block" style={{ marginBottom: 14, fontSize: 12, color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--green-800)' }}>Item dipilih:</strong> {preview.label}
          {preview.unit && <> · Satuan: <span className="chip" style={{ fontSize: 11 }}>{preview.unit}</span></>}
          {preview.volume != null && <> · Vol. Rencana: <strong style={{ color: 'var(--text)' }}>{formatNumber(preview.volume)} {preview.unit}</strong></>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="field">
          <label>Tanggal Progress *</label>
          <input type="date" value={form.progress_date} onChange={e => setForm(p => ({ ...p, progress_date: e.target.value }))} required />
        </div>
        <div className="field">
          <label>Volume Realisasi * {preview?.unit && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({preview.unit})</span>}</label>
          <input type="number" value={form.progress_volume} onChange={e => handleProgressVolumeChange(e.target.value)} step="0.0001" min="0.0001" placeholder="0.0000" required />
        </div>
      </div>

      {preview && (
        <div className="field">
          <label>
            Sisa Volume Estimasi
            {preview.unit && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> ({preview.unit})</span>}
            <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}> — auto dari Rencana − Realisasi, bisa diubah</span>
          </label>
          <input
            type="number"
            value={remainingVolume}
            onChange={e => handleRemainingChange(e.target.value)}
            step="0.0001"
            min="0"
            placeholder={planVolume > 0 ? String(autoRemaining) : '0'}
          />
          {isMarkedDone && (
            <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 4, fontWeight: 600 }}>
              ✓ Pekerjaan akan ditandai Selesai
            </div>
          )}
        </div>
      )}

      {isOverBudget && (
        <div className="danger-box" style={{ fontSize: 13, marginBottom: 12 }}>
          ⚠ Total estimasi ({formatNumber(realVolume + remainVol)} {preview?.unit}) melebihi volume rencana
          ({formatNumber(planVolume)} {preview?.unit}). Catatan lapangan <strong>wajib diisi</strong> dan
          Direktur Utama akan mendapat notifikasi.
        </div>
      )}

      <div className="field">
        <label>Biaya Realisasi (Rp) <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— opsional</span></label>
        <input type="number" value={form.actual_cost} onChange={e => setForm(p => ({ ...p, actual_cost: e.target.value }))} step="1" min="0" placeholder="0" />
      </div>

      {preview && (
        <div className="field">
          <label>
            Sisa Biaya Estimasi (Rp)
            <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}> — auto dari Sisa Volume × Harga Satuan, bisa diubah</span>
          </label>
          <input
            type="number"
            value={remainingCost}
            onChange={e => handleRemainingCostChange(e.target.value)}
            step="1"
            min="0"
            placeholder={preview.rate != null ? '(otomatis)' : '0'}
          />
          {remainingCost !== '' && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              {formatCurrency(Number(remainingCost) || 0)}
            </div>
          )}
        </div>
      )}

      <div className="field">
        <label>
          Catatan Lapangan
          {isOverBudget && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> *</span>}
        </label>
        <textarea
          value={form.note}
          onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
          rows={3}
          placeholder={isOverBudget ? 'Wajib diisi — jelaskan kondisi yang menyebabkan potensi over budget...' : 'Kondisi lapangan, kendala, atau keterangan tambahan...'}
          style={{ width: '100%', borderColor: isOverBudget && !form.note.trim() ? 'var(--danger)' : undefined }}
        />
      </div>

      <div
        onClick={() => document.getElementById('progress-file-input')?.click()}
        style={{
          marginBottom: 14,
          padding: '20px 16px',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: 12,
          border: '2px dashed var(--line)',
          borderRadius: 12,
          cursor: 'pointer',
          background: attachedFile ? 'rgba(45,125,70,0.05)' : 'transparent',
          transition: 'background 0.2s',
        }}
      >
        <input
          id="progress-file-input"
          type="file"
          style={{ display: 'none' }}
          onChange={e => setAttachedFile(e.target.files?.[0] ?? null)}
          accept="image/*,.pdf,.doc,.docx"
        />
        <div style={{ fontSize: 22, marginBottom: 8 }}>📎</div>
        {attachedFile ? (
          <>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{attachedFile.name}</div>
            <div style={{ fontSize: 11, marginTop: 4, color: 'var(--muted)' }}>
              ({(attachedFile.size / 1024).toFixed(1)} KB) · Klik untuk ganti
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>
              Klik untuk upload Foto / Bukti Lapangan
            </div>
            <div style={{ fontSize: 11 }}>JPG, PNG, PDF, DOC, DOCX — maks. 10 MB</div>
          </>
        )}
      </div>

      <div className="modal-foot" style={{ padding: 0, marginTop: 4 }}>
        <div />
        <div className="cluster">
          <button type="button" className="btn secondary" onClick={onCancel} disabled={isLoading}>Batal</button>
          <button type="submit" className="btn" disabled={isLoading}>{isLoading ? 'Menyimpan...' : 'Simpan Progress'}</button>
        </div>
      </div>
    </form>
  );
}
