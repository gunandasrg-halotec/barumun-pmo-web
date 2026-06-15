import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import projectService from '../services/projectService';

export default function AppLayout() {
  const { user } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();

  const { data: projects } = useQuery({
    queryKey: ['projects-list-topbar'],
    queryFn: () => projectService.getProjects(),
    select: (res: any) => res.data ?? [],
  });

  const activeProject = projects?.find((p: any) => p.id === projectId);

  const initials = user?.full_name
    ? user.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : 'U';

  function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (id) navigate(`/projects/${id}/dashboard`);
    else navigate('/projects');
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="main">
        {/* Topbar */}
        <div className="topbar">
          <div className="project-pill glass">
            <div style={{ flex: 1, minWidth: 0 }}>
              <label>Project</label>
              <select value={projectId ?? ''} onChange={handleProjectChange}>
                <option value="">— Pilih Proyek —</option>
                {projects?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            </div>
            {activeProject && (
              <div className="cluster">
                <div className={`chip status-${activeProject.status === 'ACTIVE' ? 'ok' : 'warn'}`}>
                  {activeProject.status}
                </div>
                <div className="chip">{activeProject.client_name ?? ''}</div>
              </div>
            )}
          </div>

          <div className="search-box glass">
            <input
              type="text"
              placeholder="Cari item pekerjaan, grup, atau kode..."
              aria-label="Pencarian"
            />
            <p>Filter cepat untuk WBD, status, penanggung jawab, atau item terlambat.</p>
          </div>

          <div className="top-actions glass">
            <div className="chip">Notifikasi</div>
            <div className="chip">{user?.role?.role_name ?? 'User'}</div>
            <div className="avatar">{initials}</div>
          </div>
        </div>

        {/* Page content */}
        <Outlet />
      </main>
    </div>
  );
}
