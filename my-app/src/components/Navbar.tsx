import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

declare const M: any;

type LinkItem = {
  to: string;
  label: string;
};

type MenuGroup = {
  key: string;
  label: string;
  items: LinkItem[];
  show: boolean;
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = !!user;
  const roleLower = (user?.role ? String(user.role) : "employee").toLowerCase();
  const isAdminish = roleLower === "admin" || roleLower === "super";
  const isSuper = roleLower === "super";

  const sidenavRef = useRef<HTMLUListElement | null>(null);
  const dropdownRootRef = useRef<HTMLDivElement | null>(null);

  const [scrolled, setScrolled] = useState(false);
  const [openDesktopMenu, setOpenDesktopMenu] = useState<string | null>(null);

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
      if (!dropdownRootRef.current) return;
      if (!dropdownRootRef.current.contains(e.target as Node)) {
        setOpenDesktopMenu(null);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setOpenDesktopMenu(null);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
    try {
      M.Sidenav.getInstance(sidenavRef.current)?.close();
    } catch {}
  };

  const displayName = user?.name || user?.username || "";
  const initial = (displayName || "U").slice(0, 1).toUpperCase();

  const baseLinks = useMemo<LinkItem[]>(() => {
    if (!isAuthenticated) return [{ to: "/login", label: "Login" }];
    return [
      { to: "/", label: "Home" },
      { to: "/employees", label: "Employees" },
      { to: "/account", label: "My Account" },
    ];
  }, [isAuthenticated]);

  const adminGroup = useMemo<MenuGroup>(
    () => ({
      key: "admin",
      label: "Admin",
      show: isAdminish,
      items: [
        { to: "/admin", label: "Admin Dashboard" },
        { to: "/applicants", label: "Applicants" },
        { to: "/admin/jobs", label: "Jobs Admin" },
      ],
    }),
    [isAdminish]
  );

  const superGroup = useMemo<MenuGroup>(
    () => ({
      key: "super",
      label: "Super",
      show: isSuper,
      items: [
        { to: "/super", label: "Super Console" },
        { to: "/super/ai", label: "Super AI" },
      ],
    }),
    [isSuper]
  );

  const isRouteActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  const isGroupActive = (group: MenuGroup) => group.items.some((x) => isRouteActive(x.to));

  const topBarGlow = scrolled
    ? "0 10px 30px rgba(0,0,0,0.34), 0 0 0 1px rgba(96,165,250,0.05)"
    : "0 8px 24px rgba(0,0,0,0.20), 0 0 0 1px rgba(96,165,250,0.04)";

  const desktopLinkStyle = (isActive: boolean): CSSProperties => ({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    padding: "0 16px",
    borderRadius: 14,
    textDecoration: "none",
    color: isActive ? "#f8fbff" : "rgba(219,234,254,0.88)",
    fontSize: 13,
    fontWeight: isActive ? 900 : 800,
    letterSpacing: 0.55,
    textTransform: "uppercase",
    background: isActive
      ? "linear-gradient(180deg, rgba(34,211,238,0.22), rgba(59,130,246,0.16) 55%, rgba(168,85,247,0.14))"
      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
    border: isActive
      ? "1px solid rgba(56,189,248,0.34)"
      : "1px solid rgba(148,163,184,0.08)",
    boxShadow: isActive
      ? "inset 0 1px 0 rgba(255,255,255,0.10), 0 0 24px rgba(59,130,246,0.14)"
      : "inset 0 1px 0 rgba(255,255,255,0.03)",
    transition: "all 180ms ease",
    overflow: "hidden",
    whiteSpace: "nowrap",
  });

  const desktopDropdownButtonStyle = (isActive: boolean, isOpen: boolean): CSSProperties => ({
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    padding: "0 16px",
    borderRadius: 14,
    color: isActive || isOpen ? "#f8fbff" : "rgba(219,234,254,0.88)",
    fontSize: 13,
    fontWeight: isActive || isOpen ? 900 : 800,
    letterSpacing: 0.55,
    textTransform: "uppercase",
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
    whiteSpace: "nowrap",
    userSelect: "none",
    outline: "none",
  });

  const TopLink = (props: { to: string; label: string }) => (
    <li style={{ display: "flex", alignItems: "center" }}>
      <NavLink to={props.to} style={({ isActive }) => desktopLinkStyle(isActive)}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
            opacity: 0.5,
          }}
        />
        <span style={{ position: "relative", zIndex: 1 }}>{props.label}</span>
      </NavLink>
    </li>
  );

  const DesktopDropdown = ({ group }: { group: MenuGroup }) => {
    if (!group.show) return null;

    const active = isGroupActive(group);
    const open = openDesktopMenu === group.key;

    return (
      <li
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={() => setOpenDesktopMenu(group.key)}
      >
        <button
          type="button"
          onClick={() => setOpenDesktopMenu((prev) => (prev === group.key ? null : group.key))}
          style={desktopDropdownButtonStyle(active, open)}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
              opacity: 0.5,
            }}
          />
          <span style={{ position: "relative", zIndex: 1 }}>{group.label}</span>
          <i
            className="material-icons"
            style={{
              position: "relative",
              zIndex: 1,
              fontSize: 18,
              opacity: 0.9,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 180ms ease",
            }}
          >
            expand_more
          </i>
        </button>

        <div
          onMouseEnter={() => setOpenDesktopMenu(group.key)}
          onMouseLeave={() => setOpenDesktopMenu((prev) => (prev === group.key ? null : prev))}
          style={{
            position: "absolute",
            top: "calc(100% + 12px)",
            left: 0,
            minWidth: 260,
            padding: 10,
            borderRadius: 20,
            background:
              "linear-gradient(180deg, rgba(8,14,24,0.98), rgba(10,18,34,0.97))",
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
          <div
            style={{
              position: "absolute",
              top: -8,
              left: 24,
              width: 16,
              height: 16,
              transform: "rotate(45deg)",
              background: "rgba(9,15,27,0.98)",
              borderLeft: "1px solid rgba(56,189,248,0.18)",
              borderTop: "1px solid rgba(56,189,248,0.18)",
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
                onClick={() => setOpenDesktopMenu(null)}
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
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
                    opacity: 0.55,
                  }}
                />
                <span style={{ position: "relative", zIndex: 1 }}>{item.label}</span>
                <i
                  className="material-icons"
                  style={{ position: "relative", zIndex: 1, fontSize: 17, opacity: 0.78 }}
                >
                  chevron_right
                </i>
              </NavLink>
            );
          })}
        </div>
      </li>
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
        {items.map((l) => (
          <MobileLink key={l.to} to={l.to} label={l.label} />
        ))}
      </li>
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
            ? "linear-gradient(180deg, rgba(4,8,15,0.96), rgba(7,12,22,0.93))"
            : "linear-gradient(180deg, rgba(5,9,18,0.88), rgba(7,12,22,0.82))",
          borderBottom: "1px solid rgba(56,189,248,0.10)",
          boxShadow: topBarGlow,
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          transition: "all 180ms ease",
          overflow: "visible",
        }}
      >
        <div
          ref={dropdownRootRef}
          className="container"
          style={{
            height: NAV_H,
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 18,
            overflow: "visible",
          }}
        >
          <NavLink
            to={isAuthenticated ? "/" : "/login"}
            style={{
              minWidth: 0,
              display: "inline-flex",
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

          <div
            className="hide-on-small-only"
            style={{
              display: "flex",
              justifyContent: "center",
              overflow: "visible",
            }}
          >
            <ul
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                margin: 0,
                padding: 7,
                borderRadius: 20,
                background:
                  "linear-gradient(180deg, rgba(11,18,31,0.92), rgba(8,14,24,0.90))",
                border: "1px solid rgba(56,189,248,0.10)",
                boxShadow:
                  "0 12px 35px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)",
                overflow: "visible",
              }}
            >
              {baseLinks.map((l) => (
                <TopLink key={l.to} to={l.to} label={l.label} />
              ))}
              <DesktopDropdown group={adminGroup} />
              <DesktopDropdown group={superGroup} />
            </ul>
          </div>

          <div
            className="hide-on-small-only"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
              minWidth: 0,
            }}
          >
            {isAuthenticated && (
              <>
                <div
                  title={displayName}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 11px 8px 8px",
                    borderRadius: 16,
                    background:
                      "linear-gradient(180deg, rgba(12,20,34,0.95), rgba(8,14,25,0.92))",
                    border: "1px solid rgba(56,189,248,0.12)",
                    maxWidth: 260,
                    boxShadow:
                      "0 0 18px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background:
                        "linear-gradient(135deg, rgba(6,182,212,1), rgba(37,99,235,1), rgba(168,85,247,1))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: 900,
                      fontSize: 12,
                      flexShrink: 0,
                      boxShadow: "0 0 24px rgba(59,130,246,0.22)",
                    }}
                  >
                    {initial}
                  </div>

                  <div
                    style={{
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <span
                      style={{
                        color: "#f8fbff",
                        fontWeight: 800,
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {displayName}
                    </span>
                    <span
                      style={{
                        color: "rgba(125,211,252,0.72)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: 1.0,
                      }}
                    >
                      {roleLower}
                    </span>
                  </div>
                </div>

                <a
                  href="#!"
                  onClick={handleLogout}
                  style={{
                    height: 44,
                    padding: "0 15px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 14,
                    textDecoration: "none",
                    color: "#f8fbff",
                    fontWeight: 900,
                    fontSize: 13,
                    letterSpacing: 0.45,
                    textTransform: "uppercase",
                    background:
                      "linear-gradient(135deg, rgba(239,68,68,0.16), rgba(244,63,94,0.12))",
                    border: "1px solid rgba(248,113,113,0.18)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    transition: "all 180ms ease",
                  }}
                >
                  <i className="material-icons" style={{ fontSize: 18 }}>
                    logout
                  </i>
                  Logout
                </a>
              </>
            )}

            {!isAuthenticated && (
              <a
                href="#!"
                onClick={() => navigate("/login")}
                style={{
                  height: 44,
                  padding: "0 16px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 14,
                  textDecoration: "none",
                  color: "#f8fbff",
                  fontWeight: 900,
                  fontSize: 13,
                  letterSpacing: 0.55,
                  textTransform: "uppercase",
                  background:
                    "linear-gradient(135deg, rgba(6,182,212,0.92), rgba(37,99,235,0.92), rgba(168,85,247,0.92))",
                  border: "1px solid rgba(56,189,248,0.30)",
                  boxShadow: "0 0 26px rgba(59,130,246,0.18)",
                }}
              >
                Login
              </a>
            )}
          </div>

          <a
            href="#!"
            data-target="mobile-sidenav"
            className="sidenav-trigger hide-on-med-and-up"
            style={{
              justifySelf: "end",
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
      </nav>

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
              background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
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