import { createContext, useContext, useState } from "react";
import { authApi } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("gem_finder_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
