// src/pages/Login.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth/AuthContext";
import M from "materialize-css";

type Particle = { x: number; y: number; vx: number; vy: number; r: number };
type PointerState = { x: number; y: number; active: boolean };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const particlesRef = useRef<Particle[]>([]);
  const pointerRef = useRef<PointerState>({ x: 0, y: 0, active: false });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const canSubmit = useMemo(
    () => !!username.trim() && !!password && !loading,
    [username, password, loading]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    function seedParticles(w: number, h: number) {
      const target = clamp(Math.floor((w * h) / 18000), 45, 110);
      const arr: Particle[] = [];
      for (let i = 0; i < target; i++) {
        arr.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.55,
          vy: (Math.random() - 0.5) * 0.55,
          r: 1.2 + Math.random() * 1.8,
        });
      }
      particlesRef.current = arr;
    }

    function resizeWith(c: HTMLCanvasElement, context: CanvasRenderingContext2D) {
      const w = window.innerWidth;
      const h = window.innerHeight;

      c.width = Math.floor(w * DPR);
      c.height = Math.floor(h * DPR);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;

      context.setTransform(DPR, 0, 0, DPR, 0, 0);
      seedParticles(w, h);
    }

    function drawWith(context: CanvasRenderingContext2D) {
      const w = window.innerWidth;
      const h = window.innerHeight;

      context.clearRect(0, 0, w, h);

      const g = context.createRadialGradient(
        w * 0.2,
        h * 0.15,
        0,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.85
      );
      g.addColorStop(0, "rgba(100, 200, 255, 0.10)");
      g.addColorStop(0.45, "rgba(0, 255, 136, 0.05)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.90)");
      context.fillStyle = g;
      context.fillRect(0, 0, w, h);

      const pts = particlesRef.current;

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      }

      const maxDist = 140;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > maxDist) continue;

          const t = 1 - d / maxDist;

          context.strokeStyle = `rgba(100, 200, 255, ${0.12 * t})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();

          if ((i + j) % 9 === 0) {
            context.strokeStyle = `rgba(0, 255, 136, ${0.08 * t})`;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }

      const ptr = pointerRef.current;
      if (ptr.active) {
        for (const p of pts) {
          const dx = ptr.x - p.x;
          const dy = ptr.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 180 && d > 0.0001) {
            const pull = (1 - d / 180) * 0.015;
            p.vx += (dx / d) * pull;
            p.vy += (dy / d) * pull;
            p.vx = clamp(p.vx, -1.2, 1.2);
            p.vy = clamp(p.vy, -1.2, 1.2);
          }
        }

        const rg = context.createRadialGradient(ptr.x, ptr.y, 0, ptr.x, ptr.y, 220);
        rg.addColorStop(0, "rgba(100, 200, 255, 0.18)");
        rg.addColorStop(0.5, "rgba(0, 255, 136, 0.08)");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = rg;
        context.beginPath();
        context.arc(ptr.x, ptr.y, 220, 0, Math.PI * 2);
        context.fill();
      }

      for (const p of pts) {
        context.shadowBlur = 12;
        context.shadowColor = "rgba(100,200,255,0.35)";
        context.fillStyle = "rgba(100, 200, 255, 0.75)";
        context.beginPath();
        context.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        context.fill();

        if (p.r > 2.2) {
          context.shadowBlur = 18;
          context.shadowColor = "rgba(0,255,136,0.20)";
          context.fillStyle = "rgba(0, 255, 136, 0.25)";
          context.beginPath();
          context.arc(p.x, p.y, p.r + 0.8, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.shadowBlur = 0;

      rafRef.current = window.requestAnimationFrame(() => drawWith(context));
    }

    function onPointerMove(e: PointerEvent) {
      pointerRef.current = { x: e.clientX, y: e.clientY, active: true };
    }
    function onPointerLeave() {
      pointerRef.current.active = false;
    }

    resizeWith(canvas, ctx);
    rafRef.current = window.requestAnimationFrame(() => drawWith(ctx));

    const onResize = () => resizeWith(canvas, ctx);

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrMsg("");
    setLoading(true);
    try {
      const ok = await login(username, password);
      if (!ok) {
        setErrMsg("Invalid username or password.");
        M.toast({ html: "Invalid credentials", classes: "red darken-2" });
        setLoading(false);
        return;
      }
      M.toast({ html: "Welcome back!", classes: "green darken-2" });
      setLoading(false);
      navigate("/");
    } catch (err: any) {
      const msg = err?.message || "Login failed. Please try again.";
      setErrMsg(msg);
      M.toast({ html: msg, classes: "red darken-2" });
      setLoading(false);
    }
  }

  const styles = (
    <style>{`
      .cpWrap { position: relative; min-height: calc(100vh - 64px); overflow: hidden; background: #000; }
      .cpCanvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

      .cpCenter {
        position: relative;
        z-index: 10;
        min-height: calc(100vh - 64px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 28px 14px 60px;
      }

      .cpCard {
        width: 92%;
        max-width: 460px;
        background: rgba(10, 10, 25, 0.88);
        backdrop-filter: blur(20px);
        padding: 46px 46px 34px;
        border-radius: 25px;
        border: 2px solid rgba(100, 200, 255, 0.28);
        box-shadow: 0 0 100px rgba(100, 200, 255, 0.18), inset 0 0 50px rgba(100, 200, 255, 0.05);
      }

      .cpTitle {
        text-align: center;
        font-size: 32px;
        font-weight: 800;
        letter-spacing: 2px;
        margin: 0 0 12px 0;
        background: linear-gradient(135deg, #64c8ff, #00ff88);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .cpSub {
        text-align: center;
        color: #94a3b8;
        margin: 0 0 30px 0;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 700;
      }

      .cpErr {
        border: 1px solid rgba(255, 0, 102, 0.35);
        background: rgba(255, 0, 102, 0.10);
        color: #ffb4cc;
        padding: 12px 14px;
        border-radius: 12px;
        font-weight: 800;
        font-size: 13px;
        margin-bottom: 18px;
      }

      .cpGroup { margin-bottom: 22px; }
      .cpLabel {
        display: block;
        color: #64c8ff;
        font-size: 12px;
        margin-bottom: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .cpInputWrap { position: relative; }
      .cpInput {
        width: 100%;
        padding: 14px 44px 14px 18px;
        background: rgba(100, 200, 255, 0.05);
        border: 2px solid rgba(100, 200, 255, 0.20);
        border-radius: 12px;
        color: #ffffff;
        font-size: 15px;
        transition: all 0.35s ease;
        outline: none;
      }
      .cpInput::placeholder { color: #4a7a99; }
      .cpInput:focus {
        background: rgba(100, 200, 255, 0.10);
        border-color: rgba(100, 200, 255, 0.60);
        box-shadow: 0 0 40px rgba(100, 200, 255, 0.28);
      }
      .cpInput:disabled { opacity: 0.65; cursor: not-allowed; }

      .cpIconBtn {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        width: 34px;
        height: 34px;
        border-radius: 12px;
        border: 1px solid rgba(100,200,255,0.20);
        background: rgba(100,200,255,0.06);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: rgba(255,255,255,0.85);
      }
      .cpIconBtn:disabled { opacity: 0.6; cursor: not-allowed; }

      .cpBtn {
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #00ff88 0%, #64c8ff 100%);
        border: none;
        border-radius: 12px;
        color: #000000;
        font-size: 15px;
        font-weight: 900;
        cursor: pointer;
        margin-top: 10px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
      }
      .cpBtn:disabled { opacity: 0.7; cursor: not-allowed; }

      .cpFoot {
        text-align: center;
        margin-top: 22px;
        color: #64a3c8;
        font-size: 13px;
        font-weight: 800;
      }
      .cpFoot a { color: #00ff88; text-decoration: none; font-weight: 900; }

      @media (max-width: 480px) {
        .cpCard { padding: 34px 22px 26px; border-radius: 20px; }
        .cpTitle { font-size: 28px; }
      }
    `}</style>
  );

  return (
    <>
      <Navbar />
      {styles}

      <div className="cpWrap">
        <canvas ref={canvasRef} className="cpCanvas" />

        <div className="cpCenter">
          <div className="cpCard">
            <h1 className="cpTitle">ARCADE</h1>
            <p className="cpSub">Enter the portal</p>

            {errMsg ? (
              <div className="cpErr">
                <i className="material-icons" style={{ fontSize: 18, verticalAlign: "middle", marginRight: 8 }}>
                  error
                </i>
                {errMsg}
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="cpGroup">
                <label className="cpLabel" htmlFor="username">Username / Email</label>
                <div className="cpInputWrap">
                  <input
                    id="username"
                    className="cpInput"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="you@fluke… or username"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="username"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="cpGroup">
                <label className="cpLabel" htmlFor="password">Password</label>
                <div className="cpInputWrap">
                  <input
                    id="password"
                    className="cpInput"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="cpIconBtn"
                    onClick={() => setShowPassword((s) => !s)}
                    disabled={loading}
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <i className="material-icons" style={{ fontSize: 20 }}>
                      {showPassword ? "visibility_off" : "visibility"}
                    </i>
                  </button>
                </div>
              </div>

              <button className="cpBtn" type="submit" disabled={!canSubmit}>
                {loading ? "Signing in…" : "Access"}
              </button>
            </form>

            <div className="cpFoot">
              Having trouble?{" "}
              <a
                href="#help"
                onClick={(e) => {
                  e.preventDefault();
                  M.toast({ html: "Contact your project lead for access.", classes: "blue-grey darken-1" });
                }}
              >
                Contact your project lead
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
