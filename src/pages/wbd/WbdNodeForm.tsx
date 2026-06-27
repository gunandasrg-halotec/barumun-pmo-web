import { useState, SubmitEvent } from 'react';
import { wbdService } from '../../services/wbdService';
import { extractError } from '../../utils/format';
import type { WbdNode } from '../../types';
import { AddDependencyModal } from './WbdTree';

interface Props {
  versionId: string;
  parentNode: WbdNode | null;
  allNodes: WbdNode[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function WbdNodeForm({ versionId, parentNode, allNodes, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState({
    node_type: parentNode ? 'ITEM' : 'GROUP',
    code: '',
    name: '',
    description: '',
    unit: '',
    volume: '',
    rate: '',
    start_date: '',
    duration_days: '',
    sort_order: '0',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  // After creation of an ITEM node, offer to add dependencies
  const [createdNode, setCreatedNode] = useState<WbdNode | null>(null);
  const [showDepModal, setShowDepModal] = useState(false);

  const isItem = form.node_type === 'ITEM';

  const set = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setFieldErrors((p) => ({ ...p, [field]: [] }));
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const payload: any = {
      node_type: form.node_type,
      code: form.code,
      name: form.name,
      description: form.description || undefined,
      sort_order: parseInt(form.sort_order) || 0,
      parent_node_id: parentNode?.id ?? undefined,
    };

    if (isItem) {
      payload.unit = form.unit;
      payload.volume = parseFloat(form.volume) || 0;
      payload.rate = parseFloat(form.rate) || 0;
      payload.start_date = form.start_date || undefined;
      payload.duration_days = parseInt(form.duration_days) || undefined;
    }

    try {
      const res = await wbdService.createNode(versionId, payload);
      const newNode: WbdNode = (res as any)?.data;
      if (isItem && newNode?.id) {
        setCreatedNode({ ...newNode, predecessors: [] });
      } else {
        onSuccess();
      }
    } catch (err: any) {
      if (err?.response?.data?.errors) {
        setFieldErrors(err.response.data.errors);
      } else {
        setError(extractError(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name]?.length ? (
      <div className="form-error">{fieldErrors[name][0]}</div>
    ) : null;

  // Step 2: node created — offer dependency step
  if (createdNode) {
    return (
      <div>
        <div className="info-box" style={{ marginBottom: 16 }}>
          ✓ Item <strong>{createdNode.code} — {createdNode.name}</strong> berhasil ditambahkan.
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          Apakah item ini bergantung pada task lain? Tambahkan relasi sekarang (opsional).
        </p>
        {createdNode.predecessors && createdNode.predecessors.length > 0 && (
          <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {createdNode.predecessors.map(p => (
              <span key={p.id} className="chip" style={{ background: 'var(--surface)', border: '1px solid var(--line)', fontSize: 12 }}>
                <strong style={{ color: 'var(--green-700)' }}>{p.dependency_type}</strong> ← {p.code}
              </span>
            ))}
          </div>
        )}
        <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={onSuccess}>Selesai tanpa relasi</button>
          <button className="btn btn-primary" onClick={() => setShowDepModal(true)}>+ Tambah Relasi</button>
        </div>
        {showDepModal && (
          <AddDependencyModal
            node={createdNode}
            allNodes={allNodes}
            onClose={() => setShowDepModal(false)}
            onSaved={() => {
              setCreatedNode(prev => prev ? { ...prev, predecessors: [...(prev.predecessors ?? [])] } : prev);
              setShowDepModal(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}
      {parentNode && (
        <div className="info-box" style={{ marginBottom: 12 }}>
          Parent: <strong>{parentNode.code} — {parentNode.name}</strong>
        </div>
      )}

      <div className="grid-2">
        <div className="form-grid field">
          <label >Tipe Node <span className="required">*</span></label>
          <select  value={form.node_type} onChange={(e) => set('node_type', e.target.value)}>
            <option value="GROUP">GROUP (Header / Grup)</option>
            <option value="ITEM">ITEM (Pekerjaan Operasional)</option>
          </select>
        </div>
        <div className="form-grid field">
          <label >Urutan</label>
          <input type="number"  value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} min="0" />
        </div>
      </div>

      <div className="grid-2">
        <div className="form-grid field">
          <label >Kode <span className="required">*</span></label>
          <input type="text"  value={form.code} onChange={(e) => set('code', e.target.value)} required placeholder="A.1.1" />
          <FieldError name="code" />
        </div>
        <div className="form-grid field">
          <label >Nama <span className="required">*</span></label>
          <input type="text"  value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Nama pekerjaan" />
          <FieldError name="name" />
        </div>
      </div>

      {isItem && (
        <>
          <div className="grid-3">
            <div className="form-grid field">
              <label >Satuan <span className="required">*</span></label>
              <input type="text"  value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="m², ton, unit" required={isItem} />
            </div>
            <div className="form-grid field">
              <label >Volume <span className="required">*</span></label>
              <input type="number"  value={form.volume} onChange={(e) => set('volume', e.target.value)} step="0.0001" min="0" required={isItem} />
            </div>
            <div className="form-grid field">
              <label >Harga Satuan <span className="required">*</span></label>
              <input type="number"  value={form.rate} onChange={(e) => set('rate', e.target.value)} step="1" min="0" required={isItem} />
            </div>
          </div>

          {form.volume && form.rate && (
            <div className="info-box" style={{ marginBottom: 12 }}>
              Biaya Rencana: <strong>Rp {(parseFloat(form.volume) * parseFloat(form.rate)).toLocaleString('id-ID')}</strong>
            </div>
          )}

          <div className="grid-2">
            <div className="form-grid field">
              <label >Tanggal Mulai <span className="required">*</span></label>
              <input type="date"  value={form.start_date} onChange={(e) => set('start_date', e.target.value)} required={isItem} />
            </div>
            <div className="form-grid field">
              <label >Durasi (hari) <span className="required">*</span></label>
              <input type="number"  value={form.duration_days} onChange={(e) => set('duration_days', e.target.value)} min="1" required={isItem} />
            </div>
          </div>
        </>
      )}

      <div className="form-grid field">
        <label >Deskripsi</label>
        <textarea  value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
      </div>

      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Menyimpan...' : 'Tambah Item'}
        </button>
      </div>
    </form>
  );
}
