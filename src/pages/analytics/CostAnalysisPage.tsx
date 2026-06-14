import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import { formatCurrency, formatPercent } from '../../utils/format';

export default function CostAnalysisPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['cost-analysis', projectId],
    queryFn: () => analyticsService.costAnalysis(projectId!),
  });

  const items = data?.data ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>Analisis Biaya</h1>
        <p>Perbandingan biaya baseline vs aktual (hanya data approved)</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Cost Analysis per Grup / Item</div>
          <span className="text-sm text-muted">Sumber: Baseline aktif + Cost APPROVED</span>
        </div>

        {isLoading ? <LoadingState /> : items.length === 0 ? (
          <EmptyState title="Belum ada data" message="Pastikan proyek memiliki baseline aktif." />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Bobot</th>
                  <th>Biaya Baseline</th>
                  <th>Biaya Aktual</th>
                  <th>Deviasi</th>
                  <th>% Deviasi</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ background: item.is_over_budget ? '#fff5f5' : '' }}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.code}</td>
                    <td style={{ fontWeight: item.node_type === 'GROUP' ? 600 : 400 }}>{item.name}</td>
                    <td style={{ textAlign: 'right' }}>{formatPercent(item.weight_percent)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.baseline_cost)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.actual_cost_approved)}</td>
                    <td style={{ textAlign: 'right', color: item.deviation > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                      {item.deviation > 0 ? '+' : ''}{formatCurrency(item.deviation)}
                    </td>
                    <td style={{ textAlign: 'right', color: item.is_over_budget ? 'var(--danger)' : 'var(--success)' }}>
                      {item.deviation_percent > 0 ? '+' : ''}{formatPercent(item.deviation_percent)}
                    </td>
                    <td>
                      {item.is_over_budget ? (
                        <span className="badge badge-danger">Over Budget</span>
                      ) : (
                        <span className="badge badge-success">On Budget</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
