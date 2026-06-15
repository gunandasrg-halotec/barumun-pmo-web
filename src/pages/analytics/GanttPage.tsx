import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';
import { extractError } from '../../utils/format';
import type { GanttNode } from '../../types';

const GROUP_CLASSES = ['group-a', 'group-b', 'group-c', 'group-d', 'group-e', 'group-f'];
const GROUP_COLORS  = ['#2d7d46', '#cf9f3c', '#6cb0a7', '#d8824d', '#c08257', '#7b8b97'];

// Jun-Dec 2026 = 28 weeks
const MONTHS = ['Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTH_START_MS = new Date('2026-06-01T00:00:00').getTime();
const MONTH_END_MS   = new Date('2026-12-31T23:59:59').getTime();
const TOTAL_MS       = MONTH_END_MS - MONTH_START_MS;

function pct(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.min(100, Math.max(0, ((new Date(dateStr).getTime() - MONTH_START_MS) / TOTAL_MS) * 100));
}
function widthPct(startStr: string | null, endStr: string | null): number {
  if (!startStr || !endStr) return 0;
  return Math.min(100 - pct(startStr), Math.max(0.5, ((new Date(endStr).getTime() - new Date(startStr).getTime()) / TOTAL_MS) * 100));
}

export default function GanttPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['gantt', projectId],
    queryFn: () => analyticsService.gantt(projectId!),
    enabled: !!projectId,
  });

  const allNodes: GanttNode[] = (data as any)?.data ?? [];
  const rootNodes = allNodes.filter(n => n.parent_node_id === null).sort((a, b) => a.sort_order - b.sort_order);

  const todayPct = ((Date.now() - MONTH_START_MS) / TOTAL_MS) * 100;

  const onTrack = allNodes.filter(n => n.node_type === 'ITEM' && n.progress_percent >= 80).length;
  const delayed = allNodes.filter(n => n.node_type === 'ITEM' && n.progress_percent < 40 && n.start_date && new Date(n.start_date) < new Date()).length;
  const done    = allNodes.filter(n => n.node_type === 'ITEM' && n.progress_percent >= 100).length;

  function flatRows(node: GanttNode, groupIdx: number, depth = 0): { node: GanttNode; groupIdx: number; depth: number }[] {
    const children = allNodes.filter(n => n.parent_node_id === node.id).sort((a, b) => a.sort_order - b.sort_order);
    return [{ node, groupIdx, depth }, ...children.flatMap(c => flatRows(c, groupIdx, depth + 1))];
  }

  const rows = rootNodes.flatMap((n, i) => flatRows(n, i, 0));

  if (isLoading) return <div className="loading-state">Memuat Gantt Chart...</div>;
  if (error)     return <div className="danger-box">{extractError(error)}</div>;

  return (
    <div>
      <div className="gantt-card glass">
        <div className="gantt-header">
          <div>
            <h3 style={{ margin: 0 }}>Gantt Chart Berdasarkan WBD</h3>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              Timeline mingguan Juni – Desember 2026. Bersumber dari baseline WBD aktif — <strong>read-only</strong>.
            </p>
          </div>
          <div className="cluster">
            <span className="chip">Zoom: Mingguan</span>
            <span className="chip status-ok">On Track {onTrack}</span>
            <span className="chip status-warn">Delay {delayed}</span>
            <span className="chip">Selesai {done}</span>
          </div>
        </div>

        <div className="toolbar">
          <select><option>Semua Grup</option>{rootNodes.map(n => <option key={n.id}>{n.name}</option>)}</select>
          <select><option>Semua Status</option><option>On Track</option><option>Delay</option><option>Selesai</option></select>
          <select><option>Mingguan</option><option>Bulanan</option></select>
          <button className="btn secondary">Tampilkan Baseline vs Actual</button>
          <div className="stretch" />
        </div>

        {allNodes.length === 0 ? (
          <div className="empty-state">
            Belum ada data Gantt. Pastikan proyek memiliki baseline WBD aktif dengan tanggal mulai dan durasi.
          </div>
        ) : (
          <div className="gantt-layout">
            {/* Task panel */}
            <div className="task-panel">
              <div className="task-head">
                <strong>Pekerjaan</strong>
                <strong>Bobot</strong>
                <strong>Status</strong>
              </div>
              {rows.map(({ node, groupIdx, depth }) => {
                const isGroup = node.node_type === 'GROUP';
                const pctVal  = node.progress_percent ?? 0;
                const statusCls = pctVal >= 100 ? 'done' : pctVal > 0 ? 'running' : 'planned';
                const statusLbl = pctVal >= 100 ? 'Done' : pctVal > 0 ? `${pctVal.toFixed(0)}%` : 'Plan';
                return (
                  <div key={node.id} className="task-row">
                    <div className="task-title">
                      <strong style={{ paddingLeft: depth * 14, color: isGroup ? 'var(--green-800)' : undefined }}>
                        {isGroup ? `${String.fromCharCode(65 + groupIdx)}. ` : ''}{node.name}
                      </strong>
                      {!isGroup && node.start_date && (
                        <span>{node.start_date} – {node.end_date ?? '—'}</span>
                      )}
                      {isGroup && <span>Header grup</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {node.weight_percent != null ? `${Number(node.weight_percent).toFixed(2)}%` : '—'}
                    </div>
                    <div>
                      <span className={`badge ${statusCls}`}>{isGroup ? 'Live' : statusLbl}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Timeline panel */}
            <div className="timeline-panel">
              <div className="timeline-head">
                <div className="month-row">
                  {MONTHS.map(m => <div key={m} style={{ gridColumn: 'span 4' }}>{m}</div>)}
                </div>
                <div className="week-row">
                  {MONTHS.flatMap(() => [1, 2, 3, 4]).map((w, i) => <div key={i}>{w}</div>)}
                </div>
              </div>

              <div className="timeline-body">
                {/* Today line */}
                <div className="today-line" style={{ left: `${Math.min(98, Math.max(2, todayPct))}%` }} />

                {rows.map(({ node, groupIdx }) => {
                  const barLeft  = pct(node.start_date ?? null);
                  const barWidth = widthPct(node.start_date ?? null, node.end_date ?? null);
                  const fillPct  = node.progress_percent ?? 0;
                  const cls      = GROUP_CLASSES[groupIdx % GROUP_CLASSES.length];

                  return (
                    <div key={node.id} className="timeline-grid-row">
                      {node.start_date && node.end_date && barWidth > 0 && (
                        <div
                          className={`bar ${cls}${fillPct === 0 && node.start_date && new Date(node.start_date) < new Date() ? ' delay' : ''}`}
                          style={{ left: `${barLeft}%`, width: `${barWidth}%`, top: 18 }}
                        >
                          <div className="fill" style={{ width: `${Math.min(100, fillPct)}%` }} />
                          <span>{fillPct >= 100 ? 'Done' : fillPct > 0 ? `${fillPct.toFixed(0)}%` : node.node_type === 'GROUP' ? `Grup ${String.fromCharCode(65 + groupIdx)}` : 'Plan'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="legend">
          {rootNodes.map((n, i) => (
            <div key={n.id} className="chip">
              <i style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
              {n.name}
            </div>
          ))}
          <div className="chip"><i style={{ background: 'var(--danger)' }} /> Risiko Delay</div>
        </div>

        <div className="empty-state" style={{ marginTop: 12 }}>
          Perubahan jadwal hanya bisa melalui halaman WBD — Gantt ini bersifat read-only.
        </div>
      </div>
    </div>
  );
}
