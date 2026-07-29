import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';
import { wbdService } from '../../services/wbdService';
import { extractError } from '../../utils/format';
import type { GanttNode, WbdNodeDependency, WbdVersion, ScheduleStatus } from '../../types';
import './gantt-modernist.css';

// ─── Constants ────────────────────────────────────────────────────────────

const ROWH = 30;
const LEFT_W = 720; // sticky left task-table width; must match .gm-header-cell / .gm-left-col in CSS
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PPD: Record<Zoom, number> = { harian: 24, mingguan: 12, bulanan: 6 };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

type Zoom = 'harian' | 'mingguan' | 'bulanan';
type LinkMode = 'terpilih' | 'semua' | 'nonaktif';
type Bucket = 'ontrack' | 'delay' | 'selesai';
type RowKind = 'phase' | 'group' | 'task';

const BUCKET_OF: Record<ScheduleStatus, Bucket> = {
  NOT_STARTED: 'ontrack',
  ON_TRACK: 'ontrack',
  AHEAD: 'ontrack',
  NO_DATA: 'ontrack',
  DELAYED: 'delay',
  COMPLETED_LATE: 'delay',
  COMPLETED_ON_TIME: 'selesai',
};
const DONE_STATUSES: ScheduleStatus[] = ['COMPLETED_ON_TIME', 'COMPLETED_LATE'];

const FALLBACK_START_MS = new Date('2026-06-01T00:00:00').getTime();
const FALLBACK_END_MS = new Date('2026-12-31T23:59:59').getTime();

// ─── Date helpers ─────────────────────────────────────────────────────────

function dayOffset(dateStr: string | null | undefined, rangeStartMs: number): number {
  if (!dateStr) return 0;
  return Math.round((new Date(dateStr + 'T00:00:00').getTime() - rangeStartMs) / MS_PER_DAY);
}
function daysBetween(aISO: string, bISO: string): number {
  return Math.round((new Date(bISO + 'T00:00:00').getTime() - new Date(aISO + 'T00:00:00').getTime()) / MS_PER_DAY);
}
function todayISO(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ─── Row model ────────────────────────────────────────────────────────────

interface VisibleRow {
  node: GanttNode;
  depth: number;
  kind: RowKind;
  isGroup: boolean;
  open: boolean;
  rowIndex: number;
  x: number;
  w: number;
  durLabel: string;
  mulaiLabel: string;
  selesaiLabel: string;
  aktualMulaiLabel: string;
  aktualSelesaiLabel: string;
  pctLabel: string;
  pctColor: 'muted' | 'accent' | 'ink';
  late: boolean;
  hasData: boolean;
  real: { x: number; w: number; done: boolean } | null;
  tagText: string;
}

function bucketOf(status: ScheduleStatus): Bucket {
  return BUCKET_OF[status] ?? 'ontrack';
}

// ─── Time axis ────────────────────────────────────────────────────────────

interface TierCell {
  key: string;
  label: string;
  widthPx: number;
  strong: boolean;
  big: boolean;
  mute: boolean;
  center: boolean;
  bg?: string;
}

function buildSegments(zoom: Zoom, ppd: number, spanDays: number, rangeStartMs: number) {
  const tier1: TierCell[] = [];
  const tier2: TierCell[] = [];
  const grid: number[] = [];
  const bands: number[] = [];

  const dateAt = (o: number) => new Date(rangeStartMs + o * MS_PER_DAY);
  const cell = (label: string, a: number, b: number, opts: { big?: boolean; strong?: boolean; mute?: boolean; center?: boolean; bg?: string }): TierCell => {
    const widthPx = (b - a) * ppd;
    return {
      key: `${a}-${b}-${label}`,
      label: widthPx < label.length * 5.6 + 12 ? '' : label,
      widthPx,
      strong: !!opts.strong,
      big: !!opts.big,
      mute: !!opts.mute,
      center: !!opts.center,
      bg: opts.bg,
    };
  };

  const monthEdges: { a: number; b: number; m: number; y: number }[] = [];
  for (let i = 0; i <= spanDays; i++) {
    const d = dateAt(i);
    if (i === 0 || d.getDate() === 1) monthEdges.push({ a: i, b: spanDays, m: d.getMonth(), y: d.getFullYear() });
  }
  monthEdges.forEach((e, i) => { e.b = i + 1 < monthEdges.length ? monthEdges[i + 1].a : spanDays; });

  if (zoom === 'bulanan') {
    const y0 = monthEdges[0]?.y, y1 = monthEdges[monthEdges.length - 1]?.y;
    const label = y0 === y1 ? `Tahun ${y0} — Rencana Proyek` : `${y0}–${y1} — Rencana Proyek`;
    tier1.push(cell(label, 0, spanDays, { big: true, strong: true }));
    monthEdges.forEach(e => { tier2.push(cell(`${MONTH_NAMES[e.m]} ${e.y}`, e.a, e.b, { mute: true })); grid.push(e.a); });
  } else {
    monthEdges.forEach(e => tier1.push(cell(`${MONTH_NAMES[e.m]} ${e.y}`, e.a, e.b, { big: true, strong: true })));
    if (zoom === 'harian') {
      for (let i = 0; i < spanDays; i++) {
        const d = dateAt(i);
        const we = d.getDay() === 0 || d.getDay() === 6;
        tier2.push(cell(String(d.getDate()), i, i + 1, { mute: true, center: true, bg: we ? 'color-mix(in srgb,var(--gm-ink) 6%,transparent)' : undefined }));
        if (d.getDay() === 1) grid.push(i);
        if (we) bands.push(i);
      }
    } else {
      for (let w = 0; w * 7 < spanDays; w++) {
        const a = w * 7, b = Math.min(spanDays, a + 7), d = dateAt(a);
        tier2.push(cell(`M${w + 1} · ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`, a, b, { mute: true }));
        grid.push(a);
      }
    }
  }
  return { tier1, tier2, grid, bands };
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function GanttPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [zoom, setZoom] = useState<Zoom>('mingguan');
  const [linkMode, setLinkMode] = useState<LinkMode>('terpilih');
  const [openBranches, setOpenBranches] = useState<Record<string, boolean> | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Bucket>('ALL');

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

  const allNodes: GanttNode[] = (data as any)?.data ?? [];
  const dependencies: WbdNodeDependency[] = (data as any)?.dependencies ?? [];
  const isActiveVersion: boolean = (data as any)?.meta?.is_active_version !== false;
  const hasBaseline: boolean = (data as any)?.meta?.has_baseline !== false;
  const versionLabel: string = (data as any)?.meta?.version_label ?? '—';

  const rootNodes = useMemo(
    () => allNodes.filter(n => n.parent_node_id === null).sort((a, b) => a.sort_order - b.sort_order),
    [allNodes],
  );

  const childrenOf = useMemo(() => {
    const map = new Map<string, GanttNode[]>();
    allNodes.forEach(n => {
      const key = n.parent_node_id ?? 'ROOT';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    });
    map.forEach(list => list.sort((a, b) => a.sort_order - b.sort_order));
    return map;
  }, [allNodes]);

  const leaves = useMemo(() => allNodes.filter(n => n.node_type === 'ITEM'), [allNodes]);

  const openMap = useMemo(() => {
    if (openBranches) return openBranches;
    const o: Record<string, boolean> = {};
    allNodes.forEach(n => { if (n.node_type === 'GROUP') o[n.id] = true; });
    return o;
  }, [openBranches, allNodes]);

  function toggleBranch(id: string) {
    setOpenBranches({ ...openMap, [id]: !openMap[id] });
  }
  function setAllBranches(v: boolean) {
    const o: Record<string, boolean> = {};
    allNodes.forEach(n => { if (n.node_type === 'GROUP') o[n.id] = v; });
    setOpenBranches(o);
  }

  // Dynamic timeline range from node dates, month-aligned, with padding.
  const { rangeStartMs, spanDays } = useMemo(() => {
    const dates = allNodes.flatMap(n => [n.start_date, n.end_date]).filter(Boolean) as string[];
    let startMs: number, endMs: number;
    if (dates.length === 0) {
      startMs = FALLBACK_START_MS; endMs = FALLBACK_END_MS;
    } else {
      const times = dates.map(d => new Date(d).getTime());
      const PAD_MS = 7 * MS_PER_DAY;
      const start = new Date(Math.min(...times) - PAD_MS);
      const end = new Date(Math.max(...times) + PAD_MS);
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
      startMs = start.getTime(); endMs = end.getTime();
    }
    return { rangeStartMs: startMs, spanDays: Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allNodes.length]);

  const ppd = PPD[zoom];
  const chartWidth = Math.round(spanDays * ppd);
  const today = todayISO();
  const todayOffset = Math.min(spanDays, Math.max(0, dayOffset(today, rangeStartMs)));
  const todayX = Math.round(todayOffset * ppd);

  const ancestorRootCode = useMemo(() => {
    const byId = new Map(allNodes.map(n => [n.id, n]));
    const cache = new Map<string, string>();
    function rootOf(id: string): string {
      if (cache.has(id)) return cache.get(id)!;
      const node = byId.get(id);
      if (!node) return '';
      const result = node.parent_node_id ? rootOf(node.parent_node_id) : node.code;
      cache.set(id, result);
      return result;
    }
    return rootOf;
  }, [allNodes]);

  const passSet = useMemo(() => {
    const set = new Set<string>();
    leaves.forEach(n => {
      const groupOk = groupFilter === 'ALL' || ancestorRootCode(n.id) === groupFilter;
      const statusOk = statusFilter === 'ALL' || bucketOf(n.schedule_status) === statusFilter;
      if (groupOk && statusOk) set.add(n.id);
    });
    return set;
  }, [leaves, groupFilter, statusFilter, ancestorRootCode]);

  const includedMap = useMemo(() => {
    const memo = new Map<string, boolean>();
    function included(node: GanttNode): boolean {
      if (memo.has(node.id)) return memo.get(node.id)!;
      let result: boolean;
      if (node.node_type === 'ITEM') {
        result = passSet.has(node.id);
      } else {
        const kids = childrenOf.get(node.id) ?? [];
        result = kids.some(k => included(k));
      }
      memo.set(node.id, result);
      return result;
    }
    allNodes.forEach(included);
    return memo;
  }, [allNodes, childrenOf, passSet]);

  // Build the flat, visible row list.
  const rows: VisibleRow[] = useMemo(() => {
    const out: VisibleRow[] = [];

    function buildRow(node: GanttNode, depth: number, kind: RowKind): VisibleRow {
      const isGroup = kind !== 'task';
      const x = dayOffset(node.start_date, rangeStartMs) * ppd;
      const w = node.start_date && node.end_date ? Math.max(3, daysBetween(node.start_date, node.end_date) * ppd) : 0;

      const hasData = node.schedule_status !== 'NO_DATA';
      const done = DONE_STATUSES.includes(node.schedule_status);

      // "late" — literal date comparison per row (independent of the bucket/counter
      // mapping above), matching the design spec's Late rule exactly.
      let late = false;
      if (!isGroup && node.end_date) {
        late = done && node.actual_end_date
          ? node.actual_end_date > node.end_date
          : (!done && today > node.end_date);
      }

      let real: VisibleRow['real'] = null;
      if (!isGroup && node.progress_percent > 0 && node.actual_start_date) {
        const rx = dayOffset(node.actual_start_date, rangeStartMs) * ppd;
        const rdDays = done && node.actual_end_date
          ? daysBetween(node.actual_start_date, node.actual_end_date)
          : Math.max(1, daysBetween(node.actual_start_date, today));
        real = { x: rx, w: Math.max(3, rdDays * ppd), done };
      }

      const pctColor: VisibleRow['pctColor'] = node.progress_percent === 100 ? 'muted' : (late ? 'accent' : 'ink');
      const tagText = isGroup
        ? `${node.progress_percent}%`
        : (!hasData ? '' : (late ? `${node.progress_percent}% · terlambat` : (node.progress_percent > 0 ? `${node.progress_percent}%` : '')));

      return {
        node, depth, kind, isGroup,
        open: kind === 'task' ? false : openMap[node.id] !== false,
        rowIndex: 0,
        x, w,
        durLabel: kind === 'task' ? `${node.duration_days ?? 0}h` : '—',
        mulaiLabel: node.start_date ?? '—',
        selesaiLabel: node.end_date ?? '—',
        aktualMulaiLabel: node.actual_start_date ?? '—',
        aktualSelesaiLabel: node.actual_end_date ?? '—',
        pctLabel: `${node.progress_percent}%`,
        pctColor,
        late, hasData, real, tagText,
      };
    }

    function flatten(node: GanttNode, depth: number) {
      if (node.node_type === 'ITEM') {
        if (includedMap.get(node.id)) out.push(buildRow(node, depth, 'task'));
        return;
      }
      if (!includedMap.get(node.id)) return;
      const kind: RowKind = depth === 0 ? 'phase' : 'group';
      const row = buildRow(node, depth, kind);
      out.push(row);
      if (row.open) {
        (childrenOf.get(node.id) ?? []).forEach(c => flatten(c, depth + 1));
      }
    }

    rootNodes.forEach(root => flatten(root, 0));
    out.forEach((r, i) => { r.rowIndex = i; });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootNodes, childrenOf, includedMap, openMap, rangeStartMs, ppd, today]);

  const rowIndexById = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => m.set(r.node.id, r.rowIndex));
    return m;
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<Bucket, number> = { ontrack: 0, delay: 0, selesai: 0 };
    leaves.forEach(n => { c[bucketOf(n.schedule_status)]++; });
    return c;
  }, [leaves]);

  const taskRowCount = rows.filter(r => r.kind === 'task').length;

  const segs = useMemo(() => buildSegments(zoom, ppd, spanDays, rangeStartMs), [zoom, ppd, spanDays, rangeStartMs]);

  // FS/SS/FF/SF link geometry
  const links = useMemo(() => {
    if (linkMode === 'nonaktif') return [];
    const byId = new Map(allNodes.map(n => [n.id, n]));
    const out: { d: string; head: string; stroke: string; w: number; dash: string; label: string; lx: number; ly: number; key: string }[] = [];

    dependencies.forEach(dep => {
      const predIdx = rowIndexById.get(dep.predecessor_node_id);
      const succIdx = rowIndexById.get(dep.successor_node_id);
      if (predIdx == null || succIdx == null) return;

      const wantLink = linkMode === 'semua' || (linkMode === 'terpilih' && (dep.predecessor_node_id === selectedTask || dep.successor_node_id === selectedTask));
      if (!wantLink) return;

      const pred = byId.get(dep.predecessor_node_id);
      const succ = byId.get(dep.successor_node_id);
      if (!pred || !succ) return;

      const predX = dayOffset(pred.start_date, rangeStartMs) * ppd;
      const predW = pred.start_date && pred.end_date ? Math.max(3, daysBetween(pred.start_date, pred.end_date) * ppd) : 0;
      const succX = dayOffset(succ.start_date, rangeStartMs) * ppd;
      const succW = succ.start_date && succ.end_date ? Math.max(3, daysBetween(succ.start_date, succ.end_date) * ppd) : 0;

      const x1 = (dep.dependency_type === 'FS' || dep.dependency_type === 'FF') ? predX + predW : predX;
      const x2 = (dep.dependency_type === 'FS' || dep.dependency_type === 'SS') ? succX : succX + succW;
      const y1 = predIdx * ROWH + 13;
      const y2 = succIdx * ROWH + 13;
      const mx = Math.max(x1 + 10, x2 - 12);
      const focus = linkMode === 'terpilih';

      out.push({
        key: dep.id,
        d: `M${x1} ${y1} H${mx} V${y2} H${x2 - 5}`,
        head: `M${x2} ${y2} l-5 -3.4 l0 6.8 Z`,
        stroke: focus ? 'var(--gm-accent)' : 'color-mix(in srgb,var(--gm-ink) 38%,transparent)',
        w: focus ? 1.5 : 1,
        dash: focus ? '0' : '3 3',
        label: focus ? dep.dependency_type : '',
        lx: mx + 4, ly: (y1 + y2) / 2 + 3,
      });
    });
    return out;
  }, [dependencies, allNodes, rowIndexById, linkMode, selectedTask, rangeStartMs, ppd]);

  // Keep "today" roughly centered when zoom changes.
  const paneRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const target = LEFT_W + todayX - (el.clientWidth - LEFT_W) / 2;
    el.scrollLeft = Math.max(0, Math.min(target, LEFT_W + chartWidth - el.clientWidth));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  if (isLoading) return <div className="loading-state">Memuat Gantt Chart...</div>;
  if (error) return <div className="danger-box">{extractError(error)}</div>;

  const selectedNode = selectedTask ? allNodes.find(n => n.id === selectedTask) : null;
  const bodyHeight = rows.length * ROWH;

  return (
    <div className="gantt-modernist">
      {/* Header */}
      <div className="gm-header">
        <div>
          <h1>Gantt Chart Berdasarkan WBD</h1>
          <div className="gm-subtitle">
            Rencana vs Realisasi · data per {today} · <span className="gm-readonly">read-only</span>
            {!isActiveVersion && <span style={{ color: 'var(--gm-accent)', marginLeft: 8 }}>⚠ Versi non-aktif — tanpa data realisasi</span>}
          </div>
        </div>
        <div className="gm-counters">
          <button
            className={`gm-counter${statusFilter === 'ontrack' ? ' active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'ontrack' ? 'ALL' : 'ontrack')}
          >
            <div className="gm-counter-label">On track</div>
            <div className="gm-counter-value">{counts.ontrack}</div>
          </button>
          <button
            className={`gm-counter${statusFilter === 'delay' ? ' active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'delay' ? 'ALL' : 'delay')}
          >
            <div className="gm-counter-label">Delay</div>
            <div className="gm-counter-value accent">{counts.delay}</div>
          </button>
          <button
            className={`gm-counter${statusFilter === 'selesai' ? ' active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'selesai' ? 'ALL' : 'selesai')}
          >
            <div className="gm-counter-label">Selesai</div>
            <div className="gm-counter-value">{counts.selesai}</div>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="gm-toolbar">
        <div className="gm-version-chip">
          <span className="dot" />
          {versionLabel}
          <select value={selectedVersionId} onChange={e => { setSelectedVersionId(e.target.value); setOpenBranches(null); }}>
            <option value="">— Versi Aktif (Baseline) —</option>
            {versions.map(v => (
              <option key={v.id} value={v.id}>v{v.version_number} — {v.status}</option>
            ))}
          </select>
        </div>

        <select className="gm-sel" value={groupFilter} onChange={e => setGroupFilter(e.target.value)}>
          <option value="ALL">Semua grup</option>
          {rootNodes.map(n => <option key={n.id} value={n.code}>{n.code} — {n.name}</option>)}
        </select>
        <select className="gm-sel" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="ALL">Semua status</option>
          <option value="ontrack">On track</option>
          <option value="delay">Delay</option>
          <option value="selesai">Selesai</option>
        </select>

        <div className="gm-vdivider" />
        {(['harian', 'mingguan', 'bulanan'] as Zoom[]).map(z => (
          <button key={z} className={`gm-toggle-btn${zoom === z ? ' active' : ''}`} onClick={() => setZoom(z)}>
            {z[0].toUpperCase() + z.slice(1)}
          </button>
        ))}
        <div className="gm-vdivider" />
        <button className="gm-toggle-btn" onClick={() => setAllBranches(true)}>Expand all</button>
        <button className="gm-toggle-btn" onClick={() => setAllBranches(false)}>Collapse all</button>
        <div className="gm-vdivider" />
        <span className="gm-relasi-label">Relasi</span>
        {(['terpilih', 'semua', 'nonaktif'] as LinkMode[]).map(m => (
          <button key={m} className={`gm-toggle-btn${linkMode === m ? ' active' : ''}`} onClick={() => setLinkMode(m)}>
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
        <div className="gm-rowcount">{taskRowCount} / {leaves.length} task</div>
      </div>

      {/* Chart pane */}
      {!hasBaseline || allNodes.length === 0 ? (
        <div className="empty-state" style={{ margin: 20 }}>
          Belum ada data Gantt. Pastikan proyek memiliki baseline WBD aktif dengan tanggal mulai dan durasi.
        </div>
      ) : (
        <div className="gm-pane" ref={paneRef}>
          {/* Sticky header strip */}
          <div className="gm-header-strip-row">
            <div className="gm-header-cell">
              <span className="gm-col-kode">Kode</span>
              <span className="gm-col-nama">Nama Task</span>
              <span className="gm-col-durasi">Durasi</span>
              <span className="gm-col-mulai">Mulai</span>
              <span className="gm-col-selesai">Selesai</span>
              <span className="gm-col-amulai">Akt. Mulai</span>
              <span className="gm-col-aselesai">Akt. Selesai</span>
              <span className="gm-col-pct">%</span>
            </div>
            <div style={{ width: chartWidth, flex: 'none', background: 'var(--gm-bg)' }}>
              <div className="gm-tier-row gm-tier1">
                {segs.tier1.map(c => (
                  <div
                    key={c.key}
                    className="gm-tier-cell"
                    style={{
                      width: c.widthPx,
                      fontSize: c.big ? 10.5 : 9.5,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      fontFamily: c.big ? 'var(--gm-font)' : undefined,
                      fontWeight: c.big ? 800 : 400,
                      justifyContent: c.center ? 'center' : 'flex-start',
                      color: c.mute ? 'color-mix(in srgb,var(--gm-ink) 50%,transparent)' : 'var(--gm-ink)',
                      borderLeftColor: c.strong ? 'var(--gm-divider)' : undefined,
                      background: c.bg,
                    }}
                  >
                    {c.label}
                  </div>
                ))}
              </div>
              <div className="gm-tier-row gm-tier2">
                {segs.tier2.map(c => (
                  <div
                    key={c.key}
                    className="gm-tier-cell"
                    style={{
                      width: c.widthPx,
                      fontSize: c.big ? 10.5 : 9.5,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      fontFamily: c.big ? 'var(--gm-font)' : undefined,
                      fontWeight: c.big ? 800 : 400,
                      justifyContent: c.center ? 'center' : 'flex-start',
                      color: c.mute ? 'color-mix(in srgb,var(--gm-ink) 50%,transparent)' : 'var(--gm-ink)',
                      borderLeftColor: c.strong ? 'var(--gm-divider)' : undefined,
                      background: c.bg,
                    }}
                  >
                    {c.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="gm-body-row">
            {/* Left sticky table column */}
            <div className="gm-left-col">
              {rows.map(row => {
                const selected = selectedTask === row.node.id;
                const bg = selected
                  ? 'color-mix(in srgb,var(--gm-accent) 12%,transparent)'
                  : row.kind === 'phase' ? 'color-mix(in srgb,var(--gm-ink) 7%,transparent)'
                    : row.kind === 'group' ? 'color-mix(in srgb,var(--gm-ink) 3.5%,transparent)'
                      : 'transparent';
                return (
                  <div
                    key={row.node.id}
                    className="gm-row-left"
                    tabIndex={0}
                    style={{
                      background: bg,
                      boxShadow: selected ? 'inset 3px 0 0 var(--gm-accent)' : 'none',
                      borderTop: row.kind === 'phase' && row.rowIndex > 0 ? '2px solid var(--gm-divider)' : 'none',
                      borderBottom: '1px solid ' + (row.isGroup ? 'var(--gm-divider)' : 'color-mix(in srgb,var(--gm-ink) 8%,transparent)'),
                    }}
                    onClick={() => (row.isGroup ? toggleBranch(row.node.id) : setSelectedTask(row.node.id))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        row.isGroup ? toggleBranch(row.node.id) : setSelectedTask(row.node.id);
                      } else if (e.key === 'ArrowLeft' && row.isGroup && row.open) {
                        toggleBranch(row.node.id);
                      } else if (e.key === 'ArrowRight' && row.isGroup && !row.open) {
                        toggleBranch(row.node.id);
                      }
                    }}
                  >
                    <span className="gm-kode-cell" style={{ paddingLeft: row.depth * 11 }}>
                      {row.isGroup && (
                        <button
                          className="gm-twisty"
                          onClick={e => { e.stopPropagation(); toggleBranch(row.node.id); }}
                        >
                          {row.open ? '−' : '+'}
                        </button>
                      )}
                      <span
                        className="gm-kode-text"
                        style={{
                          fontSize: row.kind === 'phase' ? 11 : 10.5,
                          fontWeight: row.kind === 'phase' ? 700 : 400,
                          color: row.isGroup ? 'var(--gm-ink)' : 'color-mix(in srgb,var(--gm-ink) 55%,transparent)',
                        }}
                      >
                        {row.node.code}
                      </span>
                    </span>
                    <span
                      className="gm-name-cell"
                      style={{
                        fontSize: row.kind === 'phase' ? 11.5 : row.kind === 'group' ? 11.5 : 12.5,
                        fontFamily: row.isGroup ? 'var(--gm-font)' : undefined,
                        fontWeight: row.isGroup ? 800 : 400,
                        letterSpacing: row.isGroup ? '0.07em' : 0,
                        textTransform: row.kind === 'phase' ? 'uppercase' : 'none',
                      }}
                    >
                      {row.node.name}
                    </span>
                    <span className="gm-dur-cell">{row.durLabel}</span>
                    <span className="gm-date-cell">{row.mulaiLabel}</span>
                    <span className="gm-date-cell">{row.selesaiLabel}</span>
                    <span className="gm-date-cell gm-date-actual">{row.aktualMulaiLabel}</span>
                    <span className="gm-date-cell gm-date-actual">{row.aktualSelesaiLabel}</span>
                    <span
                      className="gm-pct-cell"
                      style={{ color: row.pctColor === 'muted' ? 'color-mix(in srgb,var(--gm-ink) 45%,transparent)' : row.pctColor === 'accent' ? 'var(--gm-accent-700)' : 'var(--gm-ink)' }}
                    >
                      {row.pctLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Chart body */}
            <div className="gm-chart-body" style={{ width: chartWidth, minHeight: bodyHeight }}>
              {segs.bands.map(a => (
                <div key={a} className="gm-band" style={{ left: Math.round(a * ppd), width: Math.round(ppd) }} />
              ))}
              {segs.grid.map(a => (
                <div key={a} className="gm-gridline" style={{ left: Math.round(a * ppd) }} />
              ))}
              <div className="gm-today" style={{ left: todayX }}>
                <span className="gm-today-chip">Hari ini</span>
              </div>

              {rows.map(row => {
                const selected = selectedTask === row.node.id;
                const bg = selected
                  ? 'color-mix(in srgb,var(--gm-accent) 8%,transparent)'
                  : row.kind === 'phase' ? 'color-mix(in srgb,var(--gm-ink) 7%,transparent)'
                    : row.kind === 'group' ? 'color-mix(in srgb,var(--gm-ink) 3.5%,transparent)'
                      : 'transparent';
                return (
                  <div
                    key={row.node.id}
                    className="gm-row-chart"
                    style={{
                      background: bg,
                      borderTop: row.kind === 'phase' && row.rowIndex > 0 ? '2px solid var(--gm-divider)' : 'none',
                      borderBottom: '1px solid ' + (row.isGroup ? 'var(--gm-divider)' : 'color-mix(in srgb,var(--gm-ink) 8%,transparent)'),
                    }}
                    onClick={() => (row.isGroup ? toggleBranch(row.node.id) : setSelectedTask(row.node.id))}
                  >
                    {row.isGroup && row.w > 0 && (
                      <div
                        className="gm-bar-rollup"
                        style={{
                          left: row.x, width: row.w, top: ROWH / 2 - 4,
                          background: row.kind === 'phase' ? 'var(--gm-neutral-900)' : 'color-mix(in srgb,var(--gm-ink) 60%,transparent)',
                        }}
                      />
                    )}
                    {!row.isGroup && row.w > 0 && (
                      <div className="gm-bar-plan" style={{ left: row.x, width: row.w }} />
                    )}
                    {!row.isGroup && row.real && (
                      <div
                        className="gm-bar-real"
                        style={{
                          left: row.real.x, width: row.real.w,
                          background: row.late ? 'var(--gm-accent)' : 'var(--gm-actual)',
                          opacity: row.real.done ? 0.85 : 1,
                        }}
                      />
                    )}
                    {row.tagText && (
                      <span
                        className="gm-tag"
                        style={{
                          left: row.x + row.w + 8,
                          top: ROWH / 2 - 6,
                          color: row.late ? 'var(--gm-accent-700)' : 'color-mix(in srgb,var(--gm-ink) 50%,transparent)',
                        }}
                      >
                        {row.tagText}
                      </span>
                    )}
                  </div>
                );
              })}

              <svg style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', overflow: 'visible' }} width={chartWidth} height={bodyHeight}>
                {links.map(l => (
                  <g key={l.key}>
                    <path d={l.d} fill="none" stroke={l.stroke} strokeWidth={l.w} strokeDasharray={l.dash} />
                    <path d={l.head} fill={l.stroke} />
                    {l.label && (
                      <text x={l.lx} y={l.ly} fill={l.stroke} fontSize={8} fontFamily="Archivo" fontWeight={800} letterSpacing={0.5}>
                        {l.label}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="gm-footer">
        <span className="gm-legend-item">
          <span className="gm-legend-swatch" style={{ background: 'color-mix(in srgb,var(--gm-ink) 20%,transparent)', borderLeft: '1px solid color-mix(in srgb,var(--gm-ink) 45%,transparent)', borderRight: '1px solid color-mix(in srgb,var(--gm-ink) 45%,transparent)' }} />
          Rencana
        </span>
        <span className="gm-legend-item">
          <span className="gm-legend-swatch" style={{ background: 'var(--gm-actual)', height: 8 }} />
          Realisasi
        </span>
        <span className="gm-legend-item">
          <span className="gm-legend-swatch" style={{ background: 'var(--gm-accent)', height: 8 }} />
          Terlambat
        </span>
        <span className="gm-legend-item">
          <span className="gm-legend-swatch" style={{ background: 'var(--gm-neutral-900)', height: 8, clipPath: 'polygon(0 0,100% 0,100% 100%,calc(100% - 5px) 55%,5px 55%,0 100%)' }} />
          Roll-up WBD
        </span>
        <span className="gm-legend-item">
          <span className="gm-legend-swatch" style={{ height: 0, borderTop: '1.5px solid var(--gm-accent)', marginTop: 1 }} />
          Relasi
        </span>
        <span className="gm-selnote">
          {selectedNode ? `Terpilih: ${selectedNode.code} — ${selectedNode.name}` : 'Klik baris task untuk menyorot relasi'}
        </span>
      </div>
    </div>
  );
}
