import { NavLink, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  sub: string;
}

function NavBtn({ to, label, sub }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-btn${isActive ? ' active' : ''}`}
    >
      <strong>{label}</strong>
      <span>{sub}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout, isAdminSistem, isDireksi } = useAuth();
  const { projectId } = useParams();

  const initials = user?.full_name
    ? user.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : 'U';

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-tag">Plantation PMO</div>
        <h1>Project Management Control Center</h1>
        <p>Kelola semua proyek : WBD, biaya, jadwal, progress lapangan, dan pelaporan terintegrasi dalam satu platform.</p>
      </div>

      <nav className="sidebar-nav">
        <div className="menu-group-title">Projects</div>
        <NavBtn to="/projects" label="Dashboard" sub="Ringkasan KPI dan status proyek" />

        {projectId && (
          <>
            <div className="menu-group-title">Planning</div>
            <NavBtn to={`/projects/${projectId}/wbd`}   label="WBD"   sub="Struktur pekerjaan & biaya" />
            <NavBtn to={`/projects/${projectId}/gantt`} label="Gantt" sub="Timeline pekerjaan" />

            <div className="menu-group-title">Execution</div>
            <NavBtn to={`/projects/${projectId}/progress`} label="Progress"  sub="Input realisasi lapangan" />
            <NavBtn to={`/projects/${projectId}/files`}    label="Documents" sub="Kontrak & bukti lapangan" />

            <div className="menu-group-title">Analytics</div>
            <NavBtn to={`/projects/${projectId}/s-curve`}      label="S-Curve"       sub="Plan vs actual" />
            <NavBtn to={`/projects/${projectId}/cost-analysis`} label="Cost Analysis" sub="Biaya & deviasi" />

            <div className="menu-group-title">Reports</div>
            <NavBtn to={`/projects/${projectId}/reports`} label="Reports" sub="Generate laporan" />
          </>
        )}

        <div className="menu-group-title">System</div>
        {isAdminSistem() && (
          <NavBtn to="/admin" label="User Settings" sub="Profil & akses pengguna" />
        )}
        {isDireksi() && (
          <NavBtn to="/wbd-approvals" label="Persetujuan WBD" sub="Review & approve baseline" />
        )}

        <button
          className="nav-btn"
          onClick={logout}
          style={{ marginTop: 8, color: 'rgba(244,243,236,0.7)' }}
        >
          <strong>Keluar</strong>
          <span>{user?.full_name ?? 'Akun saya'}</span>
        </button>
      </nav>

      <div className="menu-group-title">Ekspansi Bertahap</div>
      <div className="future-module">
        <strong>+ Tambah Menu Baru</strong>
        <p>Area ini disiapkan agar modul baru seperti vendor, GPS blok, atau inspeksi HSE bisa ditambahkan tanpa mengubah struktur utama.</p>
      </div>
    </aside>
  );
}
