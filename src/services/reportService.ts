import api from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  ReportRecord,
  ReportType,
} from "../types";

export const reportService = {
  list: async (projectId: string) => {
    const res = await api.get<PaginatedResponse<ReportRecord>>(
      `/projects/${projectId}/reports`
    );
    return res.data;
  },

  generate: async (
    projectId: string,
    // data: { report_type: ReportType; period_start: string; period_end: string }
    data: { report_type: string; date_from: string; date_to: string }
  ) => {
    const res = await api.post<ApiResponse<ReportRecord>>(
      `/projects/${projectId}/reports/generate`,
      data
    );
    return res.data;
  },
  delete: async (id: string) => {},
};
