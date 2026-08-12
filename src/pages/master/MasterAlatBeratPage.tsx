import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { heavyEquipmentService } from "../../services/heavyEquipmentService";
import { extractError, formatNumber } from "../../utils/format";
import type { HeavyEquipment, HeavyEquipmentCostItem } from "../../types";

const TABS = ["Master Alat Berat", "Item Biaya"];

export default function MasterAlatBeratPage() {
  const { isAdminSistem, isFinance } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const canEditMaster = isAdminSistem();
  const canEditCost = isFinance() || isAdminSistem();

  return (
    <div>
      <div className="section-card glass" style={{ marginBottom: 18 }}>
        <div className="section-title">
          <div>
            <h3>Master Alat Berat</h3>
            <p>Kelola data unit alat berat dan katalog item biaya operasional harian.</p>
          </div>
        </div>
      </div>

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

      {activeTab === "Master Alat Berat" && <EquipmentTab canEdit={canEditMaster} />}
      {activeTab === "Item Biaya" && <CostItemTab canEdit={canEditCost} />}
    </div>
  );
}

// ─── Tab: Master Alat Berat ─────────────────────────────────────────────────

function EquipmentTab({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<HeavyEquipment | null>(null);

  const listQ = useQuery({
    queryKey: ["heavy-equipment-all"],
    queryFn: () => heavyEquipmentService.list(false),
  });
  const items: HeavyEquipment[] = (listQ.data as any)?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["heavy-equipment-all"] });

  const createMut = useMutation({
    mutationFn: (d: any) => heavyEquipmentService.create(d),
    onSuccess: () => { invalidate(); setShowCreate(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => heavyEquipmentService.update(id, d),
    onSuccess: () => { invalidate(); setEditItem(null); },
  });

  return (
    <div className="section-card glass">
      <div className="section-title" style={{ marginBottom: 14 }}>
        <div>
          <h4 style={{ margin: 0 }}>Unit Alat Berat</h4>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Kode, jenis, dan merek alat berat.</p>
        </div>
        {canEdit && <button className="btn" onClick={() => setShowCreate(true)}>+ Tambah Alat</button>}
      </div>

      {listQ.isLoading ? (
        <div className="loading-state">Memuat data...</div>
      ) : listQ.error ? (
        <div className="danger-box">{extractError(listQ.error)}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Jenis</th>
                <th>Merek</th>
                <th>Pemilik</th>
                <th>Status</th>
                {canEdit && <th>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{it.code}</td>
                  <td style={{ fontSize: 13 }}>{it.type}</td>
                  <td style={{ fontSize: 13 }}>{it.brand}</td>
                  <td>
                    {it.is_vendor_owned ? (
                      <span className="badge delay">Vendor</span>
                    ) : (
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>Perusahaan</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${it.is_active ? "done" : "delay"}`}>
                      {it.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <div className="cluster">
                        <button className="chip clickable" onClick={() => setEditItem(it)}>Edit</button>
                        <button
                          className="chip clickable"
                          style={{ color: it.is_active ? "var(--danger)" : "var(--ok)" }}
                          onClick={() => updateMut.mutate({ id: it.id, is_active: !it.is_active })}
                        >
                          {it.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={canEdit ? 6 : 5} className="empty-state">Belum ada alat berat.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Tambah Alat Berat" onClose={() => setShowCreate(false)}>
          <EquipmentForm
            onSuccess={(d) => createMut.mutate(d)}
            onCancel={() => setShowCreate(false)}
            isPending={createMut.isPending}
            error={createMut.error ? extractError(createMut.error) : ""}
          />
        </Modal>
      )}
      {editItem && (
        <Modal title={`Edit ${editItem.code}`} onClose={() => setEditItem(null)}>
          <EquipmentForm
            initial={editItem}
            onSuccess={(d) => updateMut.mutate({ id: editItem.id, ...d })}
            onCancel={() => setEditItem(null)}
            isPending={updateMut.isPending}
            error={updateMut.error ? extractError(updateMut.error) : ""}
            isEdit
          />
        </Modal>
      )}
    </div>
  );
}

function EquipmentForm({
  initial, onSuccess, onCancel, isPending, error, isEdit = false,
}: { initial?: HeavyEquipment; onSuccess: (d: any) => void; onCancel: () => void; isPending: boolean; error: string; isEdit?: boolean }) {
  const [form, setForm] = useState({
    code: initial?.code ?? "",
    type: initial?.type ?? "",
    brand: initial?.brand ?? "",
    is_vendor_owned: initial?.is_vendor_owned ?? false,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSuccess(form); }}>
      {error && <div className="danger-box" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="field">
        <label className="required">Kode Alat Berat</label>
        <input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} required />
      </div>
      <div className="field">
        <label className="required">Jenis Alat Berat</label>
        <input value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} required placeholder="mis. Excavator" />
      </div>
      <div className="field">
        <label className="required">Merek Alat Berat</label>
        <input value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))} required placeholder="mis. Komatsu PC200" />
      </div>
      <div className="field">
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={form.is_vendor_owned}
            onChange={(e) => setForm((p) => ({ ...p, is_vendor_owned: e.target.checked }))}
          />
          Milik Vendor / Pihak Ketiga
        </label>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
          Kalau dicentang: Nama Operator &amp; biaya operasional harian tidak wajib diisi saat lapor.
        </p>
      </div>
      <div className="modal-foot" style={{ padding: 0, marginTop: 4 }}>
        <div />
        <div className="cluster">
          <button type="button" className="btn secondary" onClick={onCancel} disabled={isPending}>Batal</button>
          <button type="submit" className="btn" disabled={isPending || !form.code || !form.type || !form.brand}>
            {isPending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Alat"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Tab: Item Biaya ────────────────────────────────────────────────────────

function CostItemTab({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<HeavyEquipmentCostItem | null>(null);

  const listQ = useQuery({
    queryKey: ["heavy-equipment-cost-items-all"],
    queryFn: () => heavyEquipmentService.listCostItems(false),
  });
  const items: HeavyEquipmentCostItem[] = (listQ.data as any)?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["heavy-equipment-cost-items-all"] });

  const createMut = useMutation({
    mutationFn: (d: any) => heavyEquipmentService.createCostItem(d),
    onSuccess: () => { invalidate(); setShowCreate(false); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => heavyEquipmentService.updateCostItem(id, d),
    onSuccess: () => { invalidate(); setEditItem(null); },
  });

  return (
    <div className="section-card glass">
      <div className="section-title" style={{ marginBottom: 14 }}>
        <div>
          <h4 style={{ margin: 0 }}>Katalog Item Biaya</h4>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Item biaya operasional yang diisi nominalnya oleh petugas lapangan setiap hari.
          </p>
        </div>
        {canEdit && <button className="btn" onClick={() => setShowCreate(true)}>+ Tambah Item</button>}
      </div>

      {listQ.isLoading ? (
        <div className="loading-state">Memuat data...</div>
      ) : listQ.error ? (
        <div className="danger-box">{extractError(listQ.error)}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama Item</th>
                <th style={{ textAlign: "right" }}>Nominal Default</th>
                <th>Urutan</th>
                <th>Status</th>
                {canEdit && <th>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</td>
                  <td style={{ fontSize: 13, textAlign: "right" }}>
                    {it.default_amount != null ? `Rp ${formatNumber(it.default_amount, 0)}` : "—"}
                  </td>
                  <td style={{ fontSize: 13 }}>{it.sort_order}</td>
                  <td>
                    <span className={`badge ${it.is_active ? "done" : "delay"}`}>
                      {it.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <div className="cluster">
                        <button className="chip clickable" onClick={() => setEditItem(it)}>Edit</button>
                        <button
                          className="chip clickable"
                          style={{ color: it.is_active ? "var(--danger)" : "var(--ok)" }}
                          onClick={() => updateMut.mutate({ id: it.id, is_active: !it.is_active })}
                        >
                          {it.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={canEdit ? 5 : 4} className="empty-state">Belum ada item biaya.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Tambah Item Biaya" onClose={() => setShowCreate(false)}>
          <CostItemForm
            onSuccess={(d) => createMut.mutate(d)}
            onCancel={() => setShowCreate(false)}
            isPending={createMut.isPending}
            error={createMut.error ? extractError(createMut.error) : ""}
          />
        </Modal>
      )}
      {editItem && (
        <Modal title={`Edit ${editItem.name}`} onClose={() => setEditItem(null)}>
          <CostItemForm
            initial={editItem}
            onSuccess={(d) => updateMut.mutate({ id: editItem.id, ...d })}
            onCancel={() => setEditItem(null)}
            isPending={updateMut.isPending}
            error={updateMut.error ? extractError(updateMut.error) : ""}
            isEdit
          />
        </Modal>
      )}
    </div>
  );
}

function CostItemForm({
  initial, onSuccess, onCancel, isPending, error, isEdit = false,
}: { initial?: HeavyEquipmentCostItem; onSuccess: (d: any) => void; onCancel: () => void; isPending: boolean; error: string; isEdit?: boolean }) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    default_amount: initial?.default_amount != null ? String(initial.default_amount) : "",
    sort_order: initial?.sort_order != null ? String(initial.sort_order) : "0",
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSuccess({
          name: form.name,
          default_amount: form.default_amount === "" ? null : Number(form.default_amount),
          sort_order: form.sort_order === "" ? 0 : Number(form.sort_order),
        });
      }}
    >
      {error && <div className="danger-box" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="field">
        <label className="required">Nama Item</label>
        <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required placeholder="mis. Uang makan operator" />
      </div>
      <div className="field">
        <label>Nominal Default <span style={{ color: "var(--muted)", fontWeight: 400 }}>— opsional</span></label>
        <input type="number" step="0.01" min="0" value={form.default_amount} onChange={(e) => setForm((p) => ({ ...p, default_amount: e.target.value }))} />
      </div>
      <div className="field">
        <label>Urutan Tampil</label>
        <input type="number" min="0" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))} />
      </div>
      <div className="modal-foot" style={{ padding: 0, marginTop: 4 }}>
        <div />
        <div className="cluster">
          <button type="button" className="btn secondary" onClick={onCancel} disabled={isPending}>Batal</button>
          <button type="submit" className="btn" disabled={isPending || !form.name}>
            {isPending ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Item"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Modal shell ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-window" style={{ maxWidth: 480 }}>
        <div className="modal-head">
          <div><h4>{title}</h4></div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
