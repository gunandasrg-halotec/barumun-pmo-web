import api from './api';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  read_at: string | null;
  created_at: string;
}

export const notificationService = {
  list: async (): Promise<{ data: AppNotification[]; unread: number }> => {
    const res = await api.get('/notifications');
    return res.data;
  },
  markRead: async (id: string) => {
    const res = await api.post(`/notifications/${id}/read`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await api.post('/notifications/read-all');
    return res.data;
  },
};
