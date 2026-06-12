import { NavLink, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  project: 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z',
  wbd: 'M3 3h18v18H3z M9 3v18 M3 9h18 M3 15h18',
  gantt: 'M3 4h18M3 8h10M3 12h14M3 16h8M3 20h12',
  progress: 'M22 11.08V12a10 10 0 11-5.93-9.14',
  cost: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z',
  dashboard: 'M18 20V10M12 20V4M6 20v-6',
  scurve: 'M3 20c1-4 3-8 5-10s4-3 6-2 4 4 7 4',
  report: 'M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M15 3h4a2 2 0 012 2v10a2 2 0 01-2 2h-4 M12 8v8 M8 12h8',
  admin: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
};

export default function Sidebar() {
  const { user, logout, isAdminSistem, isDireksi } = useAuth();
  const { projectId } = useParams();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          Project Management
          <small>System v1.0</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Global navigation */}
        <div className="nav-section">
          <div className="nav-section-label">Menu Utama</div>
          <NavLink to="/projects" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon d={ICONS.project} /> Daftar Proyek
          </NavLink>
          {isAdminSistem() && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon d={ICONS.admin} /> Administrasi
            </NavLink>
          )}
          {isDireksi() && (
            <NavLink to="/wbd-approvals" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon d={ICONS.wbd} /> Persetujuan WBD
            </NavLink>
          )}
        </div>

        {/* Project-specific navigation */}
        {projectId && (
          <div className="nav-section">
            <div className="nav-section-label">Proyek Aktif</div>
            <NavLink
              to={`/projects/${projectId}/dashboard`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon d={ICONS.dashboard} /> Dashboard
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/wbd`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon d={ICONS.wbd} /> WBD
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/gantt`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon d={ICONS.gantt} /> Gantt Chart
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/progress`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon d={ICONS.progress} /> Progress
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/costs`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon d={ICONS.cost} /> Biaya Aktual
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/files`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon d={ICONS.file} /> File Repository
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/s-curve`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon d={ICONS.scurve} /> S-Curve
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/cost-analysis`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon d={ICONS.cost} /> Analisis Biaya
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/reports`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon d={ICONS.report} /> Laporan
            </NavLink>
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-name">{user?.full_name}</div>
          <div className="user-role">{user?.role?.name}</div>
        </div>
        <button className="btn btn-sm btn-secondary" style={{ width: '100%' }} onClick={logout}>
          Keluar
        </button>
      </div>
    </div>
  );
}
