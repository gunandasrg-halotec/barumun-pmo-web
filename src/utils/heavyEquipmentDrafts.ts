// Penyimpanan draft laporan alat berat di perangkat (IndexedDB).
// IndexedDB dipilih karena bisa menyimpan File/Blob (foto) & kapasitas besar,
// tidak seperti localStorage yang kecil dan hanya string.

const DB_NAME = "pmo_heavy_equipment";
const DB_VERSION = 1;
const STORE = "drafts";

export interface HeavyEquipmentDraft {
  id: number;
  savedAt: number;
  form: Record<string, string>;
  activities: Record<
    string,
    { enabled: boolean; start_date: string; end_date: string; start_time: string; end_time: string; volume: string; description: string; repair_cost: string }
  >;
  costs: Record<string, { amount: string }>;
  photos: File[];
  summary: {
    log_date: string;
    kebun: string;
    operator: string;
    equipment_id: string;
    activityCount: number;
    photoCount: number;
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraft(draft: Omit<HeavyEquipmentDraft, "id">): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add(draft);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listDrafts(): Promise<HeavyEquipmentDraft[]> {
  const db = await openDb();
  try {
    const rows = await new Promise<HeavyEquipmentDraft[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as HeavyEquipmentDraft[]);
      req.onerror = () => reject(req.error);
    });
    return rows.sort((a, b) => b.savedAt - a.savedAt);
  } finally {
    db.close();
  }
}

export async function deleteDraft(id: number): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function countDrafts(): Promise<number> {
  const db = await openDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
