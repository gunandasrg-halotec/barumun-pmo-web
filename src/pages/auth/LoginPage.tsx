import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { extractError } from "../../utils/format";
import InputPassword from "@/components/ui/InputPassword";
import { ROLES } from "../../types";

const DEMO_ACCOUNTS = [
  ["pm@company.com", ROLES.PROJECT_MANAGER],
  ["direksi@company.com", ROLES.DIREKSI],
  ["finance@company.com", ROLES.FINANCE],
  ["adminproyek@company.com", ROLES.ADMIN_PROYEK],
  ["admin@company.com", ROLES.ADMINISTRATOR_SISTEM],
];

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Track password visibility
  if (isAuthenticated) {
    navigate("/projects", { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/projects");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div
            className="brand-tag"
            style={{ justifyContent: "center", marginBottom: 12 }}
          >
            Halotec Indonesia
          </div>
          <h2
            style={{ fontSize: 24, color: "var(--green-800)", marginBottom: 6 }}
          >
            Project Management Center
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Masuk untuk mengelola proyek replanting Anda
          </p>
        </div>

        {error && (
          <div className="danger-box" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@perusahaan.com"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Password</label>
            <InputPassword
              name="password"
              password={password}
              placeholder="Masukkan password"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn"
            style={{ width: "100%", padding: "13px" }}
            disabled={loading}
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        {/* Demo accounts */}
        <div className="panel-block" style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: 13, marginBottom: 10 }}>Akun Demo</h4>
          <div style={{ display: "grid", gap: 6 }}>
            {DEMO_ACCOUNTS.map(([em, role]) => (
              <div
                key={em}
                style={{
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: "rgba(220,234,213,0.3)",
                }}
                onClick={() => {
                  setEmail(em);
                  setPassword("password123");
                }}
              >
                <span style={{ color: "var(--green-700)", fontWeight: 600 }}>
                  {em}
                </span>
                <span style={{ color: "var(--muted)", marginLeft: 6 }}>
                  — {role}
                </span>
              </div>
            ))}
            <p
              style={{
                fontSize: 11,
                color: "var(--muted)",
                marginTop: 4,
                marginBottom: 0,
              }}
            >
              Password semua akun: <strong>password123</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
