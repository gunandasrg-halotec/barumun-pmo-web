import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { formatDate, formatDateTime, extractError } from "../../utils/format";
import InputPassword from "@/components/ui/InputPassword";
import ProfilePage from "./ProfilePage";
import { IRole, ROLES as ROLE_NAMES } from "@/types";
import { authService } from "@/services/authService";
import { fileService } from "@/services/fileService";

const ROLES: IRole[] = [
  {
    value: "ADMINISTRATOR_SISTEM",
    label: ROLE_NAMES.ADMINISTRATOR_SISTEM,
    cls: "done",
    desc: "Akses penuh: kelola user, semua proyek, semua modul.",
  },
  {
    value: "PROJECT_MANAGER",
    label: ROLE_NAMES.PROJECT_MANAGER,
    cls: "running",
    desc: "Kelola WBD, approve progress, generate laporan.",
  },
  {
    value: "DIREKSI",
    label: ROLE_NAMES.DIREKSI,
    cls: "done",
    desc: "Approve WBD baseline, akses executive dashboard.",
  },
  {
    value: "FINANCE",
    label: ROLE_NAMES.FINANCE,
    cls: "running",
    desc: "Review biaya, akses cost analysis dan laporan keuangan.",
  },
  {
    value: "ADMIN_PROYEK",
    label: ROLE_NAMES.ADMIN_PROYEK,
    cls: "planned",
    desc: "Input progress lapangan, upload dokumen.",
  },
];

const TABS = ["Manajemen User", "Profil Saya", "Akses & Role", "Kategori Dokumen"];

export default function AdminPage() {
  const { user: currentUser, isAdminSistem, refreshMe } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("Manajemen User");
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [queryFilter, setQueryFilter] = useState<{
    role: string;
    is_active: string;
  }>({
    role: "",
    is_active: "",
  });

  const usersQ = useQuery({
    queryKey: ["users", searchQuery, queryFilter],
    queryFn: () =>
      api
        .get("/users", {
          params: {
            search: searchQuery || undefined,
            filter: Object.fromEntries(
              Object.entries(queryFilter).filter(([, value]) => value !== "")
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
      api.patch(`/user/${id}`, d).then((r) => {
        if (id == currentUser?.id) {
          refreshMe();
        }
        return r.data;
      }),
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
                      {users.map((u: any) => {
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
          <ProfilePage currentUser={currentUser} ROLES={ROLES} />
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

      {/* Tab: Kategori Dokumen */}
      {activeTab === "Kategori Dokumen" && (
        <FileCategoryTab isAdmin={isAdminSistem()} />
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

function FileCategoryTab({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editCat,   setEditCat]    = useState<any>(null);

  const catsQ = useQuery({
    queryKey: ['file-categories-all'],
    queryFn: () => fileService.listCategories(false),
  });
  const cats: any[] = (catsQ.data as any)?.data ?? [];

  const createMut = useMutation({
    mutationFn: (d: { category_name: string; description?: string }) => fileService.createCategory(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['file-categories-all'] }); queryClient.invalidateQueries({ queryKey: ['file-categories'] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => fileService.updateCategory(id, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['file-categories-all'] }); queryClient.invalidateQueries({ queryKey: ['file-categories'] }); setEditCat(null); },
  });

  return (
    <div className="section-card glass">
      <div className="section-title" style={{ marginBottom: 14 }}>
        <div>
          <h4 style={{ margin: 0 }}>Kategori Dokumen</h4>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Kelola kategori untuk dokumen yang dapat diunggah dalam proyek.</p>
        </div>
        {isAdmin && (
          <button className="btn" onClick={() => setShowCreate(true)}>+ Tambah Kategori</button>
        )}
      </div>

      {catsQ.isLoading ? (
        <div className="loading-state">Memuat kategori...</div>
      ) : catsQ.error ? (
        <div className="danger-box">{extractError(catsQ.error)}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama Kategori</th>
                <th>Deskripsi</th>
                <th>Status</th>
                {isAdmin && <th>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {cats.map((c: any) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{c.category_name}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{c.description ?? '—'}</td>
                  <td>
                    <span className={`badge ${c.is_active ? 'done' : 'delay'}`}>
                      {c.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td>
                      <div className="cluster">
                        <button className="chip clickable" onClick={() => setEditCat(c)}>Edit</button>
                        <button
                          className="chip clickable"
                          style={{ color: c.is_active ? 'var(--danger)' : 'var(--ok)' }}
                          onClick={() => updateMut.mutate({ id: c.id, is_active: !c.is_active })}
                        >
                          {c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Category Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="modal-window" style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <div><h4>Tambah Kategori Dokumen</h4><p>Buat kategori baru untuk pengelompokan dokumen proyek.</p></div>
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <div className="modal-body">
              <CategoryForm
                onSuccess={d => createMut.mutate(d)}
                onCancel={() => setShowCreate(false)}
                isPending={createMut.isPending}
                error={createMut.error ? extractError(createMut.error) : ''}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editCat && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditCat(null); }}>
          <div className="modal-window" style={{ maxWidth: 480 }}>
            <div className="modal-head">
              <div><h4>Edit Kategori</h4><p>Ubah nama atau deskripsi kategori {editCat.category_name}.</p></div>
              <button className="modal-close" onClick={() => setEditCat(null)}>×</button>
            </div>
            <div className="modal-body">
              <CategoryForm
                initial={editCat}
                onSuccess={d => updateMut.mutate({ id: editCat.id, ...d })}
                onCancel={() => setEditCat(null)}
                isPending={updateMut.isPending}
                error={updateMut.error ? extractError(updateMut.error) : ''}
                isEdit
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryForm({
  initial, onSuccess, onCancel, isPending, error, isEdit = false,
}: { initial?: any; onSuccess: (d: any) => void; onCancel: () => void; isPending: boolean; error: string; isEdit?: boolean }) {
  const [form, setForm] = useState({ category_name: initial?.category_name ?? '', description: initial?.description ?? '' });

  return (
    <form onSubmit={e => { e.preventDefault(); onSuccess(form); }}>
      {error && <div className="danger-box" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="field">
        <label className="required">Nama Kategori</label>
        <input value={form.category_name} onChange={e => setForm(p => ({ ...p, category_name: e.target.value }))} required />
      </div>
      <div className="field">
        <label>Deskripsi <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— opsional</span></label>
        <textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ width: '100%' }} />
      </div>
      <div className="modal-foot" style={{ padding: 0, marginTop: 4 }}>
        <div />
        <div className="cluster">
          <button type="button" className="btn secondary" onClick={onCancel} disabled={isPending}>Batal</button>
          <button type="submit" className="btn" disabled={isPending || !form.category_name}>
            {isPending ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Kategori'}
          </button>
        </div>
      </div>
    </form>
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
          <label className="required">Nama Lengkap</label>
          <input
            value={form.full_name}
            onChange={(e) =>
              setForm((p) => ({ ...p, full_name: e.target.value }))
            }
            required
          />
        </div>
        <div className="field">
          <label className="required">Email</label>
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
          <label className="required">Role</label>
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
            <label className="required">Password</label>
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
