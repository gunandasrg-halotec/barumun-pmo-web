import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatDate, formatDateTime, extractError } from "../../utils/format";

const ROLES = [
  {
    value: "ADMINISTRATOR_SISTEM",
    label: "Administrator Sistem",
    cls: "done",
    desc: "Akses penuh: kelola user, semua proyek, semua modul.",
  },
  {
    value: "PROJECT_MANAGER",
    label: "Project Manager",
    cls: "running",
    desc: "Kelola WBD, approve progress, generate laporan.",
  },
  {
    value: "DIREKSI",
    label: "Direksi",
    cls: "done",
    desc: "Approve WBD baseline, akses executive dashboard.",
  },
  {
    value: "FINANCE",
    label: "Finance",
    cls: "running",
    desc: "Review biaya, akses cost analysis dan laporan keuangan.",
  },
  {
    value: "ADMIN_PROYEK",
    label: "Admin Proyek",
    cls: "planned",
    desc: "Input progress lapangan, upload dokumen.",
  },
];

const TABS = ["Manajemen User", "Profil Saya", "Akses & Role"];

export default function AdminPage() {
  const { user: currentUser, isAdminSistem } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("Manajemen User");
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [queryFilter, setQueryFilter] = useState<{
    role: string;
    is_active: string;
  }>({
    role: "",
    is_active: "",
  });

  // Profile edit state
  const [profileForm, setProfileForm] = useState({
    full_name: (currentUser as any)?.full_name ?? "",
    phone: (currentUser as any)?.phone ?? "",
  });
  const [pwForm, setPwForm] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [profileMsg, setProfileMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const usersQ = useQuery({
    queryKey: ["users", searchQuery, queryFilter],
    queryFn: () =>
      api
        .get("/users", {
          params: {
            search: searchQuery || undefined,
            filter: Object.fromEntries(
              Object.entries(queryFilter).filter(([key, value]) => value !== "")
            ),
          },
        })
        .then((r) => r.data),
    enabled: isAdminSistem(),
    gcTime: 0,
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.post("/users", d).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowCreate(false);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) =>
      api.patch(`/user/${id}`, d).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/user/${id}/toggle-active`, { is_active }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const updateProfileMut = useMutation({
    mutationFn: (d: any) => api.put("/profile", d).then((r) => r.data),
    onSuccess: () => setProfileMsg("Profil berhasil diperbarui."),
    onError: (e) => setProfileMsg("Error: " + extractError(e)),
  });

  const changePwMut = useMutation({
    mutationFn: (d: any) => api.put("/profile/password", d).then((r) => r.data),
    onSuccess: () => {
      setPwMsg("Password berhasil diubah.");
      setPwForm({
        current_password: "",
        password: "",
        password_confirmation: "",
      });
    },
    onError: (e) => setPwMsg("Error: " + extractError(e)),
  });

  const users: any[] = usersQ.data?.data ?? [];
  const userStat = useQuery({
    queryKey: ["user_stats", users],
    queryFn: () => api.get("/users/total-by-role").then((r) => r.data),
  }); 
  const userStats: any[] = userStat.data ?? [];

  return (
    <div>
      {/* Header */}
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>Pengaturan User & Sistem</h3>
            <p>
              Kelola akun pengguna, role, dan profil. Akses penuh hanya untuk
              Administrator Sistem.
            </p>
          </div>
          <div className="cluster">
            {isAdminSistem() && (
              <button className="btn" onClick={() => setShowCreate(true)}>
                + Tambah User
              </button>
            )}
          </div>
        </div>

        <div className="summary-bar">
          {userStats
            .map((r, idx) => (
              <div key={`stat-${idx}`} className="summary-item">
                <span>{r.key}</span>
                <strong>{r.value}</strong>
              </div>
            ))
            .slice(0, 4)}
        </div>
      </div>

      {/* Tabs */}
      <div className="toolbar" style={{ marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t}
            className={`btn ${activeTab === t ? "" : "secondary"}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
        <div className="stretch" />
      </div>

      {/* Tab: Manajemen User */}
      {activeTab === "Manajemen User" && (
        <div className="section-card glass">
          {!isAdminSistem() ? (
            <div className="empty-state">
              Anda tidak memiliki akses untuk mengelola user. Hubungi
              Administrator Sistem.
            </div>
          ) : (
            <>
              <div className="toolbar" style={{ marginBottom: 14 }}>
                <input
                  type="search"
                  className="stretch"
                  placeholder="Cari nama atau email pengguna..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                  value={queryFilter.role}
                  onChange={(e) =>
                    setQueryFilter((prev) => {
                      return {
                        ...prev,
                        role: e.target.value,
                      };
                    })
                  }
                >
                  <option value="">Semua Role</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <select
                  value={queryFilter.is_active}
                  onChange={(e) =>
                    setQueryFilter((prev) => {
                      return {
                        ...prev,
                        is_active: e.target.value,
                      };
                    })
                  }
                >
                  <option value="">Semua Status</option>
                  {[
                    { label: "Aktif", value: "true" },
                    { label: "Non-Aktif", value: "false" },
                  ].map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {usersQ.isLoading ? (
                <div className="loading-state">Memuat daftar pengguna...</div>
              ) : usersQ.error ? (
                <div className="danger-box">{extractError(usersQ.error)}</div>
              ) : users.length === 0 ? (
                <div className="empty-state">Tidak ada pengguna ditemukan.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Pengguna</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Bergabung</th>
                        <th>Terakhir Login</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u: any, idx) => {
                        const role = ROLES.find((r) => r.value === u.role.code);

                        return (
                          <tr key={u.id}>
                            <td>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <div
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    background:
                                      "linear-gradient(135deg, var(--green-800), var(--green-600))",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "white",
                                    fontWeight: 700,
                                    fontSize: 14,
                                    flexShrink: 0,
                                  }}
                                >
                                  {(u.full_name ?? "U").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div
                                    style={{ fontWeight: 600, fontSize: 13 }}
                                  >
                                    {u.full_name}
                                  </div>
                                  {u.phone && (
                                    <div
                                      style={{
                                        fontSize: 11,
                                        color: "var(--muted)",
                                      }}
                                    >
                                      {u.phone}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`badge ${role?.cls ?? "planned"}`}
                              >
                                {role?.label ?? u.role.name}
                              </span>
                            </td>
                            <td style={{ fontSize: 12 }}>{u.email}</td>
                            <td style={{ fontSize: 12, color: "var(--muted)" }}>
                              {formatDate(u.created_at)}
                            </td>
                            <td style={{ fontSize: 12, color: "var(--muted)" }}>
                              {u.last_login_at
                                ? formatDateTime(u.last_login_at)
                                : "—"}
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  u.is_active ? "done" : "delay"
                                }`}
                              >
                                {u.is_active ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                            <td>
                              <div className="cluster">
                                <button
                                  className="chip clickable"
                                  onClick={() => setEditUser(u)}
                                >
                                  Edit
                                </button>
                                {u.id !== (currentUser as any)?.id && (
                                  <button
                                    className="chip clickable"
                                    style={{
                                      color: u.is_active
                                        ? "var(--danger)"
                                        : "var(--ok)",
                                    }}
                                    onClick={() =>
                                      toggleActiveMut.mutate({
                                        id: u.id,
                                        is_active: !u.is_active,
                                      })
                                    }
                                  >
                                    {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Profil Saya */}
      {activeTab === "Profil Saya" && (
        <div className="editor-layout">
          {/* Profile info card */}
          <div className="editor-card glass">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "20px 0 28px",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  marginBottom: 14,
                  background:
                    "linear-gradient(135deg, var(--green-800), var(--green-600))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 28,
                }}
              >
                {((currentUser as any)?.full_name ?? "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>
                {(currentUser as any)?.full_name ?? "—"}
              </h3>
              <div
                style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}
              >
                {(currentUser as any)?.email}
              </div>
              {(() => {
                const role = ROLES.find(
                  (r) => r.value === (currentUser as any)?.role.code
                );
                return (
                  <span className={`badge ${role?.cls ?? "planned"}`}>
                    {role?.label ?? (currentUser as any)?.role.role_name}
                  </span>
                );
              })()}
            </div>

            <div className="panel-block" style={{ marginBottom: 14 }}>
              <div
                style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}
              >
                Bergabung sejak
              </div>
              <strong>{formatDate((currentUser as any)?.created_at)}</strong>
            </div>

            <h4
              style={{
                margin: "0 0 12px",
                fontSize: 14,
                color: "var(--green-800)",
              }}
            >
              Edit Profil
            </h4>
            {profileMsg && (
              <div
                className={
                  profileMsg.startsWith("Error") ? "danger-box" : "panel-block"
                }
                style={{ marginBottom: 12, fontSize: 13 }}
              >
                {profileMsg}
              </div>
            )}
            <div className="field">
              <label>Nama Lengkap</label>
              <input
                value={profileForm.full_name}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, full_name: e.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>No. Telepon</label>
              <input
                value={profileForm.phone}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, phone: e.target.value }))
                }
              />
            </div>
            <button
              className="btn"
              onClick={() => updateProfileMut.mutate(profileForm)}
              disabled={updateProfileMut.isPending}
              style={{ width: "100%", marginTop: 4 }}
            >
              {updateProfileMut.isPending ? "Menyimpan..." : "Simpan Profil"}
            </button>
          </div>

          {/* Change password */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="section-card glass" style={{ margin: 0 }}>
              <h4
                style={{
                  margin: "0 0 12px",
                  fontSize: 14,
                  color: "var(--green-800)",
                }}
              >
                Ubah Password
              </h4>
              {pwMsg && (
                <div
                  className={
                    pwMsg.startsWith("Error") ? "danger-box" : "panel-block"
                  }
                  style={{ marginBottom: 12, fontSize: 13 }}
                >
                  {pwMsg}
                </div>
              )}
              <div className="field">
                <label>Password Saat Ini *</label>
                <input
                  type="password"
                  value={pwForm.current_password}
                  onChange={(e) =>
                    setPwForm((p) => ({
                      ...p,
                      current_password: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>Password Baru *</label>
                <input
                  type="password"
                  value={pwForm.password}
                  onChange={(e) =>
                    setPwForm((p) => ({ ...p, password: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label>Konfirmasi Password Baru *</label>
                <input
                  type="password"
                  value={pwForm.password_confirmation}
                  onChange={(e) =>
                    setPwForm((p) => ({
                      ...p,
                      password_confirmation: e.target.value,
                    }))
                  }
                />
              </div>
              <button
                className="btn"
                onClick={() => changePwMut.mutate(pwForm)}
                disabled={
                  changePwMut.isPending ||
                  !pwForm.current_password ||
                  !pwForm.password
                }
                style={{ width: "100%", marginTop: 4 }}
              >
                {changePwMut.isPending ? "Mengubah..." : "Ubah Password"}
              </button>
            </div>

            <div className="section-card glass" style={{ margin: 0 }}>
              <h4
                style={{
                  margin: "0 0 10px",
                  fontSize: 14,
                  color: "var(--green-800)",
                }}
              >
                Notifikasi
              </h4>
              {[
                { label: "Progress menunggu approval", enabled: true },
                { label: "WBD disubmit untuk review", enabled: true },
                { label: "Laporan selesai digenerate", enabled: false },
                { label: "Ringkasan mingguan email", enabled: false },
              ].map((n, i) => (
                <div
                  key={i}
                  className="panel-block"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{n.label}</span>
                  <div
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      background: n.enabled
                        ? "var(--green-700)"
                        : "var(--line)",
                      position: "relative",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 3,
                        left: n.enabled ? 20 : 3,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: "white",
                        transition: "left 0.2s",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Akses & Role */}
      {activeTab === "Akses & Role" && (
        <div className="section-card glass">
          <h4
            style={{
              margin: "0 0 14px",
              fontSize: 14,
              color: "var(--green-800)",
            }}
          >
            Deskripsi Role & Hak Akses
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {ROLES.map((r) => (
              <div
                key={r.value}
                className="panel-block"
                style={{ padding: "16px 18px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <span className={`badge ${r.cls}`}>{r.label}</span>
                  <strong style={{ fontSize: 13, color: "var(--muted)" }}>
                    {users.filter((u) => u.role === r.value).length} user
                  </strong>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {r.desc}
                </p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <h4
              style={{
                margin: "0 0 12px",
                fontSize: 14,
                color: "var(--green-800)",
              }}
            >
              Matriks Akses Modul
            </h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Modul</th>
                    {ROLES.map((r) => (
                      <th key={r.value} style={{ fontSize: 11, minWidth: 100 }}>
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      modul: "Dashboard Proyek",
                      access: ["view", "view", "view", "view", "view"],
                    },
                    {
                      modul: "WBD — Edit",
                      access: ["full", "full", "none", "none", "none"],
                    },
                    {
                      modul: "WBD — Approve",
                      access: ["full", "none", "full", "none", "none"],
                    },
                    {
                      modul: "Gantt",
                      access: ["view", "view", "view", "view", "view"],
                    },
                    {
                      modul: "Progress — Input",
                      access: ["full", "full", "none", "none", "full"],
                    },
                    {
                      modul: "Progress — Approve",
                      access: ["full", "full", "none", "none", "none"],
                    },
                    {
                      modul: "Documents",
                      access: ["full", "full", "view", "view", "full"],
                    },
                    {
                      modul: "S-Curve",
                      access: ["view", "view", "view", "view", "view"],
                    },
                    {
                      modul: "Cost Analysis",
                      access: ["view", "view", "view", "full", "none"],
                    },
                    {
                      modul: "Reports",
                      access: ["full", "full", "view", "full", "none"],
                    },
                    {
                      modul: "User Management",
                      access: ["full", "none", "none", "none", "none"],
                    },
                  ].map((row) => (
                    <tr key={row.modul}>
                      <td style={{ fontWeight: 500 }}>{row.modul}</td>
                      {row.access.map((a, i) => (
                        <td key={i} style={{ textAlign: "center" }}>
                          {a === "full" && (
                            <span className="badge done">Penuh</span>
                          )}
                          {a === "view" && (
                            <span className="badge planned">Lihat</span>
                          )}
                          {a === "none" && (
                            <span
                              style={{ color: "var(--muted)", fontSize: 16 }}
                            >
                              —
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <div className="modal-window" style={{ maxWidth: 540 }}>
            <div className="modal-head">
              <div>
                <h4>Tambah Pengguna Baru</h4>
                <p>Buat akun baru dengan role yang sesuai tanggung jawab.</p>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowCreate(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <UserForm
                onSuccess={(d) => createMut.mutate(d)}
                onCancel={() => setShowCreate(false)}
                isPending={createMut.isPending}
                error={createMut.error ? extractError(createMut.error) : ""}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditUser(null);
          }}
        >
          <div className="modal-window" style={{ maxWidth: 540 }}>
            <div className="modal-head">
              <div>
                <h4>Edit Pengguna</h4>
                <p>Ubah detail akun {editUser.full_name}.</p>
              </div>
              <button className="modal-close" onClick={() => setEditUser(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <UserForm
                initial={editUser}
                onSuccess={(d) => updateMut.mutate({ id: editUser.id, ...d })}
                onCancel={() => setEditUser(null)}
                isPending={updateMut.isPending}
                error={updateMut.error ? extractError(updateMut.error) : ""}
                isEdit
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserForm({
  initial,
  onSuccess,
  onCancel,
  isPending,
  error,
  isEdit = false,
}: {
  initial?: any;
  onSuccess: (d: any) => void;
  onCancel: () => void;
  isPending: boolean;
  error: string;
  isEdit?: boolean;
}) {
  const [form, setForm] = useState({
    full_name: initial?.full_name ?? "",
    email: initial?.email ?? "",
    role: initial?.role?.code ?? "ADMIN_PROYEK",
    phone: initial?.phone ?? "",
    password: "",
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSuccess(form);
      }}
    >
      {error && (
        <div className="danger-box" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label>Nama Lengkap *</label>
          <input
            value={form.full_name}
            onChange={(e) =>
              setForm((p) => ({ ...p, full_name: e.target.value }))
            }
            required
          />
        </div>
        <div className="field">
          <label>Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label>No. Telepon</label>
          <input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Role *</label>
          <select
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            style={{ width: "100%" }}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {!isEdit && (
          <div className="field">
            <label>Password *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              required={!isEdit}
              minLength={8}
            />
          </div>
        )}
      </div>
      <div className="modal-foot" style={{ padding: 0, marginTop: 4 }}>
        <div />
        <div className="cluster">
          <button
            type="button"
            className="btn secondary"
            onClick={onCancel}
            disabled={isPending}
          >
            Batal
          </button>
          <button type="submit" className="btn" disabled={isPending}>
            {isPending
              ? "Menyimpan..."
              : isEdit
              ? "Simpan Perubahan"
              : "Tambah Pengguna"}
          </button>
        </div>
      </div>
    </form>
  );
}
