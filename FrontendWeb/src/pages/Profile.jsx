import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  authApi,
  activityStatsApi,
  favoriteApi,
  checkinApi,
  ratingApi,
  attractionApi,
  readBoolField,
  isSessionExpired,
} from "../lib/api";
import { useAuth } from "../context/AuthContext";
import AttractionCard from "../components/AttractionCard";

// Activity-stats / favorites response shapes aren't pinned down by a shared
// DTO doc, so read defensively: try several plausible key spellings and
// fall back to `fallback` instead of crashing if the backend uses a
// different name than we guessed.
function pick(obj, keys, fallback = null) {
  if (!obj) return fallback;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return fallback;
}

// favoriteApi.list / checkinApi.listByUser / ratingApi.listByUser all return
// a Spring Data Page<T> ({ content: [...] }) but could also just be a plain
// array — handle both.
function extractList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  return [];
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Edit Profile modal — General (username + high contrast) / Security
// (email + change password) tabs, matching the Stitch "Edit Profile" design.
// ---------------------------------------------------------------------------
function EditProfileModal({ open, onClose, user, highContrast, onSaved, onSessionExpired }) {
  const { login } = useAuth();
  const [tab, setTab] = useState("general");

  const [draftUsername, setDraftUsername] = useState(user.username);
  const [draftEmail, setDraftEmail] = useState(user.email);
  const [draftHighContrast, setDraftHighContrast] = useState(highContrast);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset every draft field back to the live values whenever the modal is
  // (re)opened, so leftover edits from a cancelled session don't linger.
  useEffect(() => {
    if (!open) return;
    setTab("general");
    setDraftUsername(user.username);
    setDraftEmail(user.email);
    setDraftHighContrast(highContrast);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError("");
  }, [open, user, highContrast]);

  if (!open) return null;

  async function handleSave() {
    setError("");

    // Check this up front, before firing any request: a dead token would
    // make every call below fail with a bare 401 anyway, and for the
    // password-change call specifically, a 401 is otherwise read as "wrong
    // current password" — that misattribution is exactly what this guards
    // against.
    if (isSessionExpired()) {
      onSessionExpired();
      return;
    }

    if (newPassword && newPassword !== confirmNewPassword) {
      setTab("security");
      setError("New passwords do not match.");
      return;
    }
    if (newPassword && !currentPassword) {
      setTab("security");
      setError("Enter your current password to set a new one.");
      return;
    }

    setSaving(true);
    try {
      // Run sequentially (not Promise.all) so each call's response reflects
      // every change committed before it — the last successful response is
      // what we persist as the new local user.
      let latestUser = user;

      if (draftUsername !== user.username) {
        const res = await authApi.updateUsername(draftUsername);
        latestUser = res.data;
      }
      if (draftEmail !== user.email) {
        const res = await authApi.updateEmail(draftEmail);
        latestUser = res.data;
      }
      if (draftHighContrast !== highContrast) {
        const res = await authApi.updateHighContrast(draftHighContrast);
        latestUser = res.data;
      }

      if (newPassword) {
        try {
          await authApi.changePassword(currentPassword, newPassword);
        } catch (err) {
          const backendMessage = err.response?.data?.message;
          if (backendMessage) {
            throw new Error(backendMessage);
          }
          // updatePassword throws 403 specifically and only when the
          // current-password check fails — a genuinely expired/invalid
          // session token is rejected earlier, at the JWT filter level,
          // with 401, not 403, so the two never collide. Any other status
          // (500, network error, etc.) falls through to the generic line.
          if (err.response?.status === 403) {
            throw new Error("Current password does not match. Please try again.");
          }
          throw new Error("Failed to change password. Please try again.");
        }

        // The backend ties the JWT to the password (its signature/version
        // changes whenever the password does), so the token this session
        // was using is now dead. Re-authenticate right away with the new
        // password so a fresh token gets issued — the user never sees a
        // login screen or any interruption. login() also returns the
        // freshest UserDTO, which already reflects the username/email/
        // high-contrast changes made above (those were committed first).
        const ok = await login(latestUser.email, newPassword);
        if (!ok) {
          throw new Error("Password changed, but automatic re-login failed. Please sign in again.");
        }
        // login() already persisted the fresh user + token into AuthContext
        // internally — nothing left to sync, just close the modal.
        onClose();
      } else {
        onSaved(latestUser);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  function tabButtonClass(id) {
    return tab === id
      ? "px-md py-sm border-b-2 border-primary text-primary font-semibold font-body-md text-body-md transition-colors"
      : "px-md py-sm border-b-2 border-transparent text-secondary hover:text-primary font-body-md text-body-md transition-colors";
  }

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-on-background/40 backdrop-blur-sm px-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] max-h-[85vh] bg-surface-container-lowest rounded-xl shadow-[0_30px_80px_rgba(0,104,95,0.15)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-md pt-md flex items-center justify-between">
          <h2 className="text-headline-md font-headline-md text-on-surface">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-[6px] rounded-full text-secondary hover:text-primary hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] block">close</span>
          </button>
        </div>

        <div className="flex border-b border-outline-variant/30 px-md mt-sm">
          <button
            onClick={() => {
              setTab("general");
              setError("");
            }}
            className={tabButtonClass("general")}
          >
            General
          </button>
          <button
            onClick={() => {
              setTab("security");
              setError("");
            }}
            className={tabButtonClass("security")}
          >
            Security
          </button>
        </div>

        <div className="px-md py-md overflow-y-auto flex-1">
          {tab === "general" && (
            <div className="flex flex-col gap-md">
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-xs">
                  Username
                </label>
                <input
                  type="text"
                  value={draftUsername}
                  onChange={(e) => setDraftUsername(e.target.value)}
                  minLength={3}
                  maxLength={64}
                  className="w-full px-sm py-[10px] rounded-lg bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 outline-none transition-all font-body-md text-body-md text-on-surface"
                />
              </div>

              <div className="flex items-center justify-between pt-sm border-t border-outline-variant/30">
                <div>
                  <p className="font-body-md text-body-md font-medium text-on-surface">High Contrast Mode</p>
                  <p className="text-secondary text-[13px]">Increases contrast for better readability.</p>
                </div>
                <button
                  onClick={() => setDraftHighContrast((v) => !v)}
                  role="switch"
                  aria-checked={draftHighContrast}
                  className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                    draftHighContrast ? "bg-primary" : "bg-outline-variant"
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      draftHighContrast ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {tab === "security" && (
            <div className="flex flex-col gap-md">
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant mb-xs">
                  Email Address
                </label>
                <input
                  type="email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  className="w-full px-sm py-[10px] rounded-lg bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 outline-none transition-all font-body-md text-body-md text-on-surface"
                />
              </div>

              <div className="h-px w-full bg-outline-variant/30" />

              <div>
                <h3 className="font-label-caps text-label-caps text-secondary uppercase tracking-wider mb-sm">
                  Change Password
                </h3>
                <div className="flex flex-col gap-sm">
                  <div>
                    <label className="block font-body-md text-[13px] font-medium text-on-surface-variant mb-xs">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-sm py-[10px] rounded-lg bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 outline-none transition-all font-body-md text-body-md text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block font-body-md text-[13px] font-medium text-on-surface-variant mb-xs">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="6-128 characters"
                      minLength={6}
                      maxLength={128}
                      className="w-full px-sm py-[10px] rounded-lg bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 outline-none transition-all font-body-md text-body-md text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block font-body-md text-[13px] font-medium text-on-surface-variant mb-xs">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="6-128 characters"
                      minLength={6}
                      maxLength={128}
                      className="w-full px-sm py-[10px] rounded-lg bg-surface-container-low border border-transparent focus:bg-surface-container-lowest focus:border-primary focus:ring-0 outline-none transition-all font-body-md text-body-md text-on-surface"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-error text-[13px] mt-sm">{error}</p>}
        </div>

        <div className="px-md py-sm border-t border-outline-variant/30 flex justify-end gap-sm bg-surface-container-lowest shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            type="button"
            className="px-md py-[10px] font-body-md text-body-md font-medium text-secondary bg-transparent border border-outline-variant/50 rounded-lg hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            type="button"
            className="px-md py-[10px] font-body-md text-body-md font-medium text-on-primary bg-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-[18px]">check</span>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, setUserLocal, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [favorites, setFavorites] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [favoritesError, setFavoritesError] = useState("");

  const [recentCheckins, setRecentCheckins] = useState([]);
  const [checkinsLoading, setCheckinsLoading] = useState(true);

  const [recentRatings, setRecentRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);

  // Derived directly from `user` (not a separate useState) so that after a
  // silent re-login (see handleSave's password-change path below), this
  // always reflects whatever the freshest user row says — no manual sync
  // needed.
  const highContrast = readBoolField(user || {}, "isHighContrast", "highContrast", false);

  const [editOpen, setEditOpen] = useState(false);
  const [logoutAllBusy, setLogoutAllBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;

    activityStatsApi
      .get(user.id)
      .then((res) => active && setStats(res.data))
      .catch(() => {})
      .finally(() => active && setStatsLoading(false));

    favoriteApi
      .list(user.id)
      .then((res) => {
        if (!active) return;
        const favs = extractList(res.data); // UserFavoriteDTO[] — only has attractionId
        if (favs.length === 0) return [];
        return Promise.all(
          favs.map((f) =>
            attractionApi
              .detail(f.attractionId)
              .then((r) => r.data)
              .catch(() => null)
          )
        );
      })
      .then((attractions) => active && setFavorites((attractions || []).filter(Boolean)))
      .catch((err) => active && setFavoritesError(err.response?.data?.message || "Failed to load favorites."))
      .finally(() => active && setFavoritesLoading(false));

    // Recent check-ins: latest 5, hydrated with the attraction's name/image
    // since UserCheckinDTO only carries attractionId.
    checkinApi
      .listByUser(user.id, { size: 5, sort: "visitedAt,desc" })
      .then((res) => {
        if (!active) return;
        const list = extractList(res.data);
        if (list.length === 0) return [];
        return Promise.all(
          list.map((c) =>
            attractionApi
              .detail(c.attractionId)
              .then((r) => ({ ...c, attraction: r.data }))
              .catch(() => ({ ...c, attraction: null }))
          )
        );
      })
      .then((items) => active && setRecentCheckins(items || []))
      .catch(() => {})
      .finally(() => active && setCheckinsLoading(false));

    // Recent ratings: same hydration approach as check-ins.
    ratingApi
      .listByUser(user.id, { size: 5, sort: "updatedAt,desc" })
      .then((res) => {
        if (!active) return;
        const list = extractList(res.data);
        if (list.length === 0) return [];
        return Promise.all(
          list.map((r) =>
            attractionApi
              .detail(r.attractionId)
              .then((res2) => ({ ...r, attraction: res2.data }))
              .catch(() => ({ ...r, attraction: null }))
          )
        );
      })
      .then((items) => active && setRecentRatings(items || []))
      .catch(() => {})
      .finally(() => active && setRatingsLoading(false));

    return () => {
      active = false;
    };
  }, [user]);

  // Called once handleSave finishes — whether or not a password change was
  // involved, the modal has already taken care of persisting everything
  // (including, when relevant, a silent re-login). Just sync local state
  // and close.
  function handleProfileSaved(latestUser) {
    setUserLocal(latestUser);
    setEditOpen(false);
  }

  async function handleLogoutAll() {
    setLogoutAllBusy(true);
    try {
      await authApi.logoutAll();
    } catch (err) {
      console.error(err);
    } finally {
      // logoutAll invalidates every token including this session's own, so
      // there's nothing useful left to do but clear local state too.
      setLogoutAllBusy(false);
      logout();
      navigate("/login", { replace: true });
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function handleSessionExpired() {
    setEditOpen(false);
    logout();
    navigate("/login", {
      replace: true,
      state: { flash: "Your session has expired. Please log in again." },
    });
  }

  if (!user) return null;

  const favoritesCount = pick(stats, ["favoriteCount"], favorites.length);
  const visitedPlaceCount = pick(stats, ["visitedPlaceCount"], null);
  const ratingsCount = pick(stats, ["ratingCount"], null);

  return (
    <main className="flex-grow max-w-[1440px] mx-auto w-full px-lg py-xl flex flex-col gap-lg">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-md">
        <div className="flex items-center gap-md">
          <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-md text-headline-md font-bold shrink-0">
            {user.username?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h1 className="font-display-lg text-display-lg text-on-surface">{user.username}</h1>
            <p className="text-body-md font-body-md text-secondary">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-sm">
          <button
            onClick={() => setEditOpen(true)}
            className="px-sm py-xs border border-primary text-primary rounded-lg font-body-md text-body-md hover:bg-primary hover:text-on-primary transition-colors duration-200"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            className="text-secondary text-body-md font-body-md hover:text-primary transition-colors"
          >
            Log Out
          </button>
          <button
            onClick={handleLogoutAll}
            disabled={logoutAllBusy}
            className="text-error text-body-md font-body-md hover:underline disabled:opacity-60"
          >
            {logoutAllBusy ? "Signing out everywhere…" : "Log Out Everywhere"}
          </button>
        </div>
      </header>

      {/* Activity stats */}
      <div className="grid grid-cols-3 gap-gutter">
        {[
          { label: "Favorites", value: favoritesCount, icon: "favorite" },
          { label: "Places Visited", value: visitedPlaceCount, icon: "check_circle" },
          { label: "Ratings Given", value: ratingsCount, icon: "star" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container-lowest rounded-xl p-md shadow-[0_10px_40px_rgba(0,104,95,0.04)] border border-white flex items-center gap-sm"
          >
            <span className="material-symbols-outlined text-primary text-[28px]">{stat.icon}</span>
            <div>
              <p className="font-stats-numeric text-stats-numeric text-on-surface">
                {statsLoading ? "—" : stat.value ?? "—"}
              </p>
              <p className="font-label-caps text-label-caps text-secondary uppercase">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        <section className="flex flex-col gap-sm">
          <div className="flex justify-between items-center border-b border-outline-variant/30 pb-xs">
            <h2 className="text-headline-md font-headline-md text-on-surface">Recent Check-Ins</h2>
          </div>
          {checkinsLoading ? (
            <p className="text-secondary">Loading…</p>
          ) : recentCheckins.length === 0 ? (
            <p className="text-secondary text-[13px]">No check-ins yet.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {recentCheckins.map((c) => (
                <li key={c.id}>
                  <Link
                    to={c.attraction ? `/gems/${c.attraction.id}` : "#"}
                    className="bg-surface-container-lowest p-sm rounded-lg shadow-[0_10px_30px_rgba(0,104,95,0.03)] flex items-center justify-between border border-transparent hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-sm">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-[20px]">location_on</span>
                      </div>
                      <div>
                        <p className="font-body-md text-body-md font-semibold text-on-surface">
                          {c.attraction?.name || "Unknown location"}
                        </p>
                        <p className="text-secondary text-[13px]">{formatDate(c.visitedAt)}</p>
                      </div>
                    </div>
                    {c.busynessAtVisit != null && (
                      <span className="font-label-caps text-label-caps text-secondary uppercase shrink-0">
                        Level {c.busynessAtVisit}/5
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-sm">
          <div className="flex justify-between items-center border-b border-outline-variant/30 pb-xs">
            <h2 className="text-headline-md font-headline-md text-on-surface">Recent Ratings</h2>
          </div>
          {ratingsLoading ? (
            <p className="text-secondary">Loading…</p>
          ) : recentRatings.length === 0 ? (
            <p className="text-secondary text-[13px]">No ratings yet.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {recentRatings.map((r) => {
                const score = Math.round(Number(r.rating) || 0);
                return (
                  <li key={r.id}>
                    <Link
                      to={r.attraction ? `/gems/${r.attraction.id}` : "#"}
                      className="bg-surface-container-lowest p-sm rounded-lg shadow-[0_10px_30px_rgba(0,104,95,0.03)] flex items-center justify-between border border-transparent hover:border-primary/30 transition-colors"
                    >
                      <div>
                        <p className="font-body-md text-body-md font-semibold text-on-surface">
                          {r.attraction?.name || "Unknown location"}
                        </p>
                        <p className="text-secondary text-[13px]">{formatDate(r.updatedAt || r.createdAt)}</p>
                      </div>
                      <div className="flex items-center shrink-0">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`material-symbols-outlined text-[16px] ${
                              star <= score ? "text-primary icon-fill" : "text-outline-variant"
                            }`}
                          >
                            star
                          </span>
                        ))}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Favorites */}
      <section>
        <h2 className="text-headline-md font-headline-md text-on-surface mb-sm">Your Favorites</h2>
        {favoritesLoading ? (
          <p className="text-secondary">Loading…</p>
        ) : favoritesError ? (
          <p className="text-error">{favoritesError}</p>
        ) : favorites.length === 0 ? (
          <p className="text-secondary">
            No favorites yet — save a gem from its detail page and it'll show up here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-gutter gap-y-[0px]">
            {favorites.map((a) => (
              <AttractionCard key={a.id} attraction={a} isOpen={readBoolField(a, "isOpen", "open")} busynessLevel={a.busynessLevel} />
            ))}
          </div>
        )}
      </section>

      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        user={user}
        highContrast={highContrast}
        onSaved={handleProfileSaved}
        onSessionExpired={handleSessionExpired}
      />
    </main>
  );
}
