import api from './api';
import type { ApiResponse, WbdVersion, WbdNode } from '../types';

export const wbdService = {
  // Versions
  listVersions: async (projectId: string) => {
    const res = await api.get<ApiResponse<WbdVersion[]>>(`/projects/${projectId}/wbd-versions`);
    return res.data;
  },

  getVersion: async (versionId: string) => {
    const res = await api.get<ApiResponse<WbdVersion>>(`/wbd-versions/${versionId}`);
    return res.data;
  },

  createVersion: async (projectId: string, basedOnVersionId?: string) => {
    const res = await api.post<ApiResponse<WbdVersion>>(`/projects/${projectId}/wbd-versions`, {
      based_on_version_id: basedOnVersionId,
    });
    return res.data;
  },

  submitVersion: async (versionId: string) => {
    const res = await api.post<ApiResponse<WbdVersion>>(`/wbd-versions/${versionId}/submit`);
    return res.data;
  },

  approveVersion: async (versionId: string) => {
    const res = await api.post<ApiResponse<WbdVersion>>(`/wbd-versions/${versionId}/approve`);
    return res.data;
  },

  rejectVersion: async (versionId: string, reason: string) => {
    const res = await api.post<ApiResponse<WbdVersion>>(`/wbd-versions/${versionId}/reject`, {
      reason,
    });
    return res.data;
  },

  // Nodes
  getNodes: async (versionId: string) => {
    const res = await api.get<ApiResponse<WbdNode[]>>(`/wbd-versions/${versionId}/nodes`);
    return res.data;
  },

  createNode: async (versionId: string, data: Partial<WbdNode>) => {
    const res = await api.post<ApiResponse<WbdNode>>(`/wbd-versions/${versionId}/nodes`, data);
    return res.data;
  },

  updateNode: async (nodeId: string, data: Partial<WbdNode>) => {
    const res = await api.patch<ApiResponse<WbdNode>>(`/wbd-nodes/${nodeId}`, data);
    return res.data;
  },

  deleteNode: async (nodeId: string) => {
    const res = await api.delete<ApiResponse<null>>(`/wbd-nodes/${nodeId}`);
    return res.data;
  },
};
