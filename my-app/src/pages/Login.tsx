// src/pages/Login.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth/AuthContext";
// If you have materialize JS installed:
import M from "materialize-css";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading,   setLoading] = useState(false);

  // EITHER: auto-float labels whenever values change
  useEffect(() => {
    if (typeof M !== "undefined") M.updateTextFields();
  }, [username, password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const ok = await login(username, password);
      setLoading(false);
      if (!ok) return alert("Invalid credentials");
      navigate("/");
    } catch (err: any) {
      setLoading(false);
      alert(err?.message || "Login failed");
    }
  }

  return (
    <>
      <Navbar />
      <div className="container" style={{ marginTop: 40, maxWidth: 420 }}>
        <h5>Login</h5>
        <form onSubmit={handleSubmit}>
          <div className="input-field">
            <input
              id="username"
              className="validate"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
            />
            {/* OR (no JS) add active when non-empty: className={username ? "active" : ""} */}
            <label htmlFor="username" className={username ? "active" : ""}>
              Username
            </label>
          </div>

          <div className="input-field" style={{ position: "relative" }}>
            <input
              id="password"
              className="validate"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label htmlFor="password" className={password ? "active" : ""}>
              Password
            </label>
            <i
              className="material-icons"
              style={{ position: "absolute", right: 10, top: 10, cursor: "pointer", color: "#555" }}
              onClick={() => setShowPassword((s) => !s)}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "visibility_off" : "visibility"}
            </i>
          </div>

          <button className={`btn blue ${loading ? "disabled" : ""}`} type="submit">
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </>
  );
}
