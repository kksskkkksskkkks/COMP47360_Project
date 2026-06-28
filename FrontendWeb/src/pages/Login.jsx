import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const { login, register, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/gems";
  const flash = location.state?.flash || "";

  const isLogin = mode === "login";

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError("");

    if (!isLogin && password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    const ok = isLogin
      ? await login(email, password)
      : await register(username, email, password);

    if (ok) navigate(from, { replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-sm">
      <div className="w-full max-w-[440px] bg-surface-container-lowest rounded-xl shadow-[0_20px_60px_rgba(0,104,95,0.08)] p-lg">
        <div className="text-center mb-lg">
          <Link to="/" className="text-headline-md font-headline-md font-bold text-primary">
            Gem Finder
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant mb-md">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={
              isLogin
                ? "flex-1 pb-sm font-label-caps text-label-caps text-primary border-b-2 border-primary transition-all"
                : "flex-1 pb-sm font-label-caps text-label-caps text-secondary border-b-2 border-transparent hover:text-primary transition-all"
            }
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={
              !isLogin
                ? "flex-1 pb-sm font-label-caps text-label-caps text-primary border-b-2 border-primary transition-all"
                : "flex-1 pb-sm font-label-caps text-label-caps text-secondary border-b-2 border-transparent hover:text-primary transition-all"
            }
          >
            Sign Up
          </button>
        </div>

        <h1 className="text-headline-md font-headline-md text-on-surface mb-1">
          {isLogin ? "Welcome Back" : "Create an Account"}
        </h1>
        <p className="text-body-md font-body-md text-secondary mb-md">
          {isLogin
            ? "Enter your details to access your curated gems."
            : "Join the exclusive community of explorers."}
        </p>

        {flash && (
          <p className="text-primary text-body-md font-body-md bg-primary/10 rounded-lg px-sm py-[10px] mb-md">
            {flash}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-sm" id="auth-form">
          {!isLogin && (
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-xs">
                Username
              </label>
              <input
                className="w-full px-sm py-[12px] rounded-lg bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-secondary/50"
                placeholder="3-64 characters"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={64}
                required
              />
            </div>
          )}

          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-xs">
              Email Address
            </label>
            <input
              className="w-full px-sm py-[12px] rounded-lg bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-secondary/50"
              placeholder="name@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-xs">
              Password
            </label>
            <input
              className="w-full px-sm py-[12px] rounded-lg bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-secondary/50"
              placeholder={isLogin ? "••••••••" : "6-128 characters"}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={isLogin ? undefined : 6}
              maxLength={isLogin ? undefined : 128}
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-xs">
                Confirm Password
              </label>
              <input
                className="w-full px-sm py-[12px] rounded-lg bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 outline-none transition-all font-body-md text-body-md text-on-surface placeholder:text-secondary/50"
                placeholder="6-128 characters"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                maxLength={128}
                required
              />
            </div>
          )}

          {isLogin && (
            <div className="flex justify-end -mt-1">
              <a className="font-body-md text-[13px] text-primary hover:text-primary-fixed-dim transition-colors" href="#">
                Forgot password?
              </a>
            </div>
          )}

          {(localError || error) && (
            <p className="text-error text-body-md text-[14px]">{localError || error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-[12px] rounded-full bg-primary text-on-primary font-body-md font-medium hover:opacity-90 transition-opacity disabled:opacity-60 mt-xs"
          >
            {loading ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
