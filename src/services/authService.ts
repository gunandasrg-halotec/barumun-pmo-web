import api from "./api";
import type { ApiResponse, LoginResponse, User } from "../types";

export const authService = {
  login: async (email: string, password: string) => {
    const res = await api.post<LoginResponse<{ token: string; user: User }>>(
      "/auth/login",
      {
        email,
        password,
      }
    );

    return res.data;
  },

  me: async () => {
    const res = await api.get<User>("/auth/me");
    return res.data;
  },

  logout: async () => {
    await api.post("/auth/logout");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
  },
};
