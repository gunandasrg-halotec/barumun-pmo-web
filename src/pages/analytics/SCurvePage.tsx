import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';
import { formatNumber, formatCurrency, extractError } from '../../utils/format';

// SVG S-Curve chart — no external chart library dependency
function SCurveChart({
  data,
  planKey,
  actualKey,
  labelPlan,
  labelActual,
  color,
  formatVal,
}: {
  data: any[];
  planKey: string;
  actualKey: string;
  labelPlan: string;
  labelActual: string;
  color: string;
  formatVal: (v: number) => string;
}) {
  const W = 640; const H = 220; const PL = 56; const PR = 16; const PT = 16; const PB = 32;
  const iW = W - PL - PR; const iH = H - PT - PB;

  if (!data.length) return <div className="empty-state">Belum ada data S-Curve.</div>;

  const allPlan   = data.map(d => Number(d[planKey]   ?? 0));
  const allActual = data.map(d => Number(d[actualKey] ?? 0));
  const maxVal    = Math.max(...allPlan, ...allActual, 1);

  function xOf(i: number) { return PL + (i / (data.length - 1 || 1)) * iW; }
  function yOf(v: number) { return PT + iH - (v / maxVal) * iH; }

  function polyline(vals: number[]) {
    return vals.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');
  }

  const planPts   = polyline(allPlan);
  const actualPts = polyline(allActual);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: 240, overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = PT + iH - t * iH;
        return (
          <g key={t}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--line)" strokeWidth={1} />
            <text x={PL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--muted)">
              {formatVal(t * maxVal)}
            </text>
          </g>
        );
      })}

      {/* X axis labels */}
      {data.filter((_, i) => i % Math.ceil(data.length / 8) === 0 || i === data.length - 1).map((d, _, arr) => {
        const orig = data.findIndex(x => x === d);
        return (
          <text key={orig} x={xOf(orig)} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--muted)">
            {d.label ?? d.period ?? ''}
          </text>
        );
      })}

      {/* Plan curve */}
      <polyline points={planPts} fill="none" stroke={color} strokeWidth={2} strokeDasharray="5 3" opacity={0.7} />

      {/* Actual curve */}
      <polyline points={actualPts} fill="none" stroke={color} strokeWidth={2.5} />

      {/* Dots for actual */}
      {allActual.map((v, i) => v > 0 && (
        <circle key={i} cx={xOf(i)} cy={yOf(v)} r={3} fill={color} />
      ))}

      {/* Legend */}
      <g transform={`translate(${PL},${PT - 2})`}>
        <line x1={0} y1={0} x2={20} y2={0} stroke={color} strokeWidth={2} strokeDasharray="5 3" opacity={0.7} />
        <text x={24} y={4} fontSize={10} fill="var(--muted)">{labelPlan}</text>
        <line x1={80} y1={0} x2={100} y2={0} stroke={color} strokeWidth={2.5} />
        <circle cx={90} cy={0} r={3} fill={color} />
        <text x={104} y={4} fontSize={10} fill="var(--muted)">{labelActual}</text>
      </g>
    </svg>
  );
}

export default function SCurvePage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['scurve', projectId],
    queryFn: () => analyticsService.sCurve(projectId!),
    enabled: !!projectId,
  });

  if (isLoading) return <div className="loading-state">Memuat S-Curve...</div>;
  if (error)     return <div className="danger-box">{extractError(error)}</div>;

  const scurve      = (data as any)?.data ?? {};
  const volumeData: any[] = scurve.volume_curve  ?? [];
  const costData:   any[] = scurve.cost_curve    ?? [];
  const insights:   any[] = scurve.insights      ?? [];
  const deviations: any[] = scurve.deviations    ?? [];

  const latestVol  = volumeData.at(-1);
  const latestCost = costData.at(-1);

  const planVolPct  = latestVol  ? Number(latestVol.plan_cumulative   ?? 0) : 0;
  const actVolPct   = latestVol  ? Number(latestVol.actual_cumulative ?? 0) : 0;
  const devVolPct   = actVolPct - planVolPct;

  const planCost  = latestCost ? Number(latestCost.plan_cumulative   ?? 0) : 0;
  const actCost   = latestCost ? Number(latestCost.actual_cumulative ?? 0) : 0;
  const devCost   = actCost - planCost;

  return (
    <div>
      {/* Header */}
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>S-Curve Plan vs Actual</h3>
            <p>Perbandingan kurva kumulatif rencana dan realisasi — volume pekerjaan dan biaya proyek.</p>
          </div>
          <div className="cluster">
            <span className="chip">Sumber: Baseline WBD Aktif</span>
            <span className={`chip ${devVolPct >= 0 ? 'status-ok' : 'status-bad'}`}>
              Volume {devVolPct >= 0 ? '+' : ''}{devVolPct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* KPI bar */}
        <div className="summary-bar">
          <div className="summary-item">
            <span>Rencana Kumulatif (Vol.)</span>
            <strong>{planVolPct.toFixed(1)}%</strong>
          </div>
          <div className="summary-item">
            <span>Actual Kumulatif (Vol.)</span>
            <strong style={{ color: actVolPct >= planVolPct ? 'var(--ok)' : 'var(--danger)' }}>{actVolPct.toFixed(1)}%</strong>
          </div>
          <div className="summary-item">
            <span>Deviasi Volume</span>
            <strong style={{ color: devVolPct >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
              {devVolPct >= 0 ? '+' : ''}{devVolPct.toFixed(2)}%
            </strong>
          </div>
          <div className="summary-item">
            <span>Deviasi Biaya</span>
            <strong style={{ color: devCost <= 0 ? 'var(--ok)' : 'var(--danger)' }}>
              {devCost > 0 ? '+' : ''}{formatCurrency(devCost)}
            </strong>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        <div className="section-card glass" style={{ margin: 0 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--green-800)' }}>S-Curve Volume Pekerjaan (%)</h4>
          <SCurveChart
            data={volumeData}
            planKey="plan_cumulative"
            actualKey="actual_cumulative"
            labelPlan="Rencana"
            labelActual="Realisasi"
            color="var(--green-700)"
            formatVal={v => `${v.toFixed(0)}%`}
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12 }}>
            <div className="panel-block" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)' }}>Rencana</div>
              <strong>{planVolPct.toFixed(1)}%</strong>
            </div>
            <div className="panel-block" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)' }}>Realisasi</div>
              <strong style={{ color: actVolPct >= planVolPct ? 'var(--ok)' : 'var(--danger)' }}>{actVolPct.toFixed(1)}%</strong>
            </div>
            <div className="panel-block" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)' }}>Deviasi</div>
              <strong style={{ color: devVolPct >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                {devVolPct >= 0 ? '+' : ''}{devVolPct.toFixed(2)}%
              </strong>
            </div>
          </div>
        </div>

        <div className="section-card glass" style={{ margin: 0 }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--green-800)' }}>S-Curve Biaya Kumulatif (Rp)</h4>
          <SCurveChart
            data={costData}
            planKey="plan_cumulative"
            actualKey="actual_cumulative"
            labelPlan="Rencana"
            labelActual="Realisasi"
            color="var(--soil)"
            formatVal={v => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt` : `${(v / 1_000).toFixed(0)}rb`}
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12 }}>
            <div className="panel-block" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)' }}>Rencana</div>
              <strong>{formatCurrency(planCost)}</strong>
            </div>
            <div className="panel-block" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)' }}>Realisasi</div>
              <strong style={{ color: actCost <= planCost ? 'var(--ok)' : 'var(--danger)' }}>{formatCurrency(actCost)}</strong>
            </div>
            <div className="panel-block" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: 'var(--muted)' }}>Deviasi</div>
              <strong style={{ color: devCost <= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                {devCost > 0 ? '+' : ''}{formatCurrency(devCost)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Insights + Deviations */}
      <div className="editor-layout">
        <div className="editor-card glass">
          <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--green-800)' }}>Analisis & Insight</h4>
          {insights.length === 0 ? (
            <div className="empty-state">Belum ada insight tersedia.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {insights.map((ins: any, i: number) => (
                <div key={i} className="panel-block" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>
                    {ins.type === 'warning' ? '⚠️' : ins.type === 'danger' ? '🔴' : '✅'}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ins.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{ins.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section-card glass" style={{ margin: 0 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--green-800)' }}>Deviasi Per Item</h4>
            {deviations.length === 0 ? (
              <div className="empty-state">Tidak ada deviasi signifikan.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {deviations.slice(0, 6).map((d: any, i: number) => {
                  const dev = Number(d.deviation_percent ?? 0);
                  const isNeg = dev < 0;
                  return (
                    <div key={i} className="panel-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{d.code}</div>
                      </div>
                      <span
                        className={`chip ${isNeg ? 'status-bad' : 'status-ok'}`}
                        style={{ fontWeight: 700 }}
                      >
                        {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="section-card glass" style={{ margin: 0 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, color: 'var(--green-800)' }}>Keterangan Kurva</h4>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
              <div className="panel-block">
                <strong style={{ color: 'var(--text)' }}>Garis putus-putus</strong> = Rencana kumulatif (dari WBD baseline).
              </div>
              <div className="panel-block" style={{ marginTop: 8 }}>
                <strong style={{ color: 'var(--text)' }}>Garis solid</strong> = Realisasi kumulatif (progress disetujui PM).
              </div>
              <div className="panel-block" style={{ marginTop: 8 }}>
                Deviasi positif artinya progress di atas rencana (baik untuk volume, buruk untuk biaya).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
