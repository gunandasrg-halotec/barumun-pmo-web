import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { heavyEquipmentService } from "../../services/heavyEquipmentService";
import { extractError, formatNumber, formatDate } from "../../utils/format";
import {
  HEAVY_EQUIPMENT_ACTIVITIES,
  type HeavyEquipment,
  type HeavyEquipmentLog,
  type HeavyEquipmentLogActivity,
} from "../../types";

const TABS = ["Analitik", "Data Mentah"];

const firstOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const todayISO = () => new Date().toISOString().slice(0, 10);

function shortDate(iso?: string | null): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

const ACTIVITY_COLORS: Record<string, string> = {
  PARIT_BATAS: "#1D9E75",
  PARIT_LEMBAH: "#378ADD",
  CHIPPING: "#BA7517",
  TUMBANG_POKOK: "#D85A30",
  BUKA_JALAN: "#7F77DD",
};

/** [label mulai, label selesai] — untuk Roling menampilkan tanggal bila lintas hari. */
function activityTimeLabels(a: HeavyEquipmentLogActivity, logDateIso: string): [string, string] {
  if (a.activity_type === "ROLING") {
    const sd = a.start_date || logDateIso;
    const ed = a.end_date || sd;
    const crossDay = ed !== sd;
    const start = a.start_time ? `${crossDay ? shortDate(sd) + " " : ""}${a.start_time}` : "—";
    const end = a.end_time ? `${crossDay ? shortDate(ed) + " " : ""}${a.end_time}` : "—";
    return [start, end];
  }
  return [a.start_time || "—", a.end_time || "—"];
}

export default function HeavyEquipmentUsagePage() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [filters, setFilters] = useState({
    date_from: firstOfMonthISO(),
    date_to: todayISO(),
    equipment_id: "",
    kebun: "",
  });
  const [detail, setDetail] = useState<HeavyEquipmentLog | null>(null);

  const equipmentsQ = useQuery({
    queryKey: ["heavy-equipment-active-filter"],
    queryFn: () => heavyEquipmentService.list(true),
  });
  const equipments: HeavyEquipment[] = (equipmentsQ.data as any)?.data ?? [];

  const analyticsQ = useQuery({
    queryKey: ["heavy-equipment-analytics", filters],
    queryFn: () => heavyEquipmentService.analytics(filters),
    enabled: activeTab === "Analitik",
  });
  const analytics = (analyticsQ.data as any)?.data;

  const logsQ = useQuery({
    queryKey: ["heavy-equipment-logs", filters],
    queryFn: () => heavyEquipmentService.listLogs({ ...filters, limit: 200 }),
    enabled: activeTab === "Data Mentah",
  });
  const logs: HeavyEquipmentLog[] = (logsQ.data as any)?.data ?? [];

  const setF = (k: keyof typeof filters, v: string) => setFilters((p) => ({ ...p, [k]: v }));

  function exportCsv() {
    // Kolom mengikuti formulir Excel lapangan (Laporan Harian Alat Berat), satu baris per hari,
    // diurutkan tanggal terkecil -> terbesar.
    const header = [
      "Tanggal", "Kode Alat", "Kebun", "Area", "Operator", "Kenek",
      "BBM (Ltr)", "BBM (S/d)",
      "Jam Pagi Mulai", "Jam Pagi Selesai", "Jam Sore Mulai", "Jam Sore Selesai",
      "Roling Mulai", "Roling Selesai",
      "Parit Batas Mulai", "Parit Batas Selesai", "Parit Batas (Mtr)", "Parit Batas (S/d)",
      "Parit Lembah Mulai", "Parit Lembah Selesai", "Parit Lembah (Mtr)", "Parit Lembah (S/d)",
      "Chipping Mulai", "Chipping Selesai", "Chipping (Pkk)", "Chipping (S/d)",
      "Tumbang Pokok Mulai", "Tumbang Pokok Selesai", "Tumbang Pokok (Pkk)", "Tumbang Pokok (S/d)",
      "Buka Jalan Mulai", "Buka Jalan Selesai", "Buka Jalan (Mtr)", "Buka Jalan (S/d)",
      "Keterangan", "Jumlah Foto",
    ];

    const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date) || a.id.localeCompare(b.id));
    const fuelCum: Record<string, number> = {};
    const volCum: Record<string, Record<string, number>> = {};

    const volCell = (l: HeavyEquipmentLog, eqId: string, type: string) => {
      const act = (l.activities ?? []).find((a) => a.activity_type === type);
      if (!act) return { start: "", end: "", volume: "", cum: "" as number | string };
      const [start, end] = activityTimeLabels(act, l.log_date);
      if (!volCum[type]) volCum[type] = {};
      volCum[type][eqId] = (volCum[type][eqId] ?? 0) + (act.volume ?? 0);
      return { start, end, volume: act.volume ?? "", cum: volCum[type][eqId] };
    };

    const rows: (string | number)[][] = sorted.map((l) => {
      const eqId = l.equipment?.id ?? "?";
      fuelCum[eqId] = (fuelCum[eqId] ?? 0) + (l.fuel_liters ?? 0);

      const roling = (l.activities ?? []).find((a) => a.activity_type === "ROLING");
      const [rolingStart, rolingEnd] = roling ? activityTimeLabels(roling, l.log_date) : ["", ""];

      const paritBatas = volCell(l, eqId, "PARIT_BATAS");
      const paritLembah = volCell(l, eqId, "PARIT_LEMBAH");
      const chipping = volCell(l, eqId, "CHIPPING");
      const tumbang = volCell(l, eqId, "TUMBANG_POKOK");
      const bukaJalan = volCell(l, eqId, "BUKA_JALAN");

      return [
        l.log_date,
        l.equipment?.code ?? "",
        l.kebun,
        l.area ?? "",
        l.operator,
        l.kenek ?? "",
        l.fuel_liters ?? "",
        fuelCum[eqId],
        l.work_morning_start ?? "",
        l.work_morning_end ?? "",
        l.work_afternoon_start ?? "",
        l.work_afternoon_end ?? "",
        rolingStart,
        rolingEnd,
        paritBatas.start, paritBatas.end, paritBatas.volume, paritBatas.cum,
        paritLembah.start, paritLembah.end, paritLembah.volume, paritLembah.cum,
        chipping.start, chipping.end, chipping.volume, chipping.cum,
        tumbang.start, tumbang.end, tumbang.volume, tumbang.cum,
        bukaJalan.start, bukaJalan.end, bukaJalan.volume, bukaJalan.cum,
        l.note ?? "",
        l.photos?.length ?? 0,
      ];
    });

    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `penggunaan-alat-berat_${filters.date_from}_${filters.date_to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>Penggunaan Alat Berat</h3>
            <p>Analitik produktivitas &amp; biaya operasional alat berat berdasarkan laporan harian lapangan.</p>
          </div>
        </div>

        <div className="toolbar" style={{ marginTop: 12, flexWrap: "wrap", gap: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Dari tanggal</label>
            <input type="date" value={filters.date_from} onChange={(e) => setF("date_from", e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Sampai tanggal</label>
            <input type="date" value={filters.date_to} onChange={(e) => setF("date_to", e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Alat berat</label>
            <select value={filters.equipment_id} onChange={(e) => setF("equipment_id", e.target.value)}>
              <option value="">Semua alat</option>
              {equipments.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.code} · {eq.type}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label style={{ fontSize: 11 }}>Kebun</label>
            <input placeholder="Semua kebun" value={filters.kebun} onChange={(e) => setF("kebun", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: 18 }}>
        {TABS.map((t) => (
          <button key={t} className={`btn ${activeTab === t ? "" : "secondary"}`} onClick={() => setActiveTab(t)}>
            {t}
          </button>
        ))}
        <div className="stretch" />
      </div>

      {activeTab === "Analitik" && (
        analyticsQ.isLoading ? (
          <div className="section-card glass"><div className="loading-state">Memuat analitik...</div></div>
        ) : analyticsQ.error ? (
          <div className="section-card glass"><div className="danger-box">{extractError(analyticsQ.error)}</div></div>
        ) : analytics ? (
          <AnalyticsView analytics={analytics} />
        ) : null
      )}

      {activeTab === "Data Mentah" && (
        <div>
          <div className="section-card glass" style={{ marginBottom: 18 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>
              <div>
                <h4 style={{ margin: 0 }}>Data mentah laporan harian</h4>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                  Satu tabel per jenis pekerjaan, kolom mengikuti format formulir lapangan.
                </p>
              </div>
              <button className="btn secondary" onClick={exportCsv} disabled={logs.length === 0}>Export CSV</button>
            </div>
          </div>

          {logsQ.isLoading ? (
            <div className="section-card glass"><div className="loading-state">Memuat data...</div></div>
          ) : logsQ.error ? (
            <div className="section-card glass"><div className="danger-box">{extractError(logsQ.error)}</div></div>
          ) : (
            <>
              <CostHistoryTable logs={logs} />
              <BbmHistoryTable logs={logs} />
              <RawDataByActivity logs={logs} onSelectLog={setDetail} />
            </>
          )}
        </div>
      )}

      {detail && <LogDetailModal log={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ─── Data mentah: riwayat biaya harian (pivot per item biaya) ──────────────

function CostHistoryTable({ logs }: { logs: HeavyEquipmentLog[] }) {
  const { items, rows, colTotals, grandTotal } = useMemo(() => {
    const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date) || a.id.localeCompare(b.id));

    // kumpulkan semua item biaya yang muncul (urutan kemunculan pertama)
    const itemMap = new Map<string, string>(); // id → name
    sorted.forEach((l) => (l.costs ?? []).forEach((c) => {
      if (c.cost_item_id && c.name && !itemMap.has(c.cost_item_id))
        itemMap.set(c.cost_item_id, c.name);
    }));
    const items = Array.from(itemMap.entries()).map(([id, name]) => ({ id, name }));

    // satu baris per tanggal+alat
    const rows = sorted.map((l) => {
      const byItem: Record<string, number> = {};
      (l.costs ?? []).forEach((c) => { if (c.cost_item_id) byItem[c.cost_item_id] = c.amount ?? 0; });
      const total = items.reduce((s, it) => s + (byItem[it.id] ?? 0), 0);
      return { log: l, byItem, total };
    });

    const colTotals: Record<string, number> = {};
    items.forEach((it) => { colTotals[it.id] = rows.reduce((s, r) => s + (r.byItem[it.id] ?? 0), 0); });
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);

    return { items, rows, colTotals, grandTotal };
  }, [logs]);

  const fmt = (v: number) => v > 0 ? formatNumber(v, 0) : "—";

  return (
    <div className="section-card glass" style={{ marginBottom: 18 }}>
      <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>Riwayat Biaya Harian</h4>
      {rows.length === 0 ? (
        <div className="empty-state">Belum ada data pada rentang ini.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                {items.map((it) => <th key={it.id} style={{ textAlign: "right" }}>{it.name}</th>)}
                <th style={{ textAlign: "right" }}>Total/hari</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ log, byItem, total }) => (
                <tr key={log.id}>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(log.log_date)}</td>
                  {items.map((it) => (
                    <td key={it.id} style={{ fontSize: 12, textAlign: "right" }}>{fmt(byItem[it.id] ?? 0)}</td>
                  ))}
                  <td style={{ fontSize: 12, textAlign: "right", fontWeight: 500 }}>
                    {formatNumber(total, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid var(--line)" }}>
                <td style={{ fontSize: 12, fontWeight: 500 }}>Jumlah</td>
                {items.map((it) => (
                  <td key={it.id} style={{ fontSize: 12, textAlign: "right", fontWeight: 500 }}>
                    {formatNumber(colTotals[it.id] ?? 0, 0)}
                  </td>
                ))}
                <td style={{ fontSize: 12, textAlign: "right", fontWeight: 500, color: "var(--accent, #1b6fc8)" }}>
                  {formatNumber(grandTotal, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Data mentah: history penggunaan BBM (dikelompokkan per alat) ──────────

const BBM_KEYWORDS = ["bbm", "minyak"];
function findBbmCost(costs: HeavyEquipmentLog["costs"]): number {
  const entry = (costs ?? []).find((c) =>
    BBM_KEYWORDS.some((kw) => (c.name ?? "").toLowerCase().includes(kw))
  );
  return entry?.amount ?? 0;
}

function BbmHistoryTable({ logs }: { logs: HeavyEquipmentLog[] }) {
  const groups = useMemo(() => {
    const byEquip = new Map<string, { equipment: HeavyEquipmentLog["equipment"]; logs: HeavyEquipmentLog[] }>();
    logs.forEach((l) => {
      const eqId = l.equipment?.id ?? "?";
      if (!byEquip.has(eqId)) byEquip.set(eqId, { equipment: l.equipment ?? null, logs: [] });
      byEquip.get(eqId)!.logs.push(l);
    });
    return Array.from(byEquip.values())
      .map((g) => ({
        equipment: g.equipment,
        rows: [...g.logs]
          .sort((a, b) => a.log_date.localeCompare(b.log_date) || a.id.localeCompare(b.id))
          .reduce<{ date: string; usage: number; cost: number; cumUsage: number; cumCost: number }[]>((acc, l) => {
            const usage = l.fuel_liters ?? 0;
            const cost  = findBbmCost(l.costs);
            const prev  = acc.length > 0 ? acc[acc.length - 1] : { cumUsage: 0, cumCost: 0 };
            acc.push({ date: l.log_date, usage, cost, cumUsage: prev.cumUsage + usage, cumCost: prev.cumCost + cost });
            return acc;
          }, []),
      }))
      .sort((a, b) => (a.equipment?.code ?? "").localeCompare(b.equipment?.code ?? ""));
  }, [logs]);

  return (
    <div className="section-card glass" style={{ marginBottom: 18 }}>
      <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>History Penggunaan BBM</h4>
      {groups.length === 0 ? (
        <div className="empty-state">Belum ada data pada rentang ini.</div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {groups.map(({ equipment, rows }) => (
            <div key={equipment?.id ?? "?"}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", marginBottom: 6 }}>
                {equipment ? `${equipment.code} · ${equipment.type} · ${equipment.brand}` : "Alat tidak diketahui"}
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th style={{ textAlign: "right" }}>Harga/liter (Rp)</th>
                      <th style={{ textAlign: "right" }}>Penggunaan (L)</th>
                      <th style={{ textAlign: "right" }}>Biaya (Rp)</th>
                      <th style={{ textAlign: "right" }}>Penggunaan s/d (L)</th>
                      <th style={{ textAlign: "right" }}>Biaya s/d (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const hargaPerLiter = r.usage > 0 ? Math.round(r.cost / r.usage) : null;
                      return (
                        <tr key={r.date}>
                          <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(r.date)}</td>
                          <td style={{ fontSize: 12, textAlign: "right" }}>
                            {hargaPerLiter != null ? formatNumber(hargaPerLiter, 0) : "—"}
                          </td>
                          <td style={{ fontSize: 12, textAlign: "right" }}>{formatNumber(r.usage, 0)}</td>
                          <td style={{ fontSize: 12, textAlign: "right" }}>{r.cost > 0 ? formatNumber(r.cost, 0) : "—"}</td>
                          <td style={{ fontSize: 12, textAlign: "right" }}>{formatNumber(r.cumUsage, 0)}</td>
                          <td style={{ fontSize: 12, textAlign: "right" }}>{r.cumCost > 0 ? formatNumber(r.cumCost, 0) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Data mentah: satu tabel per jenis pekerjaan ───────────────────────────

function RawDataByActivity({
  logs,
  onSelectLog,
}: {
  logs: HeavyEquipmentLog[];
  onSelectLog: (l: HeavyEquipmentLog) => void;
}) {
  const tables = HEAVY_EQUIPMENT_ACTIVITIES.map((actType) => {
    type Row = { log: HeavyEquipmentLog; activity: HeavyEquipmentLogActivity; cumVolume: number };
    const rows: Row[] = [];
    const sortedLogs = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date) || a.id.localeCompare(b.id));
    const runningVolume: Record<string, number> = {};

    sortedLogs.forEach((l) => {
      const act = (l.activities ?? []).find((a) => a.activity_type === actType.value);
      if (!act) return;
      const eqId = l.equipment?.id ?? "?";
      runningVolume[eqId] = (runningVolume[eqId] ?? 0) + (act.volume ?? 0);
      rows.push({ log: l, activity: act, cumVolume: runningVolume[eqId] });
    });

    return { actType, rows };
  });

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {tables.map(({ actType, rows }) => (
        <div key={actType.value} className="section-card glass">
          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>
            {actType.label}
            {actType.unit && <span style={{ fontWeight: 400, color: "var(--muted)" }}> ({actType.unit})</span>}
          </h4>
          {rows.length === 0 ? (
            <div className="empty-state">Belum ada data pekerjaan ini pada rentang ini.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Kebun</th>
                    <th>Area</th>
                    <th>Operator</th>
                    <th>Kenek</th>
                    <th>Pagi Mulai</th>
                    <th>Pagi Selesai</th>
                    <th>Sore Mulai</th>
                    <th>Sore Selesai</th>
                    <th>Mulai</th>
                    <th>Selesai</th>
                    {actType.unit && <th style={{ textAlign: "right" }}>Hasil</th>}
                    {actType.unit && <th style={{ textAlign: "right" }}>s/d</th>}
                    <th>Keterangan</th>
                    <th style={{ textAlign: "center" }}>Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ log, activity, cumVolume }) => {
                    const [start, end] = activityTimeLabels(activity, log.log_date);
                    return (
                      <tr
                        key={log.id + activity.activity_type}
                        className="clickable"
                        style={{ cursor: "pointer" }}
                        onClick={() => onSelectLog(log)}
                      >
                        <td style={{ fontSize: 12 }}>{formatDate(log.log_date)}</td>
                        <td style={{ fontSize: 12 }}>{log.kebun}</td>
                        <td style={{ fontSize: 12 }}>{log.area ?? "—"}</td>
                        <td style={{ fontSize: 12 }}>{log.operator}</td>
                        <td style={{ fontSize: 12 }}>{log.kenek ?? "—"}</td>
                        <td style={{ fontSize: 12 }}>{log.work_morning_start ?? "—"}</td>
                        <td style={{ fontSize: 12 }}>{log.work_morning_end ?? "—"}</td>
                        <td style={{ fontSize: 12 }}>{log.work_afternoon_start ?? "—"}</td>
                        <td style={{ fontSize: 12 }}>{log.work_afternoon_end ?? "—"}</td>
                        <td style={{ fontSize: 12 }}>{start}</td>
                        <td style={{ fontSize: 12 }}>{end}</td>
                        {actType.unit && (
                          <td style={{ fontSize: 12, textAlign: "right" }}>{activity.volume != null ? formatNumber(activity.volume, 0) : "—"}</td>
                        )}
                        {actType.unit && <td style={{ fontSize: 12, textAlign: "right" }}>{formatNumber(cumVolume, 0)}</td>}
                        <td style={{ fontSize: 12, maxWidth: 160 }}>{log.note ?? "—"}</td>
                        <td style={{ fontSize: 12, textAlign: "center" }}>{log.photos?.length ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Analytics view ─────────────────────────────────────────────────────────

function AnalyticsView({ analytics }: { analytics: any }) {
  const s = analytics.summary;
  const kpis = [
    { label: "Hari kerja", value: formatNumber(s.total_days, 0) },
    { label: "BBM total (L)", value: formatNumber(s.total_fuel_liters, 0) },
    { label: "Jam kerja", value: formatNumber(s.total_work_hours, 1) },
    { label: "Biaya operasional", value: `Rp ${formatNumber(s.total_cost, 0)}` },
  ];

  const activitiesWithData = (analytics.by_activity as any[]).filter(
    (a) => a.total_volume > 0 || a.total_hours > 0
  );

  const activeDailyTypes = (analytics.activity_daily_types as { value: string; label: string; unit: string | null }[]).filter(
    (t) => activitiesWithData.some((a) => a.activity_type === t.value && a.total_volume > 0)
  );

  return (
    <>
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="summary-bar" style={{ flexWrap: "wrap" }}>
          {kpis.map((k) => (
            <div key={k.label} className="summary-item">
              <span>{k.label}</span>
              <strong>{k.value}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Ringkasan per jenis pekerjaan: hasil kerja, jam kerja, biaya per satuan */}
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>Ringkasan per jenis pekerjaan</h4>
        {activitiesWithData.length === 0 ? (
          <div className="empty-state">Belum ada data pekerjaan pada rentang ini.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Jenis Pekerjaan</th>
                  <th style={{ textAlign: "right" }}>Hasil Kerja</th>
                  <th style={{ textAlign: "right" }}>Jam Kerja</th>
                  <th style={{ textAlign: "right" }}>Kecepatan Kerja</th>
                  <th style={{ textAlign: "right" }}>Biaya</th>
                  <th style={{ textAlign: "right" }}>Biaya / Satuan</th>
                  <th style={{ textAlign: "right" }}>Biaya / Jam</th>
                </tr>
              </thead>
              <tbody>
                {activitiesWithData.map((a) => (
                  <tr key={a.activity_type}>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{a.label}</td>
                    <td style={{ fontSize: 13, textAlign: "right" }}>
                      {a.unit ? `${formatNumber(a.total_volume, 0)} ${a.unit}` : "—"}
                    </td>
                    <td style={{ fontSize: 13, textAlign: "right" }}>{formatNumber(a.total_hours, 1)} jam</td>
                    <td style={{ fontSize: 13, textAlign: "right" }}>
                      {a.speed_per_hour != null ? `${formatNumber(a.speed_per_hour, 2)} ${a.unit}/jam` : "—"}
                    </td>
                    <td style={{ fontSize: 13, textAlign: "right" }}>Rp {formatNumber(a.total_cost, 0)}</td>
                    <td style={{ fontSize: 13, textAlign: "right" }}>
                      {a.cost_per_unit != null ? `Rp ${formatNumber(a.cost_per_unit, 0)} / ${a.unit}` : "—"}
                    </td>
                    <td style={{ fontSize: 13, textAlign: "right" }}>
                      {a.cost_per_hour != null ? `Rp ${formatNumber(a.cost_per_hour, 0)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, marginBottom: 0 }}>
          Biaya per jenis pekerjaan dialokasikan dari biaya operasional harian, sebanding porsi jam kerja pekerjaan tersebut pada hari itu.
        </p>
      </div>

      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <h4 style={{ margin: "0 0 4px", fontSize: 14, color: "var(--green-800)" }}>Hasil kerja per jenis pekerjaan per hari</h4>
        <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 12px" }}>
          Batang = hasil kerja hari itu &middot; garis putus-putus = kumulatif, masing-masing pekerjaan punya warna sendiri.
        </p>
        {activeDailyTypes.length === 0 ? (
          <div className="empty-state">Belum ada data pekerjaan bersatuan pada rentang ini.</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={analytics.activity_daily_series} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatNumber(Number(v), 0)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {activeDailyTypes.map((t) => (
                <Bar
                  key={t.value}
                  yAxisId="left"
                  dataKey={t.value}
                  name={t.label}
                  fill={ACTIVITY_COLORS[t.value]}
                  radius={[3, 3, 0, 0]}
                >
                  <LabelList dataKey={t.value} position="top" style={{ fontSize: 9, fill: "var(--text-secondary, #666)" }} formatter={(v: any) => (Number(v) > 0 ? formatNumber(Number(v), 0) : "")} />
                </Bar>
              ))}
              {activeDailyTypes.map((t) => (
                <Line
                  key={`${t.value}_cum`}
                  yAxisId="right"
                  type="monotone"
                  dataKey={`${t.value}_cum`}
                  name={`${t.label} (kumulatif)`}
                  stroke={ACTIVITY_COLORS[t.value]}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={{ r: 2 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>Jam kerja per jenis pekerjaan</h4>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={activitiesWithData} layout="vertical" margin={{ top: 8, right: 16, left: 40, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} width={140} />
            <Tooltip formatter={(v: any) => `${formatNumber(Number(v), 1)} jam`} />
            <Bar dataKey="total_hours" name="Jam kerja" fill="#378ADD" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="total_hours" position="right" style={{ fontSize: 10, fill: "var(--text-secondary, #666)" }} formatter={(v: any) => `${formatNumber(Number(v), 1)} jam`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>Biaya per satuan pekerjaan</h4>
        {activitiesWithData.filter((a) => a.cost_per_unit != null).length === 0 ? (
          <div className="empty-state">Tidak ada pekerjaan bersatuan (mis. Roling tidak dihitung per satuan).</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={activitiesWithData.filter((a) => a.cost_per_unit != null)}
              margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => `Rp ${formatNumber(Number(v), 0)}`} />
              <Bar dataKey="cost_per_unit" name="Biaya / satuan" fill="#BA7517" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="cost_per_unit" position="top" style={{ fontSize: 10, fill: "var(--text-secondary, #666)" }} formatter={(v: any) => `Rp ${formatNumber(Number(v), 0)}`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>Konsumsi BBM harian</h4>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={analytics.daily_series} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => formatNumber(Number(v), 0)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="fuel_liters" name="BBM harian (L)" fill="#378ADD" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="fuel_liters" position="top" style={{ fontSize: 10, fill: "var(--text-secondary, #666)" }} formatter={(v: any) => formatNumber(Number(v), 0)} />
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulative_fuel"
              name="Kumulatif BBM (L)"
              stroke="#BA7517"
              strokeWidth={2}
              dot={{ r: 3, fill: "#BA7517" }}
              label={{ position: "top", fontSize: 10, fill: "#BA7517", formatter: (v: any) => formatNumber(Number(v), 0) }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>Biaya operasional harian</h4>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={analytics.daily_series} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => `Rp ${formatNumber(Number(v), 0)}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="cost" name="Biaya harian (Rp)" fill="#D85A30" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="cost" position="top" style={{ fontSize: 10, fill: "var(--text-secondary, #666)" }} formatter={(v: any) => `Rp ${formatNumber(Number(v), 0)}`} />
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulative_cost"
              name="Kumulatif biaya (Rp)"
              stroke="#185FA5"
              strokeWidth={2}
              dot={{ r: 3, fill: "#185FA5" }}
              label={{ position: "top", fontSize: 10, fill: "#185FA5", formatter: (v: any) => `Rp ${formatNumber(Number(v), 0)}` }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="section-card glass">
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>Biaya per item</h4>
        {analytics.by_cost_item.length === 0 ? (
          <div className="empty-state">Belum ada data biaya.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.by_cost_item} layout="vertical" margin={{ top: 8, right: 16, left: 40, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
              <Tooltip formatter={(v: any) => `Rp ${formatNumber(Number(v), 0)}`} />
              <Bar dataKey="total" name="Total biaya" fill="#BA7517" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="total" position="right" style={{ fontSize: 10, fill: "var(--text-secondary, #666)" }} formatter={(v: any) => `Rp ${formatNumber(Number(v), 0)}`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

// ─── Log detail modal ───────────────────────────────────────────────────────

function LogDetailModal({ log, onClose }: { log: HeavyEquipmentLog; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-window" style={{ maxWidth: 620 }}>
        <div className="modal-head">
          <div>
            <h4>Laporan {formatDate(log.log_date)}</h4>
            <p>{log.equipment?.code} · {log.kebun} · {log.area ?? "—"}</p>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Info label="Operator" value={log.operator} />
            <Info label="Kenek" value={log.kenek ?? "—"} />
            <Info label="BBM (L)" value={log.fuel_liters != null ? formatNumber(log.fuel_liters, 0) : "—"} />
            <Info label="Total biaya" value={`Rp ${formatNumber(log.total_cost, 0)}`} />
            <Info label="Jam pagi" value={`${log.work_morning_start ?? "—"} – ${log.work_morning_end ?? "—"}`} />
            <Info label="Jam sore" value={`${log.work_afternoon_start ?? "—"} – ${log.work_afternoon_end ?? "—"}`} />
          </div>

          <h5 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--green-800)" }}>Pekerjaan</h5>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead><tr><th>Jenis</th><th>Mulai</th><th>Selesai</th><th style={{ textAlign: "right" }}>Hasil</th></tr></thead>
              <tbody>
                {(log.activities ?? []).map((a) => {
                  const [start, end] = activityTimeLabels(a, log.log_date);
                  return (
                    <tr key={a.id ?? a.activity_type}>
                      <td style={{ fontSize: 12 }}>{a.label ?? a.activity_type}</td>
                      <td style={{ fontSize: 12 }}>{start}</td>
                      <td style={{ fontSize: 12 }}>{end}</td>
                      <td style={{ fontSize: 12, textAlign: "right" }}>
                        {a.volume != null ? `${formatNumber(a.volume, 0)} ${a.unit ?? ""}` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {(log.activities ?? []).length === 0 && <tr><td colSpan={4} className="empty-state">Tidak ada pekerjaan.</td></tr>}
              </tbody>
            </table>
          </div>

          <h5 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--green-800)" }}>Biaya</h5>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead><tr><th>Item</th><th style={{ textAlign: "right" }}>Nominal</th></tr></thead>
              <tbody>
                {(log.costs ?? []).map((c) => (
                  <tr key={c.id ?? c.cost_item_id}>
                    <td style={{ fontSize: 12 }}>{c.name ?? "—"}</td>
                    <td style={{ fontSize: 12, textAlign: "right" }}>Rp {formatNumber(c.amount, 0)}</td>
                  </tr>
                ))}
                {(log.costs ?? []).length === 0 && <tr><td colSpan={2} className="empty-state">Tidak ada biaya.</td></tr>}
              </tbody>
            </table>
          </div>

          {log.note && (
            <div style={{ marginBottom: 16 }}>
              <h5 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--green-800)" }}>Keterangan</h5>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{log.note}</p>
            </div>
          )}

          {(log.photos ?? []).length > 0 && (
            <>
              <h5 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--green-800)" }}>Foto</h5>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {(log.photos ?? []).map((p) => (
                  <PhotoThumb key={p.id} url={p.download_url} name={p.original_file_name} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function PhotoThumb({ url, name }: { url: string; name: string }) {
  const [src, setSrc] = useState<string>("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    heavyEquipmentService
      .downloadPhoto(url)
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => setErr(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (err) return <div style={{ fontSize: 11, color: "var(--muted)" }}>{name} (gagal dimuat)</div>;
  if (!src) return <div style={{ width: 96, height: 96, borderRadius: 8, background: "var(--line)" }} />;
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt={name} style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />
    </a>
  );
}
