import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getDirectReports } from "../utils/employeeHierarchy";
import NotificationBell from "./NotificationBell";
import "./Navbar.css";

declare const M: any;

type LinkItem = {
  to: string;
  label: string;
  badge?: number;
};

type MenuGroup = {
  key: string;
  label: string;
  items: LinkItem[];
  show: boolean;
};

const RAIL_W = 64;

const GROUP_ICON: Record<string, string> = {
  organisation: "apartment",
  admin: "admin_panel_settings",
  super: "bolt",
};

const LINK_ICON: Record<string, string> = {
  Home: "home",
  "My Account": "account_circle",
  Login: "login",
};

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function initials(nameOrUser: string) {
  const s = safeStr(nameOrUser);
  if (!s) return "FG";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b) || "FG";
}

export default function Navbar() {
  const { user, logout, api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = !!user;
  const roleLower = (user?.role ? String(user.role) : "employee")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/-readonly$/, "");
  const isAdminish = roleLower === "admin" || roleLower === "super";
  const isSuper = roleLower === "super";

  const sidenavRef = useRef<HTMLUListElement | null>(null);
  const dropdownRootRef = useRef<HTMLDivElement | null>(null);
  const railRootRef = useRef<HTMLDivElement | null>(null);

  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hasTeamMembers, setHasTeamMembers] = useState(false);
  const [teamCheckReady, setTeamCheckReady] = useState(false);
  const [adminQueueCount, setAdminQueueCount] = useState(0);

  const logoSrc = "/logos/Fluke_Games_Icon_5.png";
  const NAV_H = 82;

  useEffect(() => {
    if (typeof M !== "undefined") {
      const elems = document.querySelectorAll(".sidenav");
      M.Sidenav.init(elems, { edge: "left" });
    }

    const onScroll = () => setScrolled((window.scrollY || 0) > 6);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inNav = dropdownRootRef.current?.contains(target);
      const inRail = railRootRef.current?.contains(target);
      if (!inNav && !inRail) setOpenMenu(null);
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!isAuthenticated) {
      setHasTeamMembers(false);
      setTeamCheckReady(true);
      return;
    }

    let mounted = true;
    setTeamCheckReady(false);

    (async () => {
      try {
        const resp = await api.getUsers();
        if (!mounted) return;
        const list = Array.isArray((resp as any)?.items)
          ? (resp as any).items
          : Array.isArray(resp)
            ? resp
            : [];
        setHasTeamMembers(getDirectReports(list, user).length > 0);
      } catch {
        if (mounted) setHasTeamMembers(false);
      } finally {
        if (mounted) setTeamCheckReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [api, isAuthenticated, user?.username, user?.name]);

  useEffect(() => {
    if (!isAuthenticated || !isAdminish) {
      setAdminQueueCount(0);
      return;
    }

    let mounted = true;
    const load = async () => {
      try {
        const resp = await api.getSocialPosts();
        const items = Array.isArray(resp?.items) ? resp.items : [];
        const count = items.filter((p: any) => {
          const s = String(p?.status || "").toLowerCase();
          return s.includes("pending_review") || s.includes("pending");
        }).length;
        if (mounted) setAdminQueueCount(count);
      } catch {
        if (mounted) setAdminQueueCount(0);
      }
    };

    void load();
    const id = window.setInterval(load, 30000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [api, isAdminish, isAuthenticated]);

  const handleLogout = () => {
    logout();
    navigate(`/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`);
    try {
      M.Sidenav.getInstance(sidenavRef.current)?.close();
    } catch {}
  };

  const displayName = user?.name || user?.username || "";
  const initial = (displayName || "U").slice(0, 1).toUpperCase();

  // Profile summary shown in the navbar chip's dropdown (moved off the Home dashboard card).
  const profileEmail = safeStr((user as any)?.employee_email) || "—";
  const profileTitle = safeStr((user as any)?.employee_title) || "";
  const profileDept = safeStr((user as any)?.department) || "";
  const profileEmpType = safeStr((user as any)?.employment_type) || "";
  const profileLocation = safeStr((user as any)?.location) || "";
  const profilePhone = safeStr((user as any)?.employee_phonenumber) || "";
  const profileUsername = safeStr(user?.username) || "";
  const profileAvatarUrl = safeStr((user as any)?.employee_profilepicture || (user as any)?.employee_picture);
  const profileInitials = initials(displayName);

  const baseLinks = useMemo<LinkItem[]>(() => {
    if (!isAuthenticated) return [{ to: `/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`, label: "Login" }];
    return [
      { to: "/", label: "Home" },
      { to: "/account", label: "My Account" },
    ];
  }, [isAuthenticated, location.pathname, location.search, location.hash]);

  const organisationGroup = useMemo<MenuGroup>(() => {
    const items: LinkItem[] = [
      { to: "/organisation/org-chart", label: "Org Chart" },
      { to: "/organisation/employees", label: "Employees" },
      { to: "/organisation/social-media", label: "Social Media" },
      { to: "/store", label: "Fluke Store" },
    ];

    if (teamCheckReady && hasTeamMembers) {
      items.push({ to: "/organisation/my-team", label: "My Team" });
    }

    return {
      key: "organisation",
      label: "Organisation",
      show: isAuthenticated,
      items,
    };
  }, [hasTeamMembers, isAuthenticated, teamCheckReady]);

  const adminGroup = useMemo<MenuGroup>(
    () => ({
      key: "admin",
      label: "Admin",
      show: isAdminish,
      items: [
        { to: "/admin", label: "Admin Dashboard" },
        { to: "/admin/customers", label: "Customers" },
        { to: "/applicants", label: "Applicants" },
        { to: "/admin/jobs", label: "Jobs Admin" },
        { to: "/admin/social-media-admin", label: "Social Media Admin", badge: adminQueueCount || undefined },
      ],
    }),
    [adminQueueCount, isAdminish]
  );

  const superGroup = useMemo<MenuGroup>(
    () => ({
      key: "super",
      label: "Super",
      show: isSuper,
      items: [
        { to: "/super", label: "Super Console" },
        { to: "/super/ai", label: "Super AI" },
        { to: "/super/social-media", label: "Social Media" },
        { to: "/super/ai-character-training", label: "AI Character Training" },
        { to: "/super/talking-head-page", label: "Talking Head Training" },
        { to: "/super/manager-agent-builder", label: "Agent Builder" },
      ],
    }),
    [isSuper]
  );

  const groups = [organisationGroup, adminGroup, superGroup];

  const isRouteActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  const isGroupActive = (group: MenuGroup) => group.items.some((x) => isRouteActive(x.to));
  const groupHasBadge = (group: MenuGroup) => group.items.some((x) => (x.badge || 0) > 0);

  const topBarGlow = scrolled
    ? "0 10px 30px rgba(0,0,0,0.34), 0 0 0 1px rgba(96,165,250,0.05)"
    : "0 8px 24px rgba(0,0,0,0.20), 0 0 0 1px rgba(96,165,250,0.04)";

  const iconBtnStyle = (isActive: boolean, isOpen: boolean): CSSProperties => ({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: 14,
    color: isActive || isOpen ? "#f8fbff" : "rgba(219,234,254,0.88)",
    background:
      isActive || isOpen
        ? "linear-gradient(180deg, rgba(34,211,238,0.22), rgba(59,130,246,0.16) 55%, rgba(168,85,247,0.14))"
        : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
    border:
      isActive || isOpen
        ? "1px solid rgba(56,189,248,0.34)"
        : "1px solid rgba(148,163,184,0.08)",
    boxShadow:
      isActive || isOpen
        ? "inset 0 1px 0 rgba(255,255,255,0.10), 0 0 24px rgba(59,130,246,0.14)"
        : "inset 0 1px 0 rgba(255,255,255,0.03)",
    transition: "all 180ms ease",
    cursor: "pointer",
    textDecoration: "none",
  });

  const railBtnStyle = (isActive: boolean, isOpen: boolean): CSSProperties => ({
    ...iconBtnStyle(isActive, isOpen),
    width: 46,
    height: 46,
  });

  // Glass "console" pill that groups the bell + profile chip into one designed
  // cluster instead of two icons floating loose on the bare nav background.
  const actionsPillStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: 6,
    borderRadius: 999,
    background: "linear-gradient(180deg, rgba(11,18,31,0.85), rgba(8,14,24,0.80))",
    border: "1px solid rgba(56,189,248,0.14)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)",
  };

  const badgeDot: CSSProperties = {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "linear-gradient(135deg,#ef4444,#f97316)",
    boxShadow: "0 0 8px rgba(239,68,68,.5)",
  };

  const DropdownPanel = ({ group, open }: { group: MenuGroup; open: boolean }) => (
    <div
      onMouseEnter={() => setOpenMenu(group.key)}
      onMouseLeave={() => setOpenMenu((prev) => (prev === group.key ? null : prev))}
      style={{
        position: "absolute",
        left: "calc(100% + 12px)",
        top: 0,
        minWidth: 260,
        padding: 10,
        borderRadius: 20,
        background: "linear-gradient(180deg, rgba(8,14,24,0.98), rgba(10,18,34,0.97))",
        border: "1px solid rgba(56,189,248,0.18)",
        boxShadow:
          "0 24px 70px rgba(0,0,0,0.50), 0 0 0 1px rgba(168,85,247,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        opacity: open ? 1 : 0,
        transform: open ? "translate(0,0) scale(1)" : "translateX(-8px) scale(0.985)",
        pointerEvents: open ? "auto" : "none",
        transition: "all 180ms ease",
        zIndex: 1300,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -8,
          top: 20,
          width: 16,
          height: 16,
          transform: "rotate(45deg)",
          background: "rgba(9,15,27,0.98)",
          borderLeft: "1px solid rgba(56,189,248,0.18)",
          borderBottom: "1px solid rgba(56,189,248,0.18)",
        }}
      />

      <div
        style={{
          padding: "8px 10px 10px",
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 1.3,
          textTransform: "uppercase",
          color: "rgba(125,211,252,0.82)",
        }}
      >
        {group.label} Systems
      </div>

      {group.items.map((item) => {
        const itemActive = isRouteActive(item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpenMenu(null)}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "13px 14px",
              borderRadius: 14,
              textDecoration: "none",
              color: itemActive ? "#ffffff" : "rgba(226,232,240,0.90)",
              fontWeight: itemActive ? 900 : 800,
              fontSize: 13,
              marginBottom: 6,
              background: itemActive
                ? "linear-gradient(135deg, rgba(6,182,212,0.22), rgba(37,99,235,0.16), rgba(168,85,247,0.14))"
                : "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
              border: itemActive
                ? "1px solid rgba(56,189,248,0.25)"
                : "1px solid rgba(148,163,184,0.07)",
              boxShadow: itemActive
                ? "0 0 22px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.06)"
                : "inset 0 1px 0 rgba(255,255,255,0.03)",
              transition: "all 160ms ease",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
                opacity: 0.55,
              }}
            />
            <span style={{ position: "relative", zIndex: 1 }}>{item.label}</span>
            {typeof item.badge === "number" && item.badge > 0 ? (
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  minWidth: 22,
                  height: 22,
                  padding: "0 7px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg,#ef4444,#f97316)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 950,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 18px rgba(239,68,68,.22)",
                }}
              >
                {item.badge}
              </span>
            ) : null}
            <i className="material-icons" style={{ position: "relative", zIndex: 1, fontSize: 17, opacity: 0.78 }}>
              chevron_right
            </i>
          </NavLink>
        );
      })}
    </div>
  );

  const RailLinkItem = ({ to, label }: { to: string; label: string }) => (
    <NavLink to={to} title={label} aria-label={label} style={({ isActive }) => railBtnStyle(isActive, false)}>
      <i className="material-icons" style={{ fontSize: 22 }}>
        {LINK_ICON[label] || "circle"}
      </i>
    </NavLink>
  );

  const RailGroupTrigger = ({ group }: { group: MenuGroup }) => {
    if (!group.show) return null;

    const active = isGroupActive(group);
    const open = openMenu === group.key;

    return (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === group.key ? null : group.key))}
          title={group.label}
          aria-label={group.label}
          style={railBtnStyle(active, open)}
        >
          <i className="material-icons" style={{ fontSize: 22 }}>
            {GROUP_ICON[group.key] || "apps"}
          </i>
          {groupHasBadge(group) && <span style={badgeDot} />}
        </button>

        <DropdownPanel group={group} open={open} />
      </div>
    );
  };

  const ProfileChip = () => {
    if (!isAuthenticated) return null;
    const open = openMenu === "profile";

    return (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpenMenu((prev) => (prev === "profile" ? null : "profile"))}
          title={displayName}
          aria-label="Profile"
          style={{
            position: "relative",
            display: "inline-flex",
            width: 40,
            height: 40,
            borderRadius: "50%",
            padding: 0,
            border: open
              ? "2px solid rgba(56,189,248,0.65)"
              : "2px solid rgba(56,189,248,0.22)",
            background: "rgba(255,255,255,0.04)",
            cursor: "pointer",
            overflow: "hidden",
            boxShadow: open ? "0 0 20px rgba(56,189,248,0.25)" : "none",
            transition: "all 180ms ease",
          }}
        >
          {profileAvatarUrl ? (
            <img src={profileAvatarUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, rgba(6,182,212,1), rgba(37,99,235,1), rgba(168,85,247,1))",
                color: "white",
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              {profileInitials}
            </span>
          )}
          <span
            style={{
              position: "absolute",
              right: 1,
              bottom: 1,
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "#22c55e",
              border: "2px solid rgba(7,14,26,0.95)",
            }}
          />
        </button>

        <div
          style={{
            position: "absolute",
            top: "calc(100% + 12px)",
            right: 0,
            width: "min(280px, calc(100vw - 24px))",
            padding: 16,
            borderRadius: 20,
            background: "linear-gradient(180deg, rgba(8,14,24,0.98), rgba(10,18,34,0.97))",
            border: "1px solid rgba(56,189,248,0.18)",
            boxShadow:
              "0 24px 70px rgba(0,0,0,0.50), 0 0 0 1px rgba(168,85,247,0.06), inset 0 1px 0 rgba(255,255,255,0.04)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            opacity: open ? 1 : 0,
            transform: open ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.985)",
            pointerEvents: open ? "auto" : "none",
            transition: "all 180ms ease",
            zIndex: 1300,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                border: "2px solid rgba(56,189,248,0.3)",
              }}
            >
              {profileAvatarUrl ? (
                <img src={profileAvatarUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, rgba(6,182,212,1), rgba(37,99,235,1), rgba(168,85,247,1))",
                    color: "white",
                    fontWeight: 900,
                    fontSize: 15,
                  }}
                >
                  {profileInitials}
                </span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: "#f8fbff",
                  fontWeight: 900,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {displayName}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(226,232,240,0.9)",
                  }}
                >
                  {roleLower}
                </span>
                {profileDept && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      padding: "3px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(226,232,240,0.9)",
                    }}
                  >
                    {profileDept}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(226,232,240,0.82)", fontSize: 12.5 }}>
              <i className="material-icons" style={{ fontSize: 16, opacity: 0.85 }}>alternate_email</i>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileEmail}</span>
            </div>
            {profileTitle && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(226,232,240,0.82)", fontSize: 12.5 }}>
                <i className="material-icons" style={{ fontSize: 16, opacity: 0.85 }}>work</i>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileTitle}</span>
              </div>
            )}
            {profileLocation && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(226,232,240,0.82)", fontSize: 12.5 }}>
                <i className="material-icons" style={{ fontSize: 16, opacity: 0.85 }}>location_on</i>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileLocation}</span>
              </div>
            )}
            {profilePhone && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(226,232,240,0.82)", fontSize: 12.5 }}>
                <i className="material-icons" style={{ fontSize: 16, opacity: 0.85 }}>call</i>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profilePhone}</span>
              </div>
            )}
            {profileEmpType && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(226,232,240,0.82)", fontSize: 12.5 }}>
                <i className="material-icons" style={{ fontSize: 16, opacity: 0.85 }}>business_center</i>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileEmpType}</span>
              </div>
            )}
            {profileUsername && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(226,232,240,0.82)", fontSize: 12.5 }}>
                <i className="material-icons" style={{ fontSize: 16, opacity: 0.85 }}>person</i>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileUsername}</span>
              </div>
            )}
          </div>

          <NavLink
            to="/account"
            onClick={() => setOpenMenu(null)}
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              height: 38,
              borderRadius: 12,
              textDecoration: "none",
              color: "#f8fbff",
              fontWeight: 900,
              fontSize: 12.5,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <i className="material-icons" style={{ fontSize: 16 }}>account_circle</i>
            My Account
          </NavLink>
        </div>
      </div>
    );
  };

  const MobileLink = (props: { to: string; label: string }) => (
    <li>
      <NavLink
        to={props.to}
        className="sidenav-close"
        style={({ isActive }) => ({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "14px 16px",
          margin: "6px 10px",
          borderRadius: 14,
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: 0.35,
          textTransform: "uppercase",
          color: isActive ? "#fff" : "#dbeafe",
          background: isActive
            ? "linear-gradient(135deg, rgba(6,182,212,0.24), rgba(37,99,235,0.18), rgba(168,85,247,0.15))"
            : "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))",
          border: isActive
            ? "1px solid rgba(56,189,248,0.28)"
            : "1px solid rgba(255,255,255,0.06)",
          textDecoration: "none",
          transition: "all 160ms ease",
          boxShadow: isActive ? "0 0 20px rgba(59,130,246,0.10)" : "none",
        })}
        onClick={() => {
          try {
            M.Sidenav.getInstance(sidenavRef.current)?.close();
          } catch {}
        }}
      >
        <span>{props.label}</span>
        <i className="material-icons" style={{ fontSize: 18, opacity: 0.8 }}>
          chevron_right
        </i>
      </NavLink>
    </li>
  );

  const MobileSection = ({ title, items }: { title: string; items: LinkItem[] }) => {
    if (!items.length) return null;

    return (
      <>
        <li style={{ padding: "8px 0 4px" }}>
          <div
            style={{
              padding: "10px 16px 5px",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: "rgba(125,211,252,0.86)",
            }}
          >
            {title}
          </div>
        </li>
        {items.map((l) => (
          <MobileLink key={`${title}:${l.to}`} to={l.to} label={l.label} />
        ))}
      </>
    );
  };

  return (
    <>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          height: NAV_H,
          lineHeight: "normal",
          background: scrolled
            ? "radial-gradient(1100px 140px at 12% 0%, rgba(34,211,238,0.10), transparent 60%), radial-gradient(900px 140px at 88% 0%, rgba(168,85,247,0.08), transparent 60%), linear-gradient(180deg, rgba(4,8,15,0.97), rgba(7,12,22,0.94))"
            : "radial-gradient(1100px 140px at 12% 0%, rgba(34,211,238,0.14), transparent 60%), radial-gradient(900px 140px at 88% 0%, rgba(168,85,247,0.11), transparent 60%), linear-gradient(180deg, rgba(5,9,18,0.90), rgba(7,12,22,0.84))",
          borderBottom: "1px solid rgba(56,189,248,0.12)",
          boxShadow: topBarGlow,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          transition: "all 180ms ease",
          overflow: "visible",
        }}
      >
        {/* Top highlight line — subtle brand accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.55) 20%, rgba(168,85,247,0.5) 55%, transparent 85%)",
            opacity: 0.8,
            pointerEvents: "none",
          }}
        />

        <div
          ref={dropdownRootRef}
          className="container"
          style={{
            position: "relative",
            height: NAV_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            overflow: "visible",
          }}
        >
          {/* Portrait only — landscape shows the brand mark in the rail instead */}
          <NavLink
            to={isAuthenticated ? "/" : `/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`}
            className="nav-logo"
            style={{
              minWidth: 0,
              alignItems: "center",
              gap: 14,
              textDecoration: "none",
              color: "white",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 52,
                height: 52,
                borderRadius: 16,
                background:
                  "linear-gradient(180deg, rgba(18,32,55,0.95), rgba(8,16,28,0.96))",
                border: "1px solid rgba(56,189,248,0.22)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
                boxShadow:
                  "0 0 30px rgba(59,130,246,0.16), inset 0 1px 0 rgba(255,255,255,0.07)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(circle at 30% 25%, rgba(34,211,238,0.20), transparent 42%), radial-gradient(circle at 75% 70%, rgba(168,85,247,0.15), transparent 35%)",
                  pointerEvents: "none",
                }}
              />
              <img
                src={logoSrc}
                alt="Fluke Games Logo"
                style={{
                  width: "72%",
                  height: "72%",
                  objectFit: "contain",
                  display: "block",
                  position: "relative",
                  zIndex: 1,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.02,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  letterSpacing: 0.4,
                  whiteSpace: "nowrap",
                  color: "#f8fbff",
                  textTransform: "uppercase",
                }}
              >
                Fluke Games
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "rgba(125,211,252,0.78)",
                  textTransform: "uppercase",
                  letterSpacing: 1.55,
                }}
              >
                ARCADE
              </span>
            </div>
          </NavLink>

          {/* Landscape: compact bell + profile chip — nav links live in the rail */}
          <div
            className="nav-landscape-actions"
            style={{ alignItems: "center", justifyContent: "flex-end", gap: 10, minWidth: 0, marginLeft: "auto" }}
          >
            <div style={actionsPillStyle}>
              {isAuthenticated ? <NotificationBell compact /> : null}
              <ProfileChip />
            </div>
          </div>

          {/* Portrait: compact bell + hamburger trigger for the slide-out drawer */}
          <div
            className="nav-portrait-actions"
            style={{ justifyContent: "flex-end", alignItems: "center", gap: 10 }}
          >
            <div style={actionsPillStyle}>
              {isAuthenticated ? <NotificationBell compact /> : null}
              <ProfileChip />
            </div>
            <a
              href="#!"
              data-target="mobile-sidenav"
              className="sidenav-trigger"
              style={{
                height: 46,
                width: 46,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 14,
                color: "white",
                background:
                  "linear-gradient(180deg, rgba(16,27,45,0.96), rgba(9,16,28,0.95))",
                border: "1px solid rgba(56,189,248,0.14)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <i className="material-icons">menu</i>
            </a>
          </div>
        </div>
      </nav>

      {/* Landscape: persistent icon rail (Facebook-style), replaces the drawer */}
      <div
        ref={railRootRef}
        className="nav-rail"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: RAIL_W,
          zIndex: 999,
          flexDirection: "column",
          alignItems: "center",
          paddingTop: NAV_H + 16,
          paddingBottom: 16,
          gap: 10,
          background: "linear-gradient(180deg, rgba(5,9,18,0.96), rgba(7,12,22,0.94))",
          borderRight: "1px solid rgba(56,189,248,0.10)",
          boxShadow: "8px 0 30px rgba(0,0,0,0.20)",
        }}
      >
        <NavLink
          to={isAuthenticated ? "/" : `/login?next=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`}
          title="Fluke Games Arcade"
          aria-label="Fluke Games Arcade — Home"
          style={{
            position: "relative",
            width: 46,
            height: 46,
            marginBottom: 6,
            borderRadius: 15,
            background: "linear-gradient(180deg, rgba(18,32,55,0.95), rgba(8,16,28,0.96))",
            border: "1px solid rgba(56,189,248,0.22)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
            boxShadow: "0 0 24px rgba(59,130,246,0.16), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 30% 25%, rgba(34,211,238,0.20), transparent 42%), radial-gradient(circle at 75% 70%, rgba(168,85,247,0.15), transparent 35%)",
              pointerEvents: "none",
            }}
          />
          <img
            src={logoSrc}
            alt="Fluke Games Logo"
            style={{ width: "72%", height: "72%", objectFit: "contain", display: "block", position: "relative", zIndex: 1 }}
          />
        </NavLink>
        <div style={{ width: 28, height: 1, background: "rgba(56,189,248,0.16)", marginBottom: 4 }} />

        {baseLinks.map((l) => (
          <RailLinkItem key={l.to} to={l.to} label={l.label} />
        ))}
        {groups.map((g) => (
          <RailGroupTrigger key={g.key} group={g} />
        ))}

        {isAuthenticated && (
          <a
            href="#!"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            style={{ ...railBtnStyle(false, false), marginTop: "auto" }}
          >
            <i className="material-icons" style={{ fontSize: 22, color: "#fda4af" }}>
              logout
            </i>
          </a>
        )}
      </div>

      {/* Portrait: classic slide-out drawer */}
      <ul
        id="mobile-sidenav"
        className="sidenav"
        ref={sidenavRef}
        style={{
          width: 340,
          background: "linear-gradient(180deg, #060b14, #0a1222 55%, #0c1426)",
          color: "white",
          borderRight: "1px solid rgba(56,189,248,0.12)",
        }}
      >
        <li>
          <div
            style={{
              padding: "22px 16px 16px",
              borderBottom: "1px solid rgba(56,189,248,0.10)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background:
                    "linear-gradient(180deg, rgba(18,32,55,0.95), rgba(8,16,28,0.96))",
                  border: "1px solid rgba(56,189,248,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  boxShadow: "0 0 24px rgba(59,130,246,0.12)",
                }}
              >
                <img
                  src={logoSrc}
                  alt="Fluke Games Logo"
                  style={{
                    width: "72%",
                    height: "72%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>

              <div style={{ lineHeight: 1.06, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 15,
                    color: "#f8fbff",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Fluke Games
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(125,211,252,0.74)",
                    textTransform: "uppercase",
                    letterSpacing: 1.1,
                  }}
                >
                  {isAuthenticated ? displayName : "Not Signed In"}
                </div>
              </div>
            </div>
          </div>
        </li>

        <MobileSection title="Navigation" items={baseLinks} />
        {organisationGroup.show && <MobileSection title="Organisation" items={organisationGroup.items} />}
        {adminGroup.show && <MobileSection title="Admin Systems" items={adminGroup.items} />}
        {superGroup.show && <MobileSection title="Super Systems" items={superGroup.items} />}

        {isAuthenticated && (
          <li style={{ padding: "10px 10px 16px" }}>
            <a
              href="#!"
              onClick={handleLogout}
              className="sidenav-close"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderRadius: 14,
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: 0.45,
                textTransform: "uppercase",
                color: "#f8fbff",
                background:
                  "linear-gradient(135deg, rgba(239,68,68,0.16), rgba(244,63,94,0.12))",
                textDecoration: "none",
                border: "1px solid rgba(248,113,113,0.18)",
              }}
            >
              <span>Logout</span>
              <i className="material-icons" style={{ fontSize: 18, opacity: 0.85 }}>
                logout
              </i>
            </a>
          </li>
        )}
      </ul>
    </>
  );
}
