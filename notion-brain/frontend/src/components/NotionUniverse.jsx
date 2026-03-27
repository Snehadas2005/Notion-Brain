import React, {
  useRef, useEffect, useState, useCallback, Suspense,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html, Float } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { motion, AnimatePresence } from "framer-motion";
import WorldBackground from "./WorldBackground";

// ─────────────────────────────────────────
// ENV
// ─────────────────────────────────────────
const getApiBase = () => {
  try {
    return import.meta.env.VITE_API_URL || "http://localhost:8000";
  } catch {
    return "http://localhost:8000";
  }
};
const API_BASE = getApiBase();

// ─────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Noto+Sans+JP:wght@100;300;400;700;900&family=Outfit:wght@900&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      overflow: hidden;
      background: #f5f2ec;
      font-family: 'Rajdhani', sans-serif;
      cursor: crosshair;
      color: #000;
      user-select: none;
    }
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-track { background: #f5f5f5; }
    ::-webkit-scrollbar-thumb { background: #000; }

    @keyframes blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }

    @keyframes float-up {
      0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { transform: translateY(-20px) rotate(720deg); opacity: 0; }
    }

    @keyframes data-stream {
      0% { transform: translateY(-100%); opacity: 0; }
      50% { opacity: 1; }
      100% { transform: translateY(100vh); opacity: 0; }
    }

    .node-label-html {
      pointer-events: none !important;
      z-index: 1 !important;
    }

    .particle {
      position: absolute;
      border-radius: 50%;
      animation: float-up linear infinite;
      pointer-events: none;
    }

    .data-line {
      position: absolute;
      width: 1px;
      background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.1), transparent);
      animation: data-stream linear infinite;
      pointer-events: none;
    }
  `}</style>
);

// ─────────────────────────────────────────
// LANDING BACKGROUND (only during landing phase)
// Lightweight canvas — no Three.js overhead
// ─────────────────────────────────────────
function LandingBackground() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const NODE_COUNT = 60;
    const nodes = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 1.2 + Math.random() * 1.8,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.012 + Math.random() * 0.018,
    }));

    const GRID_SIZE = 55;
    let rafId;

    const tick = () => {
      rafId = requestAnimationFrame(tick);

      ctx.fillStyle = "#f5f2ec";
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = "rgba(0,0,0,0.04)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.pulse += n.pulseSpeed;
        if (n.x < 0) n.x = W; if (n.x > W) n.x = 0;
        if (n.y < 0) n.y = H; if (n.y > H) n.y = 0;
      });

      const EDGE_DIST = 110;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < EDGE_DIST) {
            const alpha = (1 - dist / EDGE_DIST) * 0.09;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      nodes.forEach(n => {
        const pulse = Math.sin(n.pulse) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${0.18 + pulse * 0.12})`;
        ctx.fill();
      });

      // Vignette
      const vignette = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.85);
      vignette.addColorStop(0, "rgba(245,242,236,0)");
      vignette.addColorStop(1, "rgba(225,222,214,0.45)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
    };

    tick();

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(rafId); window.removeEventListener("resize", onResize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}
    />
  );
}

// ─────────────────────────────────────────
// FLOATING PARTICLES (landing only)
// ─────────────────────────────────────────
function FloatingParticles() {
  const particles = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    left: `${(i * 6.8 + 4) % 100}%`,
    size: 2 + (i % 3),
    duration: 14 + (i * 1.5) % 12,
    delay: (i * 0.8) % 7,
    opacity: 0.05 + (i % 4) * 0.012,
  }));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map(p => (
        <div key={p.id} className="particle"
          style={{ left: p.left, bottom: -10, width: p.size, height: p.size,
            background: `rgba(0,0,0,${p.opacity})`,
            animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }} />
      ))}
      {Array.from({ length: 4 }, (_, i) => (
        <div key={`line-${i}`} className="data-line"
          style={{ left: `${15 + i * 24}%`, height: `${45 + i * 8}%`, top: 0,
            animationDuration: `${7 + i * 2}s`, animationDelay: `${i * 1.5}s` }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// CORNER BRACKETS
// ─────────────────────────────────────────
function CornerBrackets({ color = "rgba(0,0,0,0.15)", size = 20, inset = 24 }) {
  const corners = [
    { top: inset, left: inset, borderTop: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` },
    { top: inset, right: inset, borderTop: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` },
    { bottom: inset, left: inset, borderBottom: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` },
    { bottom: inset, right: inset, borderBottom: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` },
  ];
  return (
    <>
      {corners.map((s, i) => (
        <div key={i} style={{ position: "fixed", width: size, height: size, zIndex: 200, pointerEvents: "none", ...s }} />
      ))}
    </>
  );
}

// ─────────────────────────────────────────
// TOP HEADER
// ─────────────────────────────────────────
function TopHeader() {
  const [time, setTime] = useState(new Date().toISOString().slice(11, 19));
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toISOString().slice(11, 19)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, height: 60,
      display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      padding: "0 24px 10px",
      borderBottom: "1px solid rgba(0,0,0,0.08)",
      zIndex: 100, background: "transparent",
      backdropFilter: "blur(12px)",
    }}>
      <div style={{ fontSize: "10px", letterSpacing: "5px", color: "#000", fontFamily: "monospace", opacity: 0.5, fontWeight: 700 }}>
        UTC {time} // NB_CORE_ACTIVE
      </div>
      <div style={{ fontSize: "10px", letterSpacing: "5px", color: "#000", fontFamily: "monospace", fontWeight: 900 }}>
        NOTION_BRAIN // SYSTEM_V3.0
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// LANDING HERO GRID
// ─────────────────────────────────────────
function HeroGrid({ onSubmit }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr", height: "100%" }}>
        <div style={{ padding: "40px", borderRight: "1px solid rgba(0,0,0,0.08)" }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{ fontSize: "32px", lineHeight: "1.1", maxWidth: "450px", fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            The Notion MCP Challenge. Centralizing workflow with AI-powered docs, projects, and notes.
          </motion.h2>
        </div>
        <div style={{ padding: "40px", borderRight: "1px solid rgba(0,0,0,0.08)", fontSize: "11px", letterSpacing: "1.5px", lineHeight: "1.8" }}>
          <div style={{ color: "#999", marginBottom: "8px", fontWeight: 700 }}>SYSTEM_ORACLE:</div>
          <div>POWERED BY <span style={{ textDecoration: "underline" }}>NOTION MCP ENGINE</span> //</div>
          <div>SUMMARIZING NODES <span style={{ textDecoration: "underline" }}>STRUCTURALLY</span></div>
          <div style={{ marginTop: "16px", color: "#999" }}>AI_ENGINE: <span style={{ color: "#000" }}>GEMINI_2.0_FLASH</span></div>
        </div>
        <div style={{ padding: "40px", fontSize: "11px", letterSpacing: "2px" }}>
          <div style={{ color: "#999", marginBottom: "8px" }}>2026 // EST</div>
          <button onClick={() => onSubmit("DEMO")}
            style={{ background: "none", border: "none", borderBottom: "1.5px solid #000",
              cursor: "pointer", fontSize: "11px", letterSpacing: "2px", fontWeight: 700,
              padding: "2px 0", transition: "opacity 0.2s" }}>
            INITIALIZE_DEMO_INSTANCE_
          </button>
        </div>
      </div>
      <div style={{ height: "140px", borderTop: "1px solid rgba(0,0,0,0.08)", display: "flex" }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{
            flex: 1, borderRight: i === 13 ? "none" : "1.5px solid rgba(0,0,0,0.08)",
            position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ position: "absolute", top: -5, left: -1, width: 2, height: 10, background: "#000" }} />
            <div style={{ position: "absolute", top: -1, left: -5, width: 10, height: 2, background: "#000" }} />
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2 + i * 0.15, repeat: Infinity, ease: "easeInOut" }}
              style={{ width: 10, height: 10, border: "0.5px solid rgba(0,0,0,0.2)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function MainTitle() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1, delay: 0.5 }}
      style={{ padding: "0 24px", position: "relative", overflow: "hidden", marginBottom: "40px" }}
    >
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif", fontSize: "clamp(80px, 14vw, 180px)",
          fontWeight: 900, letterSpacing: "-0.04em", lineHeight: "0.75", textTransform: "uppercase",
        }}>NOTION</h1>
        <h1 style={{
          fontFamily: "'Outfit', sans-serif", fontSize: "clamp(80px, 14vw, 180px)",
          fontWeight: 300, letterSpacing: "-0.04em", lineHeight: "0.75", textTransform: "uppercase",
          WebkitTextStroke: "2.5px #000", color: "transparent", marginLeft: "0.08em",
        }}>BRAIN</h1>
      </div>
      <div style={{
        position: "absolute", bottom: 0, right: 24, fontSize: "11px", letterSpacing: "4px",
        fontWeight: 700, border: "2px solid #000", padding: "6px 14px", background: "#000", color: "#fff",
      }}>
        SYSTEM_ID: MCP_2026
      </div>
    </motion.div>
  );
}

function ConnectionPanel({ onSubmit }) {
  const [token, setToken] = useState("");
  const [focused, setFocused] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.4 }}
      style={{ padding: "50px 24px", display: "flex", gap: "80px", alignItems: "flex-end" }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "10px", letterSpacing: "3px", color: "#999", marginBottom: "15px", fontWeight: 700 }}>&gt;_CONNECT WORKSPACE</div>
        <div style={{
          border: `2px solid ${focused ? "#000" : "rgba(0,0,0,0.15)"}`,
          padding: "8px 20px", display: "flex", alignItems: "center", maxWidth: "450px",
          transition: "border-color 0.3s",
        }}>
          <span style={{ marginRight: "12px", fontWeight: 600, opacity: 0.3 }}>&gt;</span>
          <input
            value={token}
            onChange={e => setToken(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="secret_xxxxxx..."
            type="password"
            style={{ flex: 1, background: "none", border: "none", outline: "none",
              fontSize: "15px", fontFamily: "monospace", letterSpacing: "2px", fontWeight: 500 }}
          />
        </div>
      </div>
      <button
        onClick={() => onSubmit(token)}
        style={{ padding: "20px 50px", background: "#000", color: "#fff", border: "none",
          fontSize: "13px", letterSpacing: "4px", fontWeight: 700, cursor: "pointer",
          transition: "transform 0.2s, opacity 0.2s" }}
        onMouseEnter={e => e.target.style.opacity = "0.8"}
        onMouseLeave={e => e.target.style.opacity = "1"}
      >
        EXECUTE_CONNECTION_
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// THREE.JS NODE COMPONENTS
// ─────────────────────────────────────────
function StructuralBackground() {
  const posRef = useRef(new Float32Array(300 * 3));
  useEffect(() => {
    for (let i = 0; i < 300; i++) {
      posRef.current[i * 3 + 0] = (Math.random() - 0.5) * 120;
      posRef.current[i * 3 + 1] = (Math.random() - 0.5) * 120;
      posRef.current[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
  }, []);
  return (
    <group>
      {Array.from({ length: 20 }).map((_, i) => (
        <Float key={i} speed={3} rotationIntensity={1} floatIntensity={1}>
          <mesh position={[(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60]}>
            <boxGeometry args={[Math.random() * 8, 0.03, 0.03]} />
            <meshStandardMaterial color="#000" transparent opacity={0.04} />
          </mesh>
        </Float>
      ))}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={300} array={posRef.current} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.15} color="#000" transparent opacity={0.1} />
      </points>
    </group>
  );
}

function NodeBlock({ node, isSelected, onNodeClick, assemblyDelay }) {
  const meshRef  = useRef();
  const groupRef = useRef();
  const [assembled, setAssembled] = useState(false);
  const [hovered, setHovered]     = useState(false);

  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.scale.setScalar(0.01);
    const tl = gsap.timeline({ delay: assemblyDelay });
    tl.to(meshRef.current.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: "slow(0.7, 0.7, false)" });
    tl.call(() => setAssembled(true));
    return () => tl.kill();
  }, [assemblyDelay]);

  useFrame(({ clock }) => {
    if (!groupRef.current || !assembled) return;
    const t = clock.elapsedTime;
    const seed = (node.id || "a").charCodeAt(0);
    groupRef.current.position.y = (node.position?.[1] || 0) + Math.sin(t * 1.2 + seed) * 0.3;
    if (isSelected) groupRef.current.rotation.y += 0.03;
  });

  return (
    <group
      position={node.position}
      ref={groupRef}
      onClick={(e) => { e.stopPropagation(); onNodeClick(node); }}
      onPointerEnter={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerLeave={() => { setHovered(false); document.body.style.cursor = "crosshair"; }}
    >
      <mesh ref={meshRef}>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshStandardMaterial
          color={isSelected ? "#000" : (hovered ? "#333" : "#eee")}
          wireframe={!isSelected && !hovered}
          roughness={0} metalness={0.9}
        />
      </mesh>
      {isSelected && <Line points={[[0, -15, 0], [0, 15, 0]]} color="#000" lineWidth={0.8} transparent opacity={0.2} />}
      <Html center position={[0, 2.0, 0]} className="node-label-html" portal={document.body}>
        <div style={{
          background: isSelected ? "#000" : (hovered ? "rgba(0,0,0,0.85)" : "rgba(245,242,236,0.92)"),
          color: (isSelected || hovered) ? "#fff" : "#000",
          padding: "3px 12px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "2px", whiteSpace: "nowrap",
          border: isSelected ? "1.5px solid #000" : "1px solid rgba(0,0,0,0.15)",
          transition: "all 0.3s", backdropFilter: "blur(4px)",
          zIndex: isSelected ? 50 : 5, position: "relative",
        }}>
          {node.label}
        </div>
      </Html>
    </group>
  );
}

// ─────────────────────────────────────────
// DEMO DATA
// ─────────────────────────────────────────
const DEMO_DATA = {
  nodes: [
    { id: "1", label: "NOTION_MCP_CHALLENGE", position: [0, 0, 0], edited: new Date().toISOString() },
    { id: "2", label: "PRIZES_AND_BADGES", position: [15, 8, -5], edited: new Date().toISOString() },
    { id: "3", label: "JUDGING_CRITERIA", position: [-15, -8, 10], edited: new Date().toISOString() },
    { id: "4", label: "SUBMISSION_TEMPLATES", position: [8, -15, -12], edited: new Date().toISOString() },
    { id: "5", label: "HACKATHON_TEAM_HUB", position: [-10, 12, 15], edited: new Date().toISOString() },
  ],
  links: [
    { source: "1", target: "2" }, { source: "1", target: "3" },
    { source: "1", target: "4" }, { source: "1", target: "5" },
  ],
};

const DEMO_CONTENT = {
  "1": `📌 OVERVIEW: The Notion MCP Challenge is a hackathon in partnership with Major League Hacking and Notion, running through March 29. Participants are invited to centralize their workflow with AI-powered docs, projects, and notes using the Model Context Protocol.\n\n🔑 KEY POINTS:\n• Build tools that integrate with Notion's MCP engine\n• Judged on Originality, Technical Complexity, and Practical Implementation\n• Winner receives an invitation to chat with Ivan Zhao (CEO) + $500 USD\n• Submissions are due March 29, 2026\n• Open to all MLH hackathon participants\n\n🏷️ CATEGORY: Hackathon Brief`,
  "2": `📌 OVERVIEW: The prizes and badges section outlines rewards for top submissions. The grand prize includes a direct meeting with Notion CEO Ivan Zhao, $500 USD cash, and exclusive Notion swag.\n\n🔑 KEY POINTS:\n• 1st place: Chat with Ivan Zhao + $500 USD\n• MLH digital badges for all finalists\n• Special Notion Pro subscriptions for runners-up\n\n🏷️ CATEGORY: Prizes`,
  "3": `📌 OVERVIEW: Submissions are evaluated across three core dimensions by a panel of Notion engineers and MLH judges.\n\n🔑 KEY POINTS:\n• Originality & Creativity — does it push boundaries?\n• Technical Complexity — how sophisticated is the implementation?\n• Practical Implementation — is it actually useful?\n\n🏷️ CATEGORY: Judging Criteria`,
  "4": `📌 OVERVIEW: Submission templates provide standardized formats for project documentation, demo videos, and code repositories.\n\n🔑 KEY POINTS:\n• README template with required sections\n• Demo video under 3 minutes\n• GitHub repo must be public by deadline\n• Include a live demo URL if possible\n\n🏷️ CATEGORY: Templates`,
  "5": `📌 OVERVIEW: The Hackathon Team Hub is a collaborative Notion workspace where participants coordinate, share resources, and connect with mentors.\n\n🔑 KEY POINTS:\n• Team formation board\n• Mentor office hours schedule\n• Shared resource library\n• Real-time Q&A channel integration\n\n🏷️ CATEGORY: Team Hub`,
};

// ─────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState("landing");
  const [data, setData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [token, setToken] = useState("");
  const [nodeContent, setNodeContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);

  // ── Connect / Demo handler ─────────────────────────────────────────
  const handleSubmit = useCallback(async (customToken) => {
    if (customToken === "DEMO") {
      setIsDemoMode(true);
      setPhase("loading");
      setTimeout(() => {
        setData(DEMO_DATA);
        setPhase("world");
      }, 1800);
      return;
    }

    if (!customToken.trim()) {
      setError("TOKEN_EMPTY — please enter your Notion integration secret");
      return;
    }

    setIsDemoMode(false);
    setToken(customToken);
    setPhase("loading");
    setError("");

    try {
      const resp = await fetch(`${API_BASE}/api/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: customToken }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || "CONNECT_ERROR");
      }
      const resData = await resp.json();
      setData(resData);
      setPhase("world");
    } catch (err) {
      setError(err.message);
      setPhase("landing");
    }
  }, []);

  // ── Node click → fetch full content from backend → Gemini summary ──
  const fetchDetail = useCallback(async (node) => {
    setSelectedNode(node);
    setNodeContent("");
    setLoadingContent(true);

    // Demo mode uses local content
    if (isDemoMode) {
      await new Promise(r => setTimeout(r, 600));
      setNodeContent(DEMO_CONTENT[node.id] || `📌 OVERVIEW: Demo node "${node.label}".\n\n🔑 KEY POINTS:\n• This is a demo workspace\n• Connect your real Notion token for live summaries\n\n🏷️ CATEGORY: Demo`);
      setLoadingContent(false);
      return;
    }

    try {
      // Backend handles: Notion full content fetch → Gemini summarization via .env key
      const resp = await fetch(`${API_BASE}/api/page/${node.id}?token=${encodeURIComponent(token)}`);
      const d = await resp.json();
      setNodeContent(d.content || "[EMPTY_PAGE] No content found.");
    } catch (err) {
      setNodeContent(`[SIGNAL_LOSS] ${err.message}`);
    }
    setLoadingContent(false);
  }, [token, isDemoMode]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#f5f2ec", color: "#000" }}>
      <GlobalStyles />

      {/* ── LANDING PHASE ──────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            style={{ position: "absolute", inset: 0, zIndex: 10 }}
          >
            <div style={{ height: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 10 }}>
              <TopHeader />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "60px 0 0" }}>
                <HeroGrid onSubmit={handleSubmit} />
                <div style={{ flex: 1 }} />
                <MainTitle />
                <ConnectionPanel onSubmit={handleSubmit} />
              </div>
            </div>
            {error && (
              <div style={{
                position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
                background: "#000", color: "#fff", padding: "8px 24px", fontSize: "11px",
                letterSpacing: "3px", zIndex: 300,
              }}>
                ERROR: {error}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LOADING PHASE ──────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute", inset: 0, zIndex: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", background: "#f5f2ec",
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              style={{
                width: 60, height: 60, border: "2px solid rgba(0,0,0,0.1)",
                borderTopColor: "#000", borderRadius: "50%", marginBottom: 30,
              }}
            />
            <div style={{ fontSize: "13px", letterSpacing: "12px", fontWeight: 700, marginBottom: "25px", animation: "blink 1s infinite" }}>
              ESTABLISHING_SYNC_CONNECTION_
            </div>
            <div style={{ width: "250px", height: "2px", background: "rgba(0,0,0,0.08)", position: "relative" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.5 }}
                style={{ position: "absolute", top: 0, left: 0, height: "100%", background: "#000" }}
              />
            </div>
            <div style={{ marginTop: 16, fontSize: "10px", letterSpacing: "4px", color: "rgba(0,0,0,0.35)", fontFamily: "monospace" }}>
              FETCHING NOTION WORKSPACE...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── WORLD PHASE ────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "world" && (
          <motion.div
            key="world"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            style={{ position: "absolute", inset: 0, zIndex: 10 }}
          >
            {/* THE WORLD BACKGROUND — only rendered here */}
            <WorldBackground active={phase === "world"} />

            {/* HUD */}
            <div style={{
              position: "fixed", top: 24, left: 24, zIndex: 200,
              display: "flex", alignItems: "center", gap: "25px",
              background: "rgba(245,242,236,0.88)", backdropFilter: "blur(10px)",
              padding: "10px 20px", border: "1px solid rgba(0,0,0,0.12)",
            }}>
              <h2 style={{ fontSize: "16px", letterSpacing: "5px", fontWeight: 700, fontFamily: "Rajdhani" }}>
                {isDemoMode ? "NB_DEMO_INSTANCE" : "NB_UNIVERSE_X1"}
              </h2>
              <button
                onClick={() => { setPhase("landing"); setSelectedNode(null); setData({ nodes: [], links: [] }); }}
                style={{
                  background: "#000", color: "#fff", border: "none",
                  padding: "6px 16px", fontSize: "10px", cursor: "pointer",
                  fontWeight: 700, letterSpacing: "3px",
                }}
              >
                TERMINATE_SYNC
              </button>
            </div>

            {/* 3D Canvas */}
            <div style={{ width: "100%", height: "100%", position: "relative", zIndex: 50 }}>
              <Canvas camera={{ position: [0, 15, 50], fov: 40 }}>
                <ambientLight intensity={0.6} />
                <pointLight position={[30, 40, 30]} intensity={2.0} />
                <Suspense fallback={null}>
                  <StructuralBackground />
                  {data.nodes.map((node, i) => (
                    <NodeBlock
                      key={node.id} node={node}
                      isSelected={selectedNode?.id === node.id}
                      onNodeClick={fetchDetail}
                      assemblyDelay={i * 0.05}
                    />
                  ))}
                  {data.links.map((link, i) => {
                    const s = data.nodes.find(n => n.id === (link.source?.id || link.source));
                    const tgt = data.nodes.find(n => n.id === (link.target?.id || link.target));
                    if (!s || !tgt) return null;
                    return (
                      <Line key={i} points={[s.position, tgt.position]}
                        color="#000" lineWidth={0.8} transparent opacity={0.15} />
                    );
                  })}
                </Suspense>
                <OrbitControls autoRotate={!selectedNode} autoRotateSpeed={0.4} />
              </Canvas>
            </div>

            {/* Node Detail Panel */}
            <AnimatePresence>
              {selectedNode && (
                <motion.div
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 220 }}
                  style={{
                    position: "fixed", right: 0, top: 0, bottom: 0, width: "500px",
                    background: "rgba(245,242,236,0.97)", backdropFilter: "blur(40px)",
                    borderLeft: "3.5px solid #000", zIndex: 9999, padding: "80px 50px",
                    display: "flex", flexDirection: "column", boxShadow: "-20px 0 40px rgba(0,0,0,0.08)",
                  }}
                >
                  {/* Diagonal stripe accent */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: "6px",
                    background: "repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 8px)",
                  }} />

                  <div style={{ position: "absolute", top: 30, right: 30, display: "flex", gap: "25px" }}>
                    {selectedNode.url && (
                      <a href={selectedNode.url} target="_blank" rel="noreferrer"
                        style={{ fontSize: "11px", color: "#000", fontWeight: 700, letterSpacing: "2px",
                          borderBottom: "2px solid #000", paddingBottom: "2px", textDecoration: "none" }}>
                        OPEN_NOTION →
                      </a>
                    )}
                    <button
                      onClick={() => setSelectedNode(null)}
                      style={{ border: "none", background: "none", cursor: "pointer", fontSize: "28px", padding: 0, fontWeight: 300 }}
                    >×</button>
                  </div>

                  <div style={{ fontSize: "11px", color: "#777", letterSpacing: "4px", marginBottom: "15px", fontWeight: 700 }}>
                    NODE_SYNC // GEMINI_ORACLE
                  </div>
                  <h3 style={{
                    fontSize: "42px", fontWeight: 900, textTransform: "uppercase",
                    marginBottom: "40px", lineHeight: 0.9, letterSpacing: "-0.02em", fontFamily: "Outfit",
                  }}>
                    {selectedNode.label}
                  </h3>

                  <div style={{ flex: 1, overflowY: "auto", borderTop: "2px solid #000", paddingTop: "40px" }}>
                    {loadingContent ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ fontSize: "11px", letterSpacing: "6px", fontWeight: 700, animation: "blink 1s infinite" }}>
                          FETCHING + SUMMARIZING...
                        </div>
                        <div style={{ fontSize: "10px", color: "#999", letterSpacing: "2px", marginTop: 4 }}>
                          Notion → content → Gemini AI → summary
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                          {[0,1,2,3,4].map(i => (
                            <motion.div key={i}
                              animate={{ scaleY: [1, 2.5, 1] }}
                              transition={{ delay: i * 0.1, repeat: Infinity, duration: 0.7 }}
                              style={{ width: 6, height: 14, background: "#000", borderRadius: 1, transformOrigin: "bottom" }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{ lineHeight: 1.8, color: "#111", fontSize: "14px", fontWeight: 500, whiteSpace: "pre-wrap" }}
                      >
                        {nodeContent}
                      </motion.div>
                    )}
                  </div>

                  <div style={{
                    marginTop: "50px", fontSize: "10px", color: "#bbb", letterSpacing: "2px",
                    borderTop: "1px solid #eee", paddingTop: "20px",
                    display: "flex", justifyContent: "space-between",
                  }}>
                    <span>ID: {selectedNode.id?.slice(0, 10).toUpperCase()}</span>
                    {selectedNode.edited && <span>{new Date(selectedNode.edited).toLocaleDateString()}</span>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Status bar */}
            <div style={{
              position: "fixed", bottom: 24, left: 24, zIndex: 200, fontSize: "10px",
              color: "#000", letterSpacing: "4px", fontWeight: 700,
              background: "rgba(245,242,236,0.88)", backdropFilter: "blur(8px)",
              padding: "6px 14px", border: "1px solid rgba(0,0,0,0.08)",
            }}>
              {data.nodes.length} NODES // {isDemoMode ? "DEMO_MODE" : "LIVE_SYNC"} // AI: GEMINI_ACTIVE
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}