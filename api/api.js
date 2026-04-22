import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Auto-attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("raneev-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Auth ───
export const register = (data) => api.post("/api/auth/register", data);
export const login = (data) => api.post("/api/auth/login", data);

// ─── Users ───
export const createUser = (data) => api.post("/api/users", data);
export const fetchProfile = (email) => api.get(`/api/profile/${encodeURIComponent(email)}`);

// ─── Emergencies ───
export const fetchEmergencies = () => api.get("/api/emergencies");
export const fetchEmergency = (id) => api.get(`/api/emergencies/${id}`);
export const createSOS = (data) => api.post("/api/sos", data);
export const acceptEmergency = (data) => api.post("/api/accept", data);
export const fetchStats = () => api.get("/api/stats");

// ─── Volunteers ───
export const goLive = (data) => api.post("/api/go-live", data);
export const goOffline = (userId) => api.post(`/api/go-offline?user_id=${userId}`);
export const fetchNearbyVolunteers = (lat, lng, radius = 5) =>
  api.get(`/api/volunteers?lat=${lat}&lng=${lng}&radius_km=${radius}`);
export const updateLocation = (userId, lat, lng) =>
  api.post(`/api/update-location?user_id=${userId}&lat=${lat}&lng=${lng}`);

// ─── Coins / Analytics ───
export const redeemCoins = (data) => api.post("/api/redeem-coins", data);
export const fetchRedeemHistory = (email) => api.get(`/api/redeem-history/${encodeURIComponent(email)}`);
export const fetchVolunteerGrowth = (userId) => api.get(`/api/volunteer/growth/${userId}`);
export const fetchVolunteerHistory = (userId) => api.get(`/api/volunteer/history/${userId}`);

// ─── Health ───
export const checkHealth = () => api.get("/");

// ─── Ambulance (stub) ───
export const notifyAmbulance = (data) => api.post("/api/notify-ambulance", data);

export default api;
