import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { wbdService } from '../../services/wbdService';
import { formatCurrency, formatNumber, formatDate } from '../../utils/format';
import type { WbdNode } from '../../types';

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

export default function WbdTree({ nodes, isEditable, onAddChild, onRefresh }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  const rootNodes = nodes.filter(n => n.parent_node_id === null).sort((a, b) => a.sort_order - b.sort_order);
  const totalCost = rootNodes.reduce((s, n) => s + Number(n.planned_cost ?? 0), 0);

  function renderRows(node: WbdNode, depth = 0): React.ReactNode {
    const children = nodes.filter(n => n.parent_node_id === node.id).sort((a, b) => a.sort_order - b.sort_order);
    const hasChildren = children.length > 0;
    const isGroup  = node.node_type === 'GROUP';
    const isColl   = collapsed.has(node.id);
    const indent   = depth > 0 ? `${depth * 18}px` : undefined;
    const endDate  = computeEndDate(node.start_date ?? null, node.duration_days ?? null);
    const st       = STATUS_MAP[node.status ?? ''] ?? { label: node.status ?? '—', cls: 'planned' };
    const subtotal = isGroup ? children.reduce((s, c) => s + Number(c.planned_cost ?? 0), 0) : 0;
    const compPct  = isGroup && totalCost > 0 ? ((subtotal / totalCost) * 100).toFixed(2) : null;

    return (
      <>
        {/* Group row */}
        <tr key={node.id} className={isGroup ? 'group-row' : depth >= 2 ? 'indent-2' : 'indent-1'}>
          <td>{node.code}</td>
          <td style={{ paddingLeft: indent }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {hasChildren && (
                <button
                  onClick={() => toggle(node.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontSize: 11, opacity: 0.8 }}
                >
                  {isColl ? '▶' : '▼'}
                </button>
              )}
              {node.name}
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
          <td>{node.start_date ? formatDate(node.start_date) : '—'}</td>
          <td>{node.duration_days ?? '—'}</td>
          <td>{endDate !== '—' ? formatDate(endDate) : '—'}</td>
          <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
          <td>
            {isEditable && (
              <div className="cluster">
                <button className="chip clickable" onClick={() => onAddChild(node)}>+ Item</button>
                <button
                  className="chip clickable"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => { if (window.confirm(`Hapus "${node.name}"?`)) deleteMut.mutate(node.id); }}
                >
                  Hapus
                </button>
              </div>
            )}
          </td>
        </tr>

        {/* Children */}
        {hasChildren && !isColl && children.map(c => renderRows(c, depth + 1))}

        {/* Subtotal row for groups */}
        {isGroup && !isColl && (
          <tr className="subtotal-row">
            <td></td>
            <td>Jumlah Biaya {node.name}</td>
            <td></td><td></td><td></td>
            <td>{formatCurrency(subtotal)}</td>
            <td></td><td></td><td></td><td></td><td></td>
            <td><span className="badge done">Subtotal</span></td>
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
    </div>
  );
}
