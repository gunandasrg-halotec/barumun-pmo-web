import { useEffect, useMemo, useState } from "react";
import { heavyEquipmentPublicService } from "../../services/heavyEquipmentPublicService";
import { extractError, formatNumber } from "../../utils/format";
import {
  AREA_OPTIONS,
  type FuelStockReceiptEntry,
  type FuelType,
  type HeavyEquipment,
  type HeavyEquipmentActivityTypeConfig,
  type HeavyEquipmentCostItem,
} from "../../types";
import {
  saveDraft,
  listDrafts,
  deleteDraft,
  countDrafts,
  type HeavyEquipmentDraft,
} from "../../utils/heavyEquipmentDrafts";

interface ActivityState {
  enabled: boolean;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  volume: string;
  description: string;
  repair_cost: string;
}
interface CostState {
  amount: string;
}
type FormShape = {
  heavy_equipment_id: string;
  log_date: string;
  kebun: string;
  area: string;
  operator: string;
  kenek: string;
  fuel_liters: string;
  fuel_liters_dex_lite: string;
  work_morning_start: string;
  work_morning_end: string;
  work_afternoon_start: string;
  work_afternoon_end: string;
  note: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

async function compressImage(file: File, maxDim = 800, quality = 0.60): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
    img.src = objUrl;
  });
}

const KEBUN_OPTIONS = ["Kota Pinang", "Binanga", "Janji Matogu", "Sosa"];
const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 5; h <= 20; h++) {
    for (const m of ["00", "30"]) out.push(`${String(h).padStart(2, "0")}:${m}`);
  }
  return out;
})();

const LS_PIN = "he_field_pin";
const LS_LISTS = "he_field_lists";

const emptyActivities = (types: HeavyEquipmentActivityTypeConfig[]): Record<string, ActivityState> =>
  Object.fromEntries(
    types.map((a) => [
      a.code,
      { enabled: false, start_date: "", end_date: "", start_time: "", end_time: "", volume: "", description: "", repair_cost: "" },
    ])
  );

const defaultForm = (): FormShape => ({
  heavy_equipment_id: "",
  log_date: todayISO(),
  kebun: "Sosa",
  area: "TM",
  operator: "",
  kenek: "",
  fuel_liters: "",
  fuel_liters_dex_lite: "",
  work_morning_start: "08:00",
  work_morning_end: "12:00",
  work_afternoon_start: "13:00",
  work_afternoon_end: "17:00",
  note: "",
});

const costsFromItems = (items: HeavyEquipmentCostItem[]): Record<string, CostState> =>
  Object.fromEntries(
    items.map((c) => [c.id, { amount: c.default_amount != null ? String(c.default_amount) : "" }])
  );

function buildFormData(
  f: Record<string, string>,
  acts: Record<string, ActivityState>,
  activityTypes: HeavyEquipmentActivityTypeConfig[],
  cs: Record<string, CostState>,
  ph: File[]
): FormData {
  const fd = new FormData();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== "" && v != null) fd.append(k, v);
  });
  let ai = 0;
  activityTypes.forEach((a) => {
    const st = acts[a.code];
    if (!st?.enabled) return;
    fd.append(`activities[${ai}][activity_type]`, a.code);
    if (st.start_date) fd.append(`activities[${ai}][start_date]`, st.start_date);
    if (st.end_date) fd.append(`activities[${ai}][end_date]`, st.end_date);
    if (st.start_time) fd.append(`activities[${ai}][start_time]`, st.start_time);
    if (st.end_time) fd.append(`activities[${ai}][end_time]`, st.end_time);
    if (st.volume !== "") fd.append(`activities[${ai}][volume]`, st.volume);
    if (a.unit) fd.append(`activities[${ai}][unit]`, a.unit);
    if (st.description !== "") fd.append(`activities[${ai}][description]`, st.description);
    if (st.repair_cost !== "") fd.append(`activities[${ai}][repair_cost]`, st.repair_cost);
    ai += 1;
  });
  let ci = 0;
  Object.entries(cs).forEach(([itemId, c]) => {
    fd.append(`costs[${ci}][cost_item_id]`, itemId);
    fd.append(`costs[${ci}][amount]`, String(parseFloat(c.amount) || 0));
    ci += 1;
  });
  ph.forEach((file) => fd.append("photos[]", file));
  return fd;
}

interface CachedLists {
  equipments: HeavyEquipment[];
  costItems: HeavyEquipmentCostItem[];
  activityTypes: HeavyEquipmentActivityTypeConfig[];
}
function loadCachedLists(): CachedLists | null {
  try {
    const raw = localStorage.getItem(LS_LISTS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLists;
    // Backward compat: jika cache lama tanpa activityTypes
    if (!parsed.activityTypes) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function PublicHeavyEquipmentLogPage() {
  const [pin, setPin] = useState("");
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pinError, setPinError] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);

  const [equipments, setEquipments] = useState<HeavyEquipment[]>([]);
  const [costItems, setCostItems] = useState<HeavyEquipmentCostItem[]>([]);
  const [activityTypes, setActivityTypes] = useState<HeavyEquipmentActivityTypeConfig[]>([]);

  const [form, setForm] = useState<FormShape>(defaultForm);
  const [activities, setActivities] = useState<Record<string, ActivityState>>({});
  const [costs, setCosts] = useState<Record<string, CostState>>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const [activePublicTab, setActivePublicTab] = useState<"laporan" | "bbm">("laporan");

  // ── State tab Penerimaan BBM ──
  const defaultBbmForm = () => ({ fuelType: "solar" as FuelType, qty20: 0, qty30: 0, qty35: 0, qty40: 0, extraLiters: "" });
  const [bbmDate, setBbmDate] = useState(todayISO());
  const [bbmForm, setBbmForm] = useState(defaultBbmForm());
  const [bbmEntries, setBbmEntries] = useState<FuelStockReceiptEntry[]>([]);
  const [bbmPhotos, setBbmPhotos] = useState<File[]>([]);
  const [bbmNotes, setBbmNotes] = useState("");
  const [bbmSubmitting, setBbmSubmitting] = useState(false);
  const [bbmError, setBbmError] = useState("");
  const [bbmSuccess, setBbmSuccess] = useState(false);

  const bbmTotal = bbmEntries.reduce((s, e) => s + e.qty_20l * 20 + e.qty_30l * 30 + e.qty_35l * 35 + e.qty_40l * 40 + e.extra_liters, 0);

  function bbmAddEntry() {
    const extra = parseFloat(bbmForm.extraLiters) || 0;
    const total = bbmForm.qty20 * 20 + bbmForm.qty30 * 30 + bbmForm.qty35 * 35 + bbmForm.qty40 * 40 + extra;
    if (total === 0) return;
    setBbmEntries((prev) => [
      ...prev,
      { fuel_type: bbmForm.fuelType, qty_20l: bbmForm.qty20, qty_30l: bbmForm.qty30, qty_35l: bbmForm.qty35, qty_40l: bbmForm.qty40, extra_liters: extra },
    ]);
    setBbmForm(defaultBbmForm());
  }

  async function bbmSubmit() {
    if (bbmEntries.length === 0) return;
    const usePin = pin || localStorage.getItem(LS_PIN) || "";
    const kebun = form.kebun;
    if (!kebun) { setBbmError("Kebun belum dipilih. Isi terlebih dahulu di tab Laporan Harian."); return; }
    setBbmSubmitting(true);
    setBbmError("");
    try {
      await heavyEquipmentPublicService.submitFuelReceipts(usePin, {
        kebun,
        receipt_date: bbmDate,
        receipts: bbmEntries,
        notes: bbmNotes || undefined,
        photos: bbmPhotos,
      });
      setBbmEntries([]);
      setBbmForm(defaultBbmForm());
      setBbmNotes("");
      setBbmPhotos([]);
      setBbmSuccess(true);
      setTimeout(() => setBbmSuccess(false), 3000);
    } catch (e) {
      setBbmError(extractError(e));
    } finally {
      setBbmSubmitting(false);
    }
  }

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [draftCount, setDraftCount] = useState(0);
  const [showDrafts, setShowDrafts] = useState(false);
  const [drafts, setDrafts] = useState<HeavyEquipmentDraft[]>([]);
  const [toast, setToast] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingDrafts, setSendingDrafts] = useState(false);

  const refreshDraftCount = () => {
    countDrafts().then(setDraftCount).catch(() => {});
  };

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/lapor-alat-berat" }).catch(() => {});
    }
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    refreshDraftCount();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const set = (k: keyof FormShape, v: string) => setForm((p) => ({ ...p, [k]: v }));

  function applyLists(eq: HeavyEquipment[], ci: HeavyEquipmentCostItem[], at: HeavyEquipmentActivityTypeConfig[]) {
    setEquipments(eq);
    setCostItems(ci);
    setActivityTypes(at);
    setCosts(costsFromItems(ci));
    setActivities(emptyActivities(at));
  }

  function enterOffline(cached: CachedLists) {
    applyLists(cached.equipments, cached.costItems, cached.activityTypes);
    setOfflineMode(true);
    setVerified(true);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    setVerifying(true);
    try {
      await heavyEquipmentPublicService.verifyPin(pin);
      const [eqRes, ciRes, atRes] = await Promise.all([
        heavyEquipmentPublicService.listEquipments(pin),
        heavyEquipmentPublicService.listCostItems(pin),
        heavyEquipmentPublicService.listActivityTypes(pin),
      ]);
      const eq = eqRes.data ?? [];
      const ci = ciRes.data ?? [];
      const at = atRes.data ?? [];
      applyLists(eq, ci, at);
      try {
        localStorage.setItem(LS_PIN, pin);
        localStorage.setItem(LS_LISTS, JSON.stringify({ equipments: eq, costItems: ci, activityTypes: at }));
      } catch {
        /* abaikan kuota penuh */
      }
      setVerified(true);
      setOfflineMode(false);
    } catch (err) {
      const cached = loadCachedLists();
      if (!navigator.onLine && cached) enterOffline(cached);
      else setPinError(extractError(err));
    } finally {
      setVerifying(false);
    }
  }

  const costTotal = Object.values(costs).reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);

  function resetForNext() {
    setForm((p) => ({ ...defaultForm(), heavy_equipment_id: p.heavy_equipment_id, kebun: p.kebun }));
    setActivities(emptyActivities(activityTypes));
    setCosts(costsFromItems(costItems));
    setPhotos([]);
    setSubmitted(false);
    setSubmitError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (!form.heavy_equipment_id) {
      setSubmitError("Pilih alat berat terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    try {
      const usePin = pin || localStorage.getItem(LS_PIN) || "";
      await heavyEquipmentPublicService.submitLog(usePin, buildFormData(form, activities, activityTypes, costs, photos));
      setSubmitted(true);
    } catch (err) {
      setSubmitError(extractError(err) + " — bila sinyal buruk, simpan sebagai draft dan kirim nanti.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    if (!form.heavy_equipment_id) {
      setSubmitError("Pilih alat berat terlebih dahulu.");
      return;
    }
    setSavingDraft(true);
    try {
      await saveDraft({
        savedAt: Date.now(),
        form,
        activities,
        costs,
        photos,
        summary: {
          log_date: form.log_date,
          kebun: form.kebun,
          operator: form.operator,
          equipment_id: form.heavy_equipment_id,
          activityCount: Object.values(activities).filter((a) => a.enabled).length,
          photoCount: photos.length,
        },
      });
      refreshDraftCount();
      showToast("Draft tersimpan di perangkat. Kirim saat sinyal bagus.");
      resetForNext();
    } catch {
      setSubmitError("Gagal menyimpan draft di perangkat.");
    } finally {
      setSavingDraft(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  }

  async function openDrafts() {
    try {
      setDrafts(await listDrafts());
    } catch {
      setDrafts([]);
    }
    setShowDrafts(true);
  }

  function loadDraft(d: HeavyEquipmentDraft) {
    setForm({ ...defaultForm(), ...d.form });
    setActivities({ ...emptyActivities(activityTypes), ...d.activities });
    setCosts(d.costs);
    setPhotos(d.photos);
    setShowDrafts(false);
    setVerified(true);
    setSubmitted(false);
    setSubmitError("");
    window.scrollTo(0, 0);
  }

  async function sendDraft(d: HeavyEquipmentDraft) {
    const usePin = pin || localStorage.getItem(LS_PIN) || "";
    if (!usePin) {
      showToast("Masukkan PIN dulu (butuh koneksi) untuk mengirim draft.");
      return;
    }
    setSendingDrafts(true);
    try {
      await heavyEquipmentPublicService.submitLog(usePin, buildFormData(d.form, d.activities, activityTypes, d.costs, d.photos));
      await deleteDraft(d.id);
      setDrafts(await listDrafts());
      refreshDraftCount();
      showToast("Draft terkirim.");
    } catch (err) {
      showToast("Gagal mengirim draft: " + extractError(err));
    } finally {
      setSendingDrafts(false);
    }
  }

  async function removeDraft(id: number) {
    await deleteDraft(id);
    setDrafts(await listDrafts());
    refreshDraftCount();
  }

  const draftsBanner = draftCount > 0 && (
    <div
      style={{
        background: "#fff7e6",
        border: "1px solid #f0c36d",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 13, color: "#8a5a00" }}>
        {draftCount} draft tersimpan — kirim saat sinyal bagus
      </span>
      <button
        type="button"
        className="btn secondary"
        style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}
        onClick={openDrafts}
      >
        Lihat draft
      </button>
    </div>
  );

  // ── Layar 1: PIN ──
  let screen: React.ReactNode;
  if (!verified) {
    const cached = loadCachedLists();
    screen = (
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

          {draftsBanner}

          {!online && (
            <div style={{ background: "#fdecea", border: "1px solid #f5aca6", borderRadius: 10, padding: "8px 12px", marginBottom: 16, fontSize: 12, color: "#8a2c25" }}>
              Sedang offline.
              {cached ? " Anda bisa mengisi laporan & menyimpan draft." : " Hubungkan internet minimal sekali untuk memuat data."}
            </div>
          )}

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
            <button type="submit" className="btn" style={{ width: "100%", padding: "13px" }} disabled={verifying || !pin}>
              {verifying ? "Memeriksa..." : "Lanjut"}
            </button>
            {!online && cached && (
              <button
                type="button"
                className="btn secondary"
                style={{ width: "100%", padding: "12px" }}
                onClick={() => enterOffline(cached)}
              >
                Lanjut tanpa koneksi (mode draft)
              </button>
            )}
          </form>
        </div>
      </div>
    );
  } else if (submitted) {
    // ── Layar sukses ──
    screen = (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
          <h2 style={{ fontSize: 20, color: "var(--green-800)", marginBottom: 6 }}>Laporan terkirim</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
            Data realisasi kerja alat berat berhasil disimpan.
          </p>
          <button className="btn" style={{ width: "100%", padding: 12 }} onClick={resetForNext}>
            Input laporan lagi
          </button>
        </div>
      </div>
    );
  } else {
    // ── Layar 2: Form ──
    screen = (
      <div className="login-page" style={{ alignItems: "flex-start", padding: "24px 16px" }}>
        <div className="login-card" style={{ width: "min(560px, 100%)", padding: 24 }}>
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div className="brand-tag" style={{ justifyContent: "center", marginBottom: 8 }}>
              Barumun Plantation
            </div>
            <h2 style={{ fontSize: 18, color: "var(--green-800)" }}>Laporan Harian Alat Berat</h2>
          </div>

          {/* Tab bar */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "2px solid var(--line)", marginBottom: 16 }}>
            {(["laporan", "bbm"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActivePublicTab(t)}
                style={{
                  background: "none", border: "none", padding: "9px 4px", fontSize: 13,
                  fontWeight: activePublicTab === t ? 700 : 500,
                  color: activePublicTab === t ? "var(--green-700)" : "var(--muted)",
                  borderBottom: activePublicTab === t ? "2px solid var(--green-700)" : "2px solid transparent",
                  marginBottom: -2, cursor: "pointer",
                }}
              >
                {t === "laporan" ? "Laporan harian" : "Penerimaan BBM"}
              </button>
            ))}
          </div>

          {activePublicTab === "bbm" && (
            <div style={{ display: "grid", gap: 14 }}>
              {bbmSuccess && (
                <div style={{ background: "var(--green-200)", border: "1px solid var(--green-500)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--green-800)", fontWeight: 600 }}>
                  Penerimaan BBM berhasil disimpan!
                </div>
              )}
              {bbmError && <div className="danger-box">{bbmError}</div>}

              <div className="field">
                <label className="required">Tanggal penerimaan</label>
                <input type="date" value={bbmDate} onChange={(e) => setBbmDate(e.target.value)} style={{ width: "100%" }} />
              </div>

              <div className="field">
                <label className="required">Jenis BBM</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {([["solar", "Solar", "#d4a537", "#fef3dc", "#7a5800"], ["dex_lite", "Dex Lite", "#0f6e56", "#e1f5ee", "#0f6e56"]] as const).map(([val, label, border, bg, color]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBbmForm((p) => ({ ...p, fuelType: val }))}
                      style={{
                        border: `2px solid ${bbmForm.fuelType === val ? border : "var(--line)"}`,
                        borderRadius: 10, padding: "10px 8px", fontSize: 13, fontWeight: 700,
                        background: bbmForm.fuelType === val ? bg : "white",
                        color: bbmForm.fuelType === val ? color : "var(--muted)",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Jumlah jirigen</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {([["qty20", 20], ["qty30", 30], ["qty35", 35], ["qty40", 40]] as const).map(([key, liter]) => (
                    <div key={key} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 8px", textAlign: "center", background: "white" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green-700)" }}>{liter}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}>Liter / jirigen</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <button type="button" onClick={() => setBbmForm((p) => ({ ...p, [key]: Math.max(0, p[key] - 1) }))}
                          style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--line)", background: "var(--green-200)", color: "var(--green-700)", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <span style={{ fontWeight: 700, minWidth: 18, textAlign: "center" }}>{bbmForm[key]}</span>
                        <button type="button" onClick={() => setBbmForm((p) => ({ ...p, [key]: p[key] + 1 }))}
                          style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--line)", background: "var(--green-200)", color: "var(--green-700)", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", margin: 0 }}>+ Sisa (liter)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={bbmForm.extraLiters}
                    onChange={(e) => setBbmForm((p) => ({ ...p, extraLiters: e.target.value }))}
                    style={{ flex: 1, borderRadius: 8, border: "1px solid var(--line)", padding: "6px 10px", fontSize: 14, textAlign: "right" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>L</span>
                </div>
              </div>

              {bbmEntries.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>Data yang akan disimpan</div>
                  <div style={{ display: "grid", gap: 7 }}>
                    {bbmEntries.map((e, i) => {
                      const vol = e.qty_20l * 20 + e.qty_30l * 30 + e.qty_35l * 35 + e.qty_40l * 40 + e.extra_liters;
                      const parts = [e.qty_20l && `${e.qty_20l}×20L`, e.qty_30l && `${e.qty_30l}×30L`, e.qty_35l && `${e.qty_35l}×35L`, e.qty_40l && `${e.qty_40l}×40L`, e.extra_liters && `sisa ${e.extra_liters}L`].filter(Boolean).join(" · ");
                      const isSolar = e.fuel_type === "solar";
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "white", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px" }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: isSolar ? "#fef3dc" : "#e1f5ee", color: isSolar ? "#8a6200" : "#0f6e56", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, fontWeight: 700 }}>
                            {isSolar ? "☀" : "D"}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{isSolar ? "Solar" : "Dex Lite"}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>{parts}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: "var(--green-700)", fontSize: 14 }}>{vol} L</div>
                          <button type="button" onClick={() => setBbmEntries((p) => p.filter((_, j) => j !== i))}
                            style={{ width: 24, height: 24, borderRadius: 6, background: "#faeae6", border: "none", color: "#cb5f45", cursor: "pointer", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ background: "var(--green-200)", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--green-700)", fontWeight: 600 }}>Total semua BBM</span>
                    <strong style={{ color: "var(--green-700)" }}>{bbmTotal} L</strong>
                  </div>
                </div>
              )}

              {/* Catatan */}
              <div className="field">
                <label>Catatan (opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Misal: dari supplier X, no. DO 12345..."
                  value={bbmNotes}
                  onChange={(e) => setBbmNotes(e.target.value)}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid var(--line)", padding: "8px 10px", fontSize: 13, resize: "vertical", fontFamily: "inherit" }}
                />
              </div>

              {/* Upload foto */}
              <div className="field">
                <label>Foto (opsional)</label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px dashed var(--line)", borderRadius: 12, padding: "10px 14px", cursor: "pointer", background: "white" }}>
                  <span style={{ fontSize: 18 }}>📷</span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    {bbmPhotos.length === 0 ? "Pilih foto nota/surat jalan" : `${bbmPhotos.length} foto dipilih`}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      const compressed = await Promise.all(files.map((f) => compressImage(f)));
                      setBbmPhotos((p) => [...p, ...compressed]);
                    }}
                  />
                </label>
                {bbmPhotos.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {bbmPhotos.map((f, i) => (
                      <div key={i} style={{ position: "relative", width: 60, height: 60 }}>
                        <img
                          src={URL.createObjectURL(f)}
                          alt={f.name}
                          style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }}
                        />
                        <button
                          type="button"
                          onClick={() => setBbmPhotos((p) => p.filter((_, j) => j !== i))}
                          style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#cb5f45", border: "none", color: "white", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button
                  type="button"
                  onClick={bbmAddEntry}
                  disabled={bbmForm.qty20 + bbmForm.qty30 + bbmForm.qty35 + bbmForm.qty40 === 0 && (parseFloat(bbmForm.extraLiters) || 0) === 0}
                  style={{ padding: "11px", borderRadius: 12, border: "1.5px solid var(--green-700)", background: "white", color: "var(--green-700)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  + Tambah data
                </button>
                <button
                  type="button"
                  onClick={bbmSubmit}
                  disabled={bbmSubmitting || bbmEntries.length === 0}
                  style={{ padding: "11px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2e5f3d,#5f9a67)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  {bbmSubmitting ? "Menyimpan..." : "Simpan data"}
                </button>
              </div>
            </div>
          )}

          {activePublicTab === "laporan" && <>
          {draftsBanner}

          {(!online || offlineMode) && (
            <div style={{ background: "#fdecea", border: "1px solid #f5aca6", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#8a2c25" }}>
              Sedang offline. Isi laporan lalu <strong>Simpan draft</strong>; kirim saat sinyal bagus.
            </div>
          )}

          {submitError && (
            <div className="danger-box" style={{ marginBottom: 16 }}>
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
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
                <input type="date" value={form.log_date} onChange={(e) => set("log_date", e.target.value)} required />
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
                <select value={form.kebun} onChange={(e) => set("kebun", e.target.value)} required style={{ width: "100%" }}>
                  {KEBUN_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>BBM (liter)</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#7a5800", fontWeight: 600, marginBottom: 4 }}>☀ Solar</div>
                    <input type="number" step="0.01" min="0" value={form.fuel_liters} onChange={(e) => set("fuel_liters", e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#0f6e56", fontWeight: 600, marginBottom: 4 }}>⛽ Dex Lite</div>
                    <input type="number" step="0.01" min="0" value={form.fuel_liters_dex_lite} onChange={(e) => set("fuel_liters_dex_lite", e.target.value)} placeholder="0" />
                  </div>
                </div>
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

            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--green-800)" }}>Jam kerja</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 6 }}>
                {(
                  [
                    ["Pagi — mulai", "work_morning_start"],
                    ["Pagi — selesai", "work_morning_end"],
                    ["Sore — mulai", "work_afternoon_start"],
                    ["Sore — selesai", "work_afternoon_end"],
                  ] as const
                ).map(([label, key]) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    <select value={form[key]} onChange={(e) => set(key, e.target.value)} style={{ width: "100%" }}>
                      <option value="">—</option>
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: "var(--green-800)" }}>Pekerjaan hari ini</label>
              <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 8px" }}>
                Aktifkan pekerjaan yang dilakukan, isi jam dan hasilnya. Bisa lebih dari satu.
              </p>
              <div style={{ display: "grid", gap: 8 }}>
                {activityTypes.map((a) => {
                  const st = activities[a.code] ?? { enabled: false, start_date: "", end_date: "", start_time: "", end_time: "", volume: "", description: "", repair_cost: "" };
                  return (
                    <div
                      key={a.code}
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
                            setActivities((p) => {
                              const next = { ...p[a.code], enabled: e.target.checked };
                              if (a.allow_date_range && e.target.checked && !next.start_date) {
                                next.start_date = form.log_date;
                                next.end_date = form.log_date;
                              }
                              return { ...p, [a.code]: next };
                            })
                          }
                          style={{ width: "auto" }}
                        />
                        {a.name}
                        {a.unit && <span style={{ color: "var(--muted)", fontWeight: 400 }}>({a.unit})</span>}
                      </label>
                      {st.enabled &&
                        (a.allow_date_range ? (
                          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                            <div style={{ fontSize: 11, color: "var(--muted)" }}>
                              Pekerjaan ini bisa lintas hari — isi tanggal &amp; jam mulai dan selesai.
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <div className="field" style={{ flex: 1 }}>
                                <label style={{ fontSize: 11 }}>Tgl mulai</label>
                                <input type="date" value={st.start_date} onChange={(e) => setActivities((p) => ({ ...p, [a.code]: { ...p[a.code], start_date: e.target.value } }))} />
                              </div>
                              <div className="field" style={{ flex: 1 }}>
                                <label style={{ fontSize: 11 }}>Jam mulai</label>
                                <input type="time" value={st.start_time} onChange={(e) => setActivities((p) => ({ ...p, [a.code]: { ...p[a.code], start_time: e.target.value } }))} />
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <div className="field" style={{ flex: 1 }}>
                                <label style={{ fontSize: 11 }}>Tgl selesai</label>
                                <input type="date" value={st.end_date} onChange={(e) => setActivities((p) => ({ ...p, [a.code]: { ...p[a.code], end_date: e.target.value } }))} />
                              </div>
                              <div className="field" style={{ flex: 1 }}>
                                <label style={{ fontSize: 11 }}>Jam selesai</label>
                                <input type="time" value={st.end_time} onChange={(e) => setActivities((p) => ({ ...p, [a.code]: { ...p[a.code], end_time: e.target.value } }))} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <div className="field" style={{ flex: 1 }}>
                              <label style={{ fontSize: 11 }}>Mulai</label>
                              <input type="time" value={st.start_time} onChange={(e) => setActivities((p) => ({ ...p, [a.code]: { ...p[a.code], start_time: e.target.value } }))} />
                            </div>
                            <div className="field" style={{ flex: 1 }}>
                              <label style={{ fontSize: 11 }}>Selesai</label>
                              <input type="time" value={st.end_time} onChange={(e) => setActivities((p) => ({ ...p, [a.code]: { ...p[a.code], end_time: e.target.value } }))} />
                            </div>
                            {a.unit && (
                              <div className="field" style={{ width: 90 }}>
                                <label style={{ fontSize: 11 }}>Hasil</label>
                                <input type="number" step="0.01" min="0" value={st.volume} onChange={(e) => setActivities((p) => ({ ...p, [a.code]: { ...p[a.code], volume: e.target.value } }))} />
                              </div>
                            )}
                          </div>
                        ))}
                      {st.enabled && a.has_description && (
                        <div className="field" style={{ marginTop: 8 }}>
                          <label style={{ fontSize: 11 }}>
                            {a.code === "PERBAIKAN_MEKANIK" ? "Perbaikan yang dilakukan" : "Catatan kerusakan"}
                          </label>
                          <textarea
                            rows={2}
                            value={st.description}
                            onChange={(e) => setActivities((p) => ({ ...p, [a.code]: { ...p[a.code], description: e.target.value } }))}
                            style={{ width: "100%", resize: "vertical", fontSize: 13 }}
                          />
                        </div>
                      )}
                      {st.enabled && a.has_repair_cost && (
                        <div className="field" style={{ marginTop: 8 }}>
                          <label style={{ fontSize: 11 }}>Biaya perbaikan (Rp)</label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={st.repair_cost}
                            onChange={(e) => setActivities((p) => ({ ...p, [a.code]: { ...p[a.code], repair_cost: e.target.value } }))}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {costItems.length > 0 && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--green-800)" }}>Biaya operasional hari ini</label>
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  {costItems.map((item) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13 }}>{item.name}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={costs[item.id]?.amount ?? ""}
                        onChange={(e) => setCosts((p) => ({ ...p, [item.id]: { amount: e.target.value } }))}
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

            <div className="field">
              <label>Keterangan/Masalah</label>
              <textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} style={{ width: "100%" }} />
            </div>

            <div className="field">
              <label>Foto dokumentasi</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (!picked.length) return;
                  const compressed = await Promise.all(picked.map((f) => compressImage(f)));
                  setPhotos((prev) => [...prev, ...compressed]);
                }}
              />
              {previews.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {previews.map((url, i) => (
                    <div key={url} style={{ position: "relative" }}>
                      <img
                        src={url}
                        alt={`Foto ${i + 1}`}
                        onClick={() => setViewPhoto(url)}
                        style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)", cursor: "pointer" }}
                      />
                      <button
                        type="button"
                        aria-label="Hapus foto"
                        onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "var(--danger)", color: "#fff", fontSize: 13, lineHeight: "20px", cursor: "pointer", padding: 0 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                  {photos.length} foto dipilih · ketuk untuk memperbesar
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <button type="submit" className="btn" style={{ width: "100%", padding: 13 }} disabled={submitting || !online}>
                {submitting ? "Mengirim..." : online ? "Kirim laporan" : "Tidak ada sinyal — simpan draft"}
              </button>
              <button type="button" className="btn secondary" style={{ width: "100%", padding: 12 }} disabled={savingDraft} onClick={handleSaveDraft}>
                {savingDraft ? "Menyimpan..." : "Simpan draft"}
              </button>
            </div>
          </form>
          </>}
        </div>
      </div>
    );
  }

  return (
    <>
      {screen}

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--green-800, #234531)",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 10,
            zIndex: 1100,
            fontSize: 13,
            maxWidth: "90%",
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          }}
        >
          {toast}
        </div>
      )}

      {viewPhoto && (
        <div
          onClick={() => setViewPhoto(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
        >
          <img src={viewPhoto} alt="Foto" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setViewPhoto(null)}
            style={{ position: "fixed", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)", fontSize: 22, lineHeight: "40px", cursor: "pointer", padding: 0 }}
          >
            ×
          </button>
        </div>
      )}

      {showDrafts && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDrafts(false);
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, padding: 16, overflowY: "auto" }}
        >
          <div style={{ background: "var(--surface, #fff)", borderRadius: 14, width: "min(560px, 100%)", padding: 18, marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--green-800)" }}>Draft tersimpan ({drafts.length})</h3>
              <button type="button" className="btn secondary" style={{ padding: "4px 10px" }} onClick={() => setShowDrafts(false)}>
                Tutup
              </button>
            </div>
            {drafts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Tidak ada draft.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {drafts.map((d) => {
                  const eq = equipments.find((x) => x.id === d.summary.equipment_id);
                  return (
                    <div key={d.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {d.summary.log_date} · {d.summary.kebun} · {eq ? eq.code : "alat?"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                        Operator {d.summary.operator || "—"} · {d.summary.activityCount} pekerjaan · {d.summary.photoCount} foto · disimpan{" "}
                        {new Date(d.savedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                      </div>
                      <div className="cluster">
                        <button type="button" className="btn secondary" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => loadDraft(d)}>
                          Muat ke form
                        </button>
                        <button type="button" className="btn" style={{ padding: "6px 10px", fontSize: 12 }} disabled={sendingDrafts || !online} onClick={() => sendDraft(d)}>
                          {online ? "Kirim" : "Offline"}
                        </button>
                        <button type="button" className="btn secondary" style={{ padding: "6px 10px", fontSize: 12, color: "var(--danger)" }} onClick={() => removeDraft(d.id)}>
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
