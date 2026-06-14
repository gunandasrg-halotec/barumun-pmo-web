import api from "./api";
import type { ApiResponse, PaginatedResponse, Role, User } from "../types";

export interface filters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const accountService = {
  list: async (filters: filters = {}) => {
    const res = await api.get<PaginatedResponse<User>>("/users", {
      params: filters,
    });

    return res.data;
  },
  roles: async () => {
    const res = await api.get("/roles");
    return res.data;
  },
  //   get: async (id: string) => {
  //     const res = await api.get<ApiResponse<Project>>(`/projects/${id}`);
  //     return res.data;
  //   },

  //   create: async (data: Partial<Project>) => {
  //     const res = await api.post<ApiResponse<Project>>('/projects', data);
  //     return res.data;
  //   },

  //   update: async (id: string, data: Partial<Project>) => {
  //     const res = await api.patch<ApiResponse<Project>>(`/projects/${id}`, data);
  //     return res.data;
  //   },
};
