import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';
import { wbdService } from '../../services/wbdService';
import { extractError } from '../../utils/format';
import type { GanttNode, WbdNodeDependency, WbdVersion } from '../../types';

const DEP_LABELS: Record<string, string> = { FS: 'Finish→Start', SS: 'Start→Start', FF: 'Finish→Finish', SF: 'Start→Finish' };
const ROW_H = 56;  // must match .timeline-grid-row height in CSS
const BAR_MID_Y = 18 + 16; // top offset of bar + half bar height (~16px)

const GROUP_CLASSES = ['group-a', 'group-b', 'group-c', 'group-d', 'group-e', 'group-f'];
const GROUP_COLORS  = ['#2d7d46', '#cf9f3c', '#6cb0a7', '#d8824d', '#c08257', '#7b8b97'];

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

// ─── Dependency Arrows SVG Overlay ───────────────────────────────────────────

function DependencyArrows({
  rows,
  dependencies,
}: {
  rows: { node: GanttNode; groupIdx: number; depth: number; isCollapsed: boolean }[];
  dependencies: WbdNodeDependency[];
}) {
  if (dependencies.length === 0) return null;

  // Map nodeId → row index in the currently visible rows
  const rowIndex = new Map<string, number>();
  rows.forEach(({ node }, i) => rowIndex.set(node.id, i));

  const arrows: React.ReactNode[] = [];

  dependencies.forEach(dep => {
    const predIdx = rowIndex.get(dep.predecessor_node_id);
    const succIdx = rowIndex.get(dep.successor_node_id);
    if (predIdx == null || succIdx == null) return; // one side is collapsed/hidden

    const predNode = rows[predIdx].node;
    const succNode = rows[succIdx].node;

    // X positions (%) based on dependency type
    let x1Pct: number, x2Pct: number;
    if (dep.dependency_type === 'FS' || dep.dependency_type === 'FF') {
      x1Pct = pct(predNode.start_date) + widthPct(predNode.start_date, predNode.end_date); // end of pred
    } else {
      x1Pct = pct(predNode.start_date); // start of pred
    }
    if (dep.dependency_type === 'FS' || dep.dependency_type === 'SS') {
      x2Pct = pct(succNode.start_date); // start of succ
    } else {
      x2Pct = pct(succNode.start_date) + widthPct(succNode.start_date, succNode.end_date); // end of succ
    }

    if (x1Pct <= 0 && x2Pct <= 0) return; // no dates

    const y1 = predIdx * ROW_H + BAR_MID_Y;
    const y2 = succIdx * ROW_H + BAR_MID_Y;

    // Use % for x but px for y — render in a 100%×totalHeight SVG
    // We'll use a 1000-unit wide coordinate space for x to work with %
    const X = (pct: number) => (pct / 100) * 1000;
    const x1 = X(x1Pct);
    const x2 = X(x2Pct);
    const midX = (x1 + x2) / 2;

    const key = dep.id;
    const color = '#f59e0b'; // amber

    arrows.push(
      <g key={key}>
        <path
          d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
          stroke={color}
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="5 3"
          opacity="0.8"
        />
        {/* Arrowhead */}
        <polygon
          points={`${x2},${y2} ${x2 - 6},${y2 - 4} ${x2 - 6},${y2 + 4}`}
          fill={color}
          opacity="0.8"
        />
        {/* Label */}
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 4} fontSize="9" fill={color} textAnchor="middle" opacity="0.9">
          {dep.dependency_type}
        </text>
      </g>
    );
  });

  if (arrows.length === 0) return null;
  const totalHeight = rows.length * ROW_H;

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: totalHeight, pointerEvents: 'none', zIndex: 10 }}
      viewBox={`0 0 1000 ${totalHeight}`}
      preserveAspectRatio="none"
    >
      {arrows}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GanttPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');

  const versionsQ = useQuery({
    queryKey: ['wbd-versions', projectId],
    queryFn: () => wbdService.listVersions(projectId!),
    enabled: !!projectId,
  });
  const versions: WbdVersion[] = (versionsQ.data as any)?.data ?? [];

  const { data, isLoading, error } = useQuery({
    queryKey: ['gantt', projectId, selectedVersionId],
    queryFn: () => analyticsService.gantt(projectId!, selectedVersionId || undefined),
    enabled: !!projectId,
  });

  const allNodes: GanttNode[]             = (data as any)?.data ?? [];
  const dependencies: WbdNodeDependency[] = (data as any)?.dependencies ?? [];
  const isActiveVersion: boolean          = (data as any)?.meta?.is_active_version !== false;

  const groupIds = useMemo(
    () => new Set(allNodes.filter(n => n.node_type === 'GROUP').map(n => n.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allNodes.length]
  );

  // Default: semua GROUP di-collapse. Reinitialize ketika data pertama kali tiba.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  if (!initialized && groupIds.size > 0) {
    setCollapsed(new Set(groupIds));
    setInitialized(true);
  }

  const rootNodes = allNodes
    .filter(n => n.parent_node_id === null)
    .sort((a, b) => a.sort_order - b.sort_order);

  const todayPct = ((Date.now() - MONTH_START_MS) / TOTAL_MS) * 100;

  const onTrack = allNodes.filter(n => n.node_type === 'ITEM' && n.progress_percent >= 80).length;
  const delayed = allNodes.filter(n => n.node_type === 'ITEM' && n.progress_percent < 40 && n.start_date && new Date(n.start_date) < new Date()).length;
  const done    = allNodes.filter(n => n.node_type === 'ITEM' && n.progress_percent >= 100).length;

  function toggleCollapse(nodeId: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function collapseAll() {
    setCollapsed(new Set(groupIds));
  }

  // Count all descendants of a node
  function countDescendants(nodeId: string): number {
    const children = allNodes.filter(n => n.parent_node_id === nodeId);
    return children.reduce((sum, c) => sum + 1 + countDescendants(c.id), 0);
  }

  // Build flat rows — skip children of collapsed nodes (recursive)
  function flatRows(
    node: GanttNode,
    groupIdx: number,
    depth = 0
  ): { node: GanttNode; groupIdx: number; depth: number; isCollapsed: boolean }[] {
    const isCollapsed = collapsed.has(node.id);
    const children = isCollapsed
      ? []
      : allNodes
          .filter(n => n.parent_node_id === node.id)
          .sort((a, b) => a.sort_order - b.sort_order);
    return [
      { node, groupIdx, depth, isCollapsed },
      ...children.flatMap(c => flatRows(c, groupIdx, depth + 1)),
    ];
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
              Timeline mingguan Juni – Desember 2026 — <strong>read-only</strong>.
              {!isActiveVersion && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>⚠ Versi non-aktif — timeline saja, tanpa data realisasi.</span>}
            </p>
          </div>
          <div className="cluster">
            <span className="chip">Zoom: Mingguan</span>
            {isActiveVersion && <span className="chip status-ok">On Track {onTrack}</span>}
            {isActiveVersion && <span className="chip status-warn">Delay {delayed}</span>}
            {isActiveVersion && <span className="chip">Selesai {done}</span>}
          </div>
        </div>

        <div className="toolbar">
          <select
            value={selectedVersionId}
            onChange={e => { setSelectedVersionId(e.target.value); setInitialized(false); }}
            style={{ fontWeight: 600 }}
          >
            <option value="">— Versi Aktif (Baseline) —</option>
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                v{v.version_number} — {v.status}
              </option>
            ))}
          </select>
          <select><option>Semua Grup</option>{rootNodes.map(n => <option key={n.id}>{n.name}</option>)}</select>
          <select><option>Semua Status</option><option>On Track</option><option>Delay</option><option>Selesai</option></select>
          <select><option>Mingguan</option><option>Bulanan</option></select>
          <button className="btn secondary" onClick={expandAll}>▼ Expand All</button>
          <button className="btn secondary" onClick={collapseAll}>▶ Collapse All</button>
          <div className="stretch" />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {rows.length} / {allNodes.length} baris
          </span>
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
              {rows.map(({ node, groupIdx, depth, isCollapsed }) => {
                const isGroup  = node.node_type === 'GROUP';
                const pctVal   = node.progress_percent ?? 0;
                const statusCls = pctVal >= 100 ? 'done' : pctVal > 0 ? 'running' : 'planned';
                const statusLbl = pctVal >= 100 ? 'Done' : pctVal > 0 ? `${pctVal.toFixed(0)}%` : 'Plan';
                const hiddenCount = isGroup && isCollapsed ? countDescendants(node.id) : 0;

                return (
                  <div key={node.id} className="task-row">
                    <div className="task-title">
                      <strong style={{
                        paddingLeft: depth * 14,
                        color: isGroup ? 'var(--green-800)' : undefined,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {isGroup && (
                          <button
                            onClick={() => toggleCollapse(node.id)}
                            className="gantt-toggle"
                            title={isCollapsed ? 'Expand' : 'Collapse'}
                          >
                            {isCollapsed ? '▶' : '▼'}
                          </button>
                        )}
                        {isGroup ? `${String.fromCharCode(65 + groupIdx)}. ` : ''}{node.name}
                        {isGroup && isCollapsed && hiddenCount > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400, marginLeft: 4 }}>
                            ({hiddenCount} item)
                          </span>
                        )}
                      </strong>
                      {!isGroup && node.start_date && (
                        <span style={{ paddingLeft: depth * 14 }}>{node.start_date} – {node.end_date ?? '—'}</span>
                      )}
                      {isGroup && !isCollapsed && <span>Header grup</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {node.weight_percent != null ? `${Number(node.weight_percent).toFixed(2)}%` : '—'}
                    </div>
                    <div>
                      <span className={`badge ${isGroup ? (isCollapsed ? 'planned' : 'running') : statusCls}`}>
                        {isGroup ? (isCollapsed ? 'Tutup' : 'Live') : statusLbl}
                      </span>
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

              <div className="timeline-body" style={{ position: 'relative' }}>
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
                          <span>
                            {fillPct >= 100 ? 'Done' : fillPct > 0
                              ? `${fillPct.toFixed(0)}%`
                              : node.node_type === 'GROUP'
                                ? `Grup ${String.fromCharCode(65 + groupIdx)}`
                                : 'Plan'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Dependency arrows overlay */}
                <DependencyArrows rows={rows} dependencies={dependencies} />
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
          {dependencies.length > 0 && (
            <div className="chip"><i style={{ background: '#f59e0b' }} /> Dependensi ({dependencies.length})</div>
          )}
        </div>

        <div className="empty-state" style={{ marginTop: 12 }}>
          Perubahan jadwal hanya bisa melalui halaman WBD — Gantt ini bersifat read-only.
        </div>
      </div>
    </div>
  );
}
