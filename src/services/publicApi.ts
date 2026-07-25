/// <reference types="vite/client" />

import axios, { type AxiosInstance } from "axios";

// Instance axios TERPISAH untuk endpoint publik (lapangan) — TANPA interceptor
// token, sehingga Bearer token (kalau kebetulan ada di localStorage) tidak
// pernah ikut terkirim. Otorisasi memakai header X-Access-Pin.
const TARGET_HOST = import.meta.env.VITE_API_URL || "http://8.219.106.148:8021";
const BASE_URL = `${TARGET_HOST.trim()}/api/v1`;

const publicApi: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { Accept: "application/json" },
});

export default publicApi;
