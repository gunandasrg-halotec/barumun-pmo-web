import api from './api';
import type { ApiResponse, DashboardData, GanttNode, SCurveSeries, CostAnalysisItem } from '../types';

export const analyticsService = {
  dashboard: async (projectId: string) => {
    const res = await api.get<ApiResponse<DashboardData>>(`/projects/${projectId}/dashboard`);
    return res.data;
  },

  gantt: async (projectId: string) => {
    const res = await api.get<ApiResponse<GanttNode[]>>(`/projects/${projectId}/gantt`);
    return res.data;
  },

  sCurve: async (projectId: string) => {
    const res = await api.get<ApiResponse<{ actual_series: SCurveSeries[] }>>(
      `/projects/${projectId}/s-curve`
    );
    return res.data;
  },

  costAnalysis: async (projectId: string) => {
    const res = await api.get<ApiResponse<CostAnalysisItem[]>>(
      `/projects/${projectId}/cost-analysis`
    );
    return res.data;
  },
};
