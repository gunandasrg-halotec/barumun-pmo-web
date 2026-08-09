import { useEffect, useMemo, useRef, useState } from "react";
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
  type HeavyEquipment,
  type HeavyEquipmentActivityTypeConfig,
  type HeavyEquipmentLog,
  type HeavyEquipmentLogActivity,
  type FuelStockData,
} from "../../types";

const TABS = ["Analitik", "Data Mentah"];

const firstOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const todayISO = () => new Date().toISOString().slice(0, 10);

// Kalau data pertama proyek jatuh di bulan SEBELUM bulan berjalan (mis. proyek
// baru mulai akhir Juli, sekarang sudah Agustus), default "1 bulan berjalan"
// akan memotong ekor data bulan lalu. Dalam kasus itu, mundurkan date_from ke
// tanggal data paling awal. Bulan-bulan berikutnya otomatis balik ke perilaku
// normal (1 bulan berjalan) karena data paling awal sudah lebih dari 1 bulan lalu.
function resolveDefaultDateFrom(earliestDataDateISO: string | null): string {
  const fom = firstOfMonthISO();
  if (!earliestDataDateISO) return fom;
  const earliest = new Date(earliestDataDateISO + "T00:00:00");
  const fomDate = new Date(fom + "T00:00:00");
  const prevMonthStart = new Date(fomDate.getFullYear(), fomDate.getMonth() - 1, 1);
  if (earliest >= prevMonthStart && earliest < fomDate) {
    return earliestDataDateISO;
  }
  return fom;
}

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

/** [label mulai, label selesai] — tampilkan tanggal bila lintas hari (start_date / end_date berbeda). */
function activityTimeLabels(a: HeavyEquipmentLogActivity, logDateIso: string): [string, string] {
  const sd = a.start_date || logDateIso;
  const ed = a.end_date || sd;
  const crossDay = sd !== logDateIso || ed !== sd;
  const start = a.start_time ? `${crossDay ? shortDate(sd) + " " : ""}${a.start_time}` : "—";
  const end = a.end_time ? `${crossDay ? shortDate(ed) + " " : ""}${a.end_time}` : "—";
  return [start, end];
}

export default function HeavyEquipmentUsagePage() {
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [filters, setFilters] = useState({
    date_from: firstOfMonthISO(),
    date_to: todayISO(),
    equipment_id: "",
    kebun: "",
  });
  const dateDefaultAdjusted = useRef(false);
  const [detail, setDetail] = useState<HeavyEquipmentLog | null>(null);
  const [photoViewer, setPhotoViewer] = useState<{ urls: string[]; index: number } | null>(null);

  const equipmentsQ = useQuery({
    queryKey: ["heavy-equipment-active-filter"],
    queryFn: () => heavyEquipmentService.list(true),
  });
  const equipments: HeavyEquipment[] = (equipmentsQ.data as any)?.data ?? [];

  const activityTypesQ = useQuery({
    queryKey: ["heavy-equipment-activity-types"],
    queryFn: () => heavyEquipmentService.listActivityTypes(false),
    staleTime: 5 * 60 * 1000,
  });
  const activityTypes: HeavyEquipmentActivityTypeConfig[] = (activityTypesQ.data as any)?.data ?? [];

  const analyticsQ = useQuery({
    queryKey: ["heavy-equipment-analytics", filters],
    queryFn: () => heavyEquipmentService.analytics(filters),
    enabled: activeTab === "Analitik",
  });
  const analytics = (analyticsQ.data as any)?.data;

  // KPI cards selalu menampilkan total keseluruhan (tidak terpengaruh filter tanggal),
  // tetap menghormati filter alat/kebun.
  const kpiTotalsQ = useQuery({
    queryKey: ["heavy-equipment-analytics-total", filters.equipment_id, filters.kebun],
    queryFn: () => heavyEquipmentService.analytics({ equipment_id: filters.equipment_id, kebun: filters.kebun }),
    enabled: activeTab === "Analitik",
  });
  const kpiSummary = (kpiTotalsQ.data as any)?.data?.summary;

  // Sekali saja (saat data pertama kali termuat, sebelum user mengubah filter
  // manapun): sesuaikan default date_from bila data proyek dimulai di bulan lalu.
  useEffect(() => {
    if (dateDefaultAdjusted.current) return;
    const dailySeries = (kpiTotalsQ.data as any)?.data?.daily_series as { date: string }[] | undefined;
    if (!dailySeries) return;
    dateDefaultAdjusted.current = true;
    const earliest = dailySeries[0]?.date ?? null;
    const resolved = resolveDefaultDateFrom(earliest);
    setFilters((p) => (p.date_from === firstOfMonthISO() ? { ...p, date_from: resolved } : p));
  }, [kpiTotalsQ.data]);

  const logsQ = useQuery({
    queryKey: ["heavy-equipment-logs", filters],
    queryFn: () => heavyEquipmentService.listLogs({ ...filters, limit: 200 }),
    enabled: activeTab === "Data Mentah",
  });
  const logs: HeavyEquipmentLog[] = (logsQ.data as any)?.data ?? [];

  const fuelStockQ = useQuery({
    queryKey: ["heavy-equipment-fuel-stock", filters.kebun, filters.date_from, filters.date_to],
    queryFn: () => heavyEquipmentService.getFuelStock({
      kebun: filters.kebun || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
    }),
    enabled: activeTab === "Data Mentah",
  });
  const fuelStock = (fuelStockQ.data as any)?.data as { solar: FuelStockData; dex_lite: FuelStockData; pertadex: FuelStockData } | undefined;

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
          <AnalyticsView analytics={analytics} kpiSummary={kpiSummary} />
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

          {/* ── Kartu stock BBM ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginBottom: 18 }}>
            {([
              { key: "solar", label: "Solar", icon: "☀️", accent: "#d4a537", bg: "#fef3dc", textColor: "#7a5800" },
              { key: "dex_lite", label: "Dex Lite", icon: "⛽", accent: "#0f6e56", bg: "#e1f5ee", textColor: "#0f6e56" },
              { key: "pertadex", label: "Pertadex", icon: "🛢️", accent: "#7a3fc4", bg: "#efe6fb", textColor: "#4a2680" },
            ] as const).map(({ key, label, icon, accent, bg, textColor }) => {
              const d: FuelStockData | undefined = fuelStock?.[key];
              const solarEntries = fuelStock?.solar.entries ?? [];
              return (
                <div key={key} className="section-card glass" style={{ border: `1.5px solid ${accent}30`, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>Stock BBM</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: textColor }}>{label}</div>
                    </div>
                  </div>
                  {fuelStockQ.isLoading ? (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Memuat...</div>
                  ) : fuelStockQ.error ? (
                    <div style={{ fontSize: 12, color: "var(--danger)" }}>Gagal memuat</div>
                  ) : d ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: key === "solar" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8, marginBottom: d.entries.length > 0 ? 12 : 0 }}>
                        <div style={{ background: bg, borderRadius: 8, padding: "10px 12px" }}>
                          <div style={{ fontSize: 11, color: textColor, fontWeight: 600, marginBottom: 2 }}>Diterima</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: textColor, fontVariantNumeric: "tabular-nums" }}>{formatNumber(d.total_received, 0)} <span style={{ fontSize: 11, fontWeight: 600 }}>L</span></div>
                        </div>
                        {key === "solar" && (
                          <div style={{ background: "#fdecea", borderRadius: 8, padding: "10px 12px", border: "1px solid #f5aca640" }}>
                            <div style={{ fontSize: 11, color: "#8a2c25", fontWeight: 600, marginBottom: 2 }}>Digunakan</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#8a2c25", fontVariantNumeric: "tabular-nums" }}>{formatNumber(d.total_used, 0)} <span style={{ fontSize: 11, fontWeight: 600 }}>L</span></div>
                          </div>
                        )}
                        <div style={{ background: accent + "15", borderRadius: 8, padding: "10px 12px", border: `1px solid ${accent}40` }}>
                          <div style={{ fontSize: 11, color: textColor, fontWeight: 600, marginBottom: 2 }}>Saldo</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: d.saldo < 0 ? "#cb5f45" : textColor, fontVariantNumeric: "tabular-nums" }}>{formatNumber(d.saldo, 0)} <span style={{ fontSize: 11, fontWeight: 600 }}>L</span></div>
                        </div>
                      </div>
                      {d.entries.length > 0 && (
                        <div style={{ borderTop: `1px solid ${accent}20`, paddingTop: 10, display: "grid", gap: 5 }}>
                          {d.entries.map((entry) => {
                            const isUsage = entry.entry_type === "usage";
                            const hasSolarSameDay = key === "dex_lite"
                              ? solarEntries.some((s) => s.receipt_date === entry.receipt_date && s.kebun === entry.kebun)
                              : false;
                            const showPhotos = !isUsage && (key === "solar" || !hasSolarSameDay) && entry.photos.length > 0;
                            const parts = isUsage
                              ? "Pemakaian alat berat"
                              : [
                                  entry.qty_20l && `${entry.qty_20l}×20L`,
                                  entry.qty_30l && `${entry.qty_30l}×30L`,
                                  entry.qty_35l && `${entry.qty_35l}×35L`,
                                  entry.qty_40l && `${entry.qty_40l}×40L`,
                                  entry.extra_liters && `sisa ${entry.extra_liters}L`,
                                ].filter(Boolean).join(" · ");
                            return (
                              <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                                <span style={{ color: "var(--muted)", minWidth: 30, fontVariantNumeric: "tabular-nums" }}>
                                  {entry.receipt_date.slice(5).replace("-", "/")}
                                </span>
                                <span style={{ flex: 1, color: isUsage ? "#8a2c25" : "var(--text)", fontStyle: isUsage ? "italic" : "normal" }}>{parts}</span>
                                <span style={{ fontWeight: 700, color: isUsage ? "#cb5f45" : textColor, fontVariantNumeric: "tabular-nums" }}>
                                  {isUsage ? "−" : "+"}{formatNumber(Math.abs(entry.total_liters), 0)} L
                                </span>
                                {showPhotos && (
                                  <button
                                    type="button"
                                    onClick={() => setPhotoViewer({ urls: entry.photos.map((p) => p.download_url), index: 0 })}
                                    title={`${entry.photos.length} foto`}
                                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "0 2px", opacity: 0.8 }}
                                  >📷</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Belum ada data</div>
                  )}
                </div>
              );
            })}
          </div>

          {logsQ.isLoading ? (
            <div className="section-card glass"><div className="loading-state">Memuat data...</div></div>
          ) : logsQ.error ? (
            <div className="section-card glass"><div className="danger-box">{extractError(logsQ.error)}</div></div>
          ) : (
            <>
              <CostHistoryTable logs={logs} />
              <BbmHistoryTable logs={logs} />
              <RawDataByActivity logs={logs} activityTypes={activityTypes} onSelectLog={setDetail} />
            </>
          )}
        </div>
      )}

      {detail && <LogDetailModal log={detail} onClose={() => setDetail(null)} />}
      {photoViewer && (
        <FuelPhotoViewer
          urls={photoViewer.urls}
          initialIndex={photoViewer.index}
          onClose={() => setPhotoViewer(null)}
        />
      )}
    </div>
  );
}

// ─── Data mentah: riwayat biaya harian (pivot per item biaya) ──────────────

function CostHistoryTable({ logs }: { logs: HeavyEquipmentLog[] }) {
  const { items, rows, colTotals, grandTotal } = useMemo(() => {
    const sorted = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date) || a.id.localeCompare(b.id));

    // kumpulkan semua item biaya yang muncul, diurutkan berdasarkan sort_order
    // katalog (bukan urutan kemunculan) — mis. Gaji Operator/Helper selalu di depan.
    const itemMap = new Map<string, { name: string; sort_order: number }>();
    sorted.forEach((l) => (l.costs ?? []).forEach((c) => {
      if (c.cost_item_id && c.name && !itemMap.has(c.cost_item_id))
        itemMap.set(c.cost_item_id, { name: c.name, sort_order: c.sort_order ?? 0 });
    }));
    const items = Array.from(itemMap.entries())
      .map(([id, v]) => ({ id, name: v.name, sort_order: v.sort_order }))
      .sort((a, b) => a.sort_order - b.sort_order);

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
          .reduce<{ date: string; usageSolar: number; usageDexLite: number; usagePertadex: number; usage: number; cost: number; cumUsage: number; cumCost: number }[]>((acc, l) => {
            const usageSolar = l.fuel_liters ?? 0;
            const usageDexLite = l.fuel_liters_dex_lite ?? 0;
            const usagePertadex = l.fuel_liters_pertadex ?? 0;
            const usage = usageSolar + usageDexLite + usagePertadex;
            const cost  = findBbmCost(l.costs);
            const prev  = acc.length > 0 ? acc[acc.length - 1] : { cumUsage: 0, cumCost: 0 };
            acc.push({ date: l.log_date, usageSolar, usageDexLite, usagePertadex, usage, cost, cumUsage: prev.cumUsage + usage, cumCost: prev.cumCost + cost });
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
                      <th style={{ textAlign: "right" }}>Solar (L)</th>
                      <th style={{ textAlign: "right" }}>Dex Lite (L)</th>
                      <th style={{ textAlign: "right" }}>Pertadex (L)</th>
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
                          <td style={{ fontSize: 12, textAlign: "right" }}>{r.usageSolar > 0 ? formatNumber(r.usageSolar, 0) : "—"}</td>
                          <td style={{ fontSize: 12, textAlign: "right" }}>{r.usageDexLite > 0 ? formatNumber(r.usageDexLite, 0) : "—"}</td>
                          <td style={{ fontSize: 12, textAlign: "right" }}>{r.usagePertadex > 0 ? formatNumber(r.usagePertadex, 0) : "—"}</td>
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
  activityTypes,
  onSelectLog,
}: {
  logs: HeavyEquipmentLog[];
  activityTypes: HeavyEquipmentActivityTypeConfig[];
  onSelectLog: (l: HeavyEquipmentLog) => void;
}) {
  const tables = activityTypes.map((actType) => {
    type Row = { log: HeavyEquipmentLog; activity: HeavyEquipmentLogActivity; cumVolume: number };
    const rows: Row[] = [];
    const sortedLogs = [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date) || a.id.localeCompare(b.id));
    const runningVolume: Record<string, number> = {};

    sortedLogs.forEach((l) => {
      const act = (l.activities ?? []).find((a) => a.activity_type === actType.code);
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
        <div key={actType.code} className="section-card glass">
          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>
            {actType.name}
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
                    <th>Tgl s/d</th>
                    {actType.unit && <th style={{ textAlign: "right" }}>Hasil</th>}
                    {actType.unit && <th style={{ textAlign: "right" }}>Kum.</th>}
                    {actType.has_description && <th>Ket. Pekerjaan</th>}
                    {actType.has_repair_cost && <th style={{ textAlign: "right" }}>Biaya Perbaikan</th>}
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
                        <td style={{ fontSize: 12 }}>
                          {activity.end_date && activity.end_date !== log.log_date ? shortDate(activity.end_date) : "—"}
                        </td>
                        {actType.unit && (
                          <td style={{ fontSize: 12, textAlign: "right" }}>{activity.volume != null ? formatNumber(activity.volume, 0) : "—"}</td>
                        )}
                        {actType.unit && <td style={{ fontSize: 12, textAlign: "right" }}>{formatNumber(cumVolume, 0)}</td>}
                        {actType.has_description && (
                          <td style={{ fontSize: 12, maxWidth: 200 }}>{activity.description ?? "—"}</td>
                        )}
                        {actType.has_repair_cost && (
                          <td style={{ fontSize: 12, textAlign: "right" }}>
                            {activity.repair_cost != null ? `Rp ${formatNumber(activity.repair_cost, 0)}` : "—"}
                          </td>
                        )}
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

function AnalyticsView({ analytics, kpiSummary }: { analytics: any; kpiSummary?: any }) {
  const s = kpiSummary ?? analytics.summary;
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

// ─── Photo viewer modal untuk foto BBM ───────────────────────────────────────

function FuelPhotoViewer({ urls, initialIndex, onClose }: { urls: string[]; initialIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(initialIndex);
  const token = localStorage.getItem("token") ?? "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % urls.length);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + urls.length) % urls.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [urls.length, onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <img
          src={`${urls[idx]}?token=${token}`}
          alt={`Foto ${idx + 1}`}
          style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 10 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {urls.length > 1 && (
            <button onClick={() => setIdx((i) => (i - 1 + urls.length) % urls.length)}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}>‹</button>
          )}
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{idx + 1} / {urls.length}</span>
          {urls.length > 1 && (
            <button onClick={() => setIdx((i) => (i + 1) % urls.length)}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}>›</button>
          )}
        </div>
        <button onClick={onClose}
          style={{ position: "absolute", top: -14, right: -14, width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", color: "white", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>×</button>
        <a
          href={urls[idx]}
          target="_blank"
          rel="noreferrer"
          style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, textDecoration: "underline" }}
        >Buka di tab baru</a>
      </div>
    </div>
  );
}
