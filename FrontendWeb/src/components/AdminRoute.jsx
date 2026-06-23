import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ADMIN_ROLES = ["ADMIN", "SUPERADMIN"];

// Like ProtectedRoute, but also gates on role. Assumes it's always nested
// inside (or used alongside) a ProtectedRoute, so `user` is expected to
// already be set by the time this renders — still guards against the
// brief moment it might not be (e.g. a hard refresh on this route).
export default function AdminRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!ADMIN_ROLES.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
