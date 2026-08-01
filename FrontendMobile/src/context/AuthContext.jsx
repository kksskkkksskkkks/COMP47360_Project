import { createContext, useContext, useEffect, useState, useCallback } from "react";
import storage from "../lib/storage";
import { authApi, setOnUnauthorized, TOKEN_KEY, USER_KEY } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true); // restoring session from disk
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // On first mount, restore whatever session was persisted from a previous
  // app launch (AsyncStorage survives app restarts, same role localStorage
  // played on web).
  useEffect(() => {
    (async () => {
      try {
        const [token, rawUser] = await storage.multiGet([TOKEN_KEY, USER_KEY]);
        const tokenValue = token?.[1];
        const rawUserValue = rawUser?.[1];
        if (tokenValue && rawUserValue) {
          setUser(JSON.parse(rawUserValue));
        }
      } catch {
        // ignore — fall through to logged-out state
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  async function persist(token, userDto) {
    await storage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(userDto)],
    ]);
    setUser(userDto);
  }

  async function login(email, password) {
    setLoading(true);
    setError("");
    try {
      // The response has already been unwrapped by the api.js interceptor, so
      // data here is the JwtResponse: { token, user }
      const { data } = await authApi.login(email, password);

      if (!data || !data.token || !data.user) {
        // Surface exactly what came back instead of silently falling through
        // to the generic "Login failed" message below — this is a shape
        // mismatch bug, not a wrong-password case, and they should never
        // look the same to whoever is debugging this.
        console.warn("[AuthContext] Unexpected login response shape:", data);
        throw new Error("Login response was missing token/user — check API response shape.");
      }

      await persist(data.token, data.user);
      return true;
    } catch (err) {
      console.warn("[AuthContext] login() failed:", err);
      setError(err.response?.data?.message || err.message || "Login failed. Please check your email and password.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function register(username, email, password) {
    setLoading(true);
    setError("");
    try {
      // The register endpoint only returns a UserDTO, no token, so we log in
      // automatically right after a successful registration.
      await authApi.register(username, email, password);
      return await login(email, password);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again later.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  const logout = useCallback(async () => {
    await storage.multiRemove([TOKEN_KEY, USER_KEY]);
    setUser(null);
  }, []);

  // Lets the Profile screen push an updated UserDTO (returned by the
  // username/email/high-contrast endpoints) into local state + storage
  // without a full re-login.
  async function setUserLocal(updatedUser) {
    await storage.setItem(USER_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
  }

  // Wire up api.js's 401 handler to clear context state too — api.js itself
  // has no React context access, so it calls back into here.
  useEffect(() => {
    setOnUnauthorized(() => {
      setUser(null);
    });
    return () => setOnUnauthorized(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, bootstrapping, loading, error, login, register, logout, setUserLocal }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
