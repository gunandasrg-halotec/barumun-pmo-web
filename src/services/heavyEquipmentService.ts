import api from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  HeavyEquipment,
  HeavyEquipmentCostItem,
  HeavyEquipmentLog,
  HeavyEquipmentAnalytics,
} from "../types";

export interface HeavyEquipmentLogFilters {
  equipment_id?: string;
  kebun?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const heavyEquipmentService = {
  // ── Master alat berat (Admin Sistem) ──
  list: async (activeOnly = false) => {
    const res = await api.get<ApiResponse<HeavyEquipment[]>>("/heavy-equipment", {
      params: { active_only: activeOnly },
    });
    return res.data;
  },
  create: async (d: { code: string; type: string; brand: string; is_active?: boolean }) => {
    const res = await api.post<ApiResponse<HeavyEquipment>>("/heavy-equipment", d);
    return res.data;
  },
  update: async (id: string, d: Partial<HeavyEquipment>) => {
    const res = await api.patch<ApiResponse<HeavyEquipment>>(`/heavy-equipment/${id}`, d);
    return res.data;
  },

  // ── Katalog item biaya (Finance / Admin Sistem) ──
  listCostItems: async (activeOnly = false) => {
    const res = await api.get<ApiResponse<HeavyEquipmentCostItem[]>>(
      "/heavy-equipment/cost-items",
      { params: { active_only: activeOnly } }
    );
    return res.data;
  },
  createCostItem: async (d: {
    name: string;
    default_amount?: number | null;
    is_active?: boolean;
    sort_order?: number;
  }) => {
    const res = await api.post<ApiResponse<HeavyEquipmentCostItem>>(
      "/heavy-equipment/cost-items",
      d
    );
    return res.data;
  },
  updateCostItem: async (id: string, d: Partial<HeavyEquipmentCostItem>) => {
    const res = await api.patch<ApiResponse<HeavyEquipmentCostItem>>(
      `/heavy-equipment/cost-items/${id}`,
      d
    );
    return res.data;
  },

  // ── Data mentah laporan harian ──
  listLogs: async (filters: HeavyEquipmentLogFilters = {}) => {
    const { page, limit, ...rest } = filters;
    const params: Record<string, any> = {};
    if (page) params.page = page;
    if (limit) params["per-page"] = limit;
    Object.entries(rest).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
    const res = await api.get<PaginatedResponse<HeavyEquipmentLog>>(
      "/heavy-equipment/logs",
      { params }
    );
    return res.data;
  },
  getLog: async (id: string) => {
    const res = await api.get<ApiResponse<HeavyEquipmentLog>>(
      `/heavy-equipment/logs/${id}`
    );
    return res.data;
  },

  // ── Analitik ──
  analytics: async (filters: Omit<HeavyEquipmentLogFilters, "page" | "limit"> = {}) => {
    const params: Record<string, any> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
    const res = await api.get<ApiResponse<HeavyEquipmentAnalytics>>(
      "/heavy-equipment/analytics",
      { params }
    );
    return res.data;
  },

  // ── Foto (blob, butuh Bearer token) ──
  downloadPhoto: async (url: string) => {
    return await api.get(url, { responseType: "blob" });
  },
};
