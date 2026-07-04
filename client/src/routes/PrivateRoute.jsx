import { Navigate } from "react-router-dom";

const BASE_ROLE_PERMISSIONS = {
  company_admin: "all",

  accountant: {
    customers: true,
    products: true,
    branches: true,
    invoices: true,
    payments: true,
    expenses: true,
    taxes: true,
    reports: true,
  },

  sales_user: {
    branches: true,
    customers: true,
    products: true,
    quotations: true,
    invoices: true,
  },
};

function normalizePermissions(permissions) {
  if (!permissions) return {};

  if (typeof permissions === "object") {
    return permissions;
  }

  try {
    return JSON.parse(permissions);
  } catch {
    return {};
  }
}

function getRedirectPath(role) {
  if (role === "superadmin") return "/superadmin/dashboard";

  return "/dashboard";
}

function PrivateRoute({ children, allowedRoles, requiredPermission }) {
  const token = localStorage.getItem("token");

  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch {
    user = null;
  }

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  const userPermissions = normalizePermissions(user.permissions);

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRedirectPath(user.role)} replace />;
  }

  if (requiredPermission) {
    const basePermissions = BASE_ROLE_PERMISSIONS[user.role];

    const hasBasePermission =
      basePermissions === "all" || Boolean(basePermissions?.[requiredPermission]);

    const hasUserPermission =
      userPermissions?.[requiredPermission] === true ||
      userPermissions?.[user.role]?.[requiredPermission] === true;

    if (!hasBasePermission && !hasUserPermission) {
      return <Navigate to={getRedirectPath(user.role)} replace />;
    }
  }

  if (["accountant", "sales_user"].includes(user.role) && !user.branch_id) {
    console.warn("Branch not assigned to user");
  }

  return children;
}

export default PrivateRoute;