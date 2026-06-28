import axios from "axios";
import storage from "./storage";
import { API_BASE_URL } from "./config";

export const TOKEN_KEY = "gem_finder_token";
export const USER_KEY = "gem_finder_user";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: automatically attach the JWT saved after login.
// AsyncStorage is async, so this awaits the read on every request (axios
// interceptors support returning a Promise).
api.interceptors.request.use(async (config) => {
  const token = await storage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Decodes (without verifying — that's the server's job) the `exp` claim out
// of a JWT's payload, purely so the UI can proactively recognize "this
// token is already dead" before firing a request, instead of guessing
// based on a 401 status code that could mean several different things.
//
// React Native has no `atob` built in (unlike browsers), so base64 is
// decoded manually via Buffer (polyfilled by Metro/Hermes) — if that's
// unavailable for some reason we fall back to returning null instead of
// crashing.
function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  if (typeof atob === "function") return atob(padded);
  if (typeof Buffer !== "undefined") return Buffer.from(padded, "base64").toString("utf-8");
  return null;
}

function getTokenExpiryMs(token) {
  try {
    const payload = token.split(".")[1];
    const decoded = base64UrlDecode(payload);
    if (!decoded) return null;
    const json = JSON.parse(decoded);
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

// True if there's no token, or the locally stored one has already passed
// its `exp` time. Used to distinguish a genuinely expired session from an
// endpoint-specific 401 that means something else (e.g. "wrong current
// password" on PUT /auth/password) — both come back as a bare 401, but
// only one of them should trigger a forced re-login.
export async function isSessionExpired() {
  const token = await storage.getItem(TOKEN_KEY);
  if (!token) return true;
  const expiryMs = getTokenExpiryMs(token);
  if (expiryMs == null) return false; // can't decode it — don't guess
  return Date.now() >= expiryMs;
}

// Allows AuthContext to react to a forced logout (401) without this module
// needing to know about navigation. AuthContext registers a callback here;
// the response interceptor below calls it after clearing storage.
let onUnauthorized = null;
export function setOnUnauthorized(callback) {
  onUnauthorized = callback;
}

// 1) Unwraps the {code, message, data} envelope into response.data directly.
//    Note: the admin GET /api/users endpoint and SSE streaming endpoints don't
//    use this envelope, so we only unwrap when the shape actually matches
//    { code, message, data }; otherwise the response is left untouched.
// 2) On 401, clear local auth state and notify AuthContext.
api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === "object" && "code" in body && "data" in body) {
      response.data = body.data;
      response.meta = { code: body.code, message: body.message };
    } else if (__DEV__) {
      // Helps catch cases where a response doesn't match the expected
      // {code, message, data} envelope (e.g. backend changed shape, or a
      // proxy/dev server returned something unexpected) — without this,
      // downstream code silently reads undefined fields off the raw body.
      console.warn(`[api] Response from ${response.config?.url} did not match the {code, message, data} envelope:`, body);
    }
    return response;
  },
  async (error) => {
    // The change-password endpoint deliberately returns 401 to mean
    // "current password is incorrect" — a business-logic error, not an
    // expired session. Don't let that trigger the global auto-logout.
    const isPasswordChangeRequest = error.config?.url?.includes("/auth/password");
    if (error.response?.status === 401 && !isPasswordChangeRequest) {
      await storage.multiRemove([TOKEN_KEY, USER_KEY]);
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  }
);

// Build the "no timezone" format LocalDateTime expects: YYYY-MM-DDTHH:mm:ss
export function toLocalDateTimeString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

// Busyness/heat-map snapshots are pre-computed on a fixed grid (every 30 minutes),
// so querying with an unaligned "exact now" timestamp tends to miss. Floor to the
// nearest 30-minute mark before formatting.
export function currentSnapshotTimeBucket(date = new Date()) {
  const floored = new Date(date);
  floored.setMinutes(date.getMinutes() < 30 ? 0 : 30, 0, 0);
  return toLocalDateTimeString(floored);
}

// Defensive against a common Jackson quirk: a boolean field with an isXxx()
// getter on a plain class (not a record) is often serialized as "xxx"
// instead of "isXxx" (the "is" prefix gets stripped). Read whichever key is
// present so the UI doesn't silently break if a DTO implementation changes
// between a record and a regular class. Returns `fallback` (default null)
// if neither key is present.
export function readBoolField(obj, isXxxKey, xxxKey, fallback = null) {
  if (obj[isXxxKey] !== undefined) return obj[isXxxKey];
  if (obj[xxxKey] !== undefined) return obj[xxxKey];
  return fallback;
}

// ---------------- 1. Auth ----------------
export const authApi = {
  register: (username, email, password) =>
    api.post("/auth/register", { username, email, password }),
  login: (email, password) => api.post("/auth/login", { email, password }),
  changePassword: (currentPassword, newPassword) =>
    api.put("/auth/password", { currentPassword, newPassword }),
  logoutAll: () => api.post("/auth/logout-all"),
  updateHighContrast: (highContrast) =>
    api.patch("/auth/high-contrast", null, { params: { highContrast } }),
  updateUsername: (username) => api.patch("/auth/username", { username }),
  updateEmail: (email) => api.patch("/auth/email", { email }),
};

// ---------------- 3. Attractions ----------------
export const attractionApi = {
  // params: { keyword, category, wheelchair, page, size, sort }
  list: (params) => api.get("/attractions", { params }),
  detail: (id) => api.get(`/attractions/${id}`),
  byZone: (zoneId) => api.get(`/attractions/zone/${zoneId}`),
};

// ---------------- 4 & 5. Busyness ----------------
export const busynessApi = {
  one: (zoneId, timeBucket) => api.get("/busyness", { params: { zoneId, timeBucket } }),
  forecast: (zoneId, from, to) =>
    api.get(`/busyness/${zoneId}/forecast`, { params: { from, to } }),
  snapshot: (timeBucket) => api.get("/busyness/snapshot", { params: { timeBucket } }),
  forAttraction: (attractionId, date) =>
    api.get(`/attractions/${attractionId}/busyness`, { params: date ? { date } : {} }),
};

// ---------------- 6. Recommendations ----------------
export const recommendationApi = {
  list: (params) => api.get("/recommendations", { params }),
};

// ---------------- 7. Heat map / "open + busyness" snapshot for list cards ----------------
export const mapApi = {
  attractions: (timeBucket) => api.get("/map/attractions", { params: { timeBucket } }),
};

// ---------------- 10. Check-ins ----------------
export const checkinApi = {
  listByUser: (userId, params) => api.get(`/users/${userId}/checkins`, { params }),
  listByAttraction: (attractionId, params) =>
    api.get(`/attractions/${attractionId}/checkins`, { params }),
  create: (userId, attractionId, busynessAtVisit) =>
    api.post(`/users/${userId}/checkins/${attractionId}`, { busynessAtVisit }),
};

// ---------------- 11. Favorites ----------------
export const favoriteApi = {
  list: (userId, params) => api.get(`/users/${userId}/favorites`, { params }),
  isFavorited: (userId, attractionId) =>
    api.get(`/users/${userId}/favorites/${attractionId}`),
  add: (userId, attractionId) => api.post(`/users/${userId}/favorites/${attractionId}`),
  remove: (userId, attractionId) =>
    api.delete(`/users/${userId}/favorites/${attractionId}`),
};

// ---------------- 12. Ratings ----------------
export const ratingApi = {
  listByUser: (userId, params) => api.get(`/users/${userId}/ratings`, { params }),
  listByAttraction: (attractionId, params) =>
    api.get(`/attractions/${attractionId}/ratings`, { params }),
  getOne: (userId, attractionId) => api.get(`/users/${userId}/ratings/${attractionId}`),
  create: (userId, attractionId, rating) =>
    api.post(`/users/${userId}/ratings/${attractionId}`, { rating }),
  update: (userId, attractionId, rating) =>
    api.put(`/users/${userId}/ratings/${attractionId}`, { rating }),
  remove: (userId, attractionId) => api.delete(`/users/${userId}/ratings/${attractionId}`),
};

// ---------------- 9. Activity stats ----------------
export const activityStatsApi = {
  get: (userId) => api.get(`/users/${userId}/activity-stats`),
};

export default api;
