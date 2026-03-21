import React, {
  useRef, useEffect, useState, useCallback, useMemo, Suspense,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Html, Stars, Float } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────
// CHERRY BLOSSOM PALETTE
// ─────────────────────────────────────────
const P = {
  sky:       "#ffb7c5",   // sakura pink sky
  skyDeep:   "#f4845f",   // warm sunset orange
  ground:    "#7ec850",   // minecraft grass green
  groundSide:"#8b5e3c",   // dirt brown
  sakura1:   "#ffb7c5",   // light pink
  sakura2:   "#ff8fab",   // medium pink
  sakura3:   "#f06292",   // deep pink
  gold:      "#ffd166",   // warm gold
  teal:      "#06d6a0",   // teal accent
  water:     "#48cae4",   // river blue
  wood:      "#8b5e3c",   // trunk brown
  leaf:      "#7ec850",   // leaf green
  white:     "#fff9f9",   // warm white
  ui:        "rgba(20,8,12,0.82)",
  uiBorder:  "rgba(255,183,197,0.35)",
  textPrimary: "#fff5f7",
  textMuted:  "rgba(255,220,228,0.55)",
};

// Cluster colors — cherry blossom biome palette
const CLUSTER_COLORS = [
  { base: "#ff8fab", emissive: "#c2185b", glow: "#ffb7c5", name: "Knowledge" },
  { base: "#7ec850", emissive: "#2e7d32", glow: "#a5d6a7", name: "Tools" },
  { base: "#ffd166", emissive: "#f57f17", glow: "#ffe082", name: "Ideas" },
  { base: "#48cae4", emissive: "#006064", glow: "#80deea", name: "Research" },
  { base: "#ce93d8", emissive: "#6a1b9a", glow: "#e1bee7", name: "Projects" },
];

// ─────────────────────────────────────────
// VOXEL POSITION GENERATOR (BFS cluster)
// ─────────────────────────────────────────
function generateVoxelPositions(count = 12, seed = 0) {
  const visited = new Set();
  const positions = [];
  const queue = [[0, 0, 0]];
  visited.add("0,0,0");
  positions.push([0, 0, 0]);
  const rng = (n) => ((Math.sin(n * 127.1 + seed * 311.7) * 43758.5453) % 1 + 1) % 1;
  const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  let i = 0;
  while (positions.length < count && queue.length > 0) {
    const idx = Math.floor(rng(i++) * queue.length);
    const [cx, cy, cz] = queue.splice(idx, 1)[0];
    const shuffled = [...dirs].sort(() => rng(i++) - 0.5);
    for (const [dx, dy, dz] of shuffled) {
      if (positions.length >= count) break;
      const nx = cx+dx, ny = cy+dy, nz = cz+dz;
      const key = `${nx},${ny},${nz}`;
      if (!visited.has(key) && rng(i++) > 0.3) {
        visited.add(key);
        positions.push([nx, ny, nz]);
        queue.push([nx, ny, nz]);
      }
    }
  }
  return positions;
}

// ─────────────────────────────────────────
// COMPONENT: Cherry Blossom Petal Particle
// ─────────────────────────────────────────
function BlossomParticles() {
  const meshRef = useRef();
  const count = 180;

  const { positions, speeds, offsets } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    const off = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i*3]   = (Math.random() - 0.5) * 120;
      pos[i*3+1] = (Math.random() - 0.5) * 50 + 5;
      pos[i*3+2] = (Math.random() - 0.5) * 120;
      spd[i] = 0.01 + Math.random() * 0.02;
      off[i] = Math.random() * Math.PI * 2;
    }
    return { positions: pos, speeds: spd, offsets: off };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const pos = meshRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i*3]   += Math.sin(t * 0.3 + offsets[i]) * 0.015;
      pos[i*3+1] -= spd[i];
      pos[i*3+2] += Math.cos(t * 0.2 + offsets[i]) * 0.01;
      if (pos[i*3+1] < -25) {
        pos[i*3+1] = 25;
        pos[i*3]   = (Math.random() - 0.5) * 120;
        pos[i*3+2] = (Math.random() - 0.5) * 120;
      }
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.28} color="#ffb7c5" transparent opacity={0.75} depthWrite={false} sizeAttenuation />
    </points>
  );
}

// ─────────────────────────────────────────
// COMPONENT: Voxel Terrain (Ground tiles)
// ─────────────────────────────────────────
function VoxelTerrain() {
  const tiles = useMemo(() => {
    const t = [];
    const size = 14;
    for (let x = -size; x <= size; x++) {
      for (let z = -size; z <= size; z++) {
        const dist = Math.sqrt(x*x + z*z);
        if (dist > size) continue;
        const h = Math.floor(Math.sin(x*0.4)*0.8 + Math.cos(z*0.4)*0.8);
        const isGrass = (Math.sin(x*7.3 + z*3.1) > 0.3);
        t.push({ x, z, h, isGrass });
      }
    }
    return t;
  }, []);

  return (
    <group position={[0, -10, 0]}>
      {tiles.map(({ x, z, h, isGrass }, i) => (
        <group key={i} position={[x * 2.2, h * 0.4, z * 2.2]}>
          {/* Grass top */}
          <mesh>
            <boxGeometry args={[2.1, 0.9, 2.1]} />
            <meshStandardMaterial color={isGrass ? "#7ec850" : "#5a9e35"} roughness={0.9} />
          </mesh>
          {/* Dirt side */}
          <mesh position={[0, -0.7, 0]}>
            <boxGeometry args={[2.1, 0.5, 2.1]} />
            <meshStandardMaterial color="#8b5e3c" roughness={0.95} />
          </mesh>
          {/* Occasional flower */}
          {isGrass && (Math.sin(x * 13.7 + z * 7.3) > 0.6) && (
            <mesh position={[0, 0.7, 0]} scale={[0.3, 0.5, 0.3]}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#ff8fab" emissive="#ff4081" emissiveIntensity={0.3} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────
// COMPONENT: Sakura Tree decoration
// ─────────────────────────────────────────
function SakuraTree({ position }) {
  return (
    <group position={position}>
      {/* Trunk */}
      {[0,1,2,3].map(i => (
        <mesh key={i} position={[0, i * 0.9 - 8, 0]}>
          <boxGeometry args={[0.7, 0.85, 0.7]} />
          <meshStandardMaterial color="#6d4c41" roughness={0.9} />
        </mesh>
      ))}
      {/* Blossom cloud — multiple pink cubes */}
      {[
        [0,0.5,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],
        [1,0.5,1],[-1,0.5,-1],[0,1,0],[1,0.3,-1],[-1,0.3,1],
        [0.5,1,0.5],[-0.5,1,-0.5],[0,1.5,0],
      ].map(([x,y,z], i) => (
        <mesh key={i} position={[x, y * 1.1 - 4.5, z]}>
          <boxGeometry args={[1.1, 1.0, 1.1]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? "#ffb7c5" : i % 3 === 1 ? "#ff8fab" : "#f8bbd0"}
            emissive="#ff4081"
            emissiveIntensity={0.15}
            roughness={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────
// COMPONENT: NodeCluster (voxel assembly)
// ─────────────────────────────────────────
function NodeCluster({ node, isSelected, isHighlighted, onNodeClick, assemblyDelay = 0 }) {
  const groupRef = useRef();
  const blockRefs = useRef([]);
  const [assembled, setAssembled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const BLOCK_COUNT = 16;

  const colors = CLUSTER_COLORS[(node.cluster || 0) % CLUSTER_COLORS.length];
  const finalPositions = useMemo(() =>
    generateVoxelPositions(BLOCK_COUNT, (node.id || "").split("").reduce((a,c) => a + c.charCodeAt(0), 0)),
    [node.id]
  );

  const spawnPositions = useMemo(() =>
    finalPositions.map((_, i) => {
      const rng = (n) => ((Math.sin((i+1)*127.1 + n*311.7)*43758.5453)%1+1)%1;
      const radius = 40 + rng(i) * 60;
      const theta = rng(i+1) * Math.PI * 2;
      const phi = (rng(i+2) - 0.5) * Math.PI;
      return [
        Math.cos(theta)*Math.cos(phi)*radius,
        Math.sin(phi)*radius,
        Math.sin(theta)*Math.cos(phi)*radius,
      ];
    }),
    [finalPositions]
  );

  useEffect(() => {
    if (!blockRefs.current.length) return;
    const tl = gsap.timeline({ delay: assemblyDelay });
    blockRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      mesh.position.set(...spawnPositions[i]);
      mesh.scale.setScalar(0.05);
      if (mesh.material) { mesh.material.opacity = 0; mesh.material.transparent = true; }
      const [fx, fy, fz] = finalPositions[i];
      const stagger = i * 0.055 + Math.random() * 0.07;
      tl.to(mesh.position, { x: fx, y: fy, z: fz, duration: 1.0, ease: "power3.out" }, stagger);
      tl.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.65, ease: "back.out(1.8)" }, stagger);
      tl.to(mesh.material, { opacity: 1, duration: 0.35 }, stagger);
    });
    tl.call(() => setAssembled(true));
    return () => tl.kill();
  }, [assemblyDelay, finalPositions, spawnPositions]);

  useEffect(() => {
    if (!groupRef.current) return;
    const s = isSelected ? 1.4 : hovered ? 1.18 : 1.0;
    gsap.to(groupRef.current.scale, { x: s, y: s, z: s, duration: 0.35, ease: "back.out(2)" });
  }, [isSelected, hovered]);

  useFrame((state) => {
    if (!groupRef.current || !assembled) return;
    const t = state.clock.elapsedTime;
    const seed = (node.id || "").charCodeAt(0) || 42;
    groupRef.current.position.y = (node.position?.[1] || 0) + Math.sin(t * 0.55 + seed * 0.4) * 0.22;
    groupRef.current.rotation.y = Math.sin(t * 0.22 + seed * 0.25) * 0.07;
  });

  const pos = node.position || [0, 0, 0];

  return (
    <group
      ref={groupRef}
      position={[pos[0], pos[1], pos[2]]}
      onClick={(e) => { e.stopPropagation(); onNodeClick(node); }}
      onPointerEnter={() => { setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerLeave={() => { setHovered(false); document.body.style.cursor = "default"; }}
    >
      {finalPositions.map((_, i) => (
        <mesh key={i} ref={(el) => (blockRefs.current[i] = el)} position={[0,0,0]}>
          <boxGeometry args={[0.88, 0.88, 0.88]} />
          <meshStandardMaterial
            color={isSelected ? "#fff5f7" : isHighlighted ? colors.glow : colors.base}
            emissive={colors.emissive}
            emissiveIntensity={isSelected ? 2.0 : isHighlighted ? 1.2 : hovered ? 0.8 : 0.3}
            roughness={0.38}
            metalness={0.22}
            transparent opacity={1}
          />
        </mesh>
      ))}

      {/* Glow orb */}
      {assembled && (
        <mesh>
          <sphereGeometry args={[2.4, 16, 16]} />
          <meshBasicMaterial
            color={colors.glow}
            transparent
            opacity={isSelected ? 0.22 : hovered ? 0.14 : 0.05}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Label */}
      <Html center position={[0, 3.4, 0]} style={{ pointerEvents: "none", transition: "all 0.2s",
        opacity: (hovered || isSelected || isHighlighted) ? 1 : 0,
        transform: `scale(${(hovered || isSelected || isHighlighted) ? 1 : 0.85})`,
      }}>
        <div style={{
          background: P.ui,
          border: `1px solid ${colors.glow}66`,
          borderRadius: "4px",
          padding: "5px 13px",
          whiteSpace: "nowrap",
          fontFamily: "'Fredoka One', 'Segoe UI', sans-serif",
          fontSize: "12px",
          letterSpacing: "1px",
          color: colors.glow,
          boxShadow: `0 0 16px ${colors.glow}55, 0 2px 8px rgba(0,0,0,0.4)`,
        }}>
          {node.label || node.id}
        </div>
      </Html>
    </group>
  );
}

// ─────────────────────────────────────────
// COMPONENT: Edge lines
// ─────────────────────────────────────────
function EdgeLines({ links, nodesMap, visible }) {
  const [progresses, setProgresses] = useState({});

  useEffect(() => {
    if (!visible) return;
    links.forEach((link, i) => {
      const obj = { v: 0 };
      gsap.to(obj, {
        v: 1, duration: 1.3, delay: 0.4 + i * 0.08, ease: "power2.out",
        onUpdate() { setProgresses(p => ({ ...p, [i]: obj.v })); },
      });
    });
  }, [visible, links]);

  return (
    <>
      {links.map((link, i) => {
        const src = nodesMap[link.source];
        const tgt = nodesMap[link.target];
        if (!src || !tgt) return null;
        const prog = progresses[i] || 0;
        if (prog < 0.01) return null;
        const sp = src.position || [0,0,0];
        const ep = tgt.position || [0,0,0];
        const end = [
          sp[0] + (ep[0]-sp[0])*prog,
          sp[1] + (ep[1]-sp[1])*prog,
          sp[2] + (ep[2]-sp[2])*prog,
        ];
        return (
          <Line
            key={i}
            points={[new THREE.Vector3(...sp), new THREE.Vector3(...end)]}
            color="#ffb7c5"
            lineWidth={1.4}
            transparent
            opacity={0.5 * prog}
          />
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────
// COMPONENT: Camera controller
// ─────────────────────────────────────────
function CameraController({ phase, selectedNode }) {
  const { camera } = useThree();
  const controlsRef = useRef();

  useEffect(() => {
    if (phase === "loading") {
      camera.position.set(0, 80, 0);
      camera.lookAt(0, 0, 0);
      gsap.to(camera.position, { x: 5, y: 32, z: 58, duration: 4, ease: "power3.inOut" });
    }
    if (phase === "world") {
      gsap.to(camera.position, { x: 5, y: 22, z: 50, duration: 2.5, ease: "power2.inOut" });
    }
  }, [phase, camera]);

  useEffect(() => {
    if (!selectedNode || !selectedNode.position) return;
    const [nx, ny, nz] = selectedNode.position;
    gsap.to(camera.position, {
      x: nx + 8, y: ny + 10, z: nz + 18,
      duration: 1.6, ease: "power2.inOut",
    });
  }, [selectedNode, camera]);

  return <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate
    minDistance={6} maxDistance={100} zoomSpeed={0.7} rotateSpeed={0.5} />;
}

// ─────────────────────────────────────────
// COMPONENT: Ambient light shaft
// ─────────────────────────────────────────
function GoldenSunRay() {
  const meshRef = useRef();
  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.material.opacity = 0.03 + Math.sin(state.clock.elapsedTime * 0.4) * 0.01;
  });
  return (
    <mesh ref={meshRef} position={[20, 20, -30]} rotation={[0.4, -0.5, 0.2]}>
      <cylinderGeometry args={[0.1, 18, 60, 8]} />
      <meshBasicMaterial color="#ffd166" transparent opacity={0.04} depthWrite={false} />
    </mesh>
  );
}

// ─────────────────────────────────────────
// COMPONENT: 3D Graph Scene
// ─────────────────────────────────────────
function GraphScene({ graphData, selectedNode, onNodeClick, highlightNodes, phase }) {
  const nodesMap = useMemo(() => {
    const m = {};
    (graphData.nodes || []).forEach(n => (m[n.id] = n));
    return m;
  }, [graphData.nodes]);

  const [edgesVisible, setEdgesVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setEdgesVisible(true), 2500);
    return () => clearTimeout(t);
  }, [graphData]);

  const treePositions = [
    [-25, 0, -20], [22, 0, -18], [-18, 0, 22], [26, 0, 14],
    [-28, 0, 5], [8, 0, -28], [30, 0, -5],
  ];

  return (
    <>
      {/* Lighting — golden hour */}
      <ambientLight intensity={0.55} color="#fff0e6" />
      <directionalLight position={[30, 40, 20]} intensity={1.4} color="#ffd166" castShadow />
      <directionalLight position={[-20, 10, -20]} intensity={0.5} color="#ffb7c5" />
      <pointLight position={[0, 15, 0]} intensity={0.8} color="#ff8fab" distance={90} />
      <hemisphereLight skyColor="#ffb7c5" groundColor="#7ec850" intensity={0.6} />

      {/* Skybox fog */}
      <fog attach="fog" args={["#ffccd5", 60, 150]} />

      {/* Scene decorations */}
      <VoxelTerrain />
      {treePositions.map((pos, i) => <SakuraTree key={i} position={pos} />)}
      <GoldenSunRay />
      <BlossomParticles />

      {/* Camera */}
      <CameraController phase={phase} selectedNode={selectedNode} />

      {/* Nodes */}
      {(graphData.nodes || []).map((node, i) => (
        <NodeCluster
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          isHighlighted={highlightNodes.has(node.id)}
          onNodeClick={onNodeClick}
          assemblyDelay={i * 0.2 + 0.5}
        />
      ))}

      {/* Edges */}
      <EdgeLines links={graphData.links || []} nodesMap={nodesMap} visible={edgesVisible} />
    </>
  );
}

// ─────────────────────────────────────────
// COMPONENT: Landing Page
// ─────────────────────────────────────────
function LandingPage({ onSubmit, isLoading }) {
  const [url, setUrl] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!url.trim()) { setError("Please paste a Notion page URL"); return; }
    if (!url.includes("notion")) { setError("URL must be a Notion page link"); return; }
    setError("");
    onSubmit(url.trim());
  };

  // Floating voxels behind
  const bgVoxels = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 12 + Math.random() * 28,
    color: [P.sakura1, P.sakura2, P.gold, P.teal, P.leaf, P.water][i % 6],
    delay: Math.random() * 4,
    dur: 4 + Math.random() * 4,
  })), []);

  return (
    <div style={{
      width: "100vw", height: "100vh", overflow: "hidden", position: "relative",
      background: `linear-gradient(160deg, #ffe4ec 0%, #ffd0bb 40%, #ffe8a3 70%, #d4f0c0 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Fredoka One', cursive",
    }}>
      {/* Animated voxels background */}
      {bgVoxels.map(v => (
        <motion.div key={v.id}
          animate={{ y: [0, -18, 0], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: v.dur, delay: v.delay, ease: "easeInOut" }}
          style={{
            position: "absolute", left: `${v.x}%`, top: `${v.y}%`,
            width: v.size, height: v.size,
            background: v.color,
            borderRadius: 3,
            opacity: 0.35,
            boxShadow: `0 4px 12px ${v.color}66`,
            transform: "translateZ(0)",
          }}
        />
      ))}

      {/* Pixel noise overlay */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
        opacity: 0.5,
      }} />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        style={{ textAlign: "center", zIndex: 10, maxWidth: 680, padding: "0 24px" }}
      >
        {/* Badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.5)",
            border: "2px solid rgba(255,143,171,0.5)",
            borderRadius: "100px",
            padding: "6px 18px", marginBottom: 28,
            backdropFilter: "blur(8px)",
            fontSize: 13, color: "#c2185b",
            letterSpacing: "1px",
          }}
        >
          <span style={{ fontSize: 16 }}>🌸</span>
          AI · NOTION · KNOWLEDGE GRAPH
          <span style={{ fontSize: 16 }}>⛏️</span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{
            fontSize: "clamp(36px, 5vw, 62px)",
            fontWeight: 900,
            lineHeight: 1.1,
            marginBottom: 18,
            color: "#3b1a24",
            fontFamily: "'Fredoka One', cursive",
            textShadow: "0 2px 0 rgba(255,255,255,0.4), 0 4px 16px rgba(194,24,91,0.15)",
          }}
        >
          Turn Your Notion Into a
          <br />
          <span style={{
            background: "linear-gradient(135deg, #f06292, #f57f17, #7ec850)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            Living Knowledge World
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            fontSize: 17, color: "#5d2a36", marginBottom: 40,
            fontFamily: "'Segoe UI', sans-serif", fontWeight: 400,
            lineHeight: 1.6, opacity: 0.85,
          }}
        >
          Paste your Notion page URL and watch your knowledge assemble<br />
          into a <strong>3D Minecraft-inspired universe</strong> — powered by AI.
        </motion.p>

        {/* Input area */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          style={{ position: "relative", marginBottom: 12 }}
        >
          <div style={{
            display: "flex", gap: 0,
            background: "rgba(255,255,255,0.75)",
            border: focused ? "2.5px solid #f06292" : "2.5px solid rgba(255,143,171,0.5)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: focused
              ? "0 0 0 4px rgba(240,98,146,0.2), 0 8px 32px rgba(194,24,91,0.15)"
              : "0 4px 24px rgba(194,24,91,0.1)",
            transition: "all 0.25s",
            backdropFilter: "blur(12px)",
          }}>
            <span style={{
              padding: "0 16px", display: "flex", alignItems: "center",
              fontSize: 20, opacity: 0.6,
            }}>🔗</span>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="https://notion.so/your-page-title..."
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontSize: 16, padding: "18px 0",
                color: "#3b1a24",
                fontFamily: "'Segoe UI', sans-serif",
              }}
            />
            <motion.button
              onClick={handleSubmit}
              disabled={isLoading}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                margin: 6, padding: "12px 28px",
                background: isLoading
                  ? "rgba(240,98,146,0.5)"
                  : "linear-gradient(135deg, #f06292, #e91e63)",
                border: "none", borderRadius: 8, cursor: isLoading ? "wait" : "pointer",
                color: "#fff", fontFamily: "'Fredoka One', cursive",
                fontSize: 16, letterSpacing: "0.5px",
                boxShadow: "0 4px 16px rgba(233,30,99,0.35)",
                whiteSpace: "nowrap",
              }}
            >
              {isLoading ? "🌸 Building..." : "⛏️ Build My World"}
            </motion.button>
          </div>
          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ color: "#c62828", fontSize: 13, marginTop: 8, fontFamily: "'Segoe UI', sans-serif" }}>
              ⚠️ {error}
            </motion.p>
          )}
        </motion.div>

        {/* Helper hint */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
          style={{ fontSize: 12, color: "#8d4b5e", fontFamily: "'Segoe UI', sans-serif" }}
        >
          Works with any public Notion page · Private pages need Notion API token
        </motion.p>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
          style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}
        >
          {[
            ["🧠", "AI Clustering"],
            ["⛏️", "Voxel Nodes"],
            ["🌸", "Live Assembly"],
            ["🔗", "Smart Connections"],
          ].map(([icon, label]) => (
            <div key={label} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.5)",
              border: "1.5px solid rgba(255,143,171,0.35)",
              borderRadius: "100px", padding: "6px 14px",
              fontSize: 12, color: "#5d2a36",
              fontFamily: "'Segoe UI', sans-serif",
              backdropFilter: "blur(6px)",
            }}>
              <span>{icon}</span>{label}
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────
// COMPONENT: Assembly Loading Screen
// ─────────────────────────────────────────
function AssemblyLoader({ url }) {
  const steps = [
    "🔗 Connecting to Notion API...",
    "📄 Fetching your pages...",
    "🧠 AI is analysing connections...",
    "🌸 Building knowledge clusters...",
    "⛏️ Assembling your voxel world...",
  ];
  const [step, setStep] = useState(0);
  const [blockGrid, setBlockGrid] = useState(Array(35).fill(false));

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => Math.min(s + 1, steps.length - 1));
      setBlockGrid(g => {
        const next = [...g];
        const idx = next.findIndex(v => !v);
        if (idx !== -1) next[idx] = true;
        return next;
      });
    }, 900);
    return () => clearInterval(interval);
  }, []);

  const COLORS = [P.sakura1, P.sakura2, P.gold, P.teal, P.leaf];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "linear-gradient(180deg, #1a0812 0%, #0d0508 100%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Fredoka One', cursive",
      }}
    >
      {/* Falling petals */}
      {Array.from({ length: 20 }, (_, i) => (
        <motion.div key={i}
          animate={{ y: ["0vh", "110vh"], x: [0, (Math.random()-0.5)*60], rotate: [0, 360*2] }}
          transition={{ repeat: Infinity, duration: 3 + Math.random()*3, delay: Math.random()*4, ease: "linear" }}
          style={{
            position: "absolute", top: "-5%",
            left: `${Math.random()*100}%`,
            width: 10 + Math.random()*8, height: 10 + Math.random()*8,
            background: COLORS[i % COLORS.length],
            borderRadius: "0 50% 0 50%",
            opacity: 0.6,
          }}
        />
      ))}

      {/* Voxel assembly grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        gap: 5, marginBottom: 40,
      }}>
        {blockGrid.map((active, i) => (
          <motion.div key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={active
              ? { scale: 1, opacity: 1 }
              : { scale: 0.2, opacity: 0.15 }
            }
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            style={{
              width: 22, height: 22,
              background: active ? COLORS[i % COLORS.length] : "#2a1018",
              borderRadius: 3,
              boxShadow: active ? `0 0 10px ${COLORS[i%COLORS.length]}88` : "none",
            }}
          />
        ))}
      </div>

      <motion.div
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
        style={{ fontSize: 22, color: P.sakura1, marginBottom: 12, textAlign: "center" }}
      >
        {steps[step]}
      </motion.div>

      <div style={{
        fontSize: 12, color: "rgba(255,183,197,0.4)",
        fontFamily: "'Segoe UI', sans-serif",
        letterSpacing: "2px", textTransform: "uppercase",
        maxWidth: 300, textAlign: "center",
      }}>
        {url?.slice(0, 50)}{url?.length > 50 ? "..." : ""}
      </div>

      {/* Progress bar */}
      <div style={{
        width: 280, height: 6,
        background: "rgba(255,183,197,0.12)",
        borderRadius: 3, marginTop: 28, overflow: "hidden",
      }}>
        <motion.div
          animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #f06292, #ffd166)",
            borderRadius: 3,
          }}
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// COMPONENT: Node Side Panel
// ─────────────────────────────────────────
function NodePanel({ node, onClose, graphData }) {
  const [content, setContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const API = import.meta?.env?.VITE_API_URL || "http://localhost:8000";
  const colors = CLUSTER_COLORS[(node?.cluster || 0) % CLUSTER_COLORS.length];

  useEffect(() => {
    if (!node) return;
    setContent(null);
    setLoadingContent(true);
    fetch(`${API}/api/page/${node.id}`)
      .then(r => r.json())
      .then(d => { setContent(d.content || null); setLoadingContent(false); })
      .catch(() => setLoadingContent(false));
  }, [node?.id]);

  // Find connections
  const connections = useMemo(() => {
    if (!node || !graphData?.links) return [];
    const nodesMap = {};
    graphData.nodes.forEach(n => (nodesMap[n.id] = n));
    return graphData.links
      .filter(l => l.source === node.id || l.target === node.id)
      .map(l => nodesMap[l.source === node.id ? l.target : l.source])
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
        transition={{ type: "spring", stiffness: 250, damping: 28 }}
        style={{
          position: "fixed", right: 0, top: 60, bottom: 0, width: 316,
          background: "rgba(20, 6, 12, 0.93)",
          backdropFilter: "blur(24px)",
          borderLeft: `2px solid ${colors.glow}44`,
          display: "flex", flexDirection: "column",
          overflow: "hidden", zIndex: 90,
          fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        {/* Scan line */}
        <motion.div
          animate={{ y: ["0%", "100%"] }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          style={{
            position: "absolute", left: 0, right: 0, height: 2, zIndex: 2, pointerEvents: "none",
            background: `linear-gradient(90deg, transparent, ${colors.glow}55, transparent)`,
          }}
        />

        {/* Header */}
        <div style={{
          padding: "20px 20px 14px",
          borderBottom: `1px solid ${colors.glow}22`,
          background: `linear-gradient(180deg, ${colors.emissive}22, transparent)`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: `${colors.glow}22`,
              border: `1px solid ${colors.glow}44`,
              borderRadius: "100px", padding: "4px 12px",
              fontSize: 11, color: colors.glow,
              fontFamily: "'Fredoka One', cursive",
              letterSpacing: "1px",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 1, background: colors.glow }} />
              {colors.name}
            </div>
            <button onClick={onClose} style={{
              background: "none", border: `1px solid ${colors.glow}44`,
              color: `${colors.glow}88`, width: 26, height: 26, cursor: "pointer",
              fontSize: 15, borderRadius: 4, display: "flex", alignItems: "center",
              justifyContent: "center", padding: 0,
            }}>×</button>
          </div>

          {/* Voxel preview row */}
          <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>
            {Array.from({ length: 8 }, (_, i) => (
              <motion.div key={i}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: i * 0.06, type: "spring" }}
                style={{
                  width: 12, height: 12, borderRadius: 2,
                  background: i % 2 === 0 ? colors.base : colors.glow,
                  opacity: 0.7 + (i % 3) * 0.1,
                  boxShadow: `0 0 6px ${colors.glow}55`,
                }}
              />
            ))}
          </div>

          <h2 style={{
            fontSize: 18, fontWeight: 700, color: P.textPrimary,
            fontFamily: "'Fredoka One', cursive",
            margin: "0 0 6px", letterSpacing: "0.5px",
          }}>
            {node.label || node.id}
          </h2>
          {node.summary && (
            <p style={{ fontSize: 12, color: "rgba(255,220,228,0.6)", margin: 0, lineHeight: 1.5 }}>
              {node.summary}
            </p>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>

          {/* Content preview */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: `${colors.glow}77`,
              textTransform: "uppercase", marginBottom: 10, fontFamily: "'Fredoka One', cursive" }}>
              📄 Page Content
            </div>
            <div style={{
              background: `${colors.glow}0a`, border: `1px solid ${colors.glow}22`,
              borderRadius: 6, padding: 14, minHeight: 60,
            }}>
              {loadingContent ? (
                <div style={{ display: "flex", gap: 5 }}>
                  {[0,1,2].map(i => (
                    <motion.div key={i}
                      animate={{ scaleY: [1, 2.2, 1] }}
                      transition={{ delay: i*0.15, repeat: Infinity, duration: 0.7 }}
                      style={{ width: 5, height: 16, background: colors.glow, borderRadius: 2, transformOrigin: "bottom" }}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: "rgba(255,220,228,0.65)", lineHeight: 1.7, margin: 0, maxHeight: 120, overflow: "auto" }}>
                  {content || "No content preview available."}
                </p>
              )}
            </div>
          </div>

          {/* Connections */}
          {connections.length > 0 && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: `${colors.glow}77`,
                textTransform: "uppercase", marginBottom: 10, fontFamily: "'Fredoka One', cursive" }}>
                🔗 Connected To ({connections.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {connections.map(c => {
                  const cc = CLUSTER_COLORS[(c.cluster || 0) % CLUSTER_COLORS.length];
                  return (
                    <div key={c.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: `${cc.glow}0d`,
                      border: `1px solid ${cc.glow}22`,
                      borderRadius: 6, padding: "8px 12px",
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: 1, background: cc.base, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "rgba(255,220,228,0.8)" }}>{c.label || c.id}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div style={{ marginTop: 20 }}>
            {[
              ["ID", (node.id || "").slice(0, 16) + ((node.id || "").length > 16 ? "…" : "")],
              ["Cluster", colors.name],
              ["Blocks", "16 voxels"],
            ].map(([k, v]) => (
              <div key={k} style={{
                display: "flex", justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,183,197,0.08)", padding: "7px 0",
              }}>
                <span style={{ fontSize: 11, color: "rgba(255,183,197,0.35)" }}>{k}</span>
                <span style={{ fontSize: 11, color: colors.glow, fontFamily: "monospace" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        {node.url && (
          <div style={{ padding: "14px 20px", borderTop: `1px solid ${colors.glow}22` }}>
            <a href={node.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: "block", textAlign: "center", padding: 12,
                background: `linear-gradient(135deg, ${colors.base}cc, ${colors.emissive}cc)`,
                border: `1px solid ${colors.glow}55`,
                color: "#fff", textDecoration: "none",
                fontFamily: "'Fredoka One', cursive",
                fontSize: 14, letterSpacing: "1px",
                borderRadius: 6,
                boxShadow: `0 4px 16px ${colors.glow}33`,
              }}>
              🌸 Open in Notion →
            </a>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────
// COMPONENT: Top Navbar (world mode)
// ─────────────────────────────────────────
function WorldNavbar({ graphData, onSearch, onBack }) {
  const [searchVal, setSearchVal] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, height: 56,
      background: "rgba(20,6,12,0.8)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(255,183,197,0.2)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", zIndex: 100,
      fontFamily: "'Fredoka One', cursive",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <motion.div
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          style={{
            width: 30, height: 30, borderRadius: 6,
            background: "linear-gradient(135deg, #ffb7c5, #ffd166, #7ec850)",
            boxShadow: "0 0 14px rgba(255,183,197,0.6)",
          }}
        />
        <div>
          <div style={{ fontSize: 14, letterSpacing: "2px", color: P.sakura1, lineHeight: 1 }}>
            NOTION BRAIN
          </div>
          <div style={{ fontSize: 8, color: P.textMuted, letterSpacing: "2px", marginTop: 2 }}>
            VOXEL KNOWLEDGE UNIVERSE
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: focused ? "rgba(255,183,197,0.12)" : "rgba(255,183,197,0.06)",
        border: `1px solid ${focused ? "rgba(255,183,197,0.5)" : "rgba(255,183,197,0.2)"}`,
        padding: "7px 14px", borderRadius: 8, width: 240,
        transition: "all 0.2s",
      }}>
        <span style={{ color: "rgba(255,183,197,0.5)", fontSize: 14 }}>🔍</span>
        <input
          value={searchVal}
          onChange={e => { setSearchVal(e.target.value); onSearch(e.target.value); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search nodes..."
          style={{
            background: "none", border: "none", outline: "none",
            color: P.textPrimary, fontFamily: "'Segoe UI', sans-serif",
            fontSize: 13, width: "100%",
          }}
        />
      </div>

      {/* Stats + back */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 12, color: P.textMuted, letterSpacing: "1px" }}>
          <span style={{ color: P.sakura1 }}>{graphData?.nodes?.length || 0}</span> nodes ·{" "}
          <span style={{ color: P.gold }}>{graphData?.links?.length || 0}</span> edges
        </div>
        <button onClick={onBack} style={{
          background: "rgba(255,183,197,0.1)",
          border: "1px solid rgba(255,183,197,0.3)",
          color: P.sakura1, padding: "6px 14px",
          borderRadius: 6, cursor: "pointer",
          fontFamily: "'Fredoka One', cursive",
          fontSize: 12, letterSpacing: "1px",
        }}>
          🌸 New URL
        </button>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────
// COMPONENT: Legend
// ─────────────────────────────────────────
function WorldLegend({ graphData }) {
  // Compute which clusters are present
  const presentClusters = useMemo(() => {
    const seen = new Set();
    (graphData?.nodes || []).forEach(n => seen.add(n.cluster || 0));
    return CLUSTER_COLORS.filter((_, i) => seen.has(i));
  }, [graphData]);

  return (
    <motion.div
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 3, duration: 0.7 }}
      style={{
        position: "fixed", bottom: 56, left: 20, zIndex: 80,
        background: "rgba(20,6,12,0.8)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,183,197,0.18)",
        padding: "12px 16px", borderRadius: 8,
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <div style={{ fontSize: 9, letterSpacing: 2, color: P.textMuted,
        textTransform: "uppercase", marginBottom: 8, fontFamily: "'Fredoka One', cursive" }}>
        🌸 Cluster Types
      </div>
      {presentClusters.map((c, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <div style={{
            width: 10, height: 10, borderRadius: 2, background: c.base,
            boxShadow: `0 0 6px ${c.glow}`,
          }} />
          <span style={{ fontSize: 11, color: "rgba(255,220,228,0.6)" }}>{c.name}</span>
        </div>
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────
export default function App() {
  // phase: "landing" | "loading" | "world"
  const [phase, setPhase] = useState("landing");
  const [notionUrl, setNotionUrl] = useState("");
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [apiError, setApiError] = useState("");

  const API = import.meta?.env?.VITE_API_URL || "http://localhost:8000";

  const handleSubmit = useCallback(async (url) => {
    setNotionUrl(url);
    setPhase("loading");
    setApiError("");
    try {
      const res = await fetch(`${API}/api/graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      // Ensure nodes have 3D positions if backend doesn't provide them
      const nodes = (data.nodes || []).map((n, i) => ({
        ...n,
        position: n.position || [
          (Math.cos(i * 2.4) * (8 + i * 2.5)),
          (Math.sin(i * 1.8) * 4),
          (Math.sin(i * 2.4) * (8 + i * 2.5)),
        ],
        cluster: n.cluster ?? (i % CLUSTER_COLORS.length),
      }));
      setGraphData({ nodes, links: data.links || [] });
      // Min display time for loading screen wow effect
      setTimeout(() => setPhase("world"), 4500);
    } catch (err) {
      console.error("API fetch failed:", err);
      setApiError(err.message);
      // Fallback: use demo data so judges can still see the experience
      const demoNodes = [
        { id: "pg-001", label: "Machine Learning", position: [0,0,0], cluster: 0, summary: "Core ML concepts" },
        { id: "pg-002", label: "Neural Networks", position: [9,3,-2], cluster: 0, summary: "Deep neural architectures" },
        { id: "pg-003", label: "Python Tools", position: [-8,2,6], cluster: 1, summary: "Dev environment setup" },
        { id: "pg-004", label: "Project Ideas", position: [-5,-3,-7], cluster: 2, summary: "Side project backlog" },
        { id: "pg-005", label: "Data Science", position: [5,-5,-8], cluster: 3, summary: "Stats & visualization" },
        { id: "pg-006", label: "Deep Learning", position: [14,-1,5], cluster: 0, summary: "Neural net research" },
      ];
      const demoLinks = [
        { source: "pg-001", target: "pg-002" },
        { source: "pg-002", target: "pg-006" },
        { source: "pg-001", target: "pg-003" },
        { source: "pg-003", target: "pg-004" },
        { source: "pg-001", target: "pg-005" },
      ];
      setGraphData({ nodes: demoNodes, links: demoLinks });
      setTimeout(() => setPhase("world"), 4500);
    }
  }, [API]);

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
      {/* Google Fonts — Fredoka One for the Minecraft-playful feel */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; background: #0d0508; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,183,197,0.3); border-radius: 2px; }
      `}</style>

      {/* LANDING */}
      <AnimatePresence>
        {phase === "landing" && (
          <motion.div key="landing" exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.6 }}>
            <LandingPage onSubmit={handleSubmit} isLoading={false} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOADING */}
      <AnimatePresence>
        {phase === "loading" && (
          <AssemblyLoader key="loading" url={notionUrl} />
        )}
      </AnimatePresence>

      {/* 3D WORLD */}
      <AnimatePresence>
        {phase === "world" && (
          <motion.div
            key="world"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2 }}
            style={{ width: "100vw", height: "100vh", position: "relative" }}
          >
            {/* 3D Canvas */}
            <Canvas
              camera={{ position: [5, 32, 58], fov: 52 }}
              gl={{ antialias: true }}
              style={{ width: "100vw", height: "100vh", background: "#1a0812" }}
              onPointerMissed={() => setSelectedNode(null)}
            >
              <Suspense fallback={null}>
                <GraphScene
                  graphData={graphData}
                  selectedNode={selectedNode}
                  onNodeClick={handleNodeClick}
                  highlightNodes={highlightNodes}
                  phase="world"
                />
              </Suspense>
            </Canvas>

            {/* Warm vignette */}
            <div style={{
              position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5,
              background: "radial-gradient(ellipse at center, transparent 38%, rgba(10,2,6,0.65) 100%)",
            }} />

            {/* Navbar */}
            <WorldNavbar graphData={graphData} onSearch={handleSearch} onBack={() => { setPhase("landing"); setSelectedNode(null); }} />

            {/* Legend */}
            <WorldLegend graphData={graphData} />

            {/* Controls hint */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3 }}
              style={{
                position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)",
                zIndex: 80, pointerEvents: "none", textAlign: "center",
                fontSize: 10, letterSpacing: "2px", textTransform: "uppercase",
                color: "rgba(255,183,197,0.3)",
                fontFamily: "'Segoe UI', sans-serif",
              }}
            >
              Drag to orbit · Scroll to zoom · Click node to explore
            </motion.div>

            {/* API error banner */}
            {apiError && (
              <motion.div
                initial={{ y: -40 }} animate={{ y: 0 }}
                style={{
                  position: "fixed", top: 62, left: "50%", transform: "translateX(-50%)",
                  zIndex: 110,
                  background: "rgba(198,40,40,0.85)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid #ef9a9a",
                  borderRadius: 6, padding: "8px 20px",
                  fontSize: 12, color: "#ffcdd2",
                  fontFamily: "'Segoe UI', sans-serif",
                }}
              >
                ⚠️ API unavailable — showing demo data · {apiError}
              </motion.div>
            )}

            {/* Node panel */}
            <AnimatePresence>
              {selectedNode && (
                <NodePanel
                  key={selectedNode.id}
                  node={selectedNode}
                  onClose={() => setSelectedNode(null)}
                  graphData={graphData}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}