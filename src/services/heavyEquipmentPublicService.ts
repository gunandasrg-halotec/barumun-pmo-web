import publicApi from "./publicApi";
import type {
  ApiResponse,
  FuelStockReceiptEntry,
  HeavyEquipment,
  HeavyEquipmentActivityTypeConfig,
  HeavyEquipmentCostItem,
  HeavyEquipmentLog,
} from "../types";

const pin = (p: string) => ({ headers: { "X-Access-Pin": p } });

export const heavyEquipmentPublicService = {
  verifyPin: async (p: string) => {
    const res = await publicApi.get<ApiResponse<null>>(
      "/public/heavy-equipment/verify-pin",
      pin(p)
    );
    return res.data;
  },

  listEquipments: async (p: string) => {
    const res = await publicApi.get<ApiResponse<HeavyEquipment[]>>(
      "/public/heavy-equipment/equipments",
      pin(p)
    );
    return res.data;
  },

  listCostItems: async (p: string) => {
    const res = await publicApi.get<ApiResponse<HeavyEquipmentCostItem[]>>(
      "/public/heavy-equipment/cost-items",
      pin(p)
    );
    return res.data;
  },

  listActivityTypes: async (p: string) => {
    const res = await publicApi.get<ApiResponse<HeavyEquipmentActivityTypeConfig[]>>(
      "/public/heavy-equipment/activity-types",
      pin(p)
    );
    return res.data;
  },

  submitFuelReceipts: async (
    p: string,
    payload: { kebun: string; receipt_date: string; receipts: FuelStockReceiptEntry[] }
  ) => {
    const res = await publicApi.post<ApiResponse<unknown>>(
      "/public/heavy-equipment/fuel-receipts",
      payload,
      pin(p)
    );
    return res.data;
  },

  submitLog: async (p: string, formData: FormData) => {
    const res = await publicApi.post<ApiResponse<HeavyEquipmentLog>>(
      "/public/heavy-equipment/logs",
      formData,
      { headers: { "X-Access-Pin": p, "Content-Type": "multipart/form-data" } }
    );
    return res.data;
  },
};
