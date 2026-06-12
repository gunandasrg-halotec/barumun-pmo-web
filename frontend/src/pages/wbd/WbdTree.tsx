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

export default function WbdTree({ nodes, isEditable, versionId, onAddChild, onRefresh }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const deleteMut = useMutation({
    mutationFn: (nodeId: string) => wbdService.deleteNode(nodeId),
    onSuccess: onRefresh,
  });

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalProject = nodes
    .filter((n) => n.parent_node_id === null)
    .reduce((sum, n) => sum + Number(n.planned_cost), 0);

  const renderNode = (node: WbdNode, depth = 0): React.ReactNode => {
    const children = nodes.filter((n) => n.parent_node_id === node.id);
    const hasChildren = children.length > 0;
    const isCollapsed = collapsed.has(node.id);
    const isGroup = node.node_type === 'GROUP';

    return (
      <div key={node.id}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 24px 140px 1fr 80px 100px 120px 100px 80px 100px 120px',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            background: isGroup ? '#f8fafc' : 'white',
            fontSize: 13,
            minHeight: 40,
          }}
        >
          {/* Expand toggle */}
          <div style={{ paddingLeft: 8 }}>
            {hasChildren && (
              <button
                onClick={() => toggleCollapse(node.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 12 }}
              >
                {isCollapsed ? '▶' : '▼'}
              </button>
            )}
          </div>

          {/* Type */}
          <div>
            <span style={{ fontSize: 10, fontWeight: 600, color: isGroup ? 'var(--primary)' : 'var(--text-muted)' }}>
              {isGroup ? 'G' : 'I'}
            </span>
          </div>

          {/* Code */}
          <div style={{ paddingLeft: depth * 16, fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
            {node.code}
          </div>

          {/* Name */}
          <div style={{ paddingLeft: depth * 8, fontWeight: isGroup ? 600 : 400, paddingRight: 8 }}>
            {node.name}
          </div>

          {/* Unit */}
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{node.unit ?? '—'}</div>

          {/* Volume */}
          <div style={{ textAlign: 'right', paddingRight: 12 }}>
            {node.volume != null ? formatNumber(node.volume) : '—'}
          </div>

          {/* Rate */}
          <div style={{ textAlign: 'right', paddingRight: 12 }}>
            {node.rate != null ? formatCurrency(node.rate) : '—'}
          </div>

          {/* Planned Cost */}
          <div style={{ textAlign: 'right', paddingRight: 12, fontWeight: 500 }}>
            {formatCurrency(Number(node.planned_cost))}
          </div>

          {/* % */}
          <div style={{ textAlign: 'right', paddingRight: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            {node.total_percent != null ? `${Number(node.total_percent).toFixed(1)}%` : '—'}
          </div>

          {/* Dates */}
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {node.start_date ? formatDate(node.start_date) : '—'}
            {node.duration_days ? ` (${node.duration_days}h)` : ''}
          </div>

          {/* Actions */}
          <div style={{ paddingRight: 8 }}>
            {isEditable && (
              <div className="btn-group">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => onAddChild(node)}
                  title="Tambah child"
                >
                  +
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    if (window.confirm(`Hapus "${node.name}"?`)) deleteMut.mutate(node.id);
                  }}
                  title="Hapus"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Children */}
        {hasChildren && !isCollapsed && (
          <div>{children.sort((a, b) => a.sort_order - b.sort_order).map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  const rootNodes = nodes.filter((n) => n.parent_node_id === null).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '32px 24px 140px 1fr 80px 100px 120px 100px 80px 100px 120px',
          background: '#f1f5f9',
          padding: '8px 0',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          borderBottom: '2px solid var(--border)',
        }}
      >
        <div />
        <div />
        <div style={{ paddingLeft: 8 }}>Kode</div>
        <div>Nama Pekerjaan</div>
        <div>Satuan</div>
        <div style={{ textAlign: 'right', paddingRight: 12 }}>Volume</div>
        <div style={{ textAlign: 'right', paddingRight: 12 }}>Harga Satuan</div>
        <div style={{ textAlign: 'right', paddingRight: 12 }}>Biaya Rencana</div>
        <div style={{ textAlign: 'right', paddingRight: 12 }}>% Total</div>
        <div>Jadwal</div>
        <div>Aksi</div>
      </div>

      {rootNodes.length === 0 ? (
        <div className="empty-state">
          <p>Belum ada item WBD. Tambahkan item baru.</p>
        </div>
      ) : (
        rootNodes.map((n) => renderNode(n, 0))
      )}

      {/* Total row */}
      {rootNodes.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 24px 140px 1fr 80px 100px 120px 100px 80px 100px 120px',
            background: '#1e293b',
            color: '#fff',
            padding: '10px 0',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <div />
          <div />
          <div style={{ paddingLeft: 8 }}>TOTAL</div>
          <div />
          <div />
          <div />
          <div />
          <div style={{ textAlign: 'right', paddingRight: 12 }}>{formatCurrency(totalProject)}</div>
          <div style={{ textAlign: 'right', paddingRight: 12 }}>100%</div>
          <div />
          <div />
        </div>
      )}
    </div>
  );
}
