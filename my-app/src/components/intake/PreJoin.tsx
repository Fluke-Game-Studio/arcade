import { useEffect, useRef, useState } from "react";
import type { StoredIntakeContext } from "./types";

interface Props {
  ctx: StoredIntakeContext;
  jobTitle: string;
  jobQuestions: string[];
  err?: string;
  onConnect: (audioDeviceId: string, videoDeviceId: string) => void;
  onBack: () => void;
}

type DeviceOption = { deviceId: string; label: string };

function IconDevice({ kind }: { kind: "mic" | "cam" }) {
  return kind === "mic" ? (
    <span style={{ fontSize: 13 }}>🎙️</span>
  ) : (
    <span style={{ fontSize: 13 }}>📷</span>
  );
}

function IconRefresh() {
  return <span style={{ fontSize: 14, lineHeight: 1 }}>↻</span>;
}

export default function PreJoin({ ctx, jobTitle, jobQuestions, err, onConnect, onBack }: Props) {
  const isWeekly = ctx.key === "weekly_update" || ctx.mcpActions.some((a) => a === "submit_weekly_update" || a === "updates_write");
  const totalQs = [...ctx.questions, ...jobQuestions].length;
  const [step, setStep] = useState<1 | 2>(1);
  const [audioDevices, setAudioDevices] = useState<DeviceOption[]>([]);
  const [videoDevices, setVideoDevices] = useState<DeviceOption[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [audioOpen, setAudioOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [checkingDevices, setCheckingDevices] = useState(false);
  const [status, setStatus] = useState("Devices not checked yet");
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const tips = isWeekly
    ? [
        { icon: "🎙️", text: "Find a quiet space with minimal background noise" },
        { icon: "💬", text: "Speak naturally — the AI captures your responses in real time" },
        { icon: "🔇", text: "You can mute yourself at any time during the session" },
        { icon: "✅", text: "Your update is saved automatically when you end the call" },
      ]
    : [
        { icon: "🎙️", text: "Find a quiet spot — background noise affects transcription" },
        { icon: "💬", text: "Speak clearly and take your time with each answer" },
        { icon: "⏸️", text: "Incomplete answers trigger a follow-up before moving on" },
        { icon: "✅", text: "All responses are saved when you end the call" },
      ];

  async function loadDevices(withPreview = false) {
    setCheckingDevices(true);
    setStatus(withPreview ? "Requesting device access…" : "Refreshing devices…");
    try {
      if (withPreview) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        previewStreamRef.current?.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = stream;
        if (previewRef.current) previewRef.current.srcObject = stream;
        setStatus("Camera and microphone ready");
      }
    } catch (e: any) {
      const message = String(e?.message || e || "");
      if (/not found/i.test(message)) setStatus("No microphone or camera detected");
      else if (/not allowed|permission/i.test(message)) setStatus("Permission blocked — allow mic/camera to list devices");
      else setStatus("Could not access devices");
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audio = devices.filter((d) => d.kind === "audioinput").map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      const video = devices.filter((d) => d.kind === "videoinput").map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      setAudioDevices(audio);
      setVideoDevices(video);
      setAudioDeviceId((prev) => prev || audio[0]?.deviceId || "");
      setVideoDeviceId((prev) => prev || video[0]?.deviceId || "");
      if (audio.length || video.length) setStatus((prev) => prev.includes("ready") ? prev : "Devices listed");
    } finally {
      setCheckingDevices(false);
    }
  }

  useEffect(() => {
    loadDevices(false);
    return () => previewStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (step !== 1) return;
    let cancelled = false;

    async function syncPreviewToSelection() {
      if (!audioDeviceId && !videoDeviceId) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        previewStreamRef.current?.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = stream;
        if (previewRef.current) previewRef.current.srcObject = stream;
      } catch {
        // Keep the existing preview if the selected device cannot be opened.
      }
    }

    syncPreviewToSelection();
    return () => {
      cancelled = true;
    };
  }, [audioDeviceId, videoDeviceId, step]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!cardRef.current?.contains(event.target as Node)) {
        setAudioOpen(false);
        setVideoOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", background: "#0d0d0d", color: "#fff", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <button style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14 }} onClick={onBack}>← Back</button>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{ctx.label}</span>
        <div style={{ width: 60 }} />
      </div>

      {step === 1 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 24px", gap: 18, minHeight: "calc(100vh - 128px)" }}>
          {err && <div style={{ width: "100%", maxWidth: 760, padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(220,38,38,0.14)", color: "#fecaca", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{err}</div>}

          <div ref={cardRef} style={{ width: "100%", maxWidth: 760, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.62)" }}>Device Setup</div>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "rgba(99,102,241,0.16)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.22)" }}>{audioDevices.length + videoDevices.length} found</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Choose your mic and camera before continuing.</div>
              </div>
              <button onClick={() => loadDevices(true)} disabled={checkingDevices} title="Refresh devices" aria-label="Refresh devices" style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <IconRefresh />
              </button>
            </div>

            <div style={{ borderRadius: 18, overflow: "hidden", background: "#111", minHeight: 280, position: "relative", border: "1px solid rgba(255,255,255,0.06)" }}>
              <video ref={previewRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", minHeight: 300, background: "linear-gradient(180deg,#111,#1b1b24)", transform: "scaleX(-1)" }} />
              <div style={{ position: "absolute", left: 12, top: 12, padding: "5px 9px", borderRadius: 999, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
                {status}
              </div>
              {!previewStreamRef.current && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center", padding: 20 }}>Allow mic/camera access to show your preview and list devices.</div>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <div style={{ background: "#101014", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>
                  <IconDevice kind="mic" /> Microphone
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Current: {audioDevices.find((d) => d.deviceId === audioDeviceId)?.label || "Choose microphone"}
                </div>
                <button onClick={() => { setAudioOpen((v) => !v); setVideoOpen(false); }} style={{ width: "100%", padding: "10px 11px", borderRadius: 11, background: "#f7f7fb", color: "#111827", border: "1px solid rgba(255,255,255,0.2)", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, lineHeight: 1.2 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{audioDevices.find((d) => d.deviceId === audioDeviceId)?.label || "Choose microphone"}</span>
                  <span style={{ opacity: 0.7 }}>▾</span>
                </button>
                {audioOpen && (
                  <div style={{ position: "absolute", left: 14, right: 14, top: "100%", marginTop: 8, background: "#0f1117", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, overflow: "hidden", zIndex: 20, boxShadow: "0 16px 36px rgba(0,0,0,0.45)" }}>
                    {audioDevices.map((d) => (
                      <button key={d.deviceId} onClick={() => { setAudioDeviceId(d.deviceId); setAudioOpen(false); }} style={{ width: "100%", padding: "10px 12px", color: "#fff", background: d.deviceId === audioDeviceId ? "rgba(99,102,241,0.22)" : "transparent", border: "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{ fontSize: 12 }}>🎙️</span>
                        {d.label}
                      </button>
                    ))}
                    {audioDevices.length === 0 && <div style={{ padding: "12px 14px", color: "rgba(255,255,255,0.5)" }}>No microphone listed yet</div>}
                  </div>
                )}
              </div>
              <div style={{ background: "#101014", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 14, position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.65)", marginBottom: 8 }}>
                  <IconDevice kind="cam" /> Camera
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.58)", marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Current: {videoDevices.find((d) => d.deviceId === videoDeviceId)?.label || "Select a camera"}
                </div>
                <button onClick={() => { setVideoOpen((v) => !v); setAudioOpen(false); }} style={{ width: "100%", padding: "10px 11px", borderRadius: 11, background: "#f7f7fb", color: "#111827", border: "1px solid rgba(255,255,255,0.2)", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, lineHeight: 1.2 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{videoDevices.find((d) => d.deviceId === videoDeviceId)?.label || "Choose camera"}</span>
                  <span style={{ opacity: 0.7 }}>▾</span>
                </button>
                {videoOpen && (
                  <div style={{ position: "absolute", left: 14, right: 14, top: "100%", marginTop: 8, background: "#0f1117", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, overflow: "hidden", zIndex: 20, boxShadow: "0 16px 36px rgba(0,0,0,0.45)" }}>
                    {videoDevices.map((d) => (
                      <button key={d.deviceId} onClick={() => { setVideoDeviceId(d.deviceId); setVideoOpen(false); }} style={{ width: "100%", padding: "10px 12px", color: "#fff", background: d.deviceId === videoDeviceId ? "rgba(99,102,241,0.22)" : "transparent", border: "none", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{ fontSize: 12 }}>📷</span>
                        {d.label}
                      </button>
                    ))}
                    {videoDevices.length === 0 && <div style={{ padding: "12px 14px", color: "rgba(255,255,255,0.5)" }}>No camera listed yet</div>}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
              <button onClick={() => setStep(2)} style={{ padding: "11px 18px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 18px rgba(99,102,241,0.3)" }}>
                Next →
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", gap: 28 }}>
          {err && <div style={{ width: "100%", maxWidth: 760, padding: "12px 16px", borderRadius: 14, border: "1px solid rgba(248,113,113,0.3)", background: "rgba(220,38,38,0.14)", color: "#fecaca", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{err}</div>}
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 16px" }}>🤖</div>
            <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "#fff" }}>
              {ctx.label}{jobTitle && <span style={{ color: "#a78bfa" }}> · {jobTitle}</span>}
            </h2>
            {ctx.description && <p style={{ margin: "0 0 10px", color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.5, maxWidth: 380 }}>{ctx.description}</p>}
            {totalQs > 0 && <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 999, background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", fontSize: 12, fontWeight: 700 }}>{totalQs} question{totalQs !== 1 ? "s" : ""}</span>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, width: "100%", maxWidth: 480 }}>
            {tips.map((tip, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{tip.icon}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{tip.text}</span>
              </div>
            ))}
          </div>

          <button onClick={() => onConnect(audioDeviceId, videoDeviceId)} style={{ padding: "14px 48px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 32px rgba(99,102,241,0.4)", letterSpacing: "0.3px" }}>
            Join Call →
          </button>
        </div>
      )}
    </div>
  );
}
