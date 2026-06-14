import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { extractError } from '../../utils/format';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    navigate('/projects', { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/projects');
    } catch (err) {
      setError(extractError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '40px 36px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              fontSize: 36,
              marginBottom: 8,
            }}
          >
            🏗️
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Project Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Masuk untuk melanjutkan</p>
        </div>

        {error && <div className="error-state" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="email@perusahaan.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px', fontSize: 14, marginTop: 8 }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex-row" style={{ justifyContent: 'center' }}>
                <span className="spinner spinner-sm" /> Masuk...
              </span>
            ) : (
              'Masuk'
            )}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
          <strong style={{ display: 'block', marginBottom: 6, color: 'var(--text-muted)' }}>
            Demo Accounts:
          </strong>
          {[
            ['pm@company.com', 'Project Manager'],
            ['direksi@company.com', 'Direksi'],
            ['finance@company.com', 'Finance'],
            ['adminproyek@company.com', 'Admin Proyek'],
            ['admin@company.com', 'Admin Sistem'],
          ].map(([email, role]) => (
            <div
              key={email}
              style={{ cursor: 'pointer', color: 'var(--primary)', marginBottom: 2 }}
              onClick={() => { setEmail(email); setPassword('password123'); }}
            >
              {email} <span style={{ color: 'var(--text-muted)' }}>({role})</span>
            </div>
          ))}
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Password: password123</div>
        </div>
      </div>
    </div>
  );
}
