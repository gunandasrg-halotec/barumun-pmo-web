import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { extractError } from '../../utils/format';
import type { GanttNode } from '../../types';

// Gantt is strictly read-only per SRS 3.6
export default function GanttPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['gantt', projectId],
    queryFn: () => analyticsService.gantt(projectId!),
    enabled: !!projectId,
  });

  const nodes = data?.data ?? [];

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={extractError(error)} />;
  if (nodes.length === 0) return (
    <div>
      <div className="page-header">
        <h1>Gantt Chart</h1>
        <p>Tampilan jadwal berdasarkan baseline WBD aktif (read-only)</p>
      </div>
      <div className="info-box">ℹ️ Gantt hanya bersumber dari WBD baseline aktif.</div>
      <EmptyState title="Belum ada data Gantt" message="Pastikan proyek memiliki baseline WBD aktif." />
    </div>
  );

  // Find date range
  const allStartDates = nodes.filter((n) => n.start_date).map((n) => new Date(n.start_date!).getTime());
  const allEndDates = nodes.filter((n) => n.end_date).map((n) => new Date(n.end_date!).getTime());
  const minDate = allStartDates.length ? Math.min(...allStartDates) : Date.now();
  const maxDate = allEndDates.length ? Math.max(...allEndDates) : Date.now() + 30 * 86400000;
  const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / 86400000));
  const BAR_WIDTH = 800;

  const renderRow = (node: GanttNode, depth = 0): React.ReactNode => {
    const children = nodes.filter((n) => n.parent_node_id === node.id);
    const isGroup = node.node_type === 'GROUP';

    const barLeft = node.start_date
      ? ((new Date(node.start_date).getTime() - minDate) / 86400000 / totalDays) * BAR_WIDTH
      : 0;
    const barWidth = node.start_date && node.end_date
      ? (Math.max(1, Math.ceil((new Date(node.end_date).getTime() - new Date(node.start_date).getTime()) / 86400000) + 1) / totalDays) * BAR_WIDTH
      : 0;

    return (
      <div key={node.id}>
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: isGroup ? '#f8fafc' : 'white',
            minHeight: 36,
          }}
        >
          {/* Left: name */}
          <div
            style={{
              width: 300,
              flexShrink: 0,
              padding: '8px 12px',
              paddingLeft: 12 + depth * 16,
              fontSize: 12,
              fontWeight: isGroup ? 600 : 400,
              borderRight: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>
              {node.code}
            </span>
            <span className="truncate">{node.name}</span>
          </div>

          {/* Right: Gantt bar area */}
          <div style={{ flex: 1, position: 'relative', padding: '8px 0', overflow: 'hidden' }}>
            {node.start_date && node.end_date && (
              <div
                style={{
                  position: 'absolute',
                  left: barLeft,
                  width: Math.max(4, barWidth),
                  top: 8,
                  height: 20,
                  borderRadius: 10,
                  background: isGroup ? '#94a3b8' : '#cbd5e1',
                }}
              >
                {/* Progress fill */}
                {node.progress_percent > 0 && (
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, node.progress_percent)}%`,
                      borderRadius: 10,
                      background: isGroup ? '#475569' : 'var(--primary)',
                    }}
                    title={`Progress: ${node.progress_percent}%`}
                  />
                )}
                {node.progress_percent > 0 && (
                  <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontSize: 9, color: '#fff', fontWeight: 600 }}>
                    {node.progress_percent.toFixed(0)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {children.length > 0 && (
          <div>{children.sort((a, b) => a.sort_order - b.sort_order).map((c) => renderRow(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  const rootNodes = nodes.filter((n) => n.parent_node_id === null).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Gantt Chart</h1>
            <p>Jadwal berdasarkan baseline WBD aktif — <strong>read-only</strong></p>
          </div>
          <span className="badge badge-secondary">🔒 Read-Only</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Gantt View</div>
          <span className="text-sm text-muted">Perubahan jadwal hanya bisa melalui WBD</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderBottom: '2px solid var(--border)' }}>
            <div style={{ width: 300, flexShrink: 0, padding: '8px 12px', fontSize: 11, fontWeight: 700, borderRight: '1px solid var(--border)', textTransform: 'uppercase' }}>
              Pekerjaan
            </div>
            <div style={{ flex: 1, padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
              Jadwal (Blue = Rencana, Darker = Aktual Progress)
            </div>
          </div>
          {rootNodes.map((n) => renderRow(n, 0))}
        </div>
      </div>
    </div>
  );
}
