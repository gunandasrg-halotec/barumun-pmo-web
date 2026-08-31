import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectService } from "../../services/projectService";
import { progressService } from "../../services/progressService";
import { wbdService } from "../../services/wbdService";
import { formatCurrency, formatNumber, extractError } from "../../utils/format";

// Hanya entri disetujui yang boleh menghitung sebagai realisasi — entri
// ditolak/menunggu tidak boleh menggelembungkan angka.
const APPROVED = new Set(["APPROVED", "AUTO_APPROVED"]);

type FlatNode = {
  id: string;
  parent_node_id: string | null;
  node_type: string;
  code: string;
  name: string;
  unit: string;
  volume: number;
  rate: number;
  planned_cost: number;
  sort_order: number;
};

/** Flatten pohon WBD TANPA membuang GROUP (struktur dipakai untuk tree + subtotal). */
function flattenAll(list: any[]): FlatNode[] {
  return (list ?? []).flatMap((n: any) => [
    {
      id: n.id,
      parent_node_id: n.parent_node_id ?? null,
      node_type: n.node_type,
      code: n.code ?? "",
      name: n.name ?? "",
      unit: n.unit ?? "",
      volume: Number(n.volume ?? 0),
      rate: Number(n.rate ?? 0),
      planned_cost: Number(n.planned_cost ?? 0),
      sort_order: Number(n.sort_order ?? 0),
    } as FlatNode,
    ...flattenAll(n.children ?? []),
  ]);
}

/** Angka realisasi + sisa untuk satu item, dihitung dari entri yang lolos filter tanggal. */
export type ItemCalc = {
  realVolume: number;
  realCost: number;
  hasRealisasi: boolean;
  sisaVolume: number;
  sisaRencana: number;
  sisaProgress: number;
  isOver: boolean;
};

/** Deviasi biaya per item = sisa sesuai rencana - sisa sesuai progress.
 *  Negatif = estimasi progress butuh lebih banyak dari yang tersisa di rencana (over budget). */
function dev(c: ItemCalc): number {
  return c.sisaRencana - c.sisaProgress;
}

function emptyCalc(plan: number, volume: number): ItemCalc {
  return {
    realVolume: 0,
    realCost: 0,
    hasRealisasi: false,
    sisaVolume: volume,
    sisaRencana: plan,
    sisaProgress: plan,
    isOver: false,
  };
}

export default function BudgetRealizationPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [realFilter, setRealFilter] = useState<"all" | "has" | "none" | "over">("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const projectQ = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectService.get(projectId!),
  });
  const activeVersionId = (projectQ.data as any)?.data?.active_wbd_version?.id;

  const nodesQ = useQuery({
    queryKey: ["wbd-nodes", activeVersionId],
    queryFn: () => wbdService.getNodes(activeVersionId!),
    enabled: !!activeVersionId,
  });

  // Ambil SELURUH entri (bukan satu halaman) supaya agregat per item akurat.
  const entriesQ = useQuery({
    queryKey: ["budget-realization-entries", projectId, dateFrom, dateTo],
    queryFn: async () => {
      const limit = 500;
      const first: any = await progressService.list(projectId!, {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: 1,
        limit,
      });
      let all: any[] = first?.data ?? [];
      const total = Number(first?.meta?.total ?? all.length);
      const pages = Math.ceil(total / limit);
      for (let p = 2; p <= pages; p++) {
        const next: any = await progressService.list(projectId!, {
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          page: p,
          limit,
        });
        all = all.concat(next?.data ?? []);
      }
      return all;
    },
    enabled: !!projectId,
  });

  const nodes: FlatNode[] = useMemo(
    () => flattenAll((nodesQ.data as any)?.data ?? []),
    [nodesQ.data],
  );
  const entries: any[] = entriesQ.data ?? [];

  /** Hitung angka per ITEM dari entri yang sudah difilter tanggal. */
  const calcByNode = useMemo(() => {
    const byNode = new Map<string, any[]>();
    for (const e of entries) {
      if (!APPROVED.has(e?.status)) continue;
      const nid: string = e.wbd_node?.id ?? e.wbd_node_id;
      if (!nid) continue;
      if (!byNode.has(nid)) byNode.set(nid, []);
      byNode.get(nid)!.push(e);
    }

    const map = new Map<string, ItemCalc>();
    for (const n of nodes) {
      if (n.node_type !== "ITEM") continue;
      const plan = n.planned_cost;
      const list = byNode.get(n.id);
      if (!list || list.length === 0) {
        map.set(n.id, emptyCalc(plan, n.volume));
        continue;
      }

      const realVolume = list.reduce((s, e) => s + Number(e.progress_volume ?? 0), 0);
      const realCost = list.reduce((s, e) => s + Number(e.actual_cost ?? 0), 0);

      // Entri terakhir DI DALAM rentang tanggal — menghormati override manual
      // "Sisa Estimasi" pada entri tersebut.
      const sorted = [...list].sort((a, b) => {
        const d = String(b.progress_date ?? "").localeCompare(String(a.progress_date ?? ""));
        if (d !== 0) return d;
        return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      });
      const last = sorted[0];

      const sisaVolume =
        last?.remaining_volume != null ? Number(last.remaining_volume) : n.volume;
      const rem = last?.remaining_cost != null ? Number(last.remaining_cost) : null;

      map.set(n.id, {
        realVolume,
        realCost,
        hasRealisasi: true,
        sisaVolume,
        // Identik rumus KPI "Sisa Biaya Sesuai Rencana" — item over budget di-cap 0.
        sisaRencana: plan - realCost > 0 ? plan - realCost : 0,
        // Identik rumus KPI "Estimasi Sisa Biaya Sesuai Progress".
        sisaProgress: rem == null ? plan : rem >= 0 ? rem : Math.abs(rem),
        isOver: Math.round(realCost) > Math.round(plan) && plan > 0,
      });
    }
    return map;
  }, [nodes, entries]);

  /** Item yang lolos filter pencarian + pills. */
  const visibleItemIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    const set = new Set<string>();
    for (const n of nodes) {
      if (n.node_type !== "ITEM") continue;
      if (q && !n.name.toLowerCase().includes(q) && !n.code.toLowerCase().includes(q)) continue;
      const c = calcByNode.get(n.id);
      if (realFilter === "has" && !c?.hasRealisasi) continue;
      if (realFilter === "none" && c?.hasRealisasi) continue;
      if (realFilter === "over" && !c?.isOver) continue;
      set.add(n.id);
    }
    return set;
  }, [nodes, calcByNode, search, realFilter]);

  const childrenOf = useMemo(() => {
    const m = new Map<string | null, FlatNode[]>();
    for (const n of nodes) {
      const k = n.parent_node_id;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(n);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [nodes]);

  /** Total rekursif seluruh ITEM keturunan sebuah node (bukan hanya anak langsung). */
  const subtotalOf = useMemo(() => {
    const cache = new Map<string, { plan: number; real: number; sisaR: number; sisaP: number; count: number }>();
    function walk(id: string): { plan: number; real: number; sisaR: number; sisaP: number; count: number } {
      if (cache.has(id)) return cache.get(id)!;
      const acc = { plan: 0, real: 0, sisaR: 0, sisaP: 0, count: 0 };
      for (const child of childrenOf.get(id) ?? []) {
        if (child.node_type === "ITEM") {
          if (!visibleItemIds.has(child.id)) continue;
          const c = calcByNode.get(child.id) ?? emptyCalc(child.planned_cost, child.volume);
          acc.plan += child.planned_cost;
          acc.real += c.realCost;
          acc.sisaR += c.sisaRencana;
          acc.sisaP += c.sisaProgress;
          acc.count += 1;
        } else {
          const sub = walk(child.id);
          acc.plan += sub.plan;
          acc.real += sub.real;
          acc.sisaR += sub.sisaR;
          acc.sisaP += sub.sisaP;
          acc.count += sub.count;
        }
      }
      cache.set(id, acc);
      return acc;
    }
    const out = new Map<string, ReturnType<typeof walk>>();
    for (const n of nodes) if (n.node_type === "GROUP") out.set(n.id, walk(n.id));
    return out;
  }, [nodes, childrenOf, calcByNode, visibleItemIds]);

  /** Grand total — dijumlah dari item yang TAMPIL supaya konsisten dengan layar. */
  const totals = useMemo(() => {
    let plan = 0, real = 0, realVol = 0, sisaR = 0, sisaP = 0, over = 0;
    for (const n of nodes) {
      if (n.node_type !== "ITEM" || !visibleItemIds.has(n.id)) continue;
      const c = calcByNode.get(n.id) ?? emptyCalc(n.planned_cost, n.volume);
      plan += n.planned_cost;
      real += c.realCost;
      realVol += c.realVolume;
      sisaR += c.sisaRencana;
      sisaP += c.sisaProgress;
      if (c.isOver) over += 1;
    }
    return { plan, real, realVol, sisaR, sisaP, over, selisih: sisaR - sisaP };
  }, [nodes, calcByNode, visibleItemIds]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const roots = (childrenOf.get(null) ?? []).filter((n) => {
    if (n.node_type === "ITEM") return visibleItemIds.has(n.id);
    return (subtotalOf.get(n.id)?.count ?? 0) > 0;
  });

  const isLoading = projectQ.isLoading || nodesQ.isLoading || entriesQ.isLoading;
  const error = projectQ.error || nodesQ.error || entriesQ.error;
  const hasBaseline = (projectQ.data as any)?.data?.has_active_baseline;

  // ── Baris tabel (desktop) ────────────────────────────────────────────────
  function renderRows(node: FlatNode, depth = 0): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    const indent = depth * 16;

    if (node.node_type === "ITEM") {
      if (!visibleItemIds.has(node.id)) return out;
      const c = calcByNode.get(node.id) ?? emptyCalc(node.planned_cost, node.volume);
      out.push(
        <tr key={node.id}>
          <td className="br-item" style={{ paddingLeft: 14 + indent }}>
            <span style={{ color: "var(--muted)", marginRight: 6 }}>{node.code}</span>
            {node.name}
            {c.isOver && <span className="br-over-badge">over</span>}
          </td>
          <td className="br-col-unit">{node.unit || "—"}</td>
          <td className="br-col-rate br-num">{formatNumber(node.rate, 0)}</td>
          <td className="br-num">{formatNumber(node.volume, 0)}</td>
          <td className="br-num">{formatNumber(node.planned_cost, 0)}</td>
          <td className="br-num">
            {c.hasRealisasi ? formatNumber(c.realVolume, 0) : <span style={{ color: "var(--muted)" }}>0</span>}
          </td>
          <td className="br-num">{formatNumber(c.sisaVolume, 0)}</td>
          <td className="br-num" style={c.isOver ? { color: "var(--danger)" } : undefined}>
            {c.hasRealisasi ? formatNumber(c.realCost, 0) : <span style={{ color: "var(--muted)" }}>0</span>}
          </td>
          <td className="br-num">{formatNumber(c.sisaRencana, 0)}</td>
          <td className="br-num" style={c.isOver ? { color: "var(--danger)" } : undefined}>
            {formatNumber(c.sisaProgress, 0)}
          </td>
          <td className="br-num" style={dev(c) < 0 ? { color: "var(--danger)", fontWeight: 700 } : undefined}>
            {formatNumber(dev(c), 0)}
          </td>
        </tr>,
      );
      return out;
    }

    const sub = subtotalOf.get(node.id);
    if (!sub || sub.count === 0) return out;
    const isColl = collapsed.has(node.id);

    out.push(
      <tr key={node.id} className="group-row" style={{ cursor: "pointer" }} onClick={() => toggle(node.id)}>
        <td className="br-item" style={{ paddingLeft: 14 + indent }}>
          <span style={{ display: "inline-block", width: 14 }}>{isColl ? "▶" : "▼"}</span>
          {node.code} · {node.name}
        </td>
        <td className="br-col-unit" />
        <td className="br-col-rate" />
        <td />
        <td className="br-num">{formatNumber(sub.plan, 0)}</td>
        <td />
        <td />
        <td className="br-num">{formatNumber(sub.real, 0)}</td>
        <td className="br-num">{formatNumber(sub.sisaR, 0)}</td>
        <td className="br-num">{formatNumber(sub.sisaP, 0)}</td>
        <td className="br-num" style={sub.sisaR - sub.sisaP < 0 ? { color: "var(--danger)" } : undefined}>
          {formatNumber(sub.sisaR - sub.sisaP, 0)}
        </td>
      </tr>,
    );

    if (!isColl) {
      for (const child of childrenOf.get(node.id) ?? []) {
        out.push(...renderRows(child, depth + 1));
      }
      out.push(
        <tr key={node.id + "-sub"} className="subtotal-row">
          <td className="br-item" style={{ paddingLeft: 14 + indent + 16 }}>Jumlah {node.name}</td>
          <td className="br-col-unit" />
          <td className="br-col-rate" />
          <td />
          <td className="br-num">{formatNumber(sub.plan, 0)}</td>
          <td />
          <td />
          <td className="br-num">{formatNumber(sub.real, 0)}</td>
          <td className="br-num">{formatNumber(sub.sisaR, 0)}</td>
          <td className="br-num">{formatNumber(sub.sisaP, 0)}</td>
          <td className="br-num" style={sub.sisaR - sub.sisaP < 0 ? { color: "var(--danger)" } : undefined}>
            {formatNumber(sub.sisaR - sub.sisaP, 0)}
          </td>
        </tr>,
      );
    }
    return out;
  }

  // ── Kartu (mobile) ───────────────────────────────────────────────────────
  function renderCards(node: FlatNode, depth = 0): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    if (node.node_type === "ITEM") {
      if (!visibleItemIds.has(node.id)) return out;
      const c = calcByNode.get(node.id) ?? emptyCalc(node.planned_cost, node.volume);
      out.push(
        <div key={node.id} className="br-card">
          <div className="br-card-head">
            <span>
              <span style={{ color: "var(--muted)", marginRight: 6 }}>{node.code}</span>
              {node.name}
            </span>
            {c.isOver && <span className="br-over-badge">over</span>}
          </div>
          <div className="br-card-meta">
            {(node.unit || "—")} · tarif {formatNumber(node.rate, 0)} · vol {formatNumber(node.volume, 0)}
          </div>
          <div className="br-card-grid">
            <span>Rencana biaya</span><b>{formatNumber(node.planned_cost, 0)}</b>
            <span>Realisasi volume</span><b>{formatNumber(c.realVolume, 0)}</b>
            <span>Sisa volume</span><b>{formatNumber(c.sisaVolume, 0)}</b>
            <span>Realisasi biaya</span>
            <b style={c.isOver ? { color: "var(--danger)" } : undefined}>
              {c.hasRealisasi ? formatNumber(c.realCost, 0) : "belum ada"}
            </b>
            <span>Sisa (rencana)</span><b>{formatNumber(c.sisaRencana, 0)}</b>
            <span>Sisa (progress)</span>
            <b style={c.isOver ? { color: "var(--danger)" } : undefined}>{formatNumber(c.sisaProgress, 0)}</b>
            <span>Deviasi biaya</span>
            <b style={dev(c) < 0 ? { color: "var(--danger)" } : undefined}>{formatNumber(dev(c), 0)}</b>
          </div>
        </div>,
      );
      return out;
    }

    const sub = subtotalOf.get(node.id);
    if (!sub || sub.count === 0) return out;
    const isColl = collapsed.has(node.id);
    out.push(
      <div key={node.id} className="br-card-group" style={{ marginLeft: depth * 8 }} onClick={() => toggle(node.id)}>
        <span>{isColl ? "▶" : "▼"} {node.code} · {node.name}</span>
        <b>{formatNumber(sub.plan, 0)}</b>
      </div>,
    );
    if (!isColl) {
      for (const child of childrenOf.get(node.id) ?? []) out.push(...renderCards(child, depth + 1));
      out.push(
        <div key={node.id + "-sub"} className="br-card-sub">
          <span>Jumlah {node.name}</span><b>{formatNumber(sub.plan, 0)}</b>
        </div>,
      );
    }
    return out;
  }

  return (
    <div className="budget-real">
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>Budget VS Realization</h3>
            <p>Perbandingan rencana biaya WBD terhadap realisasi lapangan, per item pekerjaan.</p>
          </div>
        </div>

        <div className="summary-bar br-summary">
          <div className="summary-item">
            <span>Total Rencana Biaya</span>
            <strong>{formatCurrency(totals.plan)}</strong>
          </div>
          <div className="summary-item">
            <span>Total Realisasi Biaya</span>
            <strong>{formatCurrency(totals.real)}</strong>
          </div>
          <div className="summary-item">
            <span>Total Sisa Biaya Sesuai Rencana</span>
            <strong>{formatCurrency(totals.sisaR)}</strong>
          </div>
          <div className="summary-item">
            <span>Total Sisa Biaya Sesuai Progress</span>
            <strong style={{ color: totals.selisih < 0 ? "var(--danger)" : "inherit" }}>
              {formatCurrency(totals.sisaP)}
            </strong>
          </div>
          <div className="summary-item">
            <span>Deviasi Biaya ({totals.selisih < 0 ? "Over Budget" : "On-Budget"})</span>
            <strong style={{ color: totals.selisih < 0 ? "var(--danger)" : "var(--ok)" }}>
              {totals.selisih < 0
                ? `-${formatCurrency(Math.abs(totals.selisih))}`
                : formatCurrency(totals.selisih)}
            </strong>
          </div>
          <div className="summary-item">
            <span>Total Volume Realisasi</span>
            <strong>{formatNumber(totals.realVol, 0)}</strong>
          </div>
          <div className="summary-item">
            <span>Item Over Budget</span>
            <strong style={{ color: totals.over > 0 ? "var(--danger)" : "inherit" }}>{totals.over}</strong>
          </div>
        </div>

        <div className="toolbar br-toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 9, color: "var(--muted)", fontSize: 13, pointerEvents: "none" }}>⌕</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / kode item pekerjaan…"
              style={{ paddingLeft: 28, width: 240 }}
            />
          </div>

          <div className="cluster" style={{ gap: 4, flexWrap: "wrap" }}>
            {(["all", "has", "none", "over"] as const).map((f) => {
              const labels = { all: "Semua", has: "Sudah ada realisasi", none: "Belum ada realisasi", over: "⚠ Over budget" };
              const active = realFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => setRealFilter(f)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: "1px solid",
                    borderColor: active ? (f === "over" ? "var(--danger)" : "var(--green-700)") : "var(--line)",
                    background: active
                      ? f === "over" ? "rgba(203,95,69,0.1)" : "var(--green-lt, rgba(45,125,70,0.1))"
                      : "transparent",
                    color: active ? (f === "over" ? "var(--danger)" : "var(--green-700)") : "var(--muted)",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Dari tanggal" />
          <span style={{ color: "var(--muted)", fontSize: 12 }}>s/d</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Sampai tanggal" />
          <div className="stretch" />
          <button
            className="btn secondary"
            onClick={() => { setDateFrom(""); setDateTo(""); setSearch(""); setRealFilter("all"); }}
          >
            Reset
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="section-card glass"><div className="loading-state">Memuat data...</div></div>
      ) : error ? (
        <div className="section-card glass"><div className="danger-box">{extractError(error)}</div></div>
      ) : !hasBaseline ? (
        <div className="section-card glass">
          <div className="empty-state">Proyek ini belum punya baseline WBD aktif.</div>
        </div>
      ) : roots.length === 0 ? (
        <div className="section-card glass">
          <div className="empty-state">Tidak ada item yang cocok dengan filter.</div>
        </div>
      ) : (
        <>
          <div className="br-table-wrap">
            <table className="br-table">
              <thead>
                <tr>
                  <th className="br-item">Item pekerjaan</th>
                  <th className="br-col-unit">Satuan</th>
                  <th className="br-col-rate br-num">Tarif</th>
                  <th className="br-num">Volume</th>
                  <th className="br-num">Rencana biaya</th>
                  <th className="br-num">Real. volume</th>
                  <th className="br-num">Sisa volume</th>
                  <th className="br-num">Realisasi biaya</th>
                  <th className="br-num">Sisa (rencana)</th>
                  <th className="br-num">Sisa (progress)</th>
                  <th className="br-num">Deviasi biaya</th>
                </tr>
              </thead>
              <tbody>{roots.flatMap((n) => renderRows(n, 0))}</tbody>
              <tfoot>
                <tr>
                  <td className="br-item br-foot">Total proyek</td>
                  <td className="br-col-unit br-foot" />
                  <td className="br-col-rate br-foot" />
                  <td className="br-foot" />
                  <td className="br-num br-foot">{formatNumber(totals.plan, 0)}</td>
                  <td className="br-num br-foot">{formatNumber(totals.realVol, 0)}</td>
                  <td className="br-foot" />
                  <td className="br-num br-foot">{formatNumber(totals.real, 0)}</td>
                  <td className="br-num br-foot">{formatNumber(totals.sisaR, 0)}</td>
                  <td className="br-num br-foot" style={totals.selisih < 0 ? { color: "var(--danger)" } : undefined}>
                    {formatNumber(totals.sisaP, 0)}
                  </td>
                  <td className="br-num br-foot" style={totals.selisih < 0 ? { color: "var(--danger)" } : undefined}>
                    {formatNumber(totals.selisih, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div className="br-note">Semua nilai biaya dalam Rupiah.</div>
          </div>

          <div className="br-cards">
            {roots.flatMap((n) => renderCards(n, 0))}
            <div className="br-card-total">
              <div><span>Total rencana biaya</span><b>{formatNumber(totals.plan, 0)}</b></div>
              <div><span>Total realisasi biaya</span><b>{formatNumber(totals.real, 0)}</b></div>
              <div><span>Total sisa (rencana)</span><b>{formatNumber(totals.sisaR, 0)}</b></div>
              <div><span>Total sisa (progress)</span><b>{formatNumber(totals.sisaP, 0)}</b></div>
              <div><span>Deviasi biaya</span><b style={totals.selisih < 0 ? { color: "var(--danger)" } : undefined}>{formatNumber(totals.selisih, 0)}</b></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
