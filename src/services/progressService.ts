import api from './api';
import type { ApiResponse, PaginatedResponse, ProgressEntry } from '../types';

export interface ProgressFilters {
  status?: string;
  date_from?: string;
  date_to?: string;
  wbd_node_id?: string;
  page?: number;
  limit?: number;
}

export const progressService = {
  list: async (projectId: string, filters: ProgressFilters = {}) => {
    const res = await api.get<PaginatedResponse<ProgressEntry>>(
      `/projects/${projectId}/progress-entries`,
      { params: filters }
    );
    return res.data;
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<ProgressEntry>>(`/progress-entries/${id}`);
    return res.data;
  },

  create: async (
    projectId: string,
    data: { wbd_node_id: string; progress_date: string; progress_volume: number; note?: string }
  ) => {
    const res = await api.post<ApiResponse<ProgressEntry>>(
      `/projects/${projectId}/progress-entries`,
      data
    );
    return res.data;
  },

  approve: async (id: string) => {
    const res = await api.post<ApiResponse<ProgressEntry>>(`/progress-entries/${id}/approve`);
    return res.data;
  },

  reject: async (id: string, reason: string) => {
    const res = await api.post<ApiResponse<ProgressEntry>>(`/progress-entries/${id}/reject`, {
      reason,
    });
    return res.data;
  },
};
