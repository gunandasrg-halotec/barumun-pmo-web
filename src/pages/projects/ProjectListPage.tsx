import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';
import ProjectForm from './ProjectForm';
import { formatDate, extractError } from '../../utils/format';

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PLANNING:  { label: 'Planning',  cls: 'planned'  },
  ACTIVE:    { label: 'Berjalan',  cls: 'running'  },
  ON_HOLD:   { label: 'On Hold',   cls: 'delay'    },
  COMPLETED: { label: 'Selesai',   cls: 'done'     },
  CANCELLED: { label: 'Dibatalkan',cls: 'delay'    },
};

export default function ProjectListPage() {
  const navigate = useNavigate();
  const { canManageWbd, isAdminSistem } = useAuth();
  const [search, setSearch]       = useState('');
  const [status, setStatus]       = useState('');
  const [page, setPage]           = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects', search, status, page],
    queryFn: () => projectService.list({ search, status: status || undefined, page, limit: 20 }),
  });

  const canCreate = canManageWbd() || isAdminSistem();
  const projects  = (data as any)?.data ?? [];
  const meta      = (data as any)?.meta;

  return (
    <div>
      {/* Hero */}
      <div className="hero" style={{ marginBottom: 20 }}>
        <div className="hero-card">
          <div className="brand-tag">Executive Overview</div>
          <h3>Project Management Control Center</h3>
          <p>Kelola semua proyek : WBD, biaya, jadwal, progress lapangan, dan pelaporan terintegrasi dalam satu platform.</p>
          <div className="hero-grid">
            <div className="hero-stat"><strong>{meta?.total ?? '—'}</strong><span>Total proyek</span></div>
            <div className="hero-stat"><strong>{projects.filter((p: any) => p.status === 'ACTIVE').length}</strong><span>Proyek aktif</span></div>
            <div className="hero-stat"><strong>{projects.filter((p: any) => p.active_wbd_version).length}</strong><span>Punya baseline</span></div>
          </div>
        </div>
        <div className="metrics">
          <div className="kpi glass">
            <label>Proyek Berjalan</label>
            <strong>{projects.filter((p: any) => p.status === 'ACTIVE').length} Proyek</strong>
            <div className="kpi-bar"><i style={{ width: '75%' }}></i></div>
          </div>
          <div className="kpi glass">
            <label>Sudah Ada Baseline</label>
            <strong>{projects.filter((p: any) => p.active_wbd_version).length} Proyek</strong>
            <div className="kpi-bar"><i style={{ width: '60%' }}></i></div>
          </div>
          <div className="kpi glass">
            <label>On Hold / Dibatalkan</label>
            <strong>{projects.filter((p: any) => ['ON_HOLD','CANCELLED'].includes(p.status)).length} Proyek</strong>
            <div className="kpi-bar"><i style={{ width: '15%', background: 'linear-gradient(90deg, var(--soil), var(--danger))' }}></i></div>
          </div>
        </div>
      </div>

      {/* Project list card */}
      <div className="section-card glass">
        <div className="section-title">
          <div>
            <h3>Daftar Proyek</h3>
            <p>Pilih proyek untuk masuk ke dashboard, WBD, gantt, progress, dan laporan.</p>
          </div>
          <div className="cluster">
            {canCreate && (
              <button className="btn" onClick={() => setShowCreate(true)}>
                + Tambah Proyek
              </button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <input
            type="search"
            className="stretch"
            placeholder="Cari nama atau kode proyek..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Semua Status</option>
            <option value="PLANNING">Planning</option>
            <option value="ACTIVE">Aktif</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
        </div>

        {isLoading ? (
          <div className="loading-state">Memuat daftar proyek...</div>
        ) : error ? (
          <div className="danger-box">{extractError(error)} — <button className="btn secondary" style={{ marginLeft: 8 }} onClick={() => refetch()}>Coba Lagi</button></div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            {search ? 'Tidak ada proyek yang cocok dengan pencarian.' : 'Belum ada proyek. Mulai dengan membuat proyek pertama.'}
            {canCreate && !search && (
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setShowCreate(true)}>+ Tambah Proyek</button>
              </div>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama Proyek</th>
                  <th>Client / Kebun</th>
                  <th>Lokasi</th>
                  <th>Periode</th>
                  <th>Status</th>
                  <th>Baseline</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p: any) => {
                  const st = STATUS_MAP[p.status] ?? { label: p.status, cls: 'planned' };
                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.project_code}</td>
                      <td style={{ fontWeight: 600 }}>{p.project_name}</td>
                      <td>{p.client_name}</td>
                      <td>{p.location}</td>
                      <td style={{ fontSize: 12 }}>{formatDate(p.start_date)} – {formatDate(p.end_date)}</td>
                      <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                      <td>
                        {p.active_wbd_version
                          ? <span className="badge done">v{p.active_wbd_version.version_number}</span>
                          : <span className="badge planned">Belum ada</span>
                        }
                      </td>
                      <td>
                        <button
                          className="chip clickable"
                          onClick={() => navigate(`/projects/${p.id}/dashboard`)}
                        >
                          Buka →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.total > meta.limit && (
          <div style={{ display: 'flex', gap: 8, padding: '14px 0 0', alignItems: 'center', fontSize: 13 }}>
            <button className="btn secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ color: 'var(--muted)' }}>Halaman {meta.page} dari {Math.ceil(meta.total / meta.limit)}</span>
            <button className="btn secondary" disabled={page >= Math.ceil(meta.total / meta.limit)} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="modal-window">
            <div className="modal-head">
              <div>
                <h4>Tambah Proyek Baru</h4>
                <p>Isi detail proyek replanting yang akan dikelola.</p>
              </div>
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="modal-body">
              <ProjectForm
                onSuccess={() => { setShowCreate(false); refetch(); }}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
