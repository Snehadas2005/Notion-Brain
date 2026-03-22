import React, {
  useRef, useEffect, useState, useCallback, useMemo, Suspense,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────
// API base — Vite env var, safe access
// ─────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─────────────────────────────────────────
// SNOWY TAIGA PALETTE
// ─────────────────────────────────────────
const MC = {
  snow:        "#e8eef2",
  snowShade:   "#ccd4da",
  dirt:        "#7a5030",
  spruceLeaf:  "#1a3a1a",
  spruceLeafL: "#2a5a2a",
  trunk:       "#6b3a1f",
  skyOvercast: "#b8c8d8",
  ice:         "#7ab0c8",
  clusters: [
    { base: "#4a90d9", dark: "#1e4880", glow: "#7ab8f0", name: "Knowledge" },
    { base: "#5aaa5a", dark: "#2a5a2a", glow: "#8ade8a", name: "Projects"  },
    { base: "#d9904a", dark: "#804820", glow: "#f0b87a", name: "Ideas"     },
    { base: "#9a60c8", dark: "#502880", glow: "#c090f0", name: "Research"  },
    { base: "#c84040", dark: "#802020", glow: "#f07070", name: "Notes"     },
  ],
};

// ─────────────────────────────────────────
// MC BUTTON
// ─────────────────────────────────────────
function MCButton({ children, onClick, disabled, style, variant = "stone" }) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const C = variant === "green"
    ? {
        bg:   hovered && !disabled ? "#4a9e25" : "#3a8e15",
        top:  hovered && !disabled ? "#70be50" : "#50a030",
        btm:  "#1a4005",
        text: hovered && !disabled ? "#ffffa0" : "#e0e0e0",
      }
    : {
        bg:   hovered && !disabled ? "#9a9a9a" : "#7b7b7b",
        top:  hovered && !disabled ? "#bebebe" : "#a0a0a0",
        btm:  "#3a3a3a",
        text: hovered && !disabled ? "#ffffa0" : "#e0e0e0",
      };

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        background: C.bg,
        borderTop:    `2px solid ${pressed ? C.btm : C.top}`,
        borderLeft:   `2px solid ${pressed ? C.btm : C.top}`,
        borderRight:  `2px solid ${pressed ? C.top : C.btm}`,
        borderBottom: `2px solid ${pressed ? C.top : C.btm}`,
        cursor: disabled ? "not-allowed" : "pointer",
        padding: "10px 20px",
        color: disabled ? "#888" : C.text,
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "10px",
        letterSpacing: "1px",
        textShadow: "1px 1px 0 rgba(0,0,0,0.9)",
        userSelect: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        transform: pressed ? "translate(1px,1px)" : "none",
        transition: "background 0.05s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────
// NODE — single BoxGeometry, flies in via GSAP
// GPU-safe: one draw call per node
// ─────────────────────────────────────────
function NodeBlock({ node, isSelected, isHighlighted, onNodeClick, assemblyDelay }) {
  const meshRef  = useRef();
  const groupRef = useRef();
  const [assembled, setAssembled] = useState(false);
  const [hovered,   setHovered]   = useState(false);
  const colors = MC.clusters[(node.cluster || 0) % MC.clusters.length];

  // Fly-in from random position
  useEffect(() => {
    if (!meshRef.current) return;
    const seed  = (node.id || "a").charCodeAt(0);
    const r     = 50 + (seed % 30);
    const theta = seed * 0.71;
    const phi   = ((seed % 7) / 7 - 0.5) * Math.PI;
    meshRef.current.position.set(
      Math.cos(theta) * Math.cos(phi) * r,
      Math.sin(phi) * r,
      Math.sin(theta) * Math.cos(phi) * r
    );
    meshRef.current.scale.setScalar(0.04);

    const tl = gsap.timeline({ delay: assemblyDelay });
    tl.to(meshRef.current.position, { x: 0, y: 0, z: 0, duration: 1.0, ease: "power3.out" });
    tl.to(meshRef.current.scale,    { x: 1, y: 1, z: 1, duration: 0.5, ease: "back.out(2)" }, "-=0.3");
    tl.call(() => setAssembled(true));
    return () => tl.kill();
  }, [assemblyDelay, node.id]);

  // Scale on select / hover
  useEffect(() => {
    if (!groupRef.current) return;
    const s = isSelected ? 1.7 : hovered ? 1.3 : 1.0;
    gsap.to(groupRef.current.scale, { x: s, y: s, z: s, duration: 0.18, ease: "power2.out" });
  }, [isSelected, hovered]);

  // Float + slow spin when selected
  useFrame(({ clock }) => {
    if (!groupRef.current || !assembled) return;
    const t    = clock.elapsedTime;
    const seed = (node.id || "a").charCodeAt(0);
    groupRef.current.position.y =
      (node.position?.[1] || 0) + Math.sin(t * 0.55 + seed * 0.35) * 0.4;
    if (isSelected) groupRef.current.rotation.y += 0.014;
  });

  const pos = node.position || [0, 0, 0];

  return (
    <group
      ref={groupRef}
      position={[pos[0], pos[1], pos[2]]}
      onClick={(e) => { e.stopPropagation(); onNodeClick(node); }}
      onPointerEnter={() => { setHovered(true);  document.body.style.cursor = "pointer"; }}
      onPointerLeave={() => { setHovered(false); document.body.style.cursor = "default"; }}
    >
      <mesh ref={meshRef}>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshStandardMaterial
          color={
            isSelected    ? "#ffffff" :
            isHighlighted ? "#ffffa0" :
            hovered       ? colors.glow :
                            colors.base
          }
          emissive={isSelected ? colors.dark : hovered ? colors.dark : "#000000"}
          emissiveIntensity={isSelected ? 0.6 : hovered ? 0.25 : 0}
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>

      {isSelected && assembled && (
        <pointLight color="#ffa040" intensity={3} distance={12} position={[0, 2.5, 0]} />
      )}

      <Html center position={[0, 2.5, 0]} style={{ pointerEvents: "none" }}>
        <AnimatePresence>
          {(hovered || isSelected || isHighlighted) && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                background: "rgba(0,0,0,0.92)",
                border: "2px solid #555",
                boxShadow: "inset 1px 1px 0 #777, inset -1px -1px 0 #222",
                padding: "5px 10px",
                whiteSpace: "nowrap",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "10px",
                color: isSelected ? "#ffffa0" : "#e0e0e0",
                textShadow: "1px 1px 0 #000",
              }}
            >
              {node.label || node.id}
            </motion.div>
          )}
        </AnimatePresence>
      </Html>
    </group>
  );
}

// ─────────────────────────────────────────
// EDGE LINES — animated, redstone wire style
// ─────────────────────────────────────────
function EdgeLines({ links, nodesMap, visible }) {
  const [progs, setProgs] = useState({});

  useEffect(() => {
    if (!visible) return;
    links.forEach((link, i) => {
      const obj = { v: 0 };
      gsap.to(obj, {
        v: 1, duration: 1.0, delay: 0.4 + i * 0.05, ease: "power2.out",
        onUpdate() { setProgs(p => ({ ...p, [i]: obj.v })); },
      });
    });
  }, [visible, links]);

  return (
    <>
      {links.map((link, i) => {
        const src = nodesMap[link.source];
        const tgt = nodesMap[link.target];
        if (!src || !tgt) return null;
        const p  = progs[i] || 0;
        if (p < 0.01) return null;
        const sp = src.position || [0, 0, 0];
        const ep = tgt.position || [0, 0, 0];
        const end = [
          sp[0] + (ep[0] - sp[0]) * p,
          sp[1] + (ep[1] - sp[1]) * p,
          sp[2] + (ep[2] - sp[2]) * p,
        ];
        return (
          <Line
            key={i}
            points={[new THREE.Vector3(...sp), new THREE.Vector3(...end)]}
            color={link.semantic ? "#cc4444" : "#cc7700"}
            lineWidth={link.semantic ? 1 : 1.8}
            transparent
            opacity={0.6 * p}
            dashed={!!link.semantic}
            dashSize={0.5}
            gapSize={0.3}
          />
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────
// SNOWY TERRAIN
// ─────────────────────────────────────────
function SnowyTerrain() {
  const bumps = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => {
      const a = i * 1.15;
      const r = 14 + (i % 7) * 2.5;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, w: 3 + (i % 4), h: 0.4 + (i % 3) * 0.25 };
    }),
  []);

  return (
    <group>
      <mesh position={[0, -12, 0]}>
        <boxGeometry args={[130, 0.8, 130]} />
        <meshStandardMaterial color={MC.snow} roughness={0.92} />
      </mesh>
      <mesh position={[0, -13.1, 0]}>
        <boxGeometry args={[130, 1.6, 130]} />
        <meshStandardMaterial color={MC.dirt} roughness={1} />
      </mesh>
      {bumps.map((b, i) => (
        <mesh key={i} position={[b.x, -11.65 + b.h * 0.5, b.z]}>
          <boxGeometry args={[b.w, b.h, b.w]} />
          <meshStandardMaterial color={MC.snow} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[7, -11.55, -5]}>
        <boxGeometry args={[6, 0.1, 4]} />
        <meshStandardMaterial color={MC.ice} roughness={0.1} metalness={0.1} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────
// SPRUCE TREE — 6 meshes
// ─────────────────────────────────────────
function SpruceTree({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, -7.5, 0]}>
        <boxGeometry args={[0.7, 5, 0.7]} />
        <meshStandardMaterial color={MC.trunk} roughness={1} />
      </mesh>
      {[{ y: -4.5, s: 2.8 }, { y: -2.8, s: 2.0 }, { y: -1.2, s: 1.2 }, { y: 0.2, s: 0.6 }].map((t, i) => (
        <mesh key={i} position={[0, t.y, 0]}>
          <boxGeometry args={[t.s, 1.1, t.s]} />
          <meshStandardMaterial color={i % 2 === 0 ? MC.spruceLeaf : MC.spruceLeafL} roughness={1} />
        </mesh>
      ))}
      <mesh position={[0, -3.8, 0]}>
        <boxGeometry args={[2.4, 0.22, 2.4]} />
        <meshStandardMaterial color={MC.snow} roughness={0.9} />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────
// CAMERA
// ─────────────────────────────────────────
function CameraController({ selectedNode }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(2, 18, 42);
    camera.lookAt(0, 0, 0);
  }, []);

  useEffect(() => {
    if (!selectedNode?.position) return;
    const [nx, ny, nz] = selectedNode.position;
    gsap.to(camera.position, {
      x: nx + 5, y: ny + 8, z: nz + 18,
      duration: 1.3, ease: "power2.inOut",
    });
  }, [selectedNode]);

  return (
    <OrbitControls
      enablePan enableZoom enableRotate
      minDistance={5} maxDistance={80}
      rotateSpeed={0.45} zoomSpeed={0.65}
    />
  );
}

// ─────────────────────────────────────────
// GRAPH SCENE
// ─────────────────────────────────────────
function GraphScene({ graphData, selectedNode, onNodeClick, highlightNodes }) {
  const nodesMap = useMemo(() => {
    const m = {};
    (graphData.nodes || []).forEach(n => (m[n.id] = n));
    return m;
  }, [graphData.nodes]);

  const [edgesVisible, setEdgesVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEdgesVisible(true), 2200);
    return () => clearTimeout(t);
  }, [graphData]);

  const trees = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => {
      const a = (i / 24) * Math.PI * 2 + i * 0.4;
      const r = 26 + (i % 5) * 4;
      return [Math.cos(a) * r, 0, Math.sin(a) * r];
    }),
  []);

  return (
    <>
      <ambientLight intensity={0.85} color="#d0dce8" />
      <directionalLight position={[20, 30, 10]}  intensity={0.9} color="#e8f0f8" />
      <directionalLight position={[-15, 20, -20]} intensity={0.5} color="#c0d0e0" />
      <hemisphereLight skyColor={MC.skyOvercast} groundColor={MC.snow} intensity={0.6} />
      <color attach="background" args={[MC.skyOvercast]} />
      <fog   attach="fog"        args={[MC.skyOvercast, 52, 110]} />

      <SnowyTerrain />
      {trees.map((p, i) => <SpruceTree key={i} position={p} />)}

      <CameraController selectedNode={selectedNode} />

      {(graphData.nodes || []).map((node, i) => (
        <NodeBlock
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          isHighlighted={highlightNodes.has(node.id)}
          onNodeClick={onNodeClick}
          assemblyDelay={i * 0.18 + 0.3}
        />
      ))}

      <EdgeLines links={graphData.links || []} nodesMap={nodesMap} visible={edgesVisible} />
    </>
  );
}

// ─────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────
function LandingPage({ onSubmit }) {
  const [token,   setToken]   = useState("");
  const [focused, setFocused] = useState(false);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    const t = token.trim();
    if (!t) { setError("Please enter your Notion Integration Token"); return; }
    if (!t.startsWith("secret_") && !t.startsWith("ntn_")) {
      setError("Token must start with  secret_  or  ntn_"); return;
    }
    setError("");
    setLoading(true);
    onSubmit(t);
  };

  const flakes = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 6 + Math.random() * 14,
      dur:  5 + Math.random() * 7,
      delay: Math.random() * 6,
      drift: (Math.random() - 0.5) * 38,
    })),
  []);

  return (
    <div style={{
      width: "100vw", height: "100vh",
      background: `linear-gradient(180deg,
        #8aaabb 0%,
        #b0c8d8 48%,
        #d0dce8 64%,
        ${MC.snow}  64%,
        ${MC.snow}  67%,
        ${MC.dirt}  67%
      )`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Press Start 2P', monospace",
      position: "relative", overflow: "hidden",
    }}>
      {/* Falling snow */}
      {flakes.map(f => (
        <motion.div key={f.id}
          animate={{ y: ["-2vh", "105vh"], x: [0, f.drift] }}
          transition={{ repeat: Infinity, duration: f.dur, delay: f.delay, ease: "linear" }}
          style={{
            position: "absolute", left: `${f.x}%`, top: 0,
            width: f.size, height: f.size,
            background: "rgba(232,238,242,0.85)",
            border: "1px solid rgba(200,220,230,0.5)",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Spruce silhouettes */}
      {[
        { side: "left",  trees: [200, 160, 240, 190] },
        { side: "right", trees: [190, 250, 170, 220] },
      ].map((group, gi) => (
        <div key={gi} style={{
          position: "absolute", bottom: "7%",
          ...(group.side === "left" ? { left: 0 } : { right: 0 }),
          display: "flex", alignItems: "flex-end", gap: 4,
          pointerEvents: "none",
        }}>
          {group.trees.map((h, i) => (
            <div key={i} style={{
              width: 36, height: h,
              background: "#1a3a1a",
              clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
              opacity: 0.88,
            }} />
          ))}
        </div>
      ))}

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          width: 490,
          background: "rgba(0,0,0,0.84)",
          border: "2px solid #555",
          boxShadow: "inset 1px 1px 0 #777, inset -1px -1px 0 #222, 0 12px 40px rgba(0,0,0,0.65)",
          padding: "30px 34px 26px",
          position: "relative", zIndex: 10,
        }}
      >
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "18px", color: "#55ff55", textShadow: "2px 2px 0 #004400, 3px 3px 0 rgba(0,0,0,0.6)", letterSpacing: "2px", lineHeight: 1.5, marginBottom: 8 }}>
            NOTION BRAIN
          </div>
          <div style={{ fontSize: "7px", color: "#aaa", textShadow: "1px 1px 0 #000", letterSpacing: "1.5px" }}>
            Knowledge Graph Universe
          </div>
        </div>

        {/* How-to */}
        <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid #3a3a3a", boxShadow: "inset 1px 1px 0 #222", padding: "12px 14px", marginBottom: 18 }}>
          <div style={{ fontSize: "7px", color: "#555", textShadow: "1px 1px 0 #000", marginBottom: 10, letterSpacing: "0.5px" }}>HOW TO CONNECT:</div>
          {[
            "1. Go to notion.so/my-integrations",
            "2. Create a new integration",
            "3. Copy your Integration Token",
            "4. Share your pages with the integration",
          ].map((s, i) => (
            <div key={i} style={{ fontSize: "7px", color: "#ccc", textShadow: "1px 1px 0 #000", lineHeight: 2.3, letterSpacing: "0.3px" }}>{s}</div>
          ))}
        </div>

        {/* Label */}
        <div style={{ fontSize: "7px", color: "#888", textShadow: "1px 1px 0 #000", marginBottom: 8, letterSpacing: "0.5px" }}>
          NOTION INTEGRATION TOKEN:
        </div>

        {/* Input */}
        <div style={{
          background: "#111",
          border: `2px solid ${focused ? "#55ff55" : "#333"}`,
          boxShadow: "inset 2px 2px 0 #0a0a0a",
          marginBottom: error ? 8 : 14,
          transition: "border-color 0.1s",
        }}>
          <input
            value={token}
            onChange={e => setToken(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => e.key === "Enter" && handleConnect()}
            placeholder="secret_xxxxxxxxxxxx..."
            type="password"
            style={{
              width: "100%", background: "none", border: "none", outline: "none",
              padding: "10px 12px", color: "#e0e0e0",
              fontFamily: "'Press Start 2P', monospace",
              fontSize: "9px", letterSpacing: "1px", caretColor: "#55ff55",
            }}
          />
        </div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ fontSize: "7px", color: "#ff5555", textShadow: "1px 1px 0 #000", marginBottom: 10, letterSpacing: "0.5px" }}>
            ⚠ {error}
          </motion.div>
        )}

        <MCButton onClick={handleConnect} disabled={loading} variant="green"
          style={{ width: "100%", fontSize: "10px", padding: "12px 20px", marginBottom: 8 }}>
          {loading ? "CONNECTING..." : "CONNECT WORKSPACE"}
        </MCButton>

        <MCButton onClick={() => onSubmit("DEMO")}
          style={{ width: "100%", fontSize: "8px", padding: "9px 20px" }}>
          TRY DEMO WORLD
        </MCButton>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: "6px", color: "#3a3a3a", textShadow: "1px 1px 0 #000", lineHeight: 2 }}>
          Token sent only to your local backend · never to third parties
        </div>
      </motion.div>

      <div style={{
        position: "absolute", bottom: 10,
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "7px", color: "rgba(255,255,255,0.22)", textShadow: "1px 1px 0 #000", letterSpacing: "1px",
      }}>
        v0.2.0 · React Three Fiber
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────
function MCLoadingScreen() {
  const [progress,  setProgress]  = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);
  const statuses = [
    "Authenticating...",
    "Scanning workspace...",
    "Fetching page graph...",
    "Building AI clusters...",
    "Generating world chunks...",
    "Placing node blocks...",
    "Almost ready...",
  ];

  useEffect(() => {
    const iv = setInterval(() => {
      setProgress(p => {
        const next = Math.min(p + 10 + Math.random() * 8, 95);
        setStatusIdx(Math.min(Math.floor((next / 100) * statuses.length), statuses.length - 1));
        return next;
      });
    }, 420);
    return () => clearInterval(iv);
  }, []);

  const COLS  = 16;
  const ROWS  = 5;
  const total = COLS * ROWS;
  const filled = Math.floor((progress / 100) * total);
  const blockColors = [MC.snow, "#7b7b7b", MC.dirt, MC.ice, "#c09a5a", MC.spruceLeaf];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, background: "#1a1a1a",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Press Start 2P', monospace", zIndex: 200,
      }}
    >
      <div style={{ fontSize: "12px", color: "#55ff55", textShadow: "2px 2px 0 #004400", letterSpacing: "2px", marginBottom: 30 }}>
        BUILDING YOUR WORLD
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 26px)`, gap: 2, marginBottom: 28 }}>
        {Array.from({ length: total }, (_, i) => {
          const on    = i < filled;
          const color = blockColors[i % blockColors.length];
          return (
            <motion.div key={i}
              initial={{ scale: 0 }}
              animate={{ scale: on ? 1 : 0.1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              style={{
                width: 26, height: 26,
                background: on ? color : "#2a2a2a",
                border: on ? "1px solid rgba(0,0,0,0.4)" : "1px solid #222",
                borderTop: on ? "1px solid rgba(255,255,255,0.2)" : "1px solid #222",
              }}
            />
          );
        })}
      </div>

      <div style={{ fontSize: "8px", color: "#aaa", textShadow: "1px 1px 0 #000", marginBottom: 18, letterSpacing: "1px", minHeight: 18 }}>
        {statuses[statusIdx]}
      </div>

      <div style={{ width: 360, background: "#2a2a2a", border: "2px solid #555", boxShadow: "inset 1px 1px 0 #222", height: 22, overflow: "hidden" }}>
        <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }}
          style={{ height: "100%", background: "#55ff55", borderRight: "2px solid #88ff88" }} />
      </div>
      <div style={{ fontSize: "7px", color: "#444", textShadow: "1px 1px 0 #000", marginTop: 8, letterSpacing: "1px" }}>
        {Math.floor(progress)}%
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// NODE PANEL
// ─────────────────────────────────────────
function NodePanel({ node, onClose, graphData, notionToken }) {
  const [content,        setContent]        = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const colors = MC.clusters[(node?.cluster || 0) % MC.clusters.length];

  useEffect(() => {
    if (!node) return;
    setContent(null);
    setLoadingContent(true);
    const qs  = notionToken ? `?token=${encodeURIComponent(notionToken)}` : "";
    fetch(`${API_BASE}/api/page/${node.id}${qs}`)
      .then(r => r.json())
      .then(d => { setContent(d.content || null); setLoadingContent(false); })
      .catch(() => setLoadingContent(false));
  }, [node?.id, notionToken]);

  const connections = useMemo(() => {
    if (!node || !graphData?.links) return [];
    const nm = {};
    graphData.nodes.forEach(n => (nm[n.id] = n));
    return graphData.links
      .filter(l => l.source === node.id || l.target === node.id)
      .map(l => nm[l.source === node.id ? l.target : l.source])
      .filter(Boolean);
  }, [node, graphData]);

  if (!node) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={node.id}
        initial={{ x: "110%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "110%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        style={{
          position: "fixed", right: 0, top: 52, bottom: 0, width: 296,
          background: "rgba(0,0,0,0.92)",
          border: "2px solid #555", borderRight: "none",
          boxShadow: "inset 1px 0 0 #777, inset 0 1px 0 #777, -4px 0 16px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column",
          overflow: "hidden", zIndex: 90,
          fontFamily: "'Press Start 2P', monospace",
        }}
      >
        {/* Header */}
        <div style={{
          background: colors.dark, borderBottom: "2px solid #333",
          padding: "12px 14px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "8px", color: "#e0e0e0", textShadow: "1px 1px 0 #000", letterSpacing: "1px" }}>NODE INFO</span>
          <div onClick={onClose} style={{
            width: 20, height: 20, background: "#7b7b7b",
            border: "2px solid #a0a0a0", borderRight: "2px solid #333", borderBottom: "2px solid #333",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "10px", color: "#fff", textShadow: "1px 1px 0 #000",
          }}>×</div>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "14px 14px 0" }}>
          {/* Title */}
          <div style={{ background: "#1a1a1a", border: "2px solid #333", boxShadow: "inset 1px 1px 0 #111", padding: "10px 12px", marginBottom: 14 }}>
            <div style={{ fontSize: "7px", color: "#555", marginBottom: 6, letterSpacing: "0.5px" }}>SELECTED PAGE</div>
            <div style={{ fontSize: "9px", color: "#ffffa0", textShadow: "1px 1px 0 #000", wordBreak: "break-word", lineHeight: 1.8 }}>
              {node.label || "UNTITLED"}
            </div>
          </div>

          {/* Cluster */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
            <div style={{ width: 14, height: 14, background: colors.base, border: "1px solid rgba(0,0,0,0.4)", flexShrink: 0 }} />
            <span style={{ fontSize: "7px", color: "#888", textShadow: "1px 1px 0 #000" }}>{colors.name} cluster</span>
          </div>

          {/* Content preview */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: "7px", color: "#555", marginBottom: 6, letterSpacing: "0.5px" }}>PAGE CONTENT:</div>
            <div style={{ background: "#111", border: "2px solid #2a2a2a", boxShadow: "inset 1px 1px 0 #0a0a0a", padding: "10px", minHeight: 60, maxHeight: 110, overflow: "auto" }}>
              {loadingContent ? (
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <motion.div key={i}
                      animate={{ scaleY: [1, 2.5, 1] }}
                      transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.7 }}
                      style={{ width: 4, height: 14, background: "#5aaa5a", transformOrigin: "bottom" }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "7px", color: "#aaa", textShadow: "1px 1px 0 #000", lineHeight: 2, wordBreak: "break-word" }}>
                  {content || "No preview available."}
                </div>
              )}
            </div>
          </div>

          {/* Connections */}
          {connections.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: "7px", color: "#555", marginBottom: 8, letterSpacing: "0.5px" }}>CONNECTED ({connections.length}):</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {connections.map(c => {
                  const cc = MC.clusters[(c.cluster || 0) % MC.clusters.length];
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#1a1a1a", border: "1px solid #2a2a2a", padding: "6px 8px" }}>
                      <div style={{ width: 10, height: 10, background: cc.base, border: "1px solid rgba(0,0,0,0.4)", flexShrink: 0 }} />
                      <span style={{ fontSize: "7px", color: "#ccc", textShadow: "1px 1px 0 #000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.label || c.id}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div style={{ marginBottom: 14 }}>
            {[
              ["TYPE", node.semantic ? "SEMANTIC" : "DIRECT"],
              ["ID",   (node.id || "").slice(0, 12) + "…"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #222", padding: "6px 0" }}>
                <span style={{ fontSize: "7px", color: "#444", textShadow: "1px 1px 0 #000" }}>{k}</span>
                <span style={{ fontSize: "7px", color: "#666", textShadow: "1px 1px 0 #000", fontFamily: "monospace" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {node.url && (
          <div style={{ padding: "12px 14px", borderTop: "2px solid #333", flexShrink: 0 }}>
            <a href={node.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <MCButton variant="green" style={{ width: "100%", fontSize: "8px", padding: "10px" }}>
                OPEN IN NOTION
              </MCButton>
            </a>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────
function WorldNavbar({ graphData, onSearch, onBack }) {
  const [searchVal, setSearchVal] = useState("");
  const [focused,   setFocused]   = useState(false);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, height: 52,
      background: "rgba(0,0,0,0.9)",
      borderBottom: "2px solid #555",
      boxShadow: "inset 0 -1px 0 #222, 0 2px 8px rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 18px", zIndex: 100,
      fontFamily: "'Press Start 2P', monospace",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, background: MC.snow, border: "2px solid #333", borderTop: "2px solid rgba(255,255,255,0.4)", boxShadow: "2px 2px 0 #1a1a1a", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: "9px", color: "#55ff55", textShadow: "1px 1px 0 #004400", letterSpacing: "1.5px", lineHeight: 1 }}>NOTION BRAIN</div>
          <div style={{ fontSize: "6px", color: "#333", textShadow: "1px 1px 0 #000", letterSpacing: "1px", marginTop: 4 }}>KNOWLEDGE UNIVERSE</div>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "#111",
        border: `2px solid ${focused ? "#55ff55" : "#333"}`,
        boxShadow: "inset 1px 1px 0 #0a0a0a",
        padding: "0 10px", height: 32, width: 220,
        transition: "border-color 0.1s",
      }}>
        <span style={{ fontSize: "10px", color: "#333" }}>🔍</span>
        <input
          value={searchVal}
          onChange={e => { setSearchVal(e.target.value); onSearch(e.target.value); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search nodes..."
          style={{
            background: "none", border: "none", outline: "none",
            color: "#e0e0e0",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "7px", width: "100%", caretColor: "#55ff55",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: "7px", color: "#333", textShadow: "1px 1px 0 #000", letterSpacing: "0.5px" }}>
          <span style={{ color: "#5aaa5a" }}>{graphData?.nodes?.length || 0}</span>{" nodes · "}
          <span style={{ color: "#cc7700" }}>{graphData?.links?.length || 0}</span>{" edges"}
        </div>
        <MCButton onClick={onBack} style={{ fontSize: "7px", padding: "6px 12px" }}>NEW URL</MCButton>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────
// LEGEND
// ─────────────────────────────────────────
function WorldLegend({ graphData }) {
  const present = useMemo(() => {
    const seen = new Set();
    (graphData?.nodes || []).forEach(n => seen.add(n.cluster || 0));
    return MC.clusters.filter((_, i) => seen.has(i));
  }, [graphData]);

  return (
    <motion.div
      initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 2.8 }}
      style={{
        position: "fixed", bottom: 20, left: 16, zIndex: 80,
        background: "rgba(0,0,0,0.9)",
        border: "2px solid #555",
        boxShadow: "inset 1px 1px 0 #777, inset -1px -1px 0 #222",
        padding: "10px 14px",
        fontFamily: "'Press Start 2P', monospace",
      }}
    >
      <div style={{ fontSize: "6px", color: "#333", textShadow: "1px 1px 0 #000", marginBottom: 8, letterSpacing: "0.5px" }}>CLUSTERS:</div>
      {present.map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <div style={{ width: 12, height: 12, background: c.base, border: "1px solid rgba(0,0,0,0.4)", borderTop: "1px solid rgba(255,255,255,0.18)" }} />
          <span style={{ fontSize: "6px", color: "#aaa", textShadow: "1px 1px 0 #000" }}>{c.name}</span>
        </div>
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────
export default function App() {
  const [phase,          setPhase]          = useState("landing");
  const [graphData,      setGraphData]      = useState({ nodes: [], links: [] });
  const [selectedNode,   setSelectedNode]   = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [apiError,       setApiError]       = useState("");
  const [notionToken,    setNotionToken]    = useState("");

  const DEMO_DATA = {
    nodes: [
      { id: "pg-001", label: "Machine Learning",  position: [ 0,  0,  0], cluster: 0 },
      { id: "pg-002", label: "Neural Networks",   position: [ 9,  3, -2], cluster: 0 },
      { id: "pg-003", label: "Python Tools",      position: [-8,  2,  6], cluster: 1 },
      { id: "pg-004", label: "Project Ideas",     position: [-5, -3, -7], cluster: 2 },
      { id: "pg-005", label: "Data Science",      position: [ 5, -5, -8], cluster: 3 },
      { id: "pg-006", label: "Deep Learning",     position: [14, -1,  5], cluster: 0 },
      { id: "pg-007", label: "Research Notes",    position: [-12, 4, -4], cluster: 4 },
      { id: "pg-008", label: "Reading List",      position: [  3, 6,  9], cluster: 1 },
    ],
    links: [
      { source: "pg-001", target: "pg-002" },
      { source: "pg-002", target: "pg-006" },
      { source: "pg-001", target: "pg-003" },
      { source: "pg-003", target: "pg-004" },
      { source: "pg-001", target: "pg-005" },
      { source: "pg-005", target: "pg-007" },
      { source: "pg-003", target: "pg-008" },
    ],
  };

  const handleSubmit = useCallback(async (tokenOrDemo) => {
    setPhase("loading");
    setApiError("");

    if (tokenOrDemo === "DEMO") {
      setTimeout(() => { setGraphData(DEMO_DATA); setPhase("world"); }, 3800);
      return;
    }

    setNotionToken(tokenOrDemo);

    try {
      // ✅ Exact payload the new backend expects: { "token": "secret_..." }
      const res = await fetch(`${API_BASE}/api/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenOrDemo }),
      });

      if (res.status === 401) {
        throw new Error("Invalid Notion token — make sure it starts with secret_ and the integration has access to your pages");
      }
      if (res.status === 400) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Bad request — check token format");
      }
      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const data  = await res.json();
      const nodes = (data.nodes || []).map((n, i) => ({
        ...n,
        position: n.position || [
          Math.cos(i * 2.4) * (8 + i * 2.2),
          Math.sin(i * 1.8) * 4,
          Math.sin(i * 2.4) * (8 + i * 2.2),
        ],
        cluster: n.cluster ?? (i % MC.clusters.length),
      }));
      setGraphData({ nodes, links: data.links || [] });
      setTimeout(() => setPhase("world"), 4000);
    } catch (err) {
      setApiError(err.message);
      setGraphData(DEMO_DATA);
      setTimeout(() => setPhase("world"), 4000);
    }
  }, []);

  const handleSearch = useCallback((q) => {
    if (!q.trim()) { setHighlightNodes(new Set()); return; }
    const matched = new Set(
      (graphData.nodes || [])
        .filter(n => (n.label || n.id).toLowerCase().includes(q.toLowerCase()))
        .map(n => n.id)
    );
    setHighlightNodes(matched);
  }, [graphData.nodes]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; background: #1a1a1a; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1a1a1a; }
        ::-webkit-scrollbar-thumb { background: #444; border: 1px solid #222; }
      `}</style>

      <AnimatePresence>
        {phase === "landing" && (
          <motion.div key="landing" exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <LandingPage onSubmit={handleSubmit} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "loading" && <MCLoadingScreen key="loading" />}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "world" && (
          <motion.div
            key="world"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.0 }}
            style={{ width: "100vw", height: "100vh", position: "relative" }}
          >
            <Canvas
              camera={{ position: [2, 18, 42], fov: 55 }}
              gl={{
                antialias: true,
                powerPreference: "high-performance",
                preserveDrawingBuffer: false,
              }}
              dpr={[1, 1.5]}
              style={{ width: "100vw", height: "100vh" }}
              onPointerMissed={() => setSelectedNode(null)}
            >
              <Suspense fallback={null}>
                <GraphScene
                  graphData={graphData}
                  selectedNode={selectedNode}
                  onNodeClick={handleNodeClick}
                  highlightNodes={highlightNodes}
                />
              </Suspense>
            </Canvas>

            <WorldNavbar
              graphData={graphData}
              onSearch={handleSearch}
              onBack={() => { setPhase("landing"); setSelectedNode(null); setNotionToken(""); }}
            />

            <WorldLegend graphData={graphData} />

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3 }}
              style={{
                position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
                zIndex: 80, pointerEvents: "none",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: "6px", color: "rgba(255,255,255,0.15)",
                textShadow: "1px 1px 0 #000", letterSpacing: "1px",
              }}
            >
              DRAG TO ORBIT · SCROLL TO ZOOM · CLICK NODE TO INSPECT
            </motion.div>

            {apiError && (
              <motion.div
                initial={{ y: -30 }} animate={{ y: 0 }}
                style={{
                  position: "fixed", top: 58, left: "50%", transform: "translateX(-50%)",
                  zIndex: 110,
                  background: "rgba(0,0,0,0.92)",
                  border: "2px solid #aa2222",
                  boxShadow: "inset 1px 1px 0 #cc4444",
                  padding: "8px 18px",
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: "7px", color: "#ff5555",
                  textShadow: "1px 1px 0 #000", letterSpacing: "0.5px",
                  maxWidth: "70vw", textAlign: "center",
                }}
              >
                ⚠ {apiError}
              </motion.div>
            )}

            <AnimatePresence>
              {selectedNode && (
                <NodePanel
                  key={selectedNode.id}
                  node={selectedNode}
                  onClose={() => setSelectedNode(null)}
                  graphData={graphData}
                  notionToken={notionToken}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}