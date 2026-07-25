import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { heavyEquipmentService } from "../../services/heavyEquipmentService";
import { extractError, formatNumber, formatDate } from "../../utils/format";
import type { HeavyEquipment, HeavyEquipmentLog } from "../../types";

const TABS = ["Analitik", "Data Mentah"];

const firstOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const todayISO = () => new Date().toISOString().slice(0, 10);

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
    queryFn: () => heavyEquipmentService.listLogs({ ...filters, limit: 100 }),
    enabled: activeTab === "Data Mentah",
  });
  const logs: HeavyEquipmentLog[] = (logsQ.data as any)?.data ?? [];

  const setF = (k: keyof typeof filters, v: string) => setFilters((p) => ({ ...p, [k]: v }));

  function exportCsv() {
    const header = ["Tanggal", "Kode Alat", "Kebun", "Area", "Operator", "Kenek", "BBM (L)", "Total Biaya"];
    const rows = logs.map((l) => [
      l.log_date,
      l.equipment?.code ?? "",
      l.kebun,
      l.area ?? "",
      l.operator,
      l.kenek ?? "",
      l.fuel_liters ?? "",
      l.total_cost,
    ]);
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

        {/* Filter */}
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

      {/* ── Analitik ── */}
      {activeTab === "Analitik" && (
        analyticsQ.isLoading ? (
          <div className="section-card glass"><div className="loading-state">Memuat analitik...</div></div>
        ) : analyticsQ.error ? (
          <div className="section-card glass"><div className="danger-box">{extractError(analyticsQ.error)}</div></div>
        ) : analytics ? (
          <AnalyticsView analytics={analytics} />
        ) : null
      )}

      {/* ── Data Mentah ── */}
      {activeTab === "Data Mentah" && (
        <div className="section-card glass">
          <div className="section-title" style={{ marginBottom: 12 }}>
            <div><h4 style={{ margin: 0 }}>Data mentah laporan harian</h4></div>
            <button className="btn secondary" onClick={exportCsv} disabled={logs.length === 0}>Export CSV</button>
          </div>
          {logsQ.isLoading ? (
            <div className="loading-state">Memuat data...</div>
          ) : logsQ.error ? (
            <div className="danger-box">{extractError(logsQ.error)}</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Alat</th>
                    <th>Kebun</th>
                    <th>Area</th>
                    <th>Operator</th>
                    <th style={{ textAlign: "right" }}>BBM (L)</th>
                    <th style={{ textAlign: "center" }}>Pekerjaan</th>
                    <th style={{ textAlign: "right" }}>Total Biaya</th>
                    <th style={{ textAlign: "center" }}>Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="clickable" style={{ cursor: "pointer" }} onClick={() => setDetail(l)}>
                      <td style={{ fontSize: 12 }}>{formatDate(l.log_date)}</td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{l.equipment?.code ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>{l.kebun}</td>
                      <td style={{ fontSize: 12 }}>{l.area ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>{l.operator}</td>
                      <td style={{ fontSize: 12, textAlign: "right" }}>{l.fuel_liters != null ? formatNumber(l.fuel_liters, 0) : "—"}</td>
                      <td style={{ fontSize: 12, textAlign: "center" }}>{l.activities?.length ?? 0}</td>
                      <td style={{ fontSize: 12, textAlign: "right" }}>Rp {formatNumber(l.total_cost, 0)}</td>
                      <td style={{ fontSize: 12, textAlign: "center" }}>{l.photos?.length ?? 0}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan={9} className="empty-state">Tidak ada data pada rentang ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {detail && <LogDetailModal log={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

// ─── Analytics view ─────────────────────────────────────────────────────────

function AnalyticsView({ analytics }: { analytics: any }) {
  const s = analytics.summary;
  const kpis = [
    { label: "Hari kerja", value: formatNumber(s.total_days, 0) },
    { label: "BBM total (L)", value: formatNumber(s.total_fuel_liters, 0) },
    { label: "Total meter", value: formatNumber(s.total_meter, 0) },
    { label: "Total pokok", value: formatNumber(s.total_pokok, 0) },
    { label: "Jam kerja", value: formatNumber(s.total_work_hours, 1) },
    { label: "Biaya operasional", value: `Rp ${formatNumber(s.total_cost, 0)}` },
    { label: "Biaya / meter", value: s.cost_per_meter != null ? `Rp ${formatNumber(s.cost_per_meter, 0)}` : "—" },
    { label: "Biaya / hari", value: s.cost_per_day != null ? `Rp ${formatNumber(s.cost_per_day, 0)}` : "—" },
  ];

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

      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>Volume per jenis pekerjaan</h4>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={analytics.by_activity} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => formatNumber(Number(v), 0)} />
            <Bar dataKey="total_volume" name="Volume" fill="#1D9E75" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "var(--green-800)" }}>BBM &amp; biaya harian</h4>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={analytics.daily_series} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => formatNumber(Number(v), 0)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line yAxisId="left" type="monotone" dataKey="fuel_liters" name="BBM harian (L)" stroke="#378ADD" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="cumulative_cost" name="Biaya kumulatif (Rp)" stroke="#1D9E75" strokeWidth={2} strokeDasharray="4 3" dot={false} />
          </LineChart>
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
              <Bar dataKey="total" name="Total biaya" fill="#BA7517" radius={[0, 4, 4, 0]} />
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
                {(log.activities ?? []).map((a) => (
                  <tr key={a.id ?? a.activity_type}>
                    <td style={{ fontSize: 12 }}>{a.label ?? a.activity_type}</td>
                    <td style={{ fontSize: 12 }}>{a.start_time ?? "—"}</td>
                    <td style={{ fontSize: 12 }}>{a.end_time ?? "—"}</td>
                    <td style={{ fontSize: 12, textAlign: "right" }}>
                      {a.volume != null ? `${formatNumber(a.volume, 0)} ${a.unit ?? ""}` : "—"}
                    </td>
                  </tr>
                ))}
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
