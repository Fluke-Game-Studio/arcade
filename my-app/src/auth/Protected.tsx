// src/auth/Protected.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

// We accept roles in lowercase: "super" | "admin" | "employee"
type LowerRole = "super" | "admin" | "employee";

type Props = {
  children: React.ReactNode;
  roles?: LowerRole[]; // optional allow-list
};

function ProtectedComp({ children, roles }: Props) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "checking") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ next: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Normalize whatever we get (e.g. "EMPLOYEE" → "employee")
  const currentRole = String(user.role).toLowerCase() as LowerRole;

  if (roles && !roles.includes(currentRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default ProtectedComp;
// also provide a named export so `import { Protected }` works
export { ProtectedComp as Protected };
