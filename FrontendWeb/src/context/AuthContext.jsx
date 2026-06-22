import { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("gem_finder_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // localStorage is shared across every tab/window of this origin, but each
  // tab's React state is only updated by ITS OWN code — if you log into a
  // different account in another tab, this tab's `user` state has no idea
  // the token underneath it just got swapped out from under it. It would
  // keep showing the old account's name while silently making requests
  // with the new account's token (since the axios interceptor reads
  // localStorage fresh on every call). The "storage" event fires in every
  // *other* tab whenever one tab writes to localStorage, so listening for
  // it lets every open tab stay in sync the moment any one of them logs
  // in, logs out, or switches accounts.
  useEffect(() => {
    function handleStorage(e) {
      if (e.key !== "gem_finder_token" && e.key !== "gem_finder_user") return;

      const token = localStorage.getItem("gem_finder_token");
      const rawUser = localStorage.getItem("gem_finder_user");

      if (!token || !rawUser) {
        setUser(null);
        return;
      }

      try {
        setUser(JSON.parse(rawUser));
      } catch {
        setUser(null);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function persist(token, userDto) {
    localStorage.setItem("gem_finder_token", token);
    localStorage.setItem("gem_finder_user", JSON.stringify(userDto));
    setUser(userDto);
  }

  async function login(email, password) {
    setLoading(true);
    setError("");
    try {
      // The response has already been unwrapped by the api.js interceptor, so
      // data here is the JwtResponse: { token, user }
      const { data } = await authApi.login(email, password);
      persist(data.token, data.user);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please check your email and password.");
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

  function logout() {
    localStorage.removeItem("gem_finder_token");
    localStorage.removeItem("gem_finder_user");
    setUser(null);
  }

  // Lets the Profile page push an updated UserDTO (returned by the
  // username/email/high-contrast endpoints) into local state + storage
  // without a full re-login.
  function setUserLocal(updatedUser) {
    localStorage.setItem("gem_finder_user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, setUserLocal }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
