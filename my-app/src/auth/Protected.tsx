// src/auth/Protected.tsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import RequestPageAccessPrompt from "../pages/RequestPageAccessPrompt";

// We accept roles in lowercase.
type LowerRole =
  | "super"
  | "admin"
  | "employee"
  | "test";

type Props = {
  children: React.ReactNode;
  roles?: LowerRole[]; // optional allow-list
  // Optional page key for the page-access-request system. Defaults to the
  // current pathname, so every route gets Confluence-style "request access"
  // behavior for free when its role check fails - no per-page wiring needed
  // unless you want to map a page onto curated backend endpoints (see
  // services/pageAccessCatalog.mjs).
  pageKey?: string;
};

function ProtectedComp({ children, roles, pageKey }: Props) {
  const { user, status, api } = useAuth();
  const location = useLocation();
  const effectivePageKey = pageKey || location.pathname;

  const currentRole = user
    ? (String(user.role)
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/-readonly$/, "") as LowerRole)
    : null;

  const roleOk = !roles || (currentRole !== null && roles.includes(currentRole));

  const [accessState, setAccessState] = useState<"checking" | "allowed" | "denied">(
    roleOk ? "allowed" : "checking"
  );

  useEffect(() => {
    if (roleOk) {
      setAccessState("allowed");
      return;
    }
    if (!user) return;
    let cancelled = false;
    setAccessState("checking");
    (async () => {
      try {
        const resp = await api.getMyPageAccess(effectivePageKey);
        if (!cancelled) setAccessState(resp.allowed ? "allowed" : "denied");
      } catch {
        if (!cancelled) setAccessState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleOk, effectivePageKey, user]);

  if (status === "checking") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ next: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (!user) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`}
        replace
      />
    );
  }

  if (!roleOk) {
    if (accessState === "checking") return null;
    if (accessState === "denied") return <RequestPageAccessPrompt pageKey={effectivePageKey} />;
    // accessState === "allowed" -> an approved page-access request granted
    // this specific user in; fall through and render the page.
  }

  return <>{children}</>;
}

export default ProtectedComp;
// also provide a named export so `import { Protected }` works
export { ProtectedComp as Protected };
