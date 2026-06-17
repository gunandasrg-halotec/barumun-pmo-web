import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportService } from "../../services/reportService";
import { useAuth } from "../../context/AuthContext";
import { formatDate, formatDateTime, extractError } from "../../utils/format";

// NOTE: `value` MUST match backend enum: WEEKLY | MONTHLY | PROGRESS | COST | SUMMARY
const REPORT_TYPES = [
  {
    value: "WEEKLY",
    label: "Laporan Mingguan",
    icon: "📋",
    desc: "Ringkasan realisasi lapangan per minggu dengan perbandingan plan vs actual.",
  },
  {
    value: "MONTHLY",
    label: "Laporan Bulanan",
    icon: "📅",
    desc: "Rekap kumulatif bulanan: volume, biaya, dan deviasi.",
  },
  {
    value: "PROGRESS",
    label: "Laporan Progress",
    icon: "📊",
    desc: "Status progress pekerjaan per item WBD pada periode terpilih.",
  },
  {
    value: "COST",
    label: "Laporan Biaya",
    icon: "💰",
    desc: "Analisis biaya rencana vs realisasi dengan breakdown per grup.",
  },
  {
    value: "SUMMARY",
    label: "Ringkasan Eksekutif",
    icon: "🏢",
    desc: "Ringkasan eksekutif untuk Direksi: KPI, status, dan risiko proyek.",
  },
];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  GENERATING: { label: "Memproses", cls: "running" },
  READY: { label: "Siap", cls: "done" },
  FAILED: { label: "Gagal", cls: "delay" },
};

export default function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { canGenerateReports } = useAuth() as any;
  const queryClient = useQueryClient();

  const [reportType, setReportType] = useState("WEEKLY");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const reportsQ = useQuery({
    queryKey: ["reports", projectId],
    queryFn: () => reportService.list(projectId!),
    enabled: !!projectId,
  });

  const generateMut = useMutation({
    mutationFn: () => {
      // Backend requires period_start/period_end. Default to current month if blank.
      const today = new Date();
      const defStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const defEnd = today.toISOString().slice(0, 10);
      return reportService.generate(projectId!, {
        report_type: reportType,
        period_start: dateFrom || defStart,
        period_end: dateTo || defEnd,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports", projectId] });
      setGenerating(false);
    },
    onError: (err) => {
      setGenError(extractError(err));
      setGenerating(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => reportService.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["reports", projectId] }),
  });

  const reports: any[] = (reportsQ.data as any)?.data ?? [];
  const selectedType = REPORT_TYPES.find((r) => r.value === reportType);

  function handleGenerate() {
    setGenError("");
    setGenerating(true);
    generateMut.mutate();
  }

  return (
    <div>
      {/* Header */}
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>Generate Laporan</h3>
            <p>
              Buat dan unduh laporan proyek dalam format PDF. Laporan mencakup
              WBD, Gantt, S-Curve, dan progress lapangan.
            </p>
          </div>
          <div className="cluster">
            <span className="chip">{reports.length} laporan tersimpan</span>
          </div>
        </div>

        <div className="summary-bar">
          {[
            { label: "Total Laporan", val: reports.length },
            {
              label: "Siap Unduh",
              val: reports.filter((r) => r.status === "READY").length,
            },
            {
              label: "Diproses",
              val: reports.filter((r) => r.status === "GENERATING").length,
            },
            {
              label: "Gagal",
              val: reports.filter((r) => r.status === "FAILED").length,
            },
          ].map((s) => (
            <div key={s.label} className="summary-item">
              <span>{s.label}</span>
              <strong>{s.val}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Generate toolbar */}
      {(canGenerateReports ? canGenerateReports() : true) && (
        <div className="section-card glass" style={{ marginBottom: 18 }}>
          <h4
            style={{
              margin: "0 0 14px",
              fontSize: 14,
              color: "var(--green-800)",
            }}
          >
            Generate Laporan Baru
          </h4>

          {/* Report type grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {REPORT_TYPES.map((r) => (
              <div
                key={r.value}
                onClick={() => setReportType(r.value)}
                style={{
                  padding: "14px 16px",
                  borderRadius: 12,
                  border: `2px solid ${
                    reportType === r.value ? "var(--green-700)" : "var(--line)"
                  }`,
                  background:
                    reportType === r.value
                      ? "rgba(45,125,70,0.08)"
                      : "transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 6 }}>{r.icon}</div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 13,
                    marginBottom: 4,
                    color:
                      reportType === r.value
                        ? "var(--green-800)"
                        : "var(--text)",
                  }}
                >
                  {r.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    lineHeight: 1.4,
                  }}
                >
                  {r.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Period filter + action */}
          <div className="toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Periode:
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span style={{ color: "var(--muted)" }}>s/d</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="stretch" />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {genError && (
                <span style={{ fontSize: 12, color: "var(--danger)" }}>
                  {genError}
                </span>
              )}
              <button
                className="btn"
                onClick={handleGenerate}
                disabled={generating || generateMut.isPending}
              >
                {generating || generateMut.isPending
                  ? "⏳ Memproses..."
                  : `${selectedType?.icon ?? "📄"} Generate ${
                      selectedType?.label ?? ""
                    }`}
              </button>
            </div>
          </div>

          {/* Mini preview */}
          {selectedType && (
            <div
              className="panel-block"
              style={{
                marginTop: 14,
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 90,
                  height: 120,
                  borderRadius: 8,
                  background:
                    "linear-gradient(160deg, var(--green-900), var(--green-700))",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "white",
                  fontSize: 28,
                }}
              >
                {selectedType.icon}
                <div
                  style={{
                    fontSize: 9,
                    marginTop: 8,
                    opacity: 0.7,
                    textAlign: "center",
                    padding: "0 6px",
                  }}
                >
                  Plantation PMO
                </div>
                <div
                  style={{
                    fontSize: 8,
                    opacity: 0.5,
                    textAlign: "center",
                    padding: "2px 6px",
                  }}
                >
                  {selectedType.label}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  {selectedType.label}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    marginBottom: 10,
                  }}
                >
                  {selectedType.desc}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  <span className="chip">Format: PDF</span>
                  {(dateFrom || dateTo) && (
                    <span className="chip" style={{ marginLeft: 6 }}>
                      Periode: {dateFrom || "—"} s/d {dateTo || "—"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report list */}
      <div className="section-card glass">
        <h4
          style={{
            margin: "0 0 14px",
            fontSize: 14,
            color: "var(--green-800)",
          }}
        >
          Daftar Laporan
        </h4>

        {reportsQ.isLoading ? (
          <div className="loading-state">Memuat daftar laporan...</div>
        ) : reportsQ.error ? (
          <div className="danger-box">{extractError(reportsQ.error)}</div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            Belum ada laporan. Pilih jenis laporan dan klik Generate untuk
            membuat laporan pertama.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Jenis Laporan</th>
                  <th>Periode</th>
                  <th>Dibuat</th>
                  <th>Dibuat Oleh</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report: any) => {
                  const st = STATUS_MAP[report.status] ?? {
                    label: report.status,
                    cls: "planned",
                  };
                  const rtype = REPORT_TYPES.find(
                    (r) => r.value === report.report_type
                  );
                  return (
                    <tr key={report.id}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>
                            {rtype?.icon ?? "📄"}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {rtype?.label ?? report.report_type}
                            </div>
                            <div
                              style={{ fontSize: 11, color: "var(--muted)" }}
                            >
                              {report.title}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {report.date_from
                          ? `${formatDate(report.date_from)} – ${formatDate(
                              report.date_to
                            )}`
                          : "Semua periode"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {formatDateTime(report.created_at)}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {report.generated_by?.full_name ?? "—"}
                      </td>
                      <td>
                        <span className={`badge ${st.cls}`}>{st.label}</span>
                      </td>
                      <td>
                        <div className="cluster">
                          {report.status === "READY" && report.download_url && (
                            <a
                              href={report.download_url}
                              target="_blank"
                              rel="noreferrer"
                              className="chip clickable"
                              download
                            >
                              ⬇ Unduh
                            </a>
                          )}
                          {report.status === "FAILED" && (
                            <span className="chip status-bad">Error</span>
                          )}
                          <button
                            className="chip clickable"
                            style={{ color: "var(--danger)" }}
                            onClick={() => {
                              if (window.confirm("Hapus laporan ini?"))
                                deleteMut.mutate(report.id);
                            }}
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
