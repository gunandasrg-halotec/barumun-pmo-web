import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService } from '../../services/fileService';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatDateTime, extractError } from '../../utils/format';

const BADGE_CLASSES: Record<string, string> = {
  'Kontrak':          'done',
  'Foto Lapangan':    'running',
  'Laporan':          'planned',
  'Invoice':          'delay',
  'Perizinan':        'running',
  'Berita Acara':     'planned',
  'Approval':         'done',
  'Bukti Pembayaran': 'delay',
  'Lainnya':          'planned',
};

const FILE_ICONS: Record<string, string> = {
  pdf:  '📄',
  jpg:  '🖼',
  jpeg: '🖼',
  png:  '🖼',
  xlsx: '📊',
  xls:  '📊',
  docx: '📝',
  doc:  '📝',
  zip:  '🗜',
};

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return FILE_ICONS[ext] ?? '📎';
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function catName(f: any): string {
  return f.file_category?.category_name ?? '—';
}

function catClass(f: any): string {
  return BADGE_CLASSES[catName(f)] ?? 'planned';
}

export default function FilesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { canManageFiles } = useAuth();
  const queryClient = useQueryClient();

  const [categoryFilter, setCategoryFilter] = useState('');
  const [search,         setSearch]         = useState('');
  const [showUpload,     setShowUpload]      = useState(false);
  const [previewFile,    setPreviewFile]     = useState<any>(null);

  const categoriesQ = useQuery({
    queryKey: ['file-categories'],
    queryFn: () => fileService.listCategories(true),
  });
  const categories: any[] = (categoriesQ.data as any)?.data ?? [];

  const filesQ = useQuery({
    queryKey: ['files', projectId, categoryFilter, search],
    queryFn: () => fileService.listFiles(projectId!, { file_category_id: categoryFilter || undefined, search: search || undefined }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fileService.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files', projectId] }),
  });

  const files: any[] = (filesQ.data as any)?.data ?? [];

  // Group by category name
  const grouped = files.reduce((acc: Record<string, any[]>, f) => {
    const key = catName(f);
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  const totalFiles    = files.length;
  const contractCount = files.filter(f => f.file_category?.category_name === 'Kontrak').length;
  const photoCount    = files.filter(f => f.file_category?.category_name === 'Foto Lapangan').length;
  const totalSize     = files.reduce((s, f) => s + Number(f.file_size ?? 0), 0);

  return (
    <div>
      {/* Header */}
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>Dokumen Proyek</h3>
            <p>Manajemen dokumen proyek: kontrak, foto lapangan, laporan, invoice, dan perizinan.</p>
          </div>
          <div className="cluster">
            {canManageFiles() && (
              <button className="btn" onClick={() => setShowUpload(true)}>
                + Upload Dokumen
              </button>
            )}
          </div>
        </div>

        <div className="summary-bar">
          <div className="summary-item">
            <span>Total Dokumen</span>
            <strong>{totalFiles}</strong>
          </div>
          <div className="summary-item">
            <span>Kontrak</span>
            <strong>{contractCount}</strong>
          </div>
          <div className="summary-item">
            <span>Foto Lapangan</span>
            <strong>{photoCount}</strong>
          </div>
          <div className="summary-item">
            <span>Total Ukuran</span>
            <strong>{formatBytes(totalSize || null)}</strong>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="toolbar">
          <input
            type="search"
            className="stretch"
            placeholder="Cari nama dokumen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="">Semua Kategori</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.id}>{c.category_name}</option>
            ))}
          </select>
          <button className="btn secondary" onClick={() => { setSearch(''); setCategoryFilter(''); }}>Reset</button>
        </div>
      </div>

      {/* File list */}
      {filesQ.isLoading ? (
        <div className="loading-state">Memuat dokumen...</div>
      ) : filesQ.error ? (
        <div className="danger-box">{extractError(filesQ.error)}</div>
      ) : files.length === 0 ? (
        <div className="section-card glass">
          <div className="empty-state">
            Belum ada dokumen diunggah.
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setShowUpload(true)}>+ Upload Dokumen Pertama</button>
            </div>
          </div>
        </div>
      ) : categoryFilter ? (
        <div className="section-card glass">
          <div className="table-wrap">
            <FileTable
              files={files}
              onPreview={setPreviewFile}
              onDelete={(id, name) => { if (window.confirm(`Hapus "${name}"?`)) deleteMut.mutate(id); }}
              canDelete={canManageFiles()}
            />
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catFiles]) => (
          <div key={cat} className="section-card glass" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>
                  {cat === 'Foto Lapangan' ? '🖼' : cat === 'Kontrak' ? '📄' : cat === 'Invoice' ? '💰' : '📁'}
                </span>
                <div>
                  <h4 style={{ margin: 0 }}>{cat}</h4>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{catFiles.length} dokumen</span>
                </div>
              </div>
              <span className={`badge ${BADGE_CLASSES[cat] ?? 'planned'}`}>{catFiles.length}</span>
            </div>
            <div className="table-wrap">
              <FileTable
                files={catFiles}
                onPreview={setPreviewFile}
                onDelete={(id, name) => { if (window.confirm(`Hapus "${name}"?`)) deleteMut.mutate(id); }}
                canDelete={canManageFiles()}
              />
            </div>
          </div>
        ))
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowUpload(false); }}>
          <div className="modal-window" style={{ maxWidth: 560 }}>
            <div className="modal-head">
              <div>
                <h4>Upload Dokumen</h4>
                <p>Unggah kontrak, foto lapangan, laporan, atau dokumen proyek lainnya.</p>
              </div>
              <button className="modal-close" onClick={() => setShowUpload(false)}>×</button>
            </div>
            <div className="modal-body">
              <UploadForm
                projectId={projectId!}
                categories={categories}
                onSuccess={() => { setShowUpload(false); queryClient.invalidateQueries({ queryKey: ['files', projectId] }); }}
                onCancel={() => setShowUpload(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPreviewFile(null); }}>
          <div className="modal-window" style={{ maxWidth: 680 }}>
            <div className="modal-head">
              <div>
                <h4>{fileIcon(previewFile.original_file_name ?? '')} {previewFile.original_file_name}</h4>
                <p>
                  {formatBytes(previewFile.file_size)} · Diunggah oleh {previewFile.uploaded_by?.full_name ?? '—'} · {formatDateTime(previewFile.uploaded_at)}
                </p>
              </div>
              <button className="modal-close" onClick={() => setPreviewFile(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="panel-block" style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>{fileIcon(previewFile.original_file_name ?? '')}</div>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
                  {previewFile.original_file_name}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <a
                    href={previewFile.download_url ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="btn"
                    download
                  >
                    ⬇ Download
                  </a>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16, fontSize: 13 }}>
                <div className="panel-block">
                  <span style={{ color: 'var(--muted)' }}>Kategori</span><br />
                  <span className={`badge ${catClass(previewFile)}`}>{catName(previewFile)}</span>
                </div>
                <div className="panel-block">
                  <span style={{ color: 'var(--muted)' }}>Ukuran</span><br />
                  <strong>{formatBytes(previewFile.file_size)}</strong>
                </div>
                <div className="panel-block">
                  <span style={{ color: 'var(--muted)' }}>Tanggal Upload</span><br />
                  <strong>{formatDate(previewFile.uploaded_at)}</strong>
                </div>
                <div className="panel-block">
                  <span style={{ color: 'var(--muted)' }}>Diunggah Oleh</span><br />
                  <strong>{previewFile.uploaded_by?.full_name ?? '—'}</strong>
                </div>
              </div>
              {previewFile.caption && (
                <div className="panel-block" style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
                  <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Caption</strong>
                  {previewFile.caption}
                </div>
              )}
              {previewFile.note && (
                <div className="panel-block" style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
                  <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Keterangan</strong>
                  {previewFile.note}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileTable({
  files, onPreview, onDelete, canDelete,
}: { files: any[]; onPreview: (f: any) => void; onDelete: (id: string, name: string) => void; canDelete: boolean }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Dokumen</th>
          <th>Kategori</th>
          <th>Ukuran</th>
          <th>Diunggah Oleh</th>
          <th>Tanggal</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        {files.map(f => (
          <tr key={f.id}>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{fileIcon(f.original_file_name ?? '')}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.original_file_name ?? '—'}</div>
                  {f.caption && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{f.caption}</div>}
                  {f.note && !f.caption && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{f.note}</div>}
                </div>
              </div>
            </td>
            <td>
              <span className={`badge ${catClass(f)}`}>{catName(f)}</span>
            </td>
            <td style={{ fontSize: 12, color: 'var(--muted)' }}>{formatBytes(f.file_size)}</td>
            <td style={{ fontSize: 12 }}>
              <div>{f.uploaded_by?.full_name ?? '—'}</div>
            </td>
            <td style={{ fontSize: 12, color: 'var(--muted)' }}>{formatDate(f.uploaded_at)}</td>
            <td>
              <div className="cluster">
                <button className="chip clickable" onClick={() => onPreview(f)}>Lihat</button>
                <a
                  href={f.download_url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="chip clickable"
                  download
                >
                  ⬇
                </a>
                {canDelete && (
                  <button
                    className="chip clickable"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => onDelete(f.id, f.original_file_name ?? '?')}
                  >
                    Hapus
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UploadForm({
  projectId, categories, onSuccess, onCancel,
}: { projectId: string; categories: any[]; onSuccess: () => void; onCancel: () => void }) {
  const [file,            setFile]           = useState<File | null>(null);
  const [fileCategoryId,  setFileCategoryId] = useState(categories[0]?.id ?? '');
  const [note,            setNote]           = useState('');
  const [caption,         setCaption]        = useState('');
  const [photoDate,       setPhotoDate]      = useState('');
  const [isLoading,       setIsLoading]      = useState(false);
  const [error,           setError]          = useState('');

  const selectedCategoryName = categories.find(c => c.id === fileCategoryId)?.category_name ?? '';
  const isPhoto = selectedCategoryName === 'Foto Lapangan';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Pilih file terlebih dahulu.'); return; }
    if (!fileCategoryId) { setError('Pilih kategori dokumen.'); return; }
    if (isPhoto) {
      if (!caption.trim()) { setError('Caption wajib diisi untuk Foto Lapangan.'); return; }
      if (!photoDate)       { setError('Tanggal foto wajib diisi untuk Foto Lapangan.'); return; }
    }
    setError(''); setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_category_id', fileCategoryId);
      formData.append('file_type', isPhoto ? 'IMAGE' : 'DOCUMENT');
      if (note) formData.append('note', note);
      if (isPhoto) {
        formData.append('caption', caption);
        formData.append('photo_date', photoDate);
      }
      await fileService.upload(projectId, formData);
      onSuccess();
    } catch (err) { setError(extractError(err)); }
    finally { setIsLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="danger-box" style={{ marginBottom: 12 }}>{error}</div>}

      <div
        style={{
          border: '2px dashed var(--line)',
          borderRadius: 14,
          padding: '32px 20px',
          textAlign: 'center',
          marginBottom: 16,
          cursor: 'pointer',
          background: file ? 'rgba(45,125,70,0.05)' : 'transparent',
          transition: 'background 0.2s',
        }}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          style={{ display: 'none' }}
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx,.doc,.zip"
        />
        {file ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{fileIcon(file.name)}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{formatBytes(file.size)} · Klik untuk ganti</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📎</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Klik untuk pilih file</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>PDF, JPG, PNG, XLSX, DOCX, ZIP — maks. 20 MB</div>
          </>
        )}
      </div>

      <div className="field">
        <label>Kategori Dokumen *</label>
        <select value={fileCategoryId} onChange={e => setFileCategoryId(e.target.value)} style={{ width: '100%' }} required>
          <option value="">— Pilih Kategori —</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>{c.category_name}</option>
          ))}
        </select>
      </div>

      {isPhoto && (
        <>
          <div className="field">
            <label>Caption *</label>
            <input
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Keterangan foto lapangan..."
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label>Tanggal Foto *</label>
            <input
              type="date"
              value={photoDate}
              onChange={e => setPhotoDate(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}

      <div className="field">
        <label>Keterangan <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— opsional</span></label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="Deskripsi singkat dokumen ini..."
          style={{ width: '100%' }}
        />
      </div>

      <div className="modal-foot" style={{ padding: 0, marginTop: 4 }}>
        <div />
        <div className="cluster">
          <button type="button" className="btn secondary" onClick={onCancel} disabled={isLoading}>Batal</button>
          <button type="submit" className="btn" disabled={isLoading || !file}>
            {isLoading ? 'Mengunggah...' : 'Upload Dokumen'}
          </button>
        </div>
      </div>
    </form>
  );
}
