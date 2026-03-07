import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

declare const M: any;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAuthenticated = !!user;
  const roleLower = (user?.role ? String(user.role) : "employee").toLowerCase();
  const isAdminish = roleLower === "admin" || roleLower === "super";
  const isSuper = roleLower === "super";

  const sidenavRef = useRef<HTMLUListElement | null>(null);
  const [scrolled, setScrolled] = useState(false);

  const logoSrc = "/logos/Fluke_Games_Icon_5.png";

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

  const handleLogout = () => {
    logout();
    navigate("/login");
    try {
      M.Sidenav.getInstance(sidenavRef.current)?.close();
    } catch {}
  };

  const displayName = user?.name || user?.username || "";
  const initial = (displayName || "U").slice(0, 1).toUpperCase();

  const links = useMemo(() => {
    if (!isAuthenticated) return [{ to: "/login", label: "Login" }];

    const out: { to: string; label: string; show: boolean }[] = [
      { to: "/", label: "Home", show: true },
      { to: "/employees", label: "Employees", show: true },
      { to: "/applicants", label: "Applicants", show: isAdminish },
      { to: "/admin/jobs", label: "Jobs Admin", show: isAdminish },
      { to: "/account", label: "My Account", show: true },
      { to: "/admin", label: "Admin", show: isAdminish },
      { to: "/super", label: "Super", show: isSuper },
    ];

    return out.filter((x) => x.show).map(({ to, label }) => ({ to, label }));
  }, [isAuthenticated, isAdminish, isSuper]);

  const NAV_H = 74;

  const desktopLinkStyle = (isActive: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    padding: "0 14px",
    borderRadius: 12,
    textDecoration: "none",
    color: isActive ? "#ffffff" : "rgba(226,232,240,0.84)",
    fontSize: 13,
    fontWeight: isActive ? 800 : 700,
    letterSpacing: 0.2,
    background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
    border: isActive
      ? "1px solid rgba(148,163,184,0.18)"
      : "1px solid transparent",
    boxShadow: isActive ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "none",
    transition: "all 180ms ease",
  });

  const TopLink = (props: { to: string; label: string }) => (
    <li style={{ display: "flex", alignItems: "center" }}>
      <NavLink to={props.to} style={({ isActive }) => desktopLinkStyle(isActive)}>
        {props.label}
      </NavLink>
    </li>
  );

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
          padding: "13px 16px",
          margin: "6px 10px",
          borderRadius: 12,
          fontWeight: 800,
          color: isActive ? "#fff" : "#dbe7ff",
          background: isActive ? "rgba(37,99,235,0.22)" : "rgba(255,255,255,0.03)",
          border: isActive
            ? "1px solid rgba(59,130,246,0.24)"
            : "1px solid rgba(255,255,255,0.06)",
          textDecoration: "none",
          transition: "all 160ms ease",
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
            ? "rgba(7,12,22,0.88)"
            : "rgba(7,12,22,0.72)",
          borderBottom: "1px solid rgba(148,163,184,0.12)",
          boxShadow: scrolled ? "0 18px 40px rgba(0,0,0,0.26)" : "0 10px 24px rgba(0,0,0,0.14)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          transition: "all 180ms ease",
        }}
      >
        <div
          className="container"
          style={{
            height: NAV_H,
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            alignItems: "center",
            gap: 18,
          }}
        >
          <NavLink
            to={isAuthenticated ? "/" : "/login"}
            style={{
              minWidth: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: "white",
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
                border: "1px solid rgba(148,163,184,0.16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
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

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.08,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  letterSpacing: 0.2,
                  whiteSpace: "nowrap",
                  color: "#f8fafc",
                }}
              >
                Fluke Games
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "rgba(226,232,240,0.62)",
                  textTransform: "uppercase",
                  letterSpacing: 1.1,
                }}
              >
                Internal Portal
              </span>
            </div>
          </NavLink>

          <div
            className="hide-on-small-only"
            style={{
              display: "flex",
              justifyContent: "center",
            }}
          >
            <ul
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                margin: 0,
                padding: 6,
                borderRadius: 16,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(148,163,184,0.10)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              {links.map((l) => (
                <TopLink key={l.to} to={l.to} label={l.label} />
              ))}
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
                    padding: "8px 10px 8px 8px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(148,163,184,0.12)",
                    maxWidth: 240,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: 900,
                      fontSize: 12,
                      flexShrink: 0,
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
                        color: "#f8fafc",
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
                        color: "rgba(226,232,240,0.56)",
                        fontSize: 11,
                        textTransform: "capitalize",
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
                    height: 42,
                    padding: "0 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: 12,
                    textDecoration: "none",
                    color: "#f8fafc",
                    fontWeight: 800,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(148,163,184,0.12)",
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
                  height: 42,
                  padding: "0 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 12,
                  textDecoration: "none",
                  color: "#f8fafc",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  border: "1px solid rgba(59,130,246,0.28)",
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
              height: 42,
              width: 42,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              color: "white",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(148,163,184,0.12)",
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
          width: 330,
          background: "linear-gradient(180deg, #09111f, #0b1324)",
          color: "white",
          borderRight: "1px solid rgba(148,163,184,0.12)",
        }}
      >
        <li>
          <div
            style={{
              padding: "20px 16px 16px",
              borderBottom: "1px solid rgba(148,163,184,0.10)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
                  border: "1px solid rgba(148,163,184,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
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

              <div style={{ lineHeight: 1.15, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 15,
                    color: "#f8fafc",
                  }}
                >
                  Fluke Games
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(226,232,240,0.62)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {isAuthenticated ? displayName : "Not signed in"}
                </div>
              </div>
            </div>
          </div>
        </li>

        <li style={{ padding: "10px 0 6px" }}>
          {links.map((l) => (
            <MobileLink key={l.to} to={l.to} label={l.label} />
          ))}
        </li>

        {isAuthenticated && (
          <li style={{ padding: "8px 10px 14px" }}>
            <a
              href="#!"
              onClick={handleLogout}
              className="sidenav-close"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "13px 16px",
                borderRadius: 12,
                fontWeight: 900,
                color: "#f8fafc",
                background: "rgba(255,255,255,0.04)",
                textDecoration: "none",
                border: "1px solid rgba(148,163,184,0.12)",
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