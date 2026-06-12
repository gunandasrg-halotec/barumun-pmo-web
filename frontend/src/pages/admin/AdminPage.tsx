import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService } from '../../services/fileService';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import LoadingState from '../../components/ui/LoadingState';
import Modal from '../../components/ui/Modal';
import { formatDateTime, extractError } from '../../utils/format';

export default function AdminPage() {
  const { isAdminSistem } = useAuth();
  if (!isAdminSistem()) return <Navigate to="/projects" />;

  const [activeTab, setActiveTab] = useState<'users' | 'categories'>('users');

  return (
    <div>
      <div className="page-header">
        <h1>Administrasi Sistem</h1>
        <p>Kelola user, role, dan master data</p>
      </div>

      <div className="flex-row" style={{ marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {(['users', 'categories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', padding: '10px 16px', cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1, fontSize: 13,
            }}
          >
            {tab === 'users' ? '👥 Kelola User' : '🏷️ Kategori File'}
          </button>
        ))}
      </div>

      {activeTab === 'users' ? <UsersManagement /> : <FileCategoryManagement />}
    </div>
  );
}

function UsersManagement() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const rolesQ = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data),
  });

  const users = usersQ.data?.data ?? [];
  const roles = rolesQ.data?.data ?? [];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Manajemen User</div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Tambah User</button>
      </div>
      {usersQ.isLoading ? <LoadingState /> : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td><span className="badge badge-secondary">{u.role?.name}</span></td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        api.patch(`/users/${u.id}`, { is_active: !u.is_active })
                          .then(() => queryClient.invalidateQueries({ queryKey: ['users'] }));
                      }}
                    >
                      {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Tambah User">
        <UserCreateForm
          roles={roles}
          onSuccess={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['users'] }); }}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  );
}

function UserCreateForm({ roles, onSuccess, onCancel }: any) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role_id: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post('/users', form);
      onSuccess();
    } catch (err) { setError(extractError(err)); }
    finally { setIsLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-group">
        <label className="form-label">Nama Lengkap <span className="required">*</span></label>
        <input type="text" className="form-control" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} required />
      </div>
      <div className="form-group">
        <label className="form-label">Email <span className="required">*</span></label>
        <input type="email" className="form-control" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
      </div>
      <div className="form-group">
        <label className="form-label">Password <span className="required">*</span></label>
        <input type="password" className="form-control" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required minLength={8} />
      </div>
      <div className="form-group">
        <label className="form-label">Role <span className="required">*</span></label>
        <select className="form-control" value={form.role_id} onChange={(e) => setForm((p) => ({ ...p, role_id: e.target.value }))} required>
          <option value="">Pilih role...</option>
          {roles.map((r: any) => <option key={r.id} value={r.id}>{r.role_name}</option>)}
        </select>
      </div>
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Menyimpan...' : 'Tambah User'}
        </button>
      </div>
    </form>
  );
}

function FileCategoryManagement() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const catQ = useQuery({
    queryKey: ['file-categories-all'],
    queryFn: () => fileService.listCategories(false),
  });

  const categories = catQ.data?.data ?? [];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Kategori File</div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Tambah Kategori</button>
      </div>
      {catQ.isLoading ? <LoadingState /> : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Nama Kategori</th><th>Deskripsi</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {categories.map((c: any) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.category_name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.description ?? '—'}</td>
                  <td>
                    <span className={`badge ${c.is_active ? 'badge-success' : 'badge-secondary'}`}>
                      {c.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        fileService.updateCategory(c.id, { is_active: !c.is_active })
                          .then(() => queryClient.invalidateQueries({ queryKey: ['file-categories-all'] }));
                      }}
                    >
                      {c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Tambah Kategori File">
        <CategoryCreateForm
          onSuccess={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['file-categories-all'] }); }}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  );
}

function CategoryCreateForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ category_name: '', description: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await fileService.createCategory(form);
      onSuccess();
    } catch (err) { setError(extractError(err)); }
    finally { setIsLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-group">
        <label className="form-label">Nama Kategori <span className="required">*</span></label>
        <input type="text" className="form-control" value={form.category_name} onChange={(e) => setForm((p) => ({ ...p, category_name: e.target.value }))} required />
      </div>
      <div className="form-group">
        <label className="form-label">Deskripsi</label>
        <input type="text" className="form-control" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </div>
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>Tambah</button>
      </div>
    </form>
  );
}
