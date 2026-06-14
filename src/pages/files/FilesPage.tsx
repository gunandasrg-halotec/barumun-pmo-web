import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService } from '../../services/fileService';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { formatDate, formatDateTime, extractError } from '../../utils/format';

export default function FilesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { canManageFiles } = useAuth();
  const queryClient = useQueryClient();

  const [fileType, setFileType] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [showUpload, setShowUpload] = useState(false);

  const categoriesQ = useQuery({ queryKey: ['file-categories'], queryFn: () => fileService.listCategories() });
  const filesQ = useQuery({
    queryKey: ['files', projectId, fileType, categoryId, page],
    queryFn: () => fileService.listFiles(projectId!, { file_type: fileType || undefined, file_category_id: categoryId || undefined, page, limit: 20 }),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => fileService.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files', projectId] }),
  });

  const files = filesQ.data?.data ?? [];
  const meta = filesQ.data?.meta;
  const categories = categoriesQ.data?.data ?? [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>File Repository</h1>
            <p>Dokumen dan foto proyek</p>
          </div>
          {canManageFiles() && (
            <button className="btn btn-primary" onClick={() => setShowUpload(true)}>+ Upload File</button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="filter-bar">
            <select className="form-control" value={fileType} onChange={(e) => { setFileType(e.target.value); setPage(1); }}>
              <option value="">Semua Tipe</option>
              <option value="DOCUMENT">Dokumen</option>
              <option value="IMAGE">Foto / Gambar</option>
            </select>
            <select className="form-control" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
              <option value="">Semua Kategori</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.category_name}</option>)}
            </select>
          </div>
        </div>

        {filesQ.isLoading ? <LoadingState /> :
          files.length === 0 ? (
            <EmptyState title="Belum ada file" message="Upload dokumen atau foto proyek." />
          ) : (
            <>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nama File</th>
                      <th>Tipe</th>
                      <th>Kategori</th>
                      <th>Caption/Tanggal Foto</th>
                      <th>Entitas Terkait</th>
                      <th>Diupload Oleh</th>
                      <th>Waktu Upload</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{f.original_file_name}</div>
                          <div className="text-sm text-muted">{f.mime_type}</div>
                        </td>
                        <td>
                          <span className={`badge ${f.file_type === 'IMAGE' ? 'badge-info' : 'badge-secondary'}`}>
                            {f.file_type === 'IMAGE' ? '🖼️ Foto' : '📄 Dokumen'}
                          </span>
                        </td>
                        <td>{f.file_category?.name ?? '—'}</td>
                        <td>
                          {f.caption && <div style={{ fontWeight: 500 }}>{f.caption}</div>}
                          {f.photo_date && <div className="text-sm text-muted">{formatDate(f.photo_date)}</div>}
                          {!f.caption && !f.photo_date && '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {f.related_entity_type ? `${f.related_entity_type}` : '—'}
                        </td>
                        <td>{f.uploaded_by?.full_name ?? '—'}</td>
                        <td style={{ fontSize: 12 }}>{formatDateTime(f.uploaded_at)}</td>
                        <td>
                          {canManageFiles() && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => { if (window.confirm('Arsipkan file ini?')) archiveMut.mutate(f.id); }}
                            >
                              Arsipkan
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {meta && (
                <div style={{ padding: '16px 20px' }}>
                  <Pagination page={meta.page} total={meta.total} limit={meta.limit} onChange={setPage} />
                </div>
              )}
            </>
          )
        }
      </div>

      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Upload File" size="lg">
        <FileUploadForm
          projectId={projectId!}
          categories={categories}
          onSuccess={() => { setShowUpload(false); queryClient.invalidateQueries({ queryKey: ['files', projectId] }); }}
          onCancel={() => setShowUpload(false)}
        />
      </Modal>
    </div>
  );
}

function FileUploadForm({ projectId, categories, onSuccess, onCancel }: any) {
  const [fileType, setFileType] = useState('DOCUMENT');
  const [categoryId, setCategoryId] = useState('');
  const [caption, setCaption] = useState('');
  const [photoDate, setPhotoDate] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setError('Pilih file terlebih dahulu.'); return; }
    if (fileType === 'IMAGE' && (!caption || !photoDate)) {
      setError('Caption dan tanggal foto wajib diisi untuk file foto.');
      return;
    }
    setError('');
    setIsLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('file_type', fileType);
    fd.append('file_category_id', categoryId);
    if (caption) fd.append('caption', caption);
    if (photoDate) fd.append('photo_date', photoDate);
    if (note) fd.append('note', note);
    try {
      await fileService.upload(projectId, fd);
      onSuccess();
    } catch (err) { setError(extractError(err)); }
    finally { setIsLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Tipe File <span className="required">*</span></label>
          <select className="form-control" value={fileType} onChange={(e) => setFileType(e.target.value)}>
            <option value="DOCUMENT">📄 Dokumen</option>
            <option value="IMAGE">🖼️ Foto / Gambar</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Kategori <span className="required">*</span></label>
          <select className="form-control" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">Pilih kategori...</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.category_name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">File <span className="required">*</span></label>
        <input type="file" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
      </div>
      {fileType === 'IMAGE' && (
        <>
          <div className="form-group">
            <label className="form-label">Caption <span className="required">*</span></label>
            <input type="text" className="form-control" value={caption} onChange={(e) => setCaption(e.target.value)} required placeholder="Deskripsi foto" />
          </div>
          <div className="form-group">
            <label className="form-label">Tanggal Foto <span className="required">*</span></label>
            <input type="date" className="form-control" value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} required />
          </div>
        </>
      )}
      <div className="form-group">
        <label className="form-label">Catatan</label>
        <textarea className="form-control" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Mengupload...' : 'Upload File'}
        </button>
      </div>
    </form>
  );
}
