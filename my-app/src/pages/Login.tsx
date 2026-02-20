// src/pages/Login.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth/AuthContext";
import M from "materialize-css";
import * as THREE from "three";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const rafRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const tubeGroupRef = useRef<THREE.Group | null>(null);
  const particleGroupRef = useRef<THREE.Group | null>(null);

  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

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

    // --- Scene setup ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    camera.position.z = 25;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 1);

    // ✅ Make highlights actually look “shiny”
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    rendererRef.current = renderer;

    // --- Groups ---
    const tubeGroup = new THREE.Group();
    tubeGroupRef.current = tubeGroup;
    scene.add(tubeGroup);

    const particleGroup = new THREE.Group();
    particleGroupRef.current = particleGroup;
    scene.add(particleGroup);

    // --- Create tube rings (tunnel) ---
    function createTubeRing(radius: number, depth: number, rotation = 0) {
      const points: THREE.Vector3[] = [];
      const segments = 64;

      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(
          new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
        );
      }
      points.push(points[0].clone());

      const curve = new THREE.CatmullRomCurve3(points, true);
      const tubeGeometry = new THREE.TubeGeometry(curve, segments, 0.8, 12, true);

      const hue = Math.random() * 0.3 + 0.5;

      // ✅ Strong specular highlight + higher shininess = more 3D “metal/gloss”
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(hue, 1, 0.55),
        emissive: new THREE.Color().setHSL(hue, 1, 0.20),
        specular: new THREE.Color(0xffffff),
        shininess: 160,
        wireframe: false,
      });

      const tube = new THREE.Mesh(tubeGeometry, material);
      tube.castShadow = true;
      tube.receiveShadow = true;
      tube.position.z = depth;
      tube.rotation.z = rotation;

      return tube;
    }

    const isMobile = window.innerWidth < 520;
    const tubeCount = isMobile ? 11 : 15;
    for (let i = 0; i < tubeCount; i++) {
      const tube = createTubeRing(8 + i * 1.5, -50 + i * 7, i * 0.1);
      tubeGroup.add(tube);
    }

    // --- Particles ---
    const particleGeometry = new THREE.IcosahedronGeometry(0.3, 2);
    const particleCount = isMobile ? 200 : 300;

    for (let i = 0; i < particleCount; i++) {
      const hue = Math.random() * 0.2 + 0.5;
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(hue, 1, 0.7),
        emissive: new THREE.Color().setHSL(hue, 1, 0.4),
        specular: new THREE.Color(0xffffff),
        shininess: 140,
      });

      const particle = new THREE.Mesh(particleGeometry, material);

      const angle = Math.random() * Math.PI * 2;
      const rad = 5 + Math.random() * 8;

      particle.position.set(
        Math.cos(angle) * rad,
        Math.sin(angle) * rad,
        -40 + Math.random() * 80
      );

      const s = Math.random() * 0.6 + 0.3;
      particle.scale.set(s, s, s);
      particle.castShadow = true;

      particle.userData.vz = Math.random() * 0.3 + 0.1;

      particleGroup.add(particle);
    }

    // --- Lighting ---
    const light1 = new THREE.PointLight(0x00ff88, 2.2, 240);
    light1.position.set(20, 20, 20);
    light1.castShadow = true;
    scene.add(light1);

    const light2 = new THREE.PointLight(0x64c8ff, 2.2, 240);
    light2.position.set(-20, -20, 20);
    light2.castShadow = true;
    scene.add(light2);

    const light3 = new THREE.PointLight(0xff0080, 1.6, 170);
    light3.position.set(0, 30, -30);
    light3.castShadow = true;
    scene.add(light3);

    // ✅ This “raking” light is what makes the tubes read as 3D
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(0.6, 1.0, 0.8);
    scene.add(key);

    const ambient = new THREE.AmbientLight(0xffffff, 0.10);
    scene.add(ambient);

    // --- Events ---
    function onMouseMove(e: PointerEvent) {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    }

    function onResize() {
      const cam = cameraRef.current;
      const r = rendererRef.current;
      if (!cam || !r) return;

      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
      r.setSize(window.innerWidth, window.innerHeight);
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    }

    window.addEventListener("pointermove", onMouseMove, { passive: true });
    window.addEventListener("resize", onResize);

    // --- Animation loop ---
    function animate() {
      rafRef.current = requestAnimationFrame(animate);
      timeRef.current += 0.001;

      const t = timeRef.current;

      // Rotate tube group + move forward
      tubeGroup.rotation.z += 0.0005;
      tubeGroup.position.z += 0.05;
      if (tubeGroup.position.z > 100) tubeGroup.position.z = -100;

      // Update particles
      for (const obj of particleGroup.children) {
        const p = obj as THREE.Mesh;
        p.position.z += p.userData.vz || 0.15;
        p.rotation.x += 0.005;
        p.rotation.y += 0.008;

        if (p.position.z > 50) p.position.z = -100;

        const mat = p.material as THREE.MeshPhongMaterial;
        const base = (p.userData.baseEm ||
          (p.userData.baseEm = mat.emissive.clone())) as THREE.Color;

        const k = 0.65 + 0.35 * Math.sin(t * 6 + p.position.x * 0.1 + p.position.y * 0.1);
        mat.emissive.copy(base).multiplyScalar(k);
      }

      // Animate lights
      light1.position.x = 20 + Math.sin(t * 2) * 10;
      light1.position.y = 20 + Math.cos(t * 1.5) * 10;

      light2.position.x = -20 + Math.cos(t * 1.8) * 10;
      light2.position.y = -20 + Math.sin(t * 2.2) * 10;

      // Camera interaction
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      camera.position.x += (mx * 3 - camera.position.x) * 0.08;
      camera.position.y += (my * 3 - camera.position.y) * 0.08;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    animate();

    // --- Cleanup ---
    return () => {
      window.removeEventListener("pointermove", onMouseMove);
      window.removeEventListener("resize", onResize);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      scene.traverse((obj: THREE.Object3D) => {
        const anyObj = obj as unknown as {
          geometry?: { dispose?: () => void };
          material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
        };

        if (anyObj.geometry?.dispose) anyObj.geometry.dispose();
        if (anyObj.material) {
          if (Array.isArray(anyObj.material)) anyObj.material.forEach((m) => m.dispose?.());
          else anyObj.material.dispose?.();
        }
      });

      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      tubeGroupRef.current = null;
      particleGroupRef.current = null;
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
      * { margin: 0; padding: 0; box-sizing: border-box; }

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

      /* --- Flip card --- */
      .flipStage { perspective: 1200px; width: 92%; max-width: 460px; }
      .flipInner {
        position: relative;
        width: 100%;
        transform-style: preserve-3d;
        transition: transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .flipStage:hover .flipInner,
      .flipStage:focus-within .flipInner { transform: rotateY(180deg); }

      .flipFace {
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
        transform-style: preserve-3d;
      }

      .flipFront {
        position: absolute;
        inset: 0;
        transform: rotateY(0deg);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .flipBack { transform: rotateY(180deg); }

      .logoWrap {
        width: 100%;
        background: rgba(10, 10, 25, 0.90);
        backdrop-filter: blur(20px);
        padding: 50px;
        border-radius: 25px;
        border: 2px solid rgba(100, 200, 255, 0.30);
        box-shadow: 0 0 100px rgba(100, 200, 255, 0.20), inset 0 0 50px rgba(100, 200, 255, 0.05);
        animation: glowPulse 3s ease-in-out infinite;
        text-align: center;
        min-height: 440px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 16px;
      }

      .logoImg {
        width: 280px;
        max-width: 70%;
        height: auto;
        filter: drop-shadow(0 0 24px rgba(100,200,255,0.35));
        opacity: 0.95;
        user-select: none;
        pointer-events: none;
        display: block;
        margin: 0 auto;
      }

      .logoHint {
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 800;
        font-size: 12px;
      }

      .cpCard {
        width: 100%;
        background: rgba(10, 10, 25, 0.90);
        backdrop-filter: blur(20px);
        padding: 50px;
        border-radius: 25px;
        border: 2px solid rgba(100, 200, 255, 0.30);
        box-shadow: 0 0 100px rgba(100, 200, 255, 0.20), inset 0 0 50px rgba(100, 200, 255, 0.05);
        animation: glowPulse 3s ease-in-out infinite;
      }

      @keyframes glowPulse {
        0%, 100% {
          box-shadow: 0 0 100px rgba(100, 200, 255, 0.20), inset 0 0 50px rgba(100, 200, 255, 0.05);
        }
        50% {
          box-shadow: 0 0 150px rgba(100, 200, 255, 0.40), inset 0 0 80px rgba(100, 200, 255, 0.10);
        }
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
        margin: 0 0 35px 0;
        font-size: 15px;
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

      .cpGroup { margin-bottom: 25px; }
      .cpLabel {
        display: block;
        color: #64c8ff;
        font-size: 13px;
        margin-bottom: 10px;
        font-weight: 700;
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
        transition: all 0.4s ease;
        box-shadow: inset 0 0 20px rgba(100, 200, 255, 0.02);
        outline: none;
      }
      .cpInput::placeholder { color: #4a7a99; }
      .cpInput:focus {
        background: rgba(100, 200, 255, 0.10);
        border-color: rgba(100, 200, 255, 0.60);
        box-shadow: inset 0 0 20px rgba(100, 200, 255, 0.10), 0 0 40px rgba(100, 200, 255, 0.30);
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
        font-size: 16px;
        font-weight: 900;
        cursor: pointer;
        transition: all 0.4s ease;
        margin-top: 15px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        box-shadow: 0 0 40px rgba(0, 255, 136, 0.40), 0 10px 30px rgba(100, 200, 255, 0.20);
      }
      .cpBtn:hover { transform: translateY(-4px); box-shadow: 0 0 60px rgba(0, 255, 136, 0.60), 0 20px 50px rgba(100, 200, 255, 0.40); }
      .cpBtn:active { transform: translateY(-1px); }
      .cpBtn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

      .cpFoot {
        text-align: center;
        margin-top: 25px;
        color: #64a3c8;
        font-size: 14px;
        font-weight: 800;
      }
      .cpFoot a {
        color: #00ff88;
        text-decoration: none;
        font-weight: 900;
        transition: all 0.3s;
      }
      .cpFoot a:hover { color: #64c8ff; text-shadow: 0 0 20px rgba(100, 200, 255, 0.60); }

      @media (max-width: 480px) {
        .cpCard { padding: 34px 22px 26px; border-radius: 20px; }
        .logoWrap { padding: 34px 22px 26px; border-radius: 20px; min-height: 410px; }
        .cpTitle { font-size: 28px; }
      }
    `}</style>
  );

  const LOGO_SRC = "/logos/FlukeGames_TM.png";

  return (
    <>
      <Navbar />
      {styles}

      <div className="cpWrap">
        <canvas ref={canvasRef} className="cpCanvas" />

        <div className="cpCenter">
          <div className="flipStage" aria-label="Login card">
            <div className="flipInner">
              <div className="flipFace flipFront">
                <div className="logoWrap">
                  <img className="logoImg" src={LOGO_SRC} alt="Fluke Games Logo" />
                  <div className="logoHint">Hover to access</div>
                </div>
              </div>

              <div className="flipFace flipBack">
                <div className="cpCard">
                  <h1 className="cpTitle">ARCADE</h1>
                  <p className="cpSub">Enter the portal</p>

                  {errMsg ? (
                    <div className="cpErr">
                      <i
                        className="material-icons"
                        style={{ fontSize: 18, verticalAlign: "middle", marginRight: 8 }}
                      >
                        error
                      </i>
                      {errMsg}
                    </div>
                  ) : null}

                  <form onSubmit={handleSubmit}>
                    <div className="cpGroup">
                      <label className="cpLabel" htmlFor="username">
                        Username / Email
                      </label>
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
                      <label className="cpLabel" htmlFor="password">
                        Password
                      </label>
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
                        M.toast({
                          html: "Contact your project lead for access.",
                          classes: "blue-grey darken-1",
                        });
                      }}
                    >
                      Contact your project lead
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
