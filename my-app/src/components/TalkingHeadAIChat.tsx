import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useAuth } from "../auth/AuthContext";
import type { AIProvider } from "../api/types/ai";

/* =========================================================
   CONFIG
   ========================================================= */

const CHAT_URL =
  "https://xtipeal88c.execute-api.us-east-1.amazonaws.com/ai/chat/internal";

/**
 * Replace this with your real neural TTS endpoint later.
 * Expected response example:
 * {
 *   "audioUrl": "https://....mp3",
 *   "durationMs": 3200,
 *   "cues": [
 *     { "time": 0.00, "viseme": "viseme_sil" },
 *     { "time": 0.08, "viseme": "viseme_PP" },
 *     { "time": 0.16, "viseme": "viseme_aa" }
 *   ]
 * }
 */
const TTS_URL =
  "https://xtipeal88c.execute-api.us-east-1.amazonaws.com/ai/tts/visemes";

const PROVIDER_MODEL: Record<Exclude<AIProvider, "auto">, string> = {
  openai: "gpt-5-mini",
  ollama: "qwen3:4b",
};

const MODEL_PATH = "/assets/vaibhav_untidy.glb";

/* =========================================================
   TYPES
   ========================================================= */

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  ts: number;
};

type VisemeCue = {
  time: number; // seconds from start
  viseme: string;
};

type TTSResponse = {
  audioUrl?: string;
  durationMs?: number;
  cues?: VisemeCue[];
};

type FocusMode = "face" | "full";

type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
};

type AvatarMeasure = {
  faceTarget: [number, number, number];
  bodyTarget: [number, number, number];
  bodyHeight: number;
};

type MorphMesh = THREE.Object3D & {
  isMesh?: boolean;
  isSkinnedMesh?: boolean;
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
};

type AvatarProps = {
  activeViseme: string;
  speaking: boolean;
  onMeasure?: (data: AvatarMeasure) => void;
};

/* =========================================================
   HELPERS
   ========================================================= */

const VISEME_GROUPS: Record<string, string[]> = {
  viseme_sil: [" ", ".", ",", "!", "?"],
  viseme_PP: ["b", "m", "p"],
  viseme_FF: ["f", "v"],
  viseme_TH: ["t", "d", "th"],
  viseme_DD: ["l", "n", "r"],
  viseme_kk: ["k", "g", "q", "c"],
  viseme_CH: ["j", "ch", "sh"],
  viseme_SS: ["s", "z", "x"],
  viseme_nn: ["n"],
  viseme_RR: ["r"],
  viseme_aa: ["a"],
  viseme_E: ["e"],
  viseme_I: ["i", "y"],
  viseme_O: ["o"],
  viseme_U: ["u", "w"],
};

const BLINK_NAMES = ["eyeBlinkLeft", "eyeBlinkRight"];
const SMILE_NAMES = ["mouthSmileLeft", "mouthSmileRight"];
const BROW_RELAX = ["browInnerUp"];

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function lerp(current: number, target: number, alpha: number) {
  return current + (target - current) * alpha;
}

function lerpVec3(current: THREE.Vector3, target: THREE.Vector3, alpha: number) {
  current.x = lerp(current.x, target.x, alpha);
  current.y = lerp(current.y, target.y, alpha);
  current.z = lerp(current.z, target.z, alpha);
}

function toTuple(v: THREE.Vector3): [number, number, number] {
  return [v.x, v.y, v.z];
}

function getStableClientId() {
  const key = "fluke_ai_avatar_client_id";

  if (typeof window === "undefined") {
    return `client_${uid()}`;
  }

  const existing = window.localStorage.getItem(key);
  if (existing && existing.trim()) return existing;

  const next = `client_${uid()}`;
  window.localStorage.setItem(key, next);
  return next;
}

function createCharToVisemeMap(): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  Object.entries(VISEME_GROUPS).forEach(([viseme, chars]) => {
    chars.forEach((char) => entries.push([char, viseme]));
  });
  entries.sort((a, b) => b[0].length - a[0].length);
  return entries;
}

const CHAR_TO_VISEME = createCharToVisemeMap();

function visemeForTextAt(text: string, index: number): string {
  const slice = text.toLowerCase().slice(index, index + 3);

  for (const [pattern, viseme] of CHAR_TO_VISEME) {
    if (slice.startsWith(pattern)) return viseme;
  }

  const one = (text[index] || " ").toLowerCase();

  for (const [pattern, viseme] of CHAR_TO_VISEME) {
    if (pattern.length === 1 && one === pattern) return viseme;
  }

  return /[aeiou]/.test(one) ? "viseme_aa" : "viseme_sil";
}

/* =========================================================
   AVATAR
   ========================================================= */

function Avatar({ activeViseme, speaking, onMeasure }: AvatarProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const headBoneRef = useRef<THREE.Bone | null>(null);

  const gltf = useGLTF(MODEL_PATH) as unknown as { scene: THREE.Object3D };
  const clonedScene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const morphMeshes = useMemo<MorphMesh[]>(() => {
    const list: MorphMesh[] = [];

    clonedScene.traverse((obj) => {
      const mesh = obj as MorphMesh;
      const lower = obj.name.toLowerCase();

      if (obj instanceof THREE.Bone && lower.includes("head")) {
        headBoneRef.current = obj;
      }

      if (
        (mesh.isMesh || mesh.isSkinnedMesh) &&
        mesh.morphTargetDictionary &&
        mesh.morphTargetInfluences
      ) {
        list.push(mesh);
      }
    });

    return list;
  }, [clonedScene]);

  const targetsRef = useRef<Record<string, number>>({});
  const blinkRef = useRef({ nextAt: 0, activeUntil: 0 });

  useEffect(() => {
    const next: Record<string, number> = {};
    morphMeshes.forEach((mesh) => {
      const dict = mesh.morphTargetDictionary || {};
      Object.keys(dict).forEach((name) => {
        next[name] = 0;
      });
    });
    targetsRef.current = next;
  }, [morphMeshes]);

  useEffect(() => {
    if (!modelRootRef.current) return;

    const root = modelRootRef.current;

    const rawBox = new THREE.Box3().setFromObject(root);
    const rawSize = new THREE.Vector3();
    const rawCenter = new THREE.Vector3();
    rawBox.getSize(rawSize);
    rawBox.getCenter(rawCenter);

    if (rawSize.length() === 0) return;

    const desiredHeight = 2.0;
    const fitScale = desiredHeight / Math.max(rawSize.y, 0.0001);
    root.scale.setScalar(fitScale);

    const scaledBox = new THREE.Box3().setFromObject(root);
    const scaledCenter = new THREE.Vector3();
    const scaledSize = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    scaledBox.getSize(scaledSize);

    root.position.set(-scaledCenter.x, -scaledCenter.y, -scaledCenter.z);
    root.position.y += scaledSize.y * 0.02;

    const finalBox = new THREE.Box3().setFromObject(root);
    const finalSize = new THREE.Vector3();
    const finalCenter = new THREE.Vector3();
    finalBox.getSize(finalSize);
    finalBox.getCenter(finalCenter);

    let faceTarget = new THREE.Vector3(
      finalCenter.x,
      finalBox.max.y - finalSize.y * 0.18,
      finalCenter.z
    );

    if (headBoneRef.current) {
      const headWorld = new THREE.Vector3();
      headBoneRef.current.getWorldPosition(headWorld);

      if (groupRef.current) {
        groupRef.current.worldToLocal(headWorld);
        faceTarget.copy(headWorld);
      }
    }

    const bodyTarget = new THREE.Vector3(finalCenter.x, finalCenter.y, finalCenter.z);

    onMeasure?.({
      faceTarget: toTuple(faceTarget),
      bodyTarget: toTuple(bodyTarget),
      bodyHeight: finalSize.y,
    });
  }, [clonedScene, onMeasure]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const blink = blinkRef.current;

    if (blink.nextAt === 0) {
      blink.nextAt = t + 1.8 + Math.random() * 2.4;
    }

    if (t >= blink.nextAt) {
      blink.activeUntil = t + 0.12;
      blink.nextAt = t + 2.0 + Math.random() * 3.0;
    }

    const targetValues = targetsRef.current;
    Object.keys(targetValues).forEach((key) => {
      targetValues[key] = 0;
    });

    if (t < blink.activeUntil) {
      BLINK_NAMES.forEach((name) => {
        if (name in targetValues) targetValues[name] = 1;
      });
    }

    const smile = speaking ? 0.12 : 0.04;
    SMILE_NAMES.forEach((name) => {
      if (name in targetValues) targetValues[name] = smile;
    });

    BROW_RELAX.forEach((name) => {
      if (name in targetValues) targetValues[name] = 0.05;
    });

    if (speaking) {
      const emphasis = 0.72 + 0.18 * Math.sin(t * 13);

      if (activeViseme in targetValues) {
        targetValues[activeViseme] = clamp01(emphasis);
      }

      if ("jawOpen" in targetValues && activeViseme !== "viseme_sil") {
        targetValues.jawOpen = 0.18 + 0.14 * Math.sin(t * 17 + 0.7);
      }

      if ("mouthOpen" in targetValues && activeViseme !== "viseme_sil") {
        targetValues.mouthOpen = 0.16 + 0.12 * Math.sin(t * 19);
      }
    } else if ("mouthClose" in targetValues) {
      targetValues.mouthClose = 0.08;
    }

    morphMeshes.forEach((mesh) => {
      const dict = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dict || !influences) return;

      Object.entries(dict).forEach(([name, idx]) => {
        const target = targetValues[name] ?? 0;
        influences[idx] = lerp(influences[idx] ?? 0, target, 1 - Math.exp(-delta * 18));
      });
    });

    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.2) * 0.01;
      groupRef.current.rotation.y = lerp(
        groupRef.current.rotation.y,
        speaking ? 0.08 * Math.sin(t * 0.9) : 0,
        0.04
      );
    }

    if (headBoneRef.current) {
      const lookX = speaking ? 0.05 * Math.sin(t * 0.7) : 0;
      const lookY = speaking ? 0.03 * Math.sin(t * 1.1) : 0;
      headBoneRef.current.rotation.y = lerp(headBoneRef.current.rotation.y, lookX, 0.06);
      headBoneRef.current.rotation.x = lerp(headBoneRef.current.rotation.x, lookY, 0.06);
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={modelRootRef}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

function SmoothCameraRig({ pose }: { pose: CameraPose }) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const currentPos = useRef(new THREE.Vector3(...pose.position));
  const currentTarget = useRef(new THREE.Vector3(...pose.target));
  const desiredPos = useRef(new THREE.Vector3(...pose.position));
  const desiredTarget = useRef(new THREE.Vector3(...pose.target));
  const initializedRef = useRef(false);

  useEffect(() => {
    desiredPos.current.set(...pose.position);
    desiredTarget.current.set(...pose.target);

    if (!initializedRef.current) {
      currentPos.current.copy(desiredPos.current);
      currentTarget.current.copy(desiredTarget.current);
      camera.position.copy(currentPos.current);
      camera.lookAt(currentTarget.current);

      if (controlsRef.current) {
        controlsRef.current.target.copy(currentTarget.current);
        controlsRef.current.update();
      }

      initializedRef.current = true;
    }
  }, [camera, pose]);

  useFrame((_, delta) => {
    const alpha = 1 - Math.exp(-delta * 4.5);

    lerpVec3(currentPos.current, desiredPos.current, alpha);
    lerpVec3(currentTarget.current, desiredTarget.current, alpha);

    camera.position.copy(currentPos.current);

    if (controlsRef.current) {
      controlsRef.current.target.copy(currentTarget.current);
      controlsRef.current.update();
    } else {
      camera.lookAt(currentTarget.current);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      minDistance={1.0}
      maxDistance={5.0}
      minPolarAngle={Math.PI / 2.5}
      maxPolarAngle={Math.PI / 1.7}
    />
  );
}

useGLTF.preload(MODEL_PATH);

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export default function TalkingHeadAIChat() {
  const { api } = useAuth();

  const token = String((api as any)?.token || "").trim();
  const platform = String((api as any)?.getPlatform?.() || "portal").trim() || "portal";
  const clientIdRef = useRef<string>(getStableClientId());
  const clientId = clientIdRef.current;

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const playbackRafRef = useRef<number | null>(null);

  const [provider, setProvider] = useState<Exclude<AIProvider, "auto">>("openai");
  const [focusMode, setFocusMode] = useState<FocusMode>("face");
  const [modalOpen, setModalOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Hi. Send a message. I will fetch the AI reply, then speak it through the avatar.",
      ts: Date.now(),
    },
  ]);

  const [avatarMeasure, setAvatarMeasure] = useState<AvatarMeasure>({
    faceTarget: [0, 0.9, 0],
    bodyTarget: [0, 0.2, 0],
    bodyHeight: 2,
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [activeViseme, setActiveViseme] = useState("viseme_sil");
  const [statusText, setStatusText] = useState("Ready");
  const [errorText, setErrorText] = useState("");
  const [ttsMode, setTtsMode] = useState<"api" | "browser">("api");

  const currentModel = PROVIDER_MODEL[provider];
  const canSend = !loading && !!input.trim() && !!token;

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, loading, speaking]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    const next = Math.min(Math.max(textareaRef.current.scrollHeight, 56), 180);
    textareaRef.current.style.height = `${next}px`;
  }, [input]);

  useEffect(() => {
    return () => {
      stopAllPlayback();
    };
  }, []);

  const cameraPose = useMemo<CameraPose>(() => {
    const faceTarget = avatarMeasure.faceTarget;
    const bodyTarget = avatarMeasure.bodyTarget;
    const h = avatarMeasure.bodyHeight;

    if (focusMode === "full") {
      return {
        position: [0, bodyTarget[1] + h * 0.15, 4.2],
        target: [bodyTarget[0], bodyTarget[1] + h * 0.35, bodyTarget[2]],
      };
    }

    return {
      position: [0, faceTarget[1] - 0.02, 1.6],
      target: [faceTarget[0], faceTarget[1] - 0.05, faceTarget[2]],
    };
  }, [avatarMeasure, focusMode]);

  function stopAllPlayback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }

    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
    }

    if (fallbackTimerRef.current !== null) {
      window.clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    if (playbackRafRef.current !== null) {
      cancelAnimationFrame(playbackRafRef.current);
      playbackRafRef.current = null;
    }

    speechUtteranceRef.current = null;
    setSpeaking(false);
    setActiveViseme("viseme_sil");
  }

  function startCuePlayback(cues: VisemeCue[], audio: HTMLAudioElement) {
    if (!cues.length) {
      setActiveViseme("viseme_sil");
      return;
    }

    const ordered = [...cues].sort((a, b) => a.time - b.time);

    const tick = () => {
      if (!audioRef.current) return;
      const t = audio.currentTime;

      let current = ordered[0].viseme;
      for (let i = 0; i < ordered.length; i += 1) {
        if (ordered[i].time <= t) current = ordered[i].viseme;
        else break;
      }

      setActiveViseme(current);

      if (!audio.paused && !audio.ended) {
        playbackRafRef.current = requestAnimationFrame(tick);
      }
    };

    playbackRafRef.current = requestAnimationFrame(tick);
  }

  function startFallbackVisemes(text: string) {
    let charIndex = 0;
    const totalMs = Math.max(1200, text.length * 75);
    const stepMs = Math.max(70, Math.min(140, totalMs / Math.max(10, text.length)));

    fallbackTimerRef.current = window.setInterval(() => {
      charIndex = (charIndex + 1) % Math.max(1, text.length);
      setActiveViseme(visemeForTextAt(text, charIndex));
    }, stepMs);
  }

  async function speakWithBrowser(text: string) {
    stopAllPlayback();

    if (!("speechSynthesis" in window)) {
      throw new Error("Browser speech synthesis is not supported.");
    }

    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      utterance.pitch = 1.02;
      utterance.volume = 1;

      utterance.onstart = () => {
        setSpeaking(true);
        setActiveViseme("viseme_aa");
        setStatusText("Speaking with browser TTS...");
        startFallbackVisemes(text);
      };

      utterance.onboundary = (event: any) => {
        if (typeof event?.charIndex === "number") {
          setActiveViseme(visemeForTextAt(text, event.charIndex));
        }
      };

      utterance.onend = () => {
        if (fallbackTimerRef.current !== null) {
          window.clearInterval(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        setSpeaking(false);
        setActiveViseme("viseme_sil");
        setStatusText("Ready");
        resolve();
      };

      utterance.onerror = () => {
        if (fallbackTimerRef.current !== null) {
          window.clearInterval(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        setSpeaking(false);
        setActiveViseme("viseme_sil");
        setStatusText("Ready");
        reject(new Error("Browser speech synthesis failed."));
      };

      speechUtteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    });
  }

  async function speakWithApi(text: string) {
    stopAllPlayback();

    if (!token) {
      throw new Error("Auth token is missing for TTS request.");
    }

    setStatusText("Requesting neural TTS...");

    const res = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Platform": platform,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text,
        clientId,
        provider,
        model: currentModel,
      }),
    });

    const raw = await res.text();
    let parsed: TTSResponse = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("TTS response was not valid JSON.");
    }

    if (!res.ok) {
      throw new Error((parsed as any)?.message || `TTS failed with status ${res.status}`);
    }

    if (!parsed.audioUrl) {
      throw new Error("TTS response is missing audioUrl.");
    }

    const audio = new Audio(parsed.audioUrl);
    audioRef.current = audio;

    return new Promise<void>((resolve, reject) => {
      audio.onplay = () => {
        setSpeaking(true);
        setStatusText("Speaking with neural TTS...");
        setActiveViseme("viseme_aa");

        if (parsed.cues?.length) startCuePlayback(parsed.cues, audio);
        else startFallbackVisemes(text);
      };

      audio.onended = () => {
        if (fallbackTimerRef.current !== null) {
          window.clearInterval(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        if (playbackRafRef.current !== null) {
          cancelAnimationFrame(playbackRafRef.current);
          playbackRafRef.current = null;
        }

        setSpeaking(false);
        setActiveViseme("viseme_sil");
        setStatusText("Ready");
        resolve();
      };

      audio.onerror = () => {
        if (fallbackTimerRef.current !== null) {
          window.clearInterval(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        if (playbackRafRef.current !== null) {
          cancelAnimationFrame(playbackRafRef.current);
          playbackRafRef.current = null;
        }

        setSpeaking(false);
        setActiveViseme("viseme_sil");
        setStatusText("Ready");
        reject(new Error("Audio playback failed."));
      };

      audio
        .play()
        .then(() => undefined)
        .catch((err) => {
          reject(new Error(err?.message || "Could not play TTS audio."));
        });
    });
  }

  async function speakReply(text: string) {
    if (ttsMode === "browser") {
      await speakWithBrowser(text);
      return;
    }

    try {
      await speakWithApi(text);
    } catch (err) {
      await speakWithBrowser(text);
    }
  }

  async function fetchAIReply(question: string): Promise<string> {
    if (!token) throw new Error("Auth token is missing.");

    const payload = {
      question,
      clientId,
      context: "internal",
      provider,
      model: currentModel,
      agentEmployeeId: "project_manager_core",
      agentRole: "project_manager",
    };

    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Platform": platform,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    let parsed: any = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { message: raw };
    }

    if (!res.ok) {
      throw new Error(
        parsed?.error || parsed?.message || `Request failed with status ${res.status}`
      );
    }

    /**
     * Adjust this if your backend returns a different field.
     * Tries common variants.
     */
    const answer =
      parsed?.answer ||
      parsed?.reply ||
      parsed?.response ||
      parsed?.message ||
      parsed?.text ||
      (parsed?.status === "queued"
        ? "Your request was queued by the backend."
        : "");

    if (!String(answer || "").trim()) {
      return "I received the request, but the response body did not include assistant text.";
    }

    return String(answer);
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setErrorText("");
    setStatusText("Sending to AI...");
    setLoading(true);
    setInput("");

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      ts: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      const aiText = await fetchAIReply(trimmed);

      const assistantMessage: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: aiText,
        ts: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      await speakReply(aiText);
    } catch (err: any) {
      setErrorText(err?.message || "Unknown error");
      setStatusText("Error");
    } finally {
      setLoading(false);
      if (!errorText) setStatusText("Ready");
    }
  }

  async function onInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 28,
          bottom: 28,
          zIndex: 1600,
        }}
      >
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label="Open Fluke AI Avatar Chat"
          style={{
            width: 68,
            height: 68,
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.10)",
            background:
              "linear-gradient(180deg, rgba(8,12,20,0.98), rgba(12,18,31,0.98))",
            boxShadow: "0 16px 34px rgba(0,0,0,0.28)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="material-icons" style={{ fontSize: 20, color: "#f8fafc" }}>
            psychology_alt
          </i>
        </button>
      </div>

      {modalOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(2,6,23,0.72)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <div
            style={{
              width: "min(1400px, 96vw)",
              height: "min(92vh, 920px)",
              borderRadius: 28,
              overflow: "hidden",
              background: "#080d16",
              color: "#e5e7eb",
              boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "grid",
              gridTemplateColumns: "minmax(420px, 58%) minmax(360px, 42%)",
            }}
          >
            <div
              style={{
                position: "relative",
                borderRight: "1px solid rgba(255,255,255,0.08)",
                background: "#020817",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 18,
                  left: 18,
                  zIndex: 20,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12,
                    color: "#e2e8f0",
                  }}
                >
                  Provider: {provider}
                </span>

                <span
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12,
                    color: "#e2e8f0",
                  }}
                >
                  TTS: {ttsMode}
                </span>

                <span
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: speaking
                      ? "rgba(34,197,94,0.16)"
                      : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12,
                    color: "#e2e8f0",
                  }}
                >
                  {speaking ? `Speaking • ${activeViseme}` : "Idle"}
                </span>
              </div>

              <div
                style={{
                  position: "absolute",
                  right: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 20,
                  display: "grid",
                  gap: 10,
                }}
              >
                <button
                  onClick={() => setFocusMode("face")}
                  style={{
                    width: 110,
                    height: 44,
                    borderRadius: 12,
                    border:
                      focusMode === "face"
                        ? "1px solid rgba(96,165,250,0.9)"
                        : "1px solid rgba(148,163,184,0.22)",
                    background:
                      focusMode === "face"
                        ? "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(168,85,247,0.9))"
                        : "rgba(15,23,42,0.82)",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Focus Face
                </button>

                <button
                  onClick={() => setFocusMode("full")}
                  style={{
                    width: 110,
                    height: 44,
                    borderRadius: 12,
                    border:
                      focusMode === "full"
                        ? "1px solid rgba(96,165,250,0.9)"
                        : "1px solid rgba(148,163,184,0.22)",
                    background:
                      focusMode === "full"
                        ? "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(168,85,247,0.9))"
                        : "rgba(15,23,42,0.82)",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Focus Full
                </button>
              </div>

              <Canvas camera={{ position: [0, 1.0, 1.8], fov: 30 }}>
                <color attach="background" args={["#020817"]} />
                <ambientLight intensity={1.15} />
                <directionalLight position={[2, 3, 2]} intensity={2.0} />
                <directionalLight position={[-2, 2, 1]} intensity={1.0} />
                <Environment preset="studio" />

                <Avatar
                  activeViseme={activeViseme}
                  speaking={speaking}
                  onMeasure={setAvatarMeasure}
                />

                <SmoothCameraRig pose={cameraPose} />
              </Canvas>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateRows: "auto minmax(0,1fr) auto",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  padding: "18px 22px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#f8fafc" }}>
                    Fluke AI Talking Head
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "rgba(148,163,184,0.9)",
                    }}
                  >
                    Chat → AI reply → speech → visemes
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    stopAllPlayback();
                    setModalOpen(false);
                  }}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#e5e7eb",
                    cursor: "pointer",
                  }}
                >
                  <i className="material-icons">close</i>
                </button>
              </div>

              <div
                ref={messagesRef}
                style={{
                  overflowY: "auto",
                  padding: "18px 22px",
                }}
              >
                <div style={{ display: "grid", gap: 16 }}>
                  {messages.map((msg) => {
                    const isUser = msg.role === "user";

                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: "flex",
                          justifyContent: isUser ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: isUser ? "82%" : "88%",
                            borderRadius: isUser
                              ? "22px 22px 8px 22px"
                              : "22px 22px 22px 8px",
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: isUser
                              ? "linear-gradient(180deg, rgba(29,78,216,0.22), rgba(17,24,39,0.95))"
                              : "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))",
                            padding: "14px 16px 12px 16px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12,
                              marginBottom: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 900,
                                color: isUser ? "#dbeafe" : "#f8fafc",
                              }}
                            >
                              {isUser ? "You" : "Fluke AI"}
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.82)" }}>
                              {formatTime(msg.ts)}
                            </div>
                          </div>

                          <div
                            style={{
                              color: "#f8fafc",
                              fontSize: 14,
                              lineHeight: 1.8,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  padding: "14px 22px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setProvider("openai")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border:
                        provider === "openai"
                          ? "1px solid rgba(96,165,250,0.32)"
                          : "1px solid rgba(255,255,255,0.08)",
                      background:
                        provider === "openai"
                          ? "rgba(37,99,235,0.18)"
                          : "rgba(255,255,255,0.03)",
                      color: "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    OpenAI
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider("ollama")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border:
                        provider === "ollama"
                          ? "1px solid rgba(96,165,250,0.32)"
                          : "1px solid rgba(255,255,255,0.08)",
                      background:
                        provider === "ollama"
                          ? "rgba(37,99,235,0.18)"
                          : "rgba(255,255,255,0.03)",
                      color: "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    Ollama
                  </button>

                  <button
                    type="button"
                    onClick={() => setTtsMode("api")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border:
                        ttsMode === "api"
                          ? "1px solid rgba(96,165,250,0.32)"
                          : "1px solid rgba(255,255,255,0.08)",
                      background:
                        ttsMode === "api"
                          ? "rgba(37,99,235,0.18)"
                          : "rgba(255,255,255,0.03)",
                      color: "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    Neural TTS
                  </button>

                  <button
                    type="button"
                    onClick={() => setTtsMode("browser")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border:
                        ttsMode === "browser"
                          ? "1px solid rgba(96,165,250,0.32)"
                          : "1px solid rgba(255,255,255,0.08)",
                      background:
                        ttsMode === "browser"
                          ? "rgba(37,99,235,0.18)"
                          : "rgba(255,255,255,0.03)",
                      color: "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    Browser TTS
                  </button>

                  <button
                    type="button"
                    onClick={stopAllPlayback}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                      color: "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    Stop Voice
                  </button>
                </div>

                <div
                  style={{
                    borderRadius: 24,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background:
                      "linear-gradient(180deg, rgba(10,15,26,0.96), rgba(8,12,21,0.98))",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 12,
                      padding: "12px 12px 10px 14px",
                    }}
                  >
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onInputKeyDown}
                      placeholder="Message Fluke AI..."
                      rows={1}
                      disabled={loading}
                      style={{
                        width: "100%",
                        minHeight: 56,
                        maxHeight: 180,
                        boxSizing: "border-box",
                        resize: "none",
                        border: "none",
                        background: "transparent",
                        color: "#f8fafc",
                        padding: "4px 2px",
                        fontSize: 14,
                        lineHeight: 1.7,
                        outline: "none",
                      }}
                    />

                    <button
                      type="button"
                      onClick={sendMessage}
                      disabled={!canSend}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        border: "1px solid rgba(59,130,246,0.28)",
                        background: !canSend
                          ? "rgba(255,255,255,0.06)"
                          : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                        color: "white",
                        cursor: !canSend ? "not-allowed" : "pointer",
                        opacity: !canSend ? 0.68 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <i className="material-icons" style={{ fontSize: 20 }}>
                        north_east
                      </i>
                    </button>
                  </div>

                  <div
                    style={{
                      padding: "10px 14px 12px",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      color: errorText ? "#fca5a5" : "rgba(226,232,240,0.62)",
                      fontSize: 12,
                      minHeight: 18,
                    }}
                  >
                    {errorText || statusText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          textarea::placeholder {
            color: rgba(255,255,255,0.32);
          }
        `}
      </style>
    </>
  );
}
