import { useEffect, useMemo, useRef, useState } from "react";
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

  const logoSrc = "/logos/Fluke_Games_Icon_5.png"; // from public/

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

  const NAV_H = 60;
  const padX = 14;

  const TopLink = (props: { to: string; label: string }) => (
    <li style={{ height: NAV_H, display: "flex", alignItems: "stretch" }}>
      <NavLink
        to={props.to}
        style={({ isActive }) => ({
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: NAV_H,
          padding: `0 ${padX}px`,
          fontWeight: 650,
          fontSize: 14,
          color: "white",
          textDecoration: "none",
          opacity: isActive ? 1 : 0.92,
          borderBottom: isActive ? "2px solid rgba(255,255,255,0.95)" : "2px solid transparent",
          transition: "opacity 160ms ease, border-color 160ms ease",
        })}
      >
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
          padding: "12px 16px",
          fontWeight: 750,
          color: isActive ? "#0d47a1" : "#111",
          background: isActive ? "rgba(13,71,161,0.06)" : "transparent",
          textDecoration: "none",
        })}
        onClick={() => {
          try {
            M.Sidenav.getInstance(sidenavRef.current)?.close();
          } catch {}
        }}
      >
        <span>{props.label}</span>
        <i className="material-icons" style={{ fontSize: 18, opacity: 0.6 }}>
          chevron_right
        </i>
      </NavLink>
    </li>
  );

  return (
    <>
      <nav
        className="blue"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          height: NAV_H,
          lineHeight: `${NAV_H}px`,
          background: "linear-gradient(90deg, #1565c0, #1976d2 55%, #1e88e5)",
          boxShadow: scrolled ? "0 10px 28px rgba(0,0,0,0.16)" : "0 6px 18px rgba(0,0,0,0.10)",
          transition: "box-shadow 180ms ease",
        }}
      >
        <div
          className="nav-wrapper container"
          style={{
            height: NAV_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          {/* Brand with proper centered logo */}
          <NavLink
            to={isAuthenticated ? "/" : "/login"}
            style={{
              height: NAV_H,
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              color: "white",
              textDecoration: "none",
              fontWeight: 850,
              letterSpacing: 0.2,
            }}
          >
            {/* Perfectly centered square logo container */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.18)",
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
                  width: "70%",
                  height: "70%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
              <span style={{ fontSize: 14 }}>Fluke Games</span>
              <span style={{ fontSize: 11, opacity: 0.88, fontWeight: 650 }}>Portal</span>
            </div>
          </NavLink>

          {/* Mobile trigger */}
          <a
            href="#!"
            data-target="mobile-sidenav"
            className="sidenav-trigger hide-on-med-and-up"
            style={{
              height: NAV_H,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 10px",
              color: "white",
            }}
          >
            <i className="material-icons">menu</i>
          </a>

          {/* Desktop */}
          <ul
            className="right hide-on-small-only"
            style={{
              display: "flex",
              alignItems: "stretch",
              margin: 0,
              height: NAV_H,
            }}
          >
            {links.map((l) => (
              <TopLink key={l.to} to={l.to} label={l.label} />
            ))}

            {isAuthenticated && (
              <>
                <li
                  style={{
                    height: NAV_H,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 8px",
                  }}
                >
                  <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.35)" }} />
                </li>

                <li style={{ height: NAV_H, display: "flex", alignItems: "center" }}>
                  <span
                    title={displayName}
                    className="grey-text text-lighten-4"
                    style={{
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: 650,
                      fontSize: 13,
                      padding: `0 ${padX}px`,
                    }}
                  >
                    {displayName}
                  </span>
                </li>

                <li style={{ height: NAV_H, display: "flex", alignItems: "stretch" }}>
                  <a
                    href="#!"
                    onClick={handleLogout}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: NAV_H,
                      padding: `0 ${padX}px`,
                      fontWeight: 750,
                      color: "white",
                      opacity: 0.92,
                      textDecoration: "none",
                    }}
                  >
                    Logout
                  </a>
                </li>
              </>
            )}
          </ul>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.12)" }} />
      </nav>

      {/* Mobile */}
      <ul id="mobile-sidenav" className="sidenav" ref={sidenavRef} style={{ width: 320 }}>
        <li>
          <div
            style={{
              padding: "18px 16px",
              background: "linear-gradient(90deg, #1565c0, #1976d2)",
              color: "white",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.18)",
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
                    width: "70%",
                    height: "70%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>

              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>Fluke Games</div>
                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  {isAuthenticated ? displayName : "Not signed in"}
                </div>
              </div>
            </div>
          </div>
        </li>

        <li>
          <div className="divider" />
        </li>

        {links.map((l) => (
          <MobileLink key={l.to} to={l.to} label={l.label} />
        ))}

        {isAuthenticated && (
          <>
            <li>
              <div className="divider" />
            </li>
            <li>
              <a
                href="#!"
                onClick={handleLogout}
                className="sidenav-close"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  fontWeight: 850,
                  color: "#111",
                  textDecoration: "none",
                }}
              >
                <span>Logout</span>
                <i className="material-icons" style={{ fontSize: 18, opacity: 0.6 }}>
                  logout
                </i>
              </a>
            </li>
          </>
        )}
      </ul>
    </>
  );
}
