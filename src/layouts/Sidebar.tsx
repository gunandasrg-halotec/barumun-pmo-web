import { useState, useRef, useEffect } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { notificationService, type AppNotification } from '../services/notificationService';

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

function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.list,
    refetchInterval: 60_000,
  });

  const notifications: AppNotification[] = data?.data ?? [];
  const unread = data?.unread ?? 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleMarkAll() {
    await notificationService.markAllRead();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function handleMarkOne(id: string, alreadyRead: boolean) {
    if (!alreadyRead) {
      await notificationService.markRead(id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="nav-btn"
        style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}
      >
        <div>
          <strong>Notifikasi</strong>
          <span>Peringatan & info sistem</span>
        </div>
        {unread > 0 && (
          <span style={{
            background: 'var(--danger, #dc2626)',
            color: '#fff',
            borderRadius: 99,
            fontSize: 10,
            fontWeight: 700,
            minWidth: 18,
            height: 18,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
            flexShrink: 0,
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          left: '100%',
          top: 0,
          marginLeft: 8,
          width: 340,
          background: 'var(--surface, #fff)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,.15)',
          zIndex: 1000,
          maxHeight: 480,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <strong style={{ fontSize: 14, color: 'var(--text)' }}>Notifikasi</strong>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: 'var(--green-700)',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Tandai Semua Dibaca
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                Tidak ada notifikasi.
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleMarkOne(n.id, !!n.read_at)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--line)',
                    background: n.read_at ? 'transparent' : 'rgba(37,99,235,0.05)',
                    cursor: n.read_at ? 'default' : 'pointer',
                  }}
                >
                  <div style={{ fontWeight: n.read_at ? 400 : 600, fontSize: 13, color: 'var(--text)' }}>
                    {n.type === 'OVER_BUDGET_RISK' && <span style={{ marginRight: 4 }}>⚠</span>}
                    {n.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    {new Date(n.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                    {!n.read_at && (
                      <span style={{
                        marginLeft: 8,
                        background: 'var(--danger, #dc2626)',
                        color: '#fff',
                        borderRadius: 4,
                        padding: '1px 5px',
                        fontSize: 10,
                        fontWeight: 600,
                      }}>Baru</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
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
          <>
            <NavBtn to="/wbd-approvals" label="Persetujuan WBD" sub="Review & approve baseline" />
            <NotificationBell />
          </>
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
