// src/pages/Employee.tsx
import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth/AuthContext";
import type { ApiUser } from "../api";

export default function Employee() {
  const { user, api } = useAuth();
  const [me, setMe] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        const list = await api.getUsers();
        const mine =
          list.find(u => u.username === user.username) ||
          list.find(u => (u.employee_email || "").toLowerCase() === (user.username || "").toLowerCase());
        if (mounted) setMe(mine || null);
      } catch {
        // ignore; we'll just show minimal info
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user, api]);

  const displayName = me?.employee_name || user?.name || user?.username || "—";
  const email = me?.employee_email || user?.username || "—";
  const role = (me?.employee_role || user?.role || "employee").toUpperCase();
  const avatar = me?.employee_profilepicture;

  return (
    <>
      <Navbar />
      <main className="container" style={{ paddingTop: 24, maxWidth: 1000 }}>
        <div className="card">
          <div className="card-content">
            <span className="card-title">My Profile</span>
            {loading ? (
              <p>Loading…</p>
            ) : (
              <div className="row" style={{ alignItems: "center" }}>
                <div className="col s12 m2 center">
                  {avatar ? (
                    <img src={avatar} alt="me" className="circle responsive-img" style={{ width: 120, height: 120, objectFit: "cover" }} />
                  ) : (
                    <div className="circle" style={{ width: 120, height: 120, margin: "0 auto", background: "#eceff1" }} />
                  )}
                </div>
                <div className="col s12 m10">
                  <h6 style={{ margin: 0 }}>{displayName}</h6>
                  <div className="grey-text" style={{ marginBottom: 8 }}>
                    <code>{email}</code> &nbsp;•&nbsp; <span className="chip">{role}</span>
                  </div>

                  <ul className="collection">
                    <li className="collection-item"><b>Title:</b> {me?.employee_title || "—"}</li>
                    <li className="collection-item"><b>DOB:</b> {me?.employee_dob || "—"}</li>
                    <li className="collection-item"><b>Employment:</b> {me?.employment_type || "—"}</li>
                    <li className="collection-item"><b>Department:</b> {me?.department || "—"}</li>
                    <li className="collection-item"><b>Location:</b> {me?.location || "—"}</li>
                    <li className="collection-item"><b>Phone:</b> {me?.employee_phonenumber || "—"}</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
