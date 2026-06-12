import { useState, type FormEvent } from 'react';
import { projectService } from '../../services/projectService';
import { extractError } from '../../utils/format';

interface Props {
  initialData?: Partial<{
    project_code: string;
    project_name: string;
    client_name: string;
    location: string;
    start_date: string;
    end_date: string;
    status: string;
    description: string;
  }>;
  projectId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ProjectForm({ initialData, projectId, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState({
    project_code: initialData?.project_code ?? '',
    project_name: initialData?.project_name ?? '',
    client_name: initialData?.client_name ?? '',
    location: initialData?.location ?? '',
    start_date: initialData?.start_date ?? '',
    end_date: initialData?.end_date ?? '',
    status: initialData?.status ?? 'ACTIVE',
    description: initialData?.description ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const isEdit = !!projectId;

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: [] }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError('');
    setIsLoading(true);
    try {
      if (isEdit) {
        await projectService.update(projectId, form);
      } else {
        await projectService.create(form);
      }
      onSuccess();
    } catch (err: any) {
      if (err?.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setServerError(extractError(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const Field = ({ label, name, type = 'text', required = false, children }: any) => (
    <div className="form-group">
      <label className="form-label">
        {label} {required && <span className="required">*</span>}
      </label>
      {children ?? (
        <input
          type={type}
          className={`form-control ${errors[name]?.length ? 'border-red' : ''}`}
          value={(form as any)[name]}
          onChange={(e) => handleChange(name, e.target.value)}
          required={required}
        />
      )}
      {errors[name]?.map((e: string) => (
        <div key={e} className="form-error">{e}</div>
      ))}
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {serverError && <div className="error-state">{serverError}</div>}

      <div className="grid-2">
        <Field label="Kode Proyek" name="project_code" required>
          <input
            type="text"
            className="form-control"
            value={form.project_code}
            onChange={(e) => handleChange('project_code', e.target.value)}
            required
            disabled={isEdit}
            placeholder="PRJ-001"
          />
        </Field>
        <Field label="Status" name="status">
          <select className="form-control" value={form.status} onChange={(e) => handleChange('status', e.target.value)}>
            <option value="ACTIVE">Aktif</option>
            <option value="ON_HOLD">Ditahan</option>
            <option value="COMPLETED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
        </Field>
      </div>

      <Field label="Nama Proyek" name="project_name" required>
        <input
          type="text"
          className="form-control"
          value={form.project_name}
          onChange={(e) => handleChange('project_name', e.target.value)}
          required
          placeholder="Replanting Kebun 2026"
        />
      </Field>

      <div className="grid-2">
        <Field label="Client" name="client_name" required>
          <input
            type="text"
            className="form-control"
            value={form.client_name}
            onChange={(e) => handleChange('client_name', e.target.value)}
            required
          />
        </Field>
        <Field label="Lokasi / Estate" name="location" required>
          <input
            type="text"
            className="form-control"
            value={form.location}
            onChange={(e) => handleChange('location', e.target.value)}
            required
          />
        </Field>
      </div>

      <div className="grid-2">
        <Field label="Tanggal Mulai" name="start_date" type="date" required>
          <input
            type="date"
            className="form-control"
            value={form.start_date}
            onChange={(e) => handleChange('start_date', e.target.value)}
            required
          />
        </Field>
        <Field label="Tanggal Selesai" name="end_date" type="date" required>
          <input
            type="date"
            className="form-control"
            value={form.end_date}
            onChange={(e) => handleChange('end_date', e.target.value)}
            required
            min={form.start_date}
          />
        </Field>
      </div>

      <Field label="Deskripsi" name="description">
        <textarea
          className="form-control"
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={3}
          placeholder="Deskripsi singkat proyek..."
        />
      </Field>

      <div className="btn-group" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Proyek'}
        </button>
      </div>
    </form>
  );
}
