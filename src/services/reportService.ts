import api from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  ReportRecord,
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
    // Backend contract: report_type ∈ {WEEKLY,MONTHLY,PROGRESS,COST,SUMMARY}
    // with period_start / period_end (dates).
    data: { report_type: string; period_start: string; period_end: string }
  ) => {
    const res = await api.post<ApiResponse<ReportRecord>>(
      `/projects/${projectId}/reports/generate`,
      data
    );
    return res.data;
  },
  delete: async (id: string) => {},
};
