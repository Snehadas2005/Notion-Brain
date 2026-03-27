import React, {
  useRef, useEffect, useState, useCallback, Suspense,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Html, Float } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { animate } from "animejs";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────
// FIX: Safe env variable access (was causing build error)
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
      background: #ffffff;
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

    @keyframes pulse-ring {
      0% { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }

    @keyframes data-stream {
      0% { transform: translateY(-100%); opacity: 0; }
      50% { opacity: 1; }
      100% { transform: translateY(100vh); opacity: 0; }
    }

    @keyframes glitch {
      0%, 100% { clip-path: inset(0 0 98% 0); transform: translateX(0); }
      20% { clip-path: inset(33% 0 40% 0); transform: translateX(-4px); }
      40% { clip-path: inset(70% 0 10% 0); transform: translateX(4px); }
      60% { clip-path: inset(10% 0 70% 0); transform: translateX(-2px); }
      80% { clip-path: inset(50% 0 30% 0); transform: translateX(2px); }
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
      background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.15), transparent);
      animation: data-stream linear infinite;
      pointer-events: none;
    }
  `}</style>
);

// ─────────────────────────────────────────
// SPECTACULAR ANIMATED CANVAS BACKGROUND
// ─────────────────────────────────────────
function LiveBackground() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    // --- Node system ---
    const NODE_COUNT = 80;
    const nodes = Array.from({ length: NODE_COUNT }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 1.5 + Math.random() * 2.5,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.02,
    }));

    // --- Flowing curves ---
    const CURVE_COUNT = 8;
    const curves = Array.from({ length: CURVE_COUNT }, () => ({
      points: Array.from({ length: 6 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      })),
      alpha: 0.03 + Math.random() * 0.05,
      width: 0.5 + Math.random(),
    }));

    // --- Geometric shapes ---
    const SHAPE_COUNT = 5;
    const shapes = Array.from({ length: SHAPE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 40 + Math.random() * 80,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.003,
      sides: [3, 4, 6][Math.floor(Math.random() * 3)],
      alpha: 0.04 + Math.random() * 0.04,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
    }));

    // --- Scanline ---
    let scanY = 0;

    // --- Grid ---
    const GRID_SIZE = 60;

    let t = 0;
    let rafId;

    const drawGrid = () => {
      ctx.strokeStyle = "rgba(0,0,0,0.03)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    };

    const drawPolygon = (cx, cy, r, sides, rot) => {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = rot + (i / sides) * Math.PI * 2 - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      t += 0.008;

      // Clear
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // Grid
      drawGrid();

      // Flowing background curves
      curves.forEach(curve => {
        curve.points.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > W) p.vx *= -1;
          if (p.y < 0 || p.y > H) p.vy *= -1;
        });
        ctx.beginPath();
        ctx.moveTo(curve.points[0].x, curve.points[0].y);
        for (let i = 1; i < curve.points.length - 2; i++) {
          const mx = (curve.points[i].x + curve.points[i + 1].x) / 2;
          const my = (curve.points[i].y + curve.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(curve.points[i].x, curve.points[i].y, mx, my);
        }
        ctx.strokeStyle = `rgba(0,0,0,${curve.alpha})`;
        ctx.lineWidth = curve.width;
        ctx.stroke();
      });

      // Geometric shapes
      shapes.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.rot += s.rotSpeed;
        if (s.x < -s.size) s.x = W + s.size;
        if (s.x > W + s.size) s.x = -s.size;
        if (s.y < -s.size) s.y = H + s.size;
        if (s.y > H + s.size) s.y = -s.size;
        drawPolygon(s.x, s.y, s.size, s.sides, s.rot);
        ctx.strokeStyle = `rgba(0,0,0,${s.alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        drawPolygon(s.x, s.y, s.size * 0.6, s.sides, s.rot + 0.3);
        ctx.strokeStyle = `rgba(0,0,0,${s.alpha * 0.5})`;
        ctx.stroke();
      });

      // Node movement
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.pulse += n.pulseSpeed;
        if (n.x < 0) n.x = W; if (n.x > W) n.x = 0;
        if (n.y < 0) n.y = H; if (n.y > H) n.y = 0;
      });

      // Edges between close nodes
      const EDGE_DIST = 130;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < EDGE_DIST) {
            const alpha = (1 - dist / EDGE_DIST) * 0.12;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Node dots with pulse rings
      nodes.forEach(n => {
        const pulse = Math.sin(n.pulse) * 0.5 + 0.5;
        // Pulse ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + pulse * 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,0,0,${0.05 * pulse})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Core dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${0.2 + pulse * 0.15})`;
        ctx.fill();
      });

      // Scanline
      scanY = (scanY + 0.8) % H;
      const grad = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.5, "rgba(0,0,0,0.025)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, scanY - 40, W, 80);

      // Radial vignette
      const vignette = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.85);
      vignette.addColorStop(0, "rgba(255,255,255,0)");
      vignette.addColorStop(1, "rgba(230,230,230,0.4)");
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
      style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        zIndex: 0, pointerEvents: "none",
      }}
    />
  );
}

// ─────────────────────────────────────────
// FLOATING PARTICLES OVERLAY
// ─────────────────────────────────────────
function FloatingParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${(i * 5.5 + 3) % 100}%`,
    size: 2 + (i % 4),
    duration: 12 + (i * 1.7) % 14,
    delay: (i * 0.9) % 8,
    opacity: 0.06 + (i % 5) * 0.015,
  }));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            bottom: -10,
            width: p.size,
            height: p.size,
            background: `rgba(0,0,0,${p.opacity})`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      {/* Data stream lines */}
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={`line-${i}`}
          className="data-line"
          style={{
            left: `${10 + i * 22}%`,
            height: `${40 + i * 10}%`,
            top: 0,
            animationDuration: `${6 + i * 2}s`,
            animationDelay: `${i * 1.3}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// CORNER DECO BRACKETS
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
      zIndex: 100, background: "rgba(255,255,255,0.8)",
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
// LANDING — HERO GRID
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
          <button
            onClick={() => onSubmit("DEMO")}
            style={{
              background: "none", border: "none", borderBottom: "1.5px solid #000",
              cursor: "pointer", fontSize: "11px", letterSpacing: "2px", fontWeight: 700,
              padding: "2px 0", transition: "opacity 0.2s",
            }}
          >
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
  const [error, setError] = useState("");
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
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: "15px", fontFamily: "monospace", letterSpacing: "2px", fontWeight: 500,
            }}
          />
        </div>
        {error && (
          <div style={{ fontSize: "10px", color: "#c00", letterSpacing: "2px", marginTop: "8px" }}>{error}</div>
        )}
      </div>
      <button
        onClick={() => onSubmit(token)}
        style={{
          padding: "20px 50px", background: "#000", color: "#fff", border: "none",
          fontSize: "13px", letterSpacing: "4px", fontWeight: 700, cursor: "pointer",
          transition: "transform 0.2s, opacity 0.2s",
        }}
        onMouseEnter={e => e.target.style.opacity = "0.8"}
        onMouseLeave={e => e.target.style.opacity = "1"}
      >
        EXECUTE_CONNECTION_
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// THREE.JS COMPONENTS
// ─────────────────────────────────────────
function StructuralBackground() {
  const count = 300;
  const positions = useRef(new Float32Array(count * 3));
  useEffect(() => {
    for (let i = 0; i < count; i++) {
      positions.current[i * 3 + 0] = (Math.random() - 0.5) * 120;
      positions.current[i * 3 + 1] = (Math.random() - 0.5) * 120;
      positions.current[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
  }, []);
  return (
    <group>
      {Array.from({ length: 25 }).map((_, i) => (
        <Float key={i} speed={3} rotationIntensity={1} floatIntensity={1}>
          <mesh position={[(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60]}>
            <boxGeometry args={[Math.random() * 8, 0.03, 0.03]} />
            <meshStandardMaterial color="#000" transparent opacity={0.04} />
          </mesh>
        </Float>
      ))}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={count} array={positions.current} itemSize={3} />
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
          background: isSelected ? "#000" : (hovered ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)"),
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
// FIXED: GEMINI AI SUMMARY — client-side call with proper model
// ─────────────────────────────────────────
async function summarizeWithGemini(text, geminiKey) {
  if (!geminiKey) return "[AI_KEY_MISSING] " + text.slice(0, 300);
  const models = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash"];
  for (const model of models) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text:
              `You are the Notion Brain Intelligent Oracle. Summarize the following structural data into a high-impact, concise overview. Limit to 3 sentences maximum. Use architectural, professional language.\n\nDATA_FLOW:\n${text.slice(0, 8000)}`
            }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
          }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[EMPTY_RESPONSE]";
      }
    } catch (err) {
      continue;
    }
  }
  return "[AI_SYNC_FAILED] " + text.slice(0, 300);
}

// ─────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────
const CHALLENGE_TEXT = `We're excited to announce our newest challenge in partnership with Major League Hacking (MLH) and Notion! Running through March 29, the Notion MCP Challenge welcomes you to centralize your workflow with AI-powered docs, projects, and notes. 

JUDGING CRITERIA:
• Originality & Creativity
• Technical Complexity  
• Practical Implementation

PRIZES: One winner will receive an invitation to chat with Ivan Zhao (CEO), $500 USD, and more. Submissions due March 29!`;

export default function App() {
  const [phase, setPhase] = useState("landing");
  const [data, setData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [token, setToken] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [nodeContent, setNodeContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState("");

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

  const handleSubmit = useCallback(async (customToken) => {
    if (customToken === "DEMO") {
      setPhase("loading");
      setTimeout(() => { setData(DEMO_DATA); setPhase("world"); }, 1500);
      return;
    }
    setToken(customToken);
    setPhase("loading");
    setError("");
    try {
      const resp = await fetch(`${API_BASE}/api/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: customToken }),
      });
      if (!resp.ok) throw new Error("CONNECT_ERROR");
      const resData = await resp.json();
      setData(resData);
      setPhase("world");
    } catch (err) {
      setError(err.message);
      setPhase("landing");
    }
  }, []);

  const fetchDetail = useCallback(async (node) => {
    setSelectedNode(node);
    if (node.id === "1") { setNodeContent(CHALLENGE_TEXT); return; }
    setLoadingContent(true);
    try {
      const resp = await fetch(`${API_BASE}/api/page/${node.id}?token=${token}`);
      const d = await resp.json();
      let content = d.content || "";
      // If the backend returns AI_SYNC_FAILED or similar, try client-side Gemini
      if (!content || content.includes("AI_SYNC_FAILED") || content.includes("GEMINI_API_KEY")) {
        const gKey = geminiKey || (typeof window !== "undefined" && window._GEMINI_KEY) || "";
        if (gKey && content.length > 30) {
          content = await summarizeWithGemini(content, gKey);
        }
      }
      setNodeContent(content || "NODE_EMPTY.");
    } catch (err) {
      setNodeContent("SIGNAL_LOSS: " + err.message);
    }
    setLoadingContent(false);
  }, [token, geminiKey]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#ffffff", color: "#000" }}>
      <GlobalStyles />
      {/* Always-on animated background */}
      <LiveBackground />
      <FloatingParticles />
      <CornerBrackets />

      {phase === "landing" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ height: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 10 }}
        >
          <TopHeader />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "60px 0 0" }}>
            <HeroGrid onSubmit={handleSubmit} />
            <div style={{ flex: 1 }} />
            <MainTitle />
            {/* Gemini API key input (optional) */}
            <div style={{ padding: "0 24px 12px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "10px", letterSpacing: "3px", color: "#999", fontWeight: 700, whiteSpace: "nowrap" }}>GEMINI_KEY (optional):</span>
              <input
                type="password"
                placeholder="AIza..."
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                style={{
                  background: "none", border: "none", borderBottom: "1px solid rgba(0,0,0,0.2)",
                  outline: "none", fontSize: "12px", fontFamily: "monospace", letterSpacing: "1px",
                  width: 240, padding: "4px 0", color: "#000",
                }}
              />
            </div>
            <ConnectionPanel onSubmit={handleSubmit} />
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

      {phase === "loading" && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", position: "relative", zIndex: 10,
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
        </motion.div>
      )}

      {phase === "world" && (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          {/* HUD */}
          <div style={{
            position: "fixed", top: 24, left: 24, zIndex: 200,
            display: "flex", alignItems: "center", gap: "25px",
            background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)",
            padding: "10px 20px", border: "1px solid rgba(0,0,0,0.1)",
          }}>
            <h2 style={{ fontSize: "16px", letterSpacing: "5px", fontWeight: 700, fontFamily: "Rajdhani" }}>
              NB_UNIVERSE_X1
            </h2>
            <button
              onClick={() => setPhase("landing")}
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
                    assemblyDelay={i * 0.04}
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
                  background: "rgba(255,255,255,0.97)", backdropFilter: "blur(40px)",
                  borderLeft: "3.5px solid #000", zIndex: 9999, padding: "80px 50px",
                  display: "flex", flexDirection: "column", boxShadow: "-20px 0 40px rgba(0,0,0,0.1)",
                }}
              >
                <div style={{ position: "absolute", top: 30, right: 30, display: "flex", gap: "25px" }}>
                  {selectedNode.url && (
                    <a
                      href={selectedNode.url} target="_blank" rel="noreferrer"
                      style={{
                        fontSize: "11px", color: "#000", fontWeight: 700, letterSpacing: "2px",
                        borderBottom: "2px solid #000", paddingBottom: "2px", textDecoration: "none",
                      }}
                    >
                      OPEN_NOTION_SOURCE
                    </a>
                  )}
                  <button
                    onClick={() => setSelectedNode(null)}
                    style={{ border: "none", background: "none", cursor: "pointer", fontSize: "28px", padding: 0, fontWeight: 300 }}
                  >×</button>
                </div>
                <div style={{ fontSize: "11px", color: "#777", letterSpacing: "4px", marginBottom: "15px", fontWeight: 700 }}>
                  NODE_SYNC // INTELLIGENT_ORACLE
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
                      <div style={{ fontSize: "13px", letterSpacing: "6px", fontWeight: 700, animation: "blink 1s infinite" }}>
                        GENERATING_CORE_SUMMARY...
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        {[0,1,2,3,4].map(i => (
                          <motion.div
                            key={i}
                            animate={{ scaleY: [1, 2.5, 1] }}
                            transition={{ delay: i * 0.1, repeat: Infinity, duration: 0.7 }}
                            style={{ width: 6, height: 14, background: "#000", borderRadius: 1, transformOrigin: "bottom" }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ lineHeight: 1.8, color: "#111", fontSize: "15px", fontWeight: 500, whiteSpace: "pre-wrap" }}>
                      {nodeContent}
                    </div>
                  )}
                </div>
                <div style={{
                  marginTop: "50px", fontSize: "10px", color: "#ccc", letterSpacing: "2px",
                  borderTop: "1px solid #eee", paddingTop: "20px",
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span>RECORD_TAG: {selectedNode.id.slice(0, 8).toUpperCase()}</span>
                  <span>EDITS: {new Date(selectedNode.edited).toLocaleDateString()}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status bar */}
          <div style={{
            position: "fixed", bottom: 24, left: 24, zIndex: 200, fontSize: "10px",
            color: "#000", letterSpacing: "4px", fontWeight: 700,
            background: "rgba(255,255,255,0.8)", backdropFilter: "blur(8px)",
            padding: "6px 14px", border: "1px solid rgba(0,0,0,0.08)",
          }}>
            SYNC_STATUS: ACTIVE // AI_SUMMARY_ENGINE: ENABLED
          </div>
        </div>
      )}
    </div>
  );
}