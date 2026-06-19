import api from "./api";
import type {
  ApiResponse,
  PaginatedResponse,
  ProjectFile,
  FileCategory,
} from "../types";

export interface FileFilters {
  file_type?: string;
  file_category_id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export const fileService = {
  listCategories: async (activeOnly = true) => {
    const res = await api.get<ApiResponse<FileCategory[]>>("/file-categories", {
      params: { active_only: activeOnly },
    });
    return res.data;
  },

  createCategory: async (data: {
    category_name: string;
    description?: string;
  }) => {
    const res = await api.post<ApiResponse<FileCategory>>(
      "/file-categories",
      data
    );
    return res.data;
  },

  updateCategory: async (id: string, data: Partial<FileCategory>) => {
    const res = await api.patch<ApiResponse<FileCategory>>(
      `/file-categories/${id}`,
      data
    );
    return res.data;
  },

  listFiles: async (projectId: string, filters: FileFilters = {}) => {
    const { page, limit, search, ...filterFields } = filters;
    const params: Record<string, any> = {};
    if (page)   params['page']       = page;
    if (limit)  params['per-page']   = limit;
    if (search) params['search']     = search;
    Object.entries(filterFields).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params[`filter[${k}]`] = v;
    });
    const res = await api.get<PaginatedResponse<ProjectFile>>(
      `/projects/${projectId}/files`,
      { params }
    );
    return res.data;
  },

  upload: async (projectId: string, formData: FormData) => {
    const res = await api.post<ApiResponse<ProjectFile>>(
      `/projects/${projectId}/files`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return res.data;
  },

  archive: async (fileId: string) => {
    const res = await api.delete<ApiResponse<null>>(`/files/${fileId}`);
    return res.data;
  },
};
