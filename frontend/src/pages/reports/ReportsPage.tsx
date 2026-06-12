import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportService } from '../../services/reportService';
import { useAuth } from '../../context/AuthContext';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { formatDate, formatDateTime, extractError } from '../../utils/format';
import type { ReportType } from '../../types';

export default function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { canGenerateReport } = useAuth();
  const queryClient = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);
  const [page, setPage] = useState(1);

  const reportsQ = useQuery({
    queryKey: ['reports', projectId, page],
    queryFn: () => reportService.list(projectId!),
  });

  const reports = reportsQ.data?.data ?? [];
  const meta = reportsQ.data?.meta;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Laporan Proyek</h1>
            <p>Generate dan unduh laporan final proyek</p>
          </div>
          {canGenerateReport() && (
            <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>
              📊 Generate Laporan
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Riwayat Laporan</div></div>
        {reportsQ.isLoading ? <LoadingState /> : reports.length === 0 ? (
          <EmptyState title="Belum ada laporan" message="Generate laporan untuk melihat riwayat." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipe Laporan</th>
                  <th>Periode</th>
                  <th>Dibuat Oleh</th>
                  <th>Waktu Generate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.report_type}</td>
                    <td>{formatDate(r.period_start)} – {formatDate(r.period_end)}</td>
                    <td>{r.generated_by?.full_name ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{formatDateTime(r.generated_at)}</td>
                    <td><span className="badge badge-success">{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Laporan">
        <GenerateReportForm
          projectId={projectId!}
          onSuccess={() => { setShowGenerate(false); queryClient.invalidateQueries({ queryKey: ['reports', projectId] }); }}
          onCancel={() => setShowGenerate(false)}
        />
      </Modal>
    </div>
  );
}

function GenerateReportForm({ projectId, onSuccess, onCancel }: { projectId: string; onSuccess: () => void; onCancel: () => void }) {
  const [reportType, setReportType] = useState<ReportType>('MONTHLY');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await reportService.generate(projectId, { report_type: reportType, period_start: periodStart, period_end: periodEnd });
      onSuccess();
    } catch (err) { setError(extractError(err)); }
    finally { setIsLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="form-group">
        <label className="form-label">Tipe Laporan <span className="required">*</span></label>
        <select className="form-control" value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
          <option value="WEEKLY">Mingguan</option>
          <option value="MONTHLY">Bulanan</option>
          <option value="PROGRESS">Progress Report</option>
          <option value="COST">Cost Report</option>
          <option value="SUMMARY">Summary Report</option>
        </select>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label className="form-label">Dari Tanggal <span className="required">*</span></label>
          <input type="date" className="form-control" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">Sampai Tanggal <span className="required">*</span></label>
          <input type="date" className="form-control" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required min={periodStart} />
        </div>
      </div>
      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate Laporan'}
        </button>
      </div>
    </form>
  );
}
