import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import LoadingState from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import { formatCurrency, formatNumber } from '../../utils/format';

export default function SCurvePage() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['s-curve', projectId],
    queryFn: () => analyticsService.sCurve(projectId!),
    enabled: !!projectId,
  });

  const series = data?.data?.actual_series ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>S-Curve</h1>
        <p>Perbandingan kumulatif progress dan biaya aktual (hanya data approved)</p>
      </div>

      {isLoading ? <LoadingState /> :
        series.length === 0 ? (
          <EmptyState title="Belum ada data S-Curve" message="Data akan muncul setelah ada progress dan biaya yang disetujui." />
        ) : (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Akumulasi Progress Bulanan (Approved Data Only)</div>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={series} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="volume" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v, 0)} />
                  <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `Rp ${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(value: any, name: string) => [
                      name.includes('cost') ? formatCurrency(value) : formatNumber(value),
                      name,
                    ]}
                  />
                  <Legend />
                  <Line
                    yAxisId="volume"
                    type="monotone"
                    dataKey="cumulative_volume"
                    stroke="#2563eb"
                    strokeWidth={2}
                    name="Volume Kumulatif"
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="cost"
                    type="monotone"
                    dataKey="cumulative_cost"
                    stroke="#16a34a"
                    strokeWidth={2}
                    name="Biaya Kumulatif (Approved)"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      }
    </div>
  );
}
