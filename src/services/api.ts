/// <reference types="vite/client" />

import axios, { AxiosError, type AxiosInstance } from "axios";

const BASE_URL = import.meta.env.VITE_BACKEND + "/api/v1";

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  withCredentials: true,
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => {
    const headers = res.headers as any;
    let authField: string | undefined;

    if (headers) {
      if (typeof headers.get === "function") {
        authField =
          headers.get("Authorization") ?? headers.get("authorization");
      } else {
        authField = headers["Authorization"] ?? headers["authorization"];
      }
    }
    //when token is expired but still in refresh date
    //update the token.
    
    if (authField && authField.startsWith("Bearer ")) {
      const newToken = authField.replace(/^Bearer\s+/, "");
      localStorage.setItem("auth_token", newToken);
    }
    return res;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const current_token = localStorage.getItem("auth_token");
      //user has been logged in but
      //account is deactivate or
      if (current_token) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        // window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
