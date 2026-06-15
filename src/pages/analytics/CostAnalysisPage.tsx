import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';
import { formatCurrency, formatNumber, extractError } from '../../utils/format';

const GROUP_COLORS = [
  'var(--green-700)',
  'var(--soil)',
  '#6cb0a7',
  '#d8824d',
  '#c08257',
  '#7b8b97',
];

function WeightBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 44, textAlign: 'right', color }}>{pct.toFixed(2)}%</span>
    </div>
  );
}

export default function CostAnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['cost-analysis', projectId],
    queryFn: () => analyticsService.costAnalysis(projectId!),
    enabled: !!projectId,
  });

  if (isLoading) return <div className="loading-state">Memuat analisis biaya...</div>;
  if (error)     return <div className="danger-box">{extractError(error)}</div>;

  const analysis: any   = (data as any)?.data ?? {};
  const items: any[]    = analysis.items ?? [];
  const groups: any[]   = analysis.groups ?? [];
  const summary: any    = analysis.summary ?? {};

  const totalPlan   = Number(summary.total_baseline_cost ?? 0);
  const totalActual = Number(summary.total_actual_cost ?? 0);
  const deviation   = totalActual - totalPlan;
  const devPct      = totalPlan > 0 ? (deviation / totalPlan) * 100 : 0;

  return (
    <div>
      {/* Header */}
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>Cost Analysis — Biaya & Bobot</h3>
            <p>Analisis biaya rencana vs realisasi per item WBD beserta bobot komponen dan deviasi.</p>
          </div>
          <div className="cluster">
            <span className={`chip ${devPct <= 0 ? 'status-ok' : devPct <= 5 ? 'status-warn' : 'status-bad'}`}>
              Deviasi {devPct > 0 ? '+' : ''}{devPct.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="summary-bar">
          <div className="summary-item">
            <span>Total Biaya Rencana</span>
            <strong>{formatCurrency(totalPlan)}</strong>
          </div>
          <div className="summary-item">
            <span>Total Biaya Realisasi</span>
            <strong style={{ color: totalActual > totalPlan ? 'var(--danger)' : 'var(--ok)' }}>
              {formatCurrency(totalActual)}
            </strong>
          </div>
          <div className="summary-item">
            <span>Deviasi</span>
            <strong style={{ color: deviation > 0 ? 'var(--danger)' : deviation < 0 ? 'var(--ok)' : 'inherit' }}>
              {deviation > 0 ? '+' : ''}{formatCurrency(deviation)}
            </strong>
          </div>
          <div className="summary-item">
            <span>% Deviasi</span>
            <strong style={{ color: devPct > 0 ? 'var(--danger)' : devPct < 0 ? 'var(--ok)' : 'inherit' }}>
              {devPct > 0 ? '+' : ''}{devPct.toFixed(2)}%
            </strong>
          </div>
        </div>
      </div>

      {/* Main layout: table + weight sidebar */}
      <div className="editor-layout" style={{ alignItems: 'flex-start' }}>
        {/* Analysis table */}
        <div className="editor-card glass" style={{ overflow: 'hidden' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--green-800)' }}>Rincian Biaya Per Item WBD</h4>
          {items.length === 0 ? (
            <div className="empty-state">Belum ada data biaya. Pastikan proyek memiliki baseline aktif dan progress diinput.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Uraian</th>
                    <th>Satuan</th>
                    <th>Vol. Rencana</th>
                    <th>Tarif</th>
                    <th>Biaya Rencana</th>
                    <th>Biaya Realisasi</th>
                    <th>Deviasi</th>
                    <th>% Bobot</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => {
                    const isGroup     = item.node_type === 'GROUP';
                    const plan        = Number(item.planned_cost ?? 0);
                    const actual      = Number(item.actual_cost ?? 0);
                    const dev         = actual - plan;
                    const devPctItem  = plan > 0 ? (dev / plan) * 100 : 0;
                    const isOver      = dev > 0;
                    const weight      = Number(item.weight_percent ?? item.total_percent ?? 0);

                    return (
                      <tr
                        key={item.id ?? idx}
                        className={isGroup ? 'group-row' : item.depth >= 2 ? 'indent-2' : 'indent-1'}
                      >
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.code}</td>
                        <td style={{ paddingLeft: isGroup ? undefined : `${(item.depth ?? 1) * 14}px` }}>
                          <div style={{ fontWeight: isGroup ? 700 : 500 }}>{item.name}</div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{item.unit ?? '—'}</td>
                        <td style={{ fontSize: 12 }}>{item.volume != null ? formatNumber(Number(item.volume)) : '—'}</td>
                        <td style={{ fontSize: 12 }}>{item.rate != null ? formatCurrency(Number(item.rate)) : '—'}</td>
                        <td style={{ fontSize: 12, fontWeight: isGroup ? 700 : 500 }}>{formatCurrency(plan)}</td>
                        <td style={{ fontSize: 12, fontWeight: 600, color: isOver ? 'var(--danger)' : actual > 0 ? 'var(--ok)' : 'inherit' }}>
                          {actual > 0 ? formatCurrency(actual) : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: isOver ? 'var(--danger)' : dev < 0 ? 'var(--ok)' : 'var(--muted)' }}>
                          {actual > 0
                            ? <>{dev > 0 ? '+' : ''}{formatCurrency(dev)}<br /><span style={{ fontSize: 10 }}>({devPctItem > 0 ? '+' : ''}{devPctItem.toFixed(1)}%)</span></>
                            : '—'
                          }
                        </td>
                        <td style={{ fontSize: 12 }}>{weight > 0 ? `${weight.toFixed(2)}%` : '—'}</td>
                        <td>
                          {isOver
                            ? <span className="badge delay">Over Budget</span>
                            : actual > 0 && actual <= plan
                              ? <span className="badge done">On Budget</span>
                              : <span className="badge planned">Belum Ada</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                  {/* Grand total row */}
                  <tr className="grand-row">
                    <td></td>
                    <td>Total Biaya Proyek</td>
                    <td></td><td></td><td></td>
                    <td style={{ fontWeight: 800 }}>{formatCurrency(totalPlan)}</td>
                    <td style={{ fontWeight: 800, color: totalActual > totalPlan ? 'var(--danger)' : 'var(--ok)' }}>{formatCurrency(totalActual)}</td>
                    <td style={{ fontWeight: 800, color: deviation > 0 ? 'var(--danger)' : deviation < 0 ? 'var(--ok)' : 'inherit' }}>
                      {deviation > 0 ? '+' : ''}{formatCurrency(deviation)}
                    </td>
                    <td style={{ fontWeight: 800 }}>100%</td>
                    <td>
                      <span className={`badge ${devPct <= 0 ? 'done' : devPct <= 5 ? 'running' : 'delay'}`}>
                        {devPct <= 0 ? 'On Track' : devPct <= 5 ? 'Warning' : 'Over'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Weight panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {/* Bobot per grup */}
          <div className="section-card glass" style={{ margin: 0 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--green-800)' }}>Bobot Per Grup Pekerjaan</h4>
            {groups.length === 0 ? (
              <div className="empty-state">Belum ada data.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {groups.map((g: any, i: number) => {
                  const plan    = Number(g.planned_cost ?? 0);
                  const actual  = Number(g.actual_cost  ?? 0);
                  const weight  = Number(g.weight_percent ?? g.total_percent ?? 0);
                  const isOver  = actual > plan && plan > 0;
                  const color   = GROUP_COLORS[i % GROUP_COLORS.length];

                  return (
                    <div key={g.id ?? i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color }}>
                          {String.fromCharCode(65 + i)}. {g.name}
                        </span>
                        <span className={`badge ${isOver ? 'delay' : actual > 0 ? 'done' : 'planned'}`} style={{ fontSize: 10 }}>
                          {isOver ? 'Over' : actual > 0 ? 'On Budget' : 'Belum Ada'}
                        </span>
                      </div>
                      <WeightBar pct={weight} color={color} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        <span>Rencana: {formatCurrency(plan)}</span>
                        <span>Realisasi: {actual > 0 ? formatCurrency(actual) : '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cost health indicator */}
          <div className="section-card glass" style={{ margin: 0 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--green-800)' }}>Status Kesehatan Biaya</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              {[
                { label: 'On Budget', cls: 'done', count: items.filter((i: any) => { const a = Number(i.actual_cost ?? 0); const p = Number(i.planned_cost ?? 0); return a > 0 && a <= p; }).length },
                { label: 'Over Budget', cls: 'delay', count: items.filter((i: any) => Number(i.actual_cost ?? 0) > Number(i.planned_cost ?? 0) && Number(i.planned_cost ?? 0) > 0).length },
                { label: 'Belum Ada Realisasi', cls: 'planned', count: items.filter((i: any) => Number(i.actual_cost ?? 0) === 0 && i.node_type === 'ITEM').length },
              ].map(s => (
                <div key={s.label} className="panel-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <strong>{s.count} item</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
