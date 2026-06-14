import api from './api';
import type { ApiResponse, PaginatedResponse, Project } from '../types';

export interface ProjectFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const projectService = {
  list: async (filters: ProjectFilters = {}) => {
    const res = await api.get<PaginatedResponse<Project>>('/projects', { params: filters });
    return res.data;
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<Project>>(`/projects/${id}`);
    return res.data;
  },

  create: async (data: Partial<Project>) => {
    const res = await api.post<ApiResponse<Project>>('/projects', data);
    return res.data;
  },

  update: async (id: string, data: Partial<Project>) => {
    const res = await api.patch<ApiResponse<Project>>(`/projects/${id}`, data);
    return res.data;
  },
};
