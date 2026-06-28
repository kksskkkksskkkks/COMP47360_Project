import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { userApi } from "../lib/api";
import Pagination from "../components/Pagination";

const ROLES = ["USER", "ADMIN", "SUPERADMIN"];

const ROLE_BADGE = {
  USER: "bg-secondary/10 text-secondary",
  ADMIN: "bg-blue-50 text-blue-600",
  SUPERADMIN: "bg-violet-50 text-violet-600",
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Mirrors the backend's own business rules (Service-layer checks) so the
// UI doesn't dangle an action that's just going to come back as a 403 —
// the backend remains the source of truth either way, this is purely to
// avoid a pointless round trip and a confusing error for an action that
// was never going to be allowed.
function canChangeRole(actingUser, target) {
  if (actingUser.role !== "SUPERADMIN") return false; // PATCH /role is SUPERADMIN-only
  if (target.role === "SUPERADMIN") return false; // can't modify another SUPERADMIN's role
  return true;
}

function canToggleActive(actingUser, target) {
  if (target.id === actingUser.id) return false; // don't let anyone deactivate themselves by accident
  if (actingUser.role === "ADMIN") {
    return target.role === "USER"; // ADMIN can't touch ADMIN or SUPERADMIN
  }
  if (actingUser.role === "SUPERADMIN") {
    return target.role !== "SUPERADMIN"; // SUPERADMIN can't touch another SUPERADMIN
  }
  return false;
}

export default function AdminUsers() {
  const { user: actingUser } = useAuth();

  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "inactive"
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Per-row busy/error state, keyed by user id, so one row's request
  // doesn't block or visually affect any other row.
  const [rowBusy, setRowBusy] = useState({});
  const [rowError, setRowError] = useState({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const params = {
      page,
      size: 20,
      ...(statusFilter === "active" ? { isActive: true } : {}),
      ...(statusFilter === "inactive" ? { isActive: false } : {}),
    };

    userApi
      .list(params)
      .then((res) => {
        if (!active) return;
        const data = res.data; // raw Page<UserDTO>, not wrapped in the usual envelope
        setUsers(data.content || []);
        setTotalPages(data.totalPages ?? 1);
      })
      .catch((err) => active && setError(err.response?.data?.message || "Failed to load users."))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [page, statusFilter]);

  function setBusy(id, value) {
    setRowBusy((prev) => ({ ...prev, [id]: value }));
  }
  function setError_(id, message) {
    setRowError((prev) => ({ ...prev, [id]: message }));
  }

  async function handleRoleChange(target, nextRole) {
    if (nextRole === target.role) return;
    setBusy(target.id, true);
    setError_(target.id, "");
    try {
      const res = await userApi.updateRole(target.id, nextRole);
      setUsers((prev) => prev.map((u) => (u.id === target.id ? res.data : u)));
    } catch (err) {
      setError_(target.id, err.response?.data?.message || "Failed to update role.");
    } finally {
      setBusy(target.id, false);
    }
  }

  async function handleToggleActive(target) {
    setBusy(target.id, true);
    setError_(target.id, "");
    try {
      const res = target.isActive ? await userApi.deactivate(target.id) : await userApi.activate(target.id);
      setUsers((prev) => prev.map((u) => (u.id === target.id ? res.data : u)));
    } catch (err) {
      setError_(target.id, err.response?.data?.message || "Failed to update status.");
    } finally {
      setBusy(target.id, false);
    }
  }

  if (!actingUser) return null;

  return (
    <main className="flex-grow max-w-[1440px] mx-auto w-full px-lg py-xl flex flex-col gap-lg">
      <header>
        <h1 className="font-display-lg text-display-lg text-on-surface">User Management</h1>
        <p className="text-body-md font-body-md text-secondary">
          {actingUser.role === "SUPERADMIN"
            ? "View, activate/deactivate, and change roles for any account."
            : "View and activate/deactivate standard user accounts."}
        </p>
      </header>

      {/* Status filter */}
      <div className="flex items-center gap-xs">
        {[
          { value: "all", label: "All" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setStatusFilter(opt.value);
              setPage(0);
            }}
            className={
              statusFilter === opt.value
                ? "px-sm py-[8px] rounded-full bg-primary/10 text-primary border border-primary/20 font-label-caps text-label-caps uppercase transition-colors"
                : "px-sm py-[8px] rounded-full bg-transparent text-secondary border border-outline-variant hover:border-primary hover:text-primary transition-colors font-label-caps text-label-caps uppercase"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-[0_20px_50px_rgba(0,104,95,0.03)] border border-white overflow-hidden">
        {loading ? (
          <p className="text-secondary p-lg">Loading…</p>
        ) : error ? (
          <p className="text-error p-lg">{error}</p>
        ) : users.length === 0 ? (
          <p className="text-secondary p-lg">No users match this filter.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/30">
                <th className="px-md py-sm font-label-caps text-label-caps text-secondary uppercase">User</th>
                <th className="px-md py-sm font-label-caps text-label-caps text-secondary uppercase">Role</th>
                <th className="px-md py-sm font-label-caps text-label-caps text-secondary uppercase">Status</th>
                <th className="px-md py-sm font-label-caps text-label-caps text-secondary uppercase">Joined</th>
                <th className="px-md py-sm font-label-caps text-label-caps text-secondary uppercase text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const busy = !!rowBusy[u.id];
                const roleEditable = canChangeRole(actingUser, u) && !busy;
                const activeToggleable = canToggleActive(actingUser, u) && !busy;

                return (
                  <tr key={u.id} className="border-b border-outline-variant/20 last:border-b-0 align-top">
                    <td className="px-md py-sm">
                      <p className="font-body-md text-body-md font-semibold text-on-surface">{u.username}</p>
                      <p className="text-secondary text-[13px]">{u.email}</p>
                      {rowError[u.id] && <p className="text-error text-[12px] mt-1">{rowError[u.id]}</p>}
                    </td>
                    <td className="px-md py-sm">
                      {roleEditable ? (
                        <select
                          value={u.role}
                          disabled={busy}
                          onChange={(e) => handleRoleChange(u, e.target.value)}
                          className={`text-[12px] font-label-caps uppercase rounded-full px-sm py-[4px] border border-transparent outline-none cursor-pointer ${ROLE_BADGE[u.role] || ROLE_BADGE.USER}`}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-block text-[12px] font-label-caps uppercase rounded-full px-sm py-[4px] ${ROLE_BADGE[u.role] || ROLE_BADGE.USER}`}
                        >
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-md py-sm">
                      <span className="inline-flex items-center gap-1 text-[13px] text-secondary">
                        <span
                          className={`w-2 h-2 rounded-full ${u.isActive ? "bg-primary" : "bg-outline-variant"}`}
                        />
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-md py-sm text-secondary text-[13px]">{formatDate(u.createdAt)}</td>
                    <td className="px-md py-sm text-right">
                      <button
                        onClick={() => handleToggleActive(u)}
                        disabled={!activeToggleable}
                        title={
                          activeToggleable
                            ? undefined
                            : u.id === actingUser.id
                              ? "You can't deactivate your own account."
                              : "You don't have permission to change this account's status."
                        }
                        className={
                          u.isActive
                            ? "px-sm py-[6px] rounded-full text-error border border-error/30 hover:bg-error/5 transition-colors text-[13px] font-medium disabled:opacity-40 disabled:hover:bg-transparent"
                            : "px-sm py-[6px] rounded-full text-primary border border-primary/30 hover:bg-primary/5 transition-colors text-[13px] font-medium disabled:opacity-40 disabled:hover:bg-transparent"
                        }
                      >
                        {busy ? "…" : u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          canPrev={page > 0}
          canNext={page + 1 < totalPages}
          onChange={setPage}
        />
      )}
    </main>
  );
}
