import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { ROUTE_ROLES } from "@/lib/routeAccess";
import AccessDenied from "@/components/AccessDenied";

// Enforces the same role allowlist the sidebar uses to hide links, at the
// route level - so a staff account can't reach a restricted page just by
// typing its URL. Unlisted paths fall through unrestricted (any
// authenticated staff), matching prior behavior for anything not yet
// mapped in routeAccess.js.
export default function RoleRoute() {
  const { user } = useAuth();
  const location = useLocation();
  const allowedRoles = ROUTE_ROLES[location.pathname];

  if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
    return <AccessDenied />;
  }

  return <Outlet />;
}
