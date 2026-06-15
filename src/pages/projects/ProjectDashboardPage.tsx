import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';
import { projectService } from '../../services/projectService';
import { formatCurrency, formatDate, extractError } from '../../utils/format';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PLANNING:  { label: 'Planning',   cls: 'planned' },
  ACTIVE:    { label: 'Berjalan',   cls: 'running' },
  ON_HOLD:   { label: 'On Hold',    cls: 'delay'   },
  COMPLETED: { label: 'Selesai',    cls: 'done'    },
  CANCELLED: { label: 'Dibatalkan', cls: 'delay'   },
};

const SHORTCUTS = [
  { label: 'WBD',           sub: 'Struktur pekerjaan & biaya',  path: 'wbd'           },
  { label: 'Gantt',         sub: 'Timeline pekerjaan',          path: 'gantt'         },
  { label: 'Progress',      sub: 'Input realisasi lapangan',     path: 'progress'      },
  { label: 'Documents',     sub: 'Kontrak & bukti lapangan',     path: 'files'         },
  { label: 'S-Curve',       sub: 'Plan vs actual',              path: 's-curve'       },
  { label: 'Cost Analysis', sub: 'Biaya & deviasi',             path: 'cost-analysis' },
  { label: 'Reports',       sub: 'Generate laporan',            path: 'reports'       },
];

const GROUP_COLORS = [
  'linear-gradient(90deg, #2d7d46, #68a56c)',
  'linear-gradient(90deg, #8c6a18, #cf9f3c)',
  'linear-gradient(90deg, #4d7f79, #6cb0a7)',
  'linear-gradient(90deg, #a95d35, #d8824d)',
  'linear-gradient(90deg, #87553f, #c08257)',
  'linear-gradient(90deg, #58656f, #7b8b97)',
];

export default function ProjectDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const projectQ = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.get(projectId!),
    enabled: !!projectId,
  });

  const dashQ = useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => analyticsService.dashboard(projectId!),
    enabled: !!projectId,
  });

  if (projectQ.isLoading || dashQ.isLoading) {
    return <div className="loading-state">Memuat dashboard proyek...</div>;
  }
  if (projectQ.error) {
    return <div className="danger-box">{extractError(projectQ.error)}</div>;
  }

  const project = (projectQ.data as any)?.data;
  const dash    = (dashQ.data as any)?.data;
  const st      = STATUS_MAP[project?.status] ?? { label: project?.status, cls: 'planned' };

  const totalCost    = dash?.total_baseline_cost    ?? 0;
  const actualCost   = dash?.total_actual_cost_approved ?? 0;
  const deviation    = dash?.cost_deviation_percent ?? 0;
  const progressPct  = dash?.overall_progress_percent ?? 0;

  const nodes: any[] = dash?.nodes ?? [];
  const groups = nodes.filter((n: any) => n.node_type === 'GROUP');

  return (
    <div>
      {/* Hero */}
      <div className="hero">
        <div className="hero-card">
          <div className="brand-tag">Executive Overview</div>
          <h3>{project?.project_name}</h3>
          <p>{project?.client_name} · {project?.location} · {formatDate(project?.start_date)} – {formatDate(project?.end_date)}</p>
          <div className="hero-grid">
            <div className="hero-stat">
              <strong>{formatCurrency(totalCost)}</strong>
              <span>Total biaya baseline</span>
            </div>
            <div className="hero-stat">
              <strong>{progressPct}%</strong>
              <span>Progress resmi kumulatif</span>
            </div>
            <div className="hero-stat">
              <strong>{project?.active_wbd_version ? `v${project.active_wbd_version.version_number}` : '—'}</strong>
              <span>Baseline aktif</span>
            </div>
          </div>
        </div>

        <div className="metrics">
          <div className="kpi glass">
            <label>Total Biaya Proyek</label>
            <strong>{formatCurrency(totalCost)}</strong>
            <div className="kpi-bar"><i style={{ width: '82%' }}></i></div>
          </div>
          <div className="kpi glass">
            <label>Biaya Realisasi (Approved)</label>
            <strong>{formatCurrency(actualCost)}</strong>
            <div className="kpi-bar"><i style={{ width: `${Math.min(100, (actualCost / (totalCost || 1)) * 100)}%` }}></i></div>
          </div>
          <div className="kpi glass">
            <label>Deviasi Biaya</label>
            <strong style={{ color: deviation > 0 ? 'var(--danger)' : 'var(--ok)' }}>
              {deviation > 0 ? '+' : ''}{deviation}%
            </strong>
            <div className="kpi-bar">
              <i style={{ width: `${Math.min(100, Math.abs(deviation) * 5)}%`, background: deviation > 0 ? 'linear-gradient(90deg, var(--soil), var(--danger))' : undefined }}></i>
            </div>
          </div>
        </div>
      </div>

      {/* No baseline warning */}
      {!dash?.has_baseline && (
        <div className="danger-box" style={{ marginBottom: 18 }}>
          Proyek ini belum memiliki baseline WBD yang aktif. Buat dan ajukan WBD untuk mulai memantau proyek.{' '}
          <Link to={`/projects/${projectId}/wbd`} style={{ color: 'var(--green-700)', fontWeight: 600 }}>
            Kelola WBD →
          </Link>
        </div>
      )}

      {/* Group progress */}
      {groups.length > 0 && (
        <div className="section-card glass" style={{ marginBottom: 18 }}>
          <div className="section-title">
            <div>
              <h3>Progress Per Grup Pekerjaan</h3>
              <p>Capaian progress berdasarkan grup WBD aktif.</p>
            </div>
            <div className="cluster">
              <span className={`chip status-${st.cls}`}>{st.label}</span>
            </div>
          </div>
          <div className="progress-list" style={{ marginTop: 0 }}>
            {groups.map((g: any, i: number) => {
              const pct = Math.min(100, Math.round((g.progress_percent ?? 0)));
              return (
                <div className="progress-row" key={g.id}>
                  <div className="progress-head">
                    <strong>{g.node_name}</strong>
                    <span>Bobot {g.weight_percent ?? '—'}%</span>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${pct}%`, background: GROUP_COLORS[i % GROUP_COLORS.length] }}></i>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="empty-state" style={{ marginTop: 12, display: groups.length ? 'none' : 'block' }}>
            Belum ada data progress. Tambahkan WBD baseline terlebih dahulu.
          </div>
        </div>
      )}

      {/* Quick nav */}
      <div className="section-card glass">
        <div className="section-title">
          <div>
            <h3>Navigasi Cepat</h3>
            <p>Akses langsung ke semua modul proyek.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {SHORTCUTS.map(s => (
            <Link
              key={s.path}
              to={`/projects/${projectId}/${s.path}`}
              className="nav-btn"
              style={{
                background: 'rgba(255,255,255,0.85)',
                color: 'var(--text)',
                border: '1px solid var(--line)',
                textDecoration: 'none',
              }}
            >
              <strong style={{ color: 'var(--green-800)' }}>{s.label}</strong>
              <span style={{ color: 'var(--muted)' }}>{s.sub}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Pending approvals summary */}
      {dash && (dash.pending_progress_approval > 0 || dash.pending_cost_review > 0) && (
        <div className="section-card glass" style={{ marginTop: 18 }}>
          <div className="section-title">
            <div><h3>Perlu Perhatian</h3></div>
          </div>
          <div className="summary-bar" style={{ position: 'static' }}>
            <div className="summary-item">
              <span>Progress Menunggu Approval</span>
              <strong style={{ color: 'var(--warning)' }}>{dash.pending_progress_approval}</strong>
            </div>
            <div className="summary-item">
              <span>Biaya Menunggu Review</span>
              <strong style={{ color: 'var(--warning)' }}>{dash.pending_cost_review}</strong>
            </div>
            <div className="summary-item">
              <span>Total Progress Entries</span>
              <strong>{dash.total_official_progress_entries}</strong>
            </div>
            <div className="summary-item">
              <span>Status Proyek</span>
              <strong><span className={`badge ${st.cls}`}>{st.label}</span></strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
