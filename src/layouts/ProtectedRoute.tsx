import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingState from '../components/ui/LoadingState';

interface Props {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <LoadingState message="Memuat..." />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && user && !allowedRoles.includes(user.role.name)) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>🔒 Akses Ditolak</h2>
        <p>Anda tidak memiliki hak akses ke halaman ini.</p>
      </div>
    );
  }

  return <Outlet />;
}
