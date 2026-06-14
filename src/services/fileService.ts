import api from './api';
import type { ApiResponse, PaginatedResponse, ProjectFile, FileCategory } from '../types';

export interface FileFilters {
  file_type?: string;
  file_category_id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  page?: number;
  limit?: number;
}

export const fileService = {
  listCategories: async (activeOnly = true) => {
    const res = await api.get<ApiResponse<FileCategory[]>>('/file-categories', {
      params: { active_only: activeOnly },
    });
    return res.data;
  },

  createCategory: async (data: { category_name: string; description?: string }) => {
    const res = await api.post<ApiResponse<FileCategory>>('/file-categories', data);
    return res.data;
  },

  updateCategory: async (id: string, data: Partial<FileCategory>) => {
    const res = await api.patch<ApiResponse<FileCategory>>(`/file-categories/${id}`, data);
    return res.data;
  },

  listFiles: async (projectId: string, filters: FileFilters = {}) => {
    const res = await api.get<PaginatedResponse<ProjectFile>>(`/projects/${projectId}/files`, {
      params: filters,
    });
    return res.data;
  },

  upload: async (projectId: string, formData: FormData) => {
    const res = await api.post<ApiResponse<ProjectFile>>(`/projects/${projectId}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  archive: async (fileId: string) => {
    const res = await api.delete<ApiResponse<null>>(`/files/${fileId}`);
    return res.data;
  },
};
