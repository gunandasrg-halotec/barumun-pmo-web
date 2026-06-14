import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import ProjectForm from './ProjectForm';
import { formatDate, extractError } from '../../utils/format';

export default function ProjectListPage() {
  const navigate = useNavigate();
  const { canManageWbd, isAdminSistem } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['projects', search, status, page],
    queryFn: () => projectService.list({ search, status: status || undefined, page, limit: 20 }),
  });

  const canCreate = canManageWbd() || isAdminSistem();

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Daftar Proyek</h1>
            <p>Semua proyek yang tersedia dalam sistem</p>
          </div>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Tambah Proyek
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="filter-bar">
            <input
              type="search"
              className="form-control search-input"
              placeholder="Cari proyek..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <select
              className="form-control"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="COMPLETED">Selesai</option>
              <option value="ON_HOLD">Ditahan</option>
              <option value="CANCELLED">Dibatalkan</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={extractError(error)} onRetry={refetch} />
        ) : !data?.data?.length ? (
          <EmptyState
            title="Belum ada proyek"
            message={search ? 'Tidak ada proyek yang cocok dengan pencarian.' : 'Mulai dengan membuat proyek pertama.'}
            action={canCreate ? (
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                + Tambah Proyek
              </button>
            ) : undefined}
          />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Proyek</th>
                    <th>Client</th>
                    <th>Lokasi</th>
                    <th>Periode</th>
                    <th>Status</th>
                    <th>Baseline</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((project) => (
                    <tr key={project.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{project.project_code}</td>
                      <td style={{ fontWeight: 500 }}>{project.project_name}</td>
                      <td>{project.client_name}</td>
                      <td>{project.location}</td>
                      <td style={{ fontSize: 12 }}>
                        {formatDate(project.start_date)} – {formatDate(project.end_date)}
                      </td>
                      <td>
                        <StatusBadge status={project.status} />
                      </td>
                      <td>
                        {project.active_wbd_version ? (
                          <span className="badge badge-success">
                            v{project.active_wbd_version.version_number}
                          </span>
                        ) : (
                          <span className="badge badge-secondary">Belum ada</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => navigate(`/projects/${project.id}/dashboard`)}
                        >
                          Buka
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <Pagination
                page={data.meta.page}
                total={data.meta.total}
                limit={data.meta.limit}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Tambah Proyek Baru"
        size="lg"
      >
        <ProjectForm
          onSuccess={() => { setShowCreate(false); refetch(); }}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  );
}
