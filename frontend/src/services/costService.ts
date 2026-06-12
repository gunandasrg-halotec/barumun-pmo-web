import api from './api';
import type { ApiResponse, PaginatedResponse, ActualCostTransaction } from '../types';

export interface CostFilters {
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const costService = {
  list: async (projectId: string, filters: CostFilters = {}) => {
    const res = await api.get<PaginatedResponse<ActualCostTransaction>>(
      `/projects/${projectId}/actual-cost-transactions`,
      { params: filters }
    );
    return res.data;
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<ActualCostTransaction>>(
      `/actual-cost-transactions/${id}`
    );
    return res.data;
  },

  create: async (
    projectId: string,
    data: {
      progress_entry_id: string;
      amount: number;
      transaction_date: string;
      description?: string;
    }
  ) => {
    const res = await api.post<ApiResponse<ActualCostTransaction>>(
      `/projects/${projectId}/actual-cost-transactions`,
      data
    );
    return res.data;
  },

  approve: async (id: string) => {
    const res = await api.post<ApiResponse<ActualCostTransaction>>(
      `/actual-cost-transactions/${id}/approve`
    );
    return res.data;
  },

  reject: async (id: string, reason: string) => {
    const res = await api.post<ApiResponse<ActualCostTransaction>>(
      `/actual-cost-transactions/${id}/reject`,
      { reason }
    );
    return res.data;
  },
};
