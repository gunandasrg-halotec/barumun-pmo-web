import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';
import { projectService } from '../../services/projectService';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatCurrency, formatDate, extractError } from '../../utils/format';

function StatCard({ label, value, sub, color = '' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={`card stat-card`}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color}`}>{value}</div>
      {sub && <div className="stat-sub text-muted text-sm">{sub}</div>}
    </div>
  );
}

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

  if (projectQ.isLoading || dashQ.isLoading) return <LoadingState />;
  if (projectQ.error) return <ErrorState message={extractError(projectQ.error)} />;

  const project = projectQ.data?.data;
  const dash = dashQ.data?.data;

  const shortcuts = [
    { label: '📋 WBD', to: `/projects/${projectId}/wbd`, desc: 'Work Breakdown Detail' },
    { label: '📅 Gantt', to: `/projects/${projectId}/gantt`, desc: 'Jadwal Proyek' },
    { label: '📈 Progress', to: `/projects/${projectId}/progress`, desc: 'Input & Approval' },
    { label: '💰 Biaya', to: `/projects/${projectId}/costs`, desc: 'Actual Cost' },
    { label: '🗂️ Files', to: `/projects/${projectId}/files`, desc: 'Dokumen & Foto' },
    { label: '📊 Laporan', to: `/projects/${projectId}/reports`, desc: 'Generate Laporan' },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>{project?.project_name}</h1>
            <p>{project?.client_name} · {project?.location}</p>
          </div>
          {project && <StatusBadge status={project.status} />}
        </div>
      </div>

      {/* Project info */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div className="grid-3" style={{ gap: 24 }}>
            <div>
              <div className="text-muted text-sm">Kode Proyek</div>
              <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{project?.project_code}</div>
            </div>
            <div>
              <div className="text-muted text-sm">Periode</div>
              <div style={{ fontWeight: 600 }}>
                {formatDate(project?.start_date)} – {formatDate(project?.end_date)}
              </div>
            </div>
            <div>
              <div className="text-muted text-sm">Baseline Aktif</div>
              <div style={{ fontWeight: 600 }}>
                {project?.active_wbd_version
                  ? <span className="badge badge-success">Version {project.active_wbd_version.version_number}</span>
                  : <span className="badge badge-secondary">Belum ada baseline</span>}
              </div>
            </div>
          </div>
          {project?.description && (
            <div style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 13 }}>
              {project.description}
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      {dash && !dash.has_baseline ? (
        <div className="info-box" style={{ marginBottom: 24 }}>
          ℹ️ Proyek ini belum memiliki baseline WBD yang aktif. Buat dan ajukan WBD untuk mulai memantau proyek.
          <Link to={`/projects/${projectId}/wbd`} style={{ marginLeft: 8, fontWeight: 600 }}>
            Kelola WBD →
          </Link>
        </div>
      ) : dash ? (
        <div className="stats-grid">
          <StatCard
            label="Total Baseline Cost"
            value={formatCurrency(dash.total_baseline_cost)}
          />
          <StatCard
            label="Actual Cost (Approved)"
            value={formatCurrency(dash.total_actual_cost_approved)}
          />
          <StatCard
            label="Deviasi Biaya"
            value={formatCurrency(dash.cost_deviation)}
            sub={`${dash.cost_deviation_percent}% dari baseline`}
            color={dash.cost_deviation > 0 ? 'text-danger' : 'text-success'}
          />
          <StatCard
            label="Progress Resmi"
            value={String(dash.total_official_progress_entries)}
            sub="entri approved"
          />
          <StatCard
            label="Menunggu Persetujuan"
            value={String(dash.pending_progress_approval)}
            sub="progress pending"
            color={dash.pending_progress_approval > 0 ? 'text-warning' : ''}
          />
          <StatCard
            label="Review Finance"
            value={String(dash.pending_cost_review)}
            sub="biaya review"
            color={dash.pending_cost_review > 0 ? 'text-warning' : ''}
          />
        </div>
      ) : null}

      {/* Quick navigation */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Navigasi Cepat</div>
        </div>
        <div className="card-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12,
            }}
          >
            {shortcuts.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                style={{
                  display: 'block',
                  padding: '16px',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLElement).style.background = '';
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 6 }}>{s.label.split(' ')[0]}</div>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
                  {s.label.split(' ').slice(1).join(' ')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
