import { IRole, User } from "@/types";
import { formatDate, extractError } from "@/utils/format";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/services/api";
import InputPassword from "@/components/ui/InputPassword";
const ProfilePage = ({
  currentUser,
  ROLES,
}: {
  currentUser: User | null;
  ROLES: Array<IRole>;
}) => {
  // Profile edit state

  const [profileForm, setProfileForm] = useState({
    full_name: currentUser?.full_name ?? "",
    phone: currentUser?.phone ?? "",
  });
  const [profileMsg, setProfileMsg] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const [pwForm, setPwForm] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
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
  return (
    <>
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
            {((currentUser as any)?.full_name ?? "U").charAt(0).toUpperCase()}
          </div>
          <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>
            {(currentUser as any)?.full_name ?? "—"}
          </h3>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
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
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 2 }}>
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
          <label className="required">Nama Lengkap</label>
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
            <label className="required">Password Saat Ini </label>
            <InputPassword
              name="old_password"
              password={pwForm.current_password}
              onChange={(e) =>
                setPwForm((p) => ({
                  ...p,
                  current_password: e.target.value,
                }))
              }
            />
          </div>
          <div className="field">
            <label className="required">Password Baru</label>

            <InputPassword
              name="password"
              placeholder="password baru"
              password={pwForm.password}
              onChange={(e) =>
                setPwForm((p) => ({ ...p, password: e.target.value }))
              }
            />
          </div>
          <div className="field">
            <label className="required">Konfirmasi Password Baru</label>
            <InputPassword
              name="password_confirm"
              placeholder="password konfirmasi"
              password={pwForm.password_confirmation}
              onChange={(e) => {
                setPwForm((p) => ({
                  ...p,
                  password_confirmation: e.target.value,
                }));
              }}
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
                  background: n.enabled ? "var(--green-700)" : "var(--line)",
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
    </>
  );
};
export default ProfilePage;
