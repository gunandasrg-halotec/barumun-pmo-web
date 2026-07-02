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
    const { status, date_from, date_to, wbd_node_id, page, limit } = filters;
    const params: Record<string, any> = {};
    if (status)      params['filter[status]']       = status;
    if (date_from)   params['filter[date_from]']    = date_from;
    if (date_to)     params['filter[date_to]']      = date_to;
    if (wbd_node_id) params['filter[wbd_node_id]']  = wbd_node_id;
    if (page)        params['page']                 = page;
    if (limit)       params['per-page']             = limit;
    const res = await api.get<PaginatedResponse<ProgressEntry>>(
      `/projects/${projectId}/progress-entries`,
      { params }
    );
    return res.data;
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<ProgressEntry>>(`/progress-entries/${id}`);
    return res.data;
  },

  create: async (
    projectId: string,
    data: FormData | { wbd_node_id: string; progress_date: string; progress_volume: number; actual_cost?: number; note?: string }
  ) => {
    const res = await api.post<ApiResponse<ProgressEntry>>(
      `/projects/${projectId}/progress-entries`,
      data,
      data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
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
