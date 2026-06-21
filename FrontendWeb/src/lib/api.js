import axios from "axios";

// Spring backend base URL. Configure VITE_API_BASE_URL in .env during development,
// e.g. VITE_API_BASE_URL=http://localhost:8080/api
const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: automatically attach the JWT saved after login
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("gem_finder_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor:
// 1) Unwrap { code, message, data } -> return data directly, so call sites don't
//    need to write .data.data everywhere.
//    Note: the admin GET /api/users endpoint and SSE streaming endpoints don't use
//    this envelope, so we only unwrap when the shape actually matches
//    { code, message, data }; otherwise the response is left untouched.
// 2) On 401, clear local auth state and redirect to the login page
api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === "object" && "code" in body && "data" in body) {
      response.data = body.data;
      response.meta = { code: body.code, message: body.message };
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("gem_finder_token");
      localStorage.removeItem("gem_finder_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
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
// getter on a plain class (not a record) is often serialized as "xxx" instead
// of "isXxx" (the "is" prefix gets stripped). Read whichever key is present
// so the UI doesn't silently break if a DTO implementation changes between a
// record and a regular class. Returns `fallback` (default null) if neither
// key is present.
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
  // zoneId + timeBucket (ISO LocalDateTime)
  one: (zoneId, timeBucket) => api.get("/busyness", { params: { zoneId, timeBucket } }),
  forecast: (zoneId, from, to) =>
    api.get(`/busyness/${zoneId}/forecast`, { params: { from, to } }),
  snapshot: (timeBucket) => api.get("/busyness/snapshot", { params: { timeBucket } }),
  // Per-attraction, per-day busyness slots (used by the detail page chart)
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

// ---------------- 2. User management (admin only) ----------------
// NOTE: per the doc, GET /api/users does NOT use the {code,message,data}
// envelope (unlike almost everything else), so res.data here is the raw
// Page<UserDTO> directly — the response interceptor only unwraps when it
// actually sees that shape, so this passes through untouched automatically.
export const userApi = {
  list: (params) => api.get("/users", { params }),
  get: (id) => api.get(`/users/${id}`),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, null, { params: { role } }),
  deactivate: (id) => api.patch(`/users/${id}/deactivate`),
  activate: (id) => api.patch(`/users/${id}/activate`),
};

// ---------------- 13. Weather chatbot ----------------
export const weatherChatApi = {
  chat: (message, history) => api.post("/weather-chatbot/chat", { message, history }),
  forecast: () => api.get("/weather-chatbot/forecast"),
};

// Raw fetch-based SSE reader for POST /weather-chatbot/chat/stream.
// axios doesn't have first-class support for streaming a POST response body,
// so this talks to the endpoint directly. Calls `onEvent({ event, data })`
// for every "event: ...\ndata: ..." block as it arrives.
export async function streamWeatherChat(message, history, onEvent) {
  const token = localStorage.getItem("gem_finder_token");
  const response = await fetch(`${baseURL}/weather-chatbot/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok || !response.body) {
    let detail = "";
    try {
      detail = (await response.json())?.message;
    } catch {
      // ignore — response wasn't JSON
    }
    throw new Error(detail || `Stream request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let eventName = "message";
      let dataLine = "";
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;

      let data;
      try {
        data = JSON.parse(dataLine);
      } catch {
        data = dataLine;
      }
      onEvent({ event: eventName, data });
    }
  }
}

export default api;
