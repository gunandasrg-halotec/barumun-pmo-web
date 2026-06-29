import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { wbdService } from '../../services/wbdService';
import { formatCurrency, formatNumber, formatDate, extractError } from '../../utils/format';
import type { WbdNode, WbdNodePredecessor, DependencyType } from '../../types';

const DEP_TYPE_LABELS: Record<DependencyType, string> = {
  FS: 'Finish-to-Start',
  SS: 'Start-to-Start',
  FF: 'Finish-to-Finish',
  SF: 'Start-to-Finish',
};

// ─── Dependency Row Panel ────────────────────────────────────────────────────

// ─── Add Dependency Modal ────────────────────────────────────────────────────

export function AddDependencyModal({
  node,
  allNodes,
  onClose,
  onSaved,
}: {
  node: WbdNode;
  allNodes: WbdNode[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [predId, setPredId]   = useState('');
  const [depType, setDepType] = useState<DependencyType>('FS');
  const [error, setError]     = useState('');

  const usedIds = new Set((node.predecessors ?? []).map(p => p.predecessor_id));
  // Allow both ITEM and GROUP as predecessors, excluding the node itself
  const candidateNodes = allNodes.filter(
    n => n.id !== node.id && !usedIds.has(n.id)
  );
  const groupCandidates = candidateNodes.filter(n => n.node_type === 'GROUP');
  const itemCandidates  = candidateNodes.filter(n => n.node_type === 'ITEM');

  const addMut = useMutation({
    mutationFn: () => wbdService.addDependency(node.id, predId, depType),
    onSuccess: () => { onSaved(); onClose(); },
    onError: (err: any) => setError(extractError(err)),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>Tambah Relasi — {node.code}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Task <strong>{node.code} {node.name}</strong> bergantung pada:
          </p>

          {error && <div className="danger-box" style={{ marginBottom: 12 }}>{error}</div>}

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Tipe Relasi</label>
            <select value={depType} onChange={e => setDepType(e.target.value as DependencyType)} style={{ width: '100%' }}>
              {(Object.keys(DEP_TYPE_LABELS) as DependencyType[]).map(t => (
                <option key={t} value={t}>{t} — {DEP_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 20 }}>
            <label>Predecessor (task/grup yang harus lebih dulu)</label>
            <select value={predId} onChange={e => setPredId(e.target.value)} style={{ width: '100%' }}>
              <option value="">Pilih predecessor...</option>
              {groupCandidates.length > 0 && (
                <optgroup label="── Grup ──">
                  {groupCandidates.map(n => (
                    <option key={n.id} value={n.id}>{n.code} — {n.name} [GRUP]</option>
                  ))}
                </optgroup>
              )}
              {itemCandidates.length > 0 && (
                <optgroup label="── Item ──">
                  {itemCandidates.map(n => (
                    <option key={n.id} value={n.id}>{n.code} — {n.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {candidateNodes.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                Tidak ada node lain yang tersedia sebagai predecessor.
              </div>
            )}
          </div>

          <div className="info-box" style={{ fontSize: 12, marginBottom: 16 }}>
            <strong>Catatan:</strong> Tanggal mulai/selesai task ini akan otomatis disesuaikan setelah relasi disimpan.
            Jika predecessor adalah sebuah Grup, sistem akan menggunakan tanggal akhir item terakhir di dalam grup tersebut.
          </div>

          <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Batal</button>
            <button
              className="btn btn-primary"
              onClick={() => { if (predId) addMut.mutate(); }}
              disabled={!predId || addMut.isPending}
            >
              {addMut.isPending ? 'Menyimpan...' : 'Simpan Relasi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dependency Panel (compact chips + open modal button) ────────────────────

function DependencyPanel({
  node,
  allNodes,
  isEditable,
  onRefresh,
}: {
  node: WbdNode;
  allNodes: WbdNode[];
  isEditable: boolean;
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const removeMut = useMutation({
    mutationFn: (depId: string) => wbdService.removeDependency(depId),
    onSuccess: onRefresh,
  });

  const predecessors: WbdNodePredecessor[] = node.predecessors ?? [];

  if (predecessors.length === 0 && !isEditable) return null;

  return (
    <div style={{ fontSize: 12 }}>
      {/* Compact chips — code only */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: predecessors.length && isEditable ? 4 : 0 }}>
        {predecessors.map(p => (
          <span key={p.id} className="chip" style={{ background: 'var(--surface)', border: '1px solid var(--line)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11 }}
            title={`${DEP_TYPE_LABELS[p.dependency_type]}: ${p.code} ${p.name}`}
          >
            <strong style={{ color: 'var(--green-700)' }}>{p.dependency_type}</strong>
            ←{p.code}
            {isEditable && (
              <button
                onClick={() => removeMut.mutate(p.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0 1px', fontSize: 12, lineHeight: 1 }}
                title="Hapus relasi"
                disabled={removeMut.isPending}
              >×</button>
            )}
          </span>
        ))}
      </div>

      {isEditable && (
        <button
          className="chip clickable"
          style={{ fontSize: 11, color: 'var(--muted)' }}
          onClick={() => setShowModal(true)}
        >+ Tambah Relasi</button>
      )}

      {showModal && (
        <AddDependencyModal
          node={node}
          allNodes={allNodes}
          onClose={() => setShowModal(false)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}

interface Props {
  nodes: WbdNode[];
  isEditable: boolean;
  versionId: string;
  onAddChild: (parent: WbdNode) => void;
  onRefresh: () => void;
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  DRAFT:    { label: 'Draft',    cls: 'planned' },
  ACTIVE:   { label: 'Berjalan', cls: 'running' },
  DONE:     { label: 'Selesai',  cls: 'done'    },
  DELAYED:  { label: 'Terlambat',cls: 'delay'   },
};

function computeEndDate(startDate: string | null, durationDays: number | null): string {
  if (!startDate || !durationDays) return '—';
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + durationDays - 1);
  return d.toISOString().slice(0, 10);
}

// Display-only: derive a GROUP's effective start/end dates from its descendant ITEM nodes.
// Earliest child start_date and latest child end_date. Not persisted to the backend.
function computeGroupDateRange(group: WbdNode, allNodes: WbdNode[]): { start: string | null; end: string | null } {
  const children = allNodes.filter(n => n.parent_node_id === group.id);
  let minStart: string | null = null;
  let maxEnd: string | null = null;

  for (const child of children) {
    let childStart: string | null;
    let childEnd: string | null;
    if (child.node_type === 'GROUP') {
      const range = computeGroupDateRange(child, allNodes);
      childStart = range.start;
      childEnd = range.end;
    } else {
      childStart = child.start_date ?? null;
      childEnd = childStart ? computeEndDate(childStart, child.duration_days ?? null) : null;
      if (childEnd === '—') childEnd = null;
    }
    if (childStart && (!minStart || childStart < minStart)) minStart = childStart;
    if (childEnd && (!maxEnd || childEnd > maxEnd)) maxEnd = childEnd;
  }

  return { start: minStart, end: maxEnd };
}

// ─── Edit Form ───────────────────────────────────────────────────────────────

function EditNodeForm({ node, allNodes, onClose, onSaved }: { node: WbdNode; allNodes: WbdNode[]; onClose: () => void; onSaved: () => void }) {
  const isItem = node.node_type === 'ITEM';
  const [form, setForm] = useState({
    name:          node.name ?? '',
    code:          node.code ?? '',
    description:   node.description ?? '',
    unit:          node.unit ?? '',
    volume:        node.volume != null ? String(node.volume) : '',
    rate:          node.rate != null ? String(node.rate) : '',
    start_date:    node.start_date ?? '',
    duration_days: node.duration_days != null ? String(node.duration_days) : '',
    sort_order:    node.sort_order != null ? String(node.sort_order) : '0',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        name:        form.name,
        code:        form.code,
        description: form.description || undefined,
        sort_order:  parseInt(form.sort_order) || 0,
      };
      if (isItem) {
        payload.unit          = form.unit;
        payload.volume        = parseFloat(form.volume) || 0;
        payload.rate          = parseFloat(form.rate) || 0;
        payload.start_date    = form.start_date || undefined;
        payload.duration_days = parseInt(form.duration_days) || undefined;
      }
      await wbdService.updateNode(node.id, payload);
      onSaved();
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  }

  const previewCost = isItem && form.volume && form.rate
    ? parseFloat(form.volume) * parseFloat(form.rate)
    : null;

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="grid-2">
        <div className="form-grid field">
          <label>Kode <span className="required">*</span></label>
          <input value={form.code} onChange={e => set('code', e.target.value)} required />
        </div>
        <div className="form-grid field">
          <label>Urutan</label>
          <input type="number" value={form.sort_order} onChange={e => set('sort_order', e.target.value)} min="0" />
        </div>
      </div>

      <div className="form-grid field">
        <label>Nama <span className="required">*</span></label>
        <input value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>

      {isItem && (
        <>
          <div className="grid-3">
            <div className="form-grid field">
              <label>Satuan <span className="required">*</span></label>
              <input value={form.unit} onChange={e => set('unit', e.target.value)} required />
            </div>
            <div className="form-grid field">
              <label>Volume <span className="required">*</span></label>
              <input type="number" value={form.volume} onChange={e => set('volume', e.target.value)} step="0.0001" min="0" required />
            </div>
            <div className="form-grid field">
              <label>Harga Satuan <span className="required">*</span></label>
              <input type="number" value={form.rate} onChange={e => set('rate', e.target.value)} step="1" min="0" required />
            </div>
          </div>

          {previewCost !== null && (
            <div className="info-box" style={{ marginBottom: 12 }}>
              Biaya Rencana: <strong>Rp {previewCost.toLocaleString('id-ID')}</strong>
            </div>
          )}

          <div className="grid-2">
            <div className="form-grid field">
              <label>Tanggal Mulai <span className="required">*</span></label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} required />
            </div>
            <div className="form-grid field">
              <label>Durasi (hari) <span className="required">*</span></label>
              <input type="number" value={form.duration_days} onChange={e => set('duration_days', e.target.value)} min="1" required />
            </div>
          </div>
        </>
      )}

      <div className="form-grid field">
        <label>Deskripsi</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
      </div>

      <div className="form-grid field" style={{ marginTop: 4 }}>
        <label>Relasi (Dependensi Task)</label>
        <DependencyPanel node={node} allNodes={allNodes} isEditable={true} onRefresh={onSaved} />
      </div>

      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </form>
  );
}

// ─── WbdTree ─────────────────────────────────────────────────────────────────

export default function WbdTree({ nodes, isEditable, onAddChild, onRefresh }: Props) {
  const [collapsed, setCollapsed]         = useState<Set<string>>(new Set());
  const [editNode, setEditNode]           = useState<WbdNode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<WbdNode | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => wbdService.deleteNode(id),
    onSuccess: onRefresh,
  });

  function toggle(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleDeleteClick(node: WbdNode) {
    const isGroup    = node.node_type === 'GROUP';
    const hasChildren = nodes.some(n => n.parent_node_id === node.id);
    if (isGroup && hasChildren) {
      setDeleteConfirm(node);
    } else {
      deleteMut.mutate(node.id);
    }
  }

  const rootNodes = nodes.filter(n => n.parent_node_id === null).sort((a, b) => a.sort_order - b.sort_order);
  const totalCost = rootNodes.reduce((s, n) => s + Number(n.planned_cost ?? 0), 0);

  function renderRows(node: WbdNode, depth = 0): React.ReactNode {
    const children   = nodes.filter(n => n.parent_node_id === node.id).sort((a, b) => a.sort_order - b.sort_order);
    const hasChildren = children.length > 0;
    const isGroup    = node.node_type === 'GROUP';
    const isColl     = collapsed.has(node.id);
    const indent     = depth > 0 ? `${depth * 18}px` : undefined;
    const endDate    = computeEndDate(node.start_date ?? null, node.duration_days ?? null);
    const groupRange = isGroup ? computeGroupDateRange(node, nodes) : null;
    const groupDurationDays = groupRange?.start && groupRange?.end
      ? Math.round((new Date(groupRange.end + 'T00:00:00').getTime() - new Date(groupRange.start + 'T00:00:00').getTime()) / 86400000) + 1
      : null;
    const st         = STATUS_MAP[node.status ?? ''] ?? { label: node.status ?? '—', cls: 'planned' };
    const subtotal   = isGroup ? children.reduce((s, c) => s + Number(c.planned_cost ?? 0), 0) : 0;
    const compPct    = isGroup && totalCost > 0 ? ((subtotal / totalCost) * 100).toFixed(2) : null;

    return (
      <>
        <tr key={node.id} className={isGroup ? 'group-row' : depth >= 2 ? 'indent-2' : 'indent-1'}>
          <td>{node.code}</td>
          <td style={{ paddingLeft: indent, maxWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              {hasChildren && (
                <button
                  onClick={() => toggle(node.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 11, opacity: 0.8, marginTop: 2, flexShrink: 0 }}
                >
                  {isColl ? '▶' : '▼'}
                </button>
              )}
              <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{node.name}</span>
            </div>
          </td>
          <td>{node.unit ?? '—'}</td>
          <td className={isGroup ? '' : 'editable'}>{node.volume != null ? formatNumber(node.volume) : '—'}</td>
          <td className={isGroup ? '' : 'editable'}>{node.rate != null ? formatCurrency(node.rate) : '—'}</td>
          <td>
            {isGroup ? formatCurrency(subtotal) : formatCurrency(Number(node.planned_cost ?? 0))}
            {!isGroup && <span className="formula">Volume × Tarif</span>}
          </td>
          <td>{compPct ? `${compPct}%` : (node.component_percent != null ? `${Number(node.component_percent).toFixed(2)}%` : '—')}</td>
          <td>{node.total_percent != null ? `${Number(node.total_percent).toFixed(2)}%` : (compPct ? `${((subtotal/totalCost)*100).toFixed(2)}%` : '—')}</td>
          <td>{isGroup ? (groupRange?.start ? formatDate(groupRange.start) : '—') : (node.start_date ? formatDate(node.start_date) : '—')}</td>
          <td>{isGroup ? (groupDurationDays ?? '—') : (node.duration_days ?? '—')}</td>
          <td>{isGroup ? (groupRange?.end ? formatDate(groupRange.end) : '—') : (endDate !== '—' ? formatDate(endDate) : '—')}</td>
          <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
          <td>
            <DependencyPanel
              node={node}
              allNodes={nodes}
              isEditable={isEditable}
              onRefresh={onRefresh}
            />
          </td>
          <td>
            {isEditable && (
              <div className="cluster">
                <button className="chip clickable" onClick={() => onAddChild(node)}>+ Item</button>
                <button
                  className="chip clickable"
                  style={{ color: 'var(--green-700)' }}
                  onClick={() => setEditNode(node)}
                >
                  Edit
                </button>
                <button
                  className="chip clickable"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => handleDeleteClick(node)}
                  disabled={deleteMut.isPending}
                >
                  Hapus
                </button>
              </div>
            )}
          </td>
        </tr>

        {hasChildren && !isColl && children.map(c => renderRows(c, depth + 1))}

        {isGroup && !isColl && (
          <tr className="subtotal-row">
            <td></td>
            <td>Jumlah Biaya {node.name}</td>
            <td></td><td></td><td></td>
            <td>{formatCurrency(subtotal)}</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td><span className="badge done">Subtotal</span></td>
            <td></td>
            <td><span className="chip">Terkunci</span></td>
          </tr>
        )}
      </>
    );
  }

  if (rootNodes.length === 0) {
    return (
      <div className="empty-state">
        Belum ada item WBD. Klik <strong>+ Tambah Item</strong> untuk mulai.
      </div>
    );
  }

  return (
    <div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Uraian Pekerjaan</th>
              <th>Satuan</th>
              <th>Volume</th>
              <th>Tarif</th>
              <th>Total Biaya</th>
              <th>% Komponen</th>
              <th>% Total</th>
              <th>Tanggal Mulai</th>
              <th>Durasi</th>
              <th>Tanggal Akhir</th>
              <th>Status</th>
              <th>Relasi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rootNodes.map(n => renderRows(n, 0))}
            <tr className="grand-row">
              <td></td>
              <td>Total Biaya Proyek</td>
              <td></td><td></td><td></td>
              <td>{formatCurrency(totalCost)}</td>
              <td></td>
              <td>100,00%</td>
              <td></td><td></td><td></td>
              <td><span className="badge done">Baseline</span></td>
              <td><span className="chip">Terkunci</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="wbd-footer">
        <span className="chip">Expand / collapse grup</span>
        <span className="chip">Formula badge</span>
        <span className="chip">Sticky subtotal & grand total</span>
      </div>

      {/* Modal Edit Item */}
      {editNode && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditNode(null); }}>
          <div className="modal-window">
            <div className="modal-head">
              <div>
                <h4>Edit Item WBD — {editNode.code}</h4>
                <p>Perubahan akan langsung tersimpan ke versi DRAFT ini.</p>
              </div>
              <button className="modal-close" onClick={() => setEditNode(null)}>×</button>
            </div>
            <div className="modal-body">
              <EditNodeForm
                node={editNode}
                allNodes={nodes}
                onClose={() => setEditNode(null)}
                onSaved={() => { setEditNode(null); onRefresh(); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus GROUP */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div className="modal-window" style={{ maxWidth: 500 }}>
            <div className="modal-head">
              <div>
                <h4>Hapus Grup Beserta Isinya</h4>
                <p>Tindakan ini tidak dapat dibatalkan.</p>
              </div>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="danger-box" style={{ marginBottom: 0 }}>
                Grup <strong>{deleteConfirm.code} — {deleteConfirm.name}</strong> memiliki item di bawahnya.
                Menghapus grup ini akan menghapus <strong>semua item turunannya</strong>.
              </div>
            </div>
            <div className="modal-foot">
              <div />
              <div className="cluster">
                <button className="btn secondary" onClick={() => setDeleteConfirm(null)}>Batal</button>
                <button
                  className="btn danger"
                  disabled={deleteMut.isPending}
                  onClick={() => { deleteMut.mutate(deleteConfirm.id); setDeleteConfirm(null); }}
                >
                  {deleteMut.isPending ? 'Menghapus...' : 'Hapus Grup & Semua Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
