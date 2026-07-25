import { useState } from "react";
import { heavyEquipmentPublicService } from "../../services/heavyEquipmentPublicService";
import { extractError, formatNumber } from "../../utils/format";
import {
  HEAVY_EQUIPMENT_ACTIVITIES,
  AREA_OPTIONS,
  type HeavyEquipment,
  type HeavyEquipmentCostItem,
} from "../../types";

interface ActivityState {
  enabled: boolean;
  start_time: string;
  end_time: string;
  volume: string;
}

interface CostState {
  amount: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PublicHeavyEquipmentLogPage() {
  const [pin, setPin] = useState("");
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pinError, setPinError] = useState("");

  const [equipments, setEquipments] = useState<HeavyEquipment[]>([]);
  const [costItems, setCostItems] = useState<HeavyEquipmentCostItem[]>([]);

  const [form, setForm] = useState({
    heavy_equipment_id: "",
    log_date: todayISO(),
    kebun: "",
    area: "TM",
    operator: "",
    kenek: "",
    fuel_liters: "",
    work_morning_start: "",
    work_morning_end: "",
    work_afternoon_start: "",
    work_afternoon_end: "",
    note: "",
  });

  const [activities, setActivities] = useState<Record<string, ActivityState>>(
    () =>
      Object.fromEntries(
        HEAVY_EQUIPMENT_ACTIVITIES.map((a) => [
          a.value,
          { enabled: false, start_time: "", end_time: "", volume: "" },
        ])
      )
  );
  const [costs, setCosts] = useState<Record<string, CostState>>({});
  const [photos, setPhotos] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    setVerifying(true);
    try {
      await heavyEquipmentPublicService.verifyPin(pin);
      const [eqRes, ciRes] = await Promise.all([
        heavyEquipmentPublicService.listEquipments(pin),
        heavyEquipmentPublicService.listCostItems(pin),
      ]);
      setEquipments(eqRes.data ?? []);
      setCostItems(ciRes.data ?? []);
      setCosts(
        Object.fromEntries(
          (ciRes.data ?? []).map((c) => [
            c.id,
            { amount: c.default_amount != null ? String(c.default_amount) : "" },
          ])
        )
      );
      setVerified(true);
    } catch (err) {
      setPinError(extractError(err));
    } finally {
      setVerifying(false);
    }
  }

  const costTotal = Object.values(costs).reduce(
    (s, c) => s + (parseFloat(c.amount) || 0),
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (!form.heavy_equipment_id) {
      setSubmitError("Pilih alat berat terlebih dahulu.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "" && v != null) fd.append(k, v);
      });

      let ai = 0;
      HEAVY_EQUIPMENT_ACTIVITIES.forEach((a) => {
        const st = activities[a.value];
        if (!st?.enabled) return;
        fd.append(`activities[${ai}][activity_type]`, a.value);
        if (st.start_time) fd.append(`activities[${ai}][start_time]`, st.start_time);
        if (st.end_time) fd.append(`activities[${ai}][end_time]`, st.end_time);
        if (st.volume !== "") fd.append(`activities[${ai}][volume]`, st.volume);
        if (a.unit) fd.append(`activities[${ai}][unit]`, a.unit);
        ai += 1;
      });

      let ci = 0;
      costItems.forEach((item) => {
        const c = costs[item.id];
        const amount = c ? parseFloat(c.amount) || 0 : 0;
        fd.append(`costs[${ci}][cost_item_id]`, item.id);
        fd.append(`costs[${ci}][amount]`, String(amount));
        ci += 1;
      });

      photos.forEach((file) => fd.append("photos[]", file));

      await heavyEquipmentPublicService.submitLog(pin, fd);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForNext() {
    setForm((p) => ({
      ...p,
      operator: "",
      kenek: "",
      fuel_liters: "",
      work_morning_start: "",
      work_morning_end: "",
      work_afternoon_start: "",
      work_afternoon_end: "",
      note: "",
    }));
    setActivities(
      Object.fromEntries(
        HEAVY_EQUIPMENT_ACTIVITIES.map((a) => [
          a.value,
          { enabled: false, start_time: "", end_time: "", volume: "" },
        ])
      )
    );
    setCosts(
      Object.fromEntries(
        costItems.map((c) => [
          c.id,
          { amount: c.default_amount != null ? String(c.default_amount) : "" },
        ])
      )
    );
    setPhotos([]);
    setSubmitted(false);
    setSubmitError("");
  }

  // ── Layar 1: PIN ──
  if (!verified) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div style={{ marginBottom: 24, textAlign: "center" }}>
            <div className="brand-tag" style={{ justifyContent: "center", marginBottom: 12 }}>
              Barumun Plantation
            </div>
            <h2 style={{ fontSize: 22, color: "var(--green-800)", marginBottom: 6 }}>
              Laporan Harian Alat Berat
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
              Masukkan kode akses untuk mulai mencatat realisasi kerja alat berat.
            </p>
          </div>

          {pinError && (
            <div className="danger-box" style={{ marginBottom: 16 }}>
              {pinError}
            </div>
          )}

          <form onSubmit={handleVerify} style={{ display: "grid", gap: 14 }}>
            <div className="field">
              <label>Kode Akses</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Masukkan kode akses"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn"
              style={{ width: "100%", padding: "13px" }}
              disabled={verifying || !pin}
            >
              {verifying ? "Memeriksa..." : "Lanjut"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Layar sukses ──
  if (submitted) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
          <h2 style={{ fontSize: 20, color: "var(--green-800)", marginBottom: 6 }}>
            Laporan terkirim
          </h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
            Data realisasi kerja alat berat berhasil disimpan.
          </p>
          <button className="btn" style={{ width: "100%", padding: 12 }} onClick={resetForNext}>
            Input laporan lagi
          </button>
        </div>
      </div>
    );
  }

  // ── Layar 2: Form ──
  return (
    <div className="login-page" style={{ alignItems: "flex-start", padding: "24px 16px" }}>
      <div className="login-card" style={{ width: "min(560px, 100%)", padding: 24 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div className="brand-tag" style={{ justifyContent: "center", marginBottom: 8 }}>
            Barumun Plantation
          </div>
          <h2 style={{ fontSize: 18, color: "var(--green-800)" }}>Laporan Harian Alat Berat</h2>
        </div>

        {submitError && (
          <div className="danger-box" style={{ marginBottom: 16 }}>
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {/* Identitas */}
          <div className="field">
            <label className="required">Alat Berat</label>
            <select
              value={form.heavy_equipment_id}
              onChange={(e) => set("heavy_equipment_id", e.target.value)}
              required
              style={{ width: "100%" }}
            >
              <option value="">— Pilih alat berat —</option>
              {equipments.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.code} · {eq.type} · {eq.brand}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label className="required">Tanggal</label>
              <input
                type="date"
                value={form.log_date}
                onChange={(e) => set("log_date", e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Area</label>
              <select value={form.area} onChange={(e) => set("area", e.target.value)} style={{ width: "100%" }}>
                {AREA_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="required">Kebun</label>
              <input value={form.kebun} onChange={(e) => set("kebun", e.target.value)} required />
            </div>
            <div className="field">
              <label>BBM (liter)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.fuel_liters}
                onChange={(e) => set("fuel_liters", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="required">Operator</label>
              <input value={form.operator} onChange={(e) => set("operator", e.target.value)} required />
            </div>
            <div className="field">
              <label>Kenek</label>
              <input value={form.kenek} onChange={(e) => set("kenek", e.target.value)} />
            </div>
          </div>

          {/* Jam kerja */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--green-800)" }}>Jam kerja</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 6 }}>
              <div className="field">
                <label>Pagi — mulai</label>
                <input type="time" value={form.work_morning_start} onChange={(e) => set("work_morning_start", e.target.value)} />
              </div>
              <div className="field">
                <label>Pagi — selesai</label>
                <input type="time" value={form.work_morning_end} onChange={(e) => set("work_morning_end", e.target.value)} />
              </div>
              <div className="field">
                <label>Sore — mulai</label>
                <input type="time" value={form.work_afternoon_start} onChange={(e) => set("work_afternoon_start", e.target.value)} />
              </div>
              <div className="field">
                <label>Sore — selesai</label>
                <input type="time" value={form.work_afternoon_end} onChange={(e) => set("work_afternoon_end", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Pekerjaan (multi) */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--green-800)" }}>
              Pekerjaan hari ini
            </label>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 8px" }}>
              Aktifkan pekerjaan yang dilakukan, isi jam dan hasilnya. Bisa lebih dari satu.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {HEAVY_EQUIPMENT_ACTIVITIES.map((a) => {
                const st = activities[a.value];
                return (
                  <div
                    key={a.value}
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: 10,
                      background: st.enabled ? "rgba(37,99,235,0.04)" : "transparent",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={st.enabled}
                        onChange={(e) =>
                          setActivities((p) => ({ ...p, [a.value]: { ...p[a.value], enabled: e.target.checked } }))
                        }
                        style={{ width: "auto" }}
                      />
                      {a.label}
                      {a.unit && <span style={{ color: "var(--muted)", fontWeight: 400 }}>({a.unit})</span>}
                    </label>
                    {st.enabled && (
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <div className="field" style={{ flex: 1 }}>
                          <label style={{ fontSize: 11 }}>Mulai</label>
                          <input
                            type="time"
                            value={st.start_time}
                            onChange={(e) =>
                              setActivities((p) => ({ ...p, [a.value]: { ...p[a.value], start_time: e.target.value } }))
                            }
                          />
                        </div>
                        <div className="field" style={{ flex: 1 }}>
                          <label style={{ fontSize: 11 }}>Selesai</label>
                          <input
                            type="time"
                            value={st.end_time}
                            onChange={(e) =>
                              setActivities((p) => ({ ...p, [a.value]: { ...p[a.value], end_time: e.target.value } }))
                            }
                          />
                        </div>
                        {a.unit && (
                          <div className="field" style={{ width: 90 }}>
                            <label style={{ fontSize: 11 }}>Hasil</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={st.volume}
                              onChange={(e) =>
                                setActivities((p) => ({ ...p, [a.value]: { ...p[a.value], volume: e.target.value } }))
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Biaya operasional */}
          {costItems.length > 0 && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--green-800)" }}>
                Biaya operasional hari ini
              </label>
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {costItems.map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{item.name}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={costs[item.id]?.amount ?? ""}
                      onChange={(e) =>
                        setCosts((p) => ({ ...p, [item.id]: { amount: e.target.value } }))
                      }
                      style={{ width: 130, textAlign: "right" }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13 }}>
                <span style={{ color: "var(--muted)" }}>Total biaya</span>
                <strong>Rp {formatNumber(costTotal, 0)}</strong>
              </div>
            </div>
          )}

          {/* Keterangan */}
          <div className="field">
            <label>Keterangan</label>
            <textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} style={{ width: "100%" }} />
          </div>

          {/* Foto */}
          <div className="field">
            <label>Foto dokumentasi</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
            />
            {photos.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                {photos.length} foto dipilih
              </div>
            )}
          </div>

          <button type="submit" className="btn" style={{ width: "100%", padding: 13 }} disabled={submitting}>
            {submitting ? "Mengirim..." : "Kirim laporan"}
          </button>
        </form>
      </div>
    </div>
  );
}
