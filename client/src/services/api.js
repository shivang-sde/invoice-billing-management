import axios from "axios";

const api = axios.create({
  // ◄ CHANGED: Reads the variable dynamically from your configuration!
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const path = window.location.pathname;

  const token = path.startsWith("/kyc-verification")
    ? localStorage.getItem("kyc_token")
    : localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;