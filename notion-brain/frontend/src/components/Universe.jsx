import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import ForceGraph3D from 'react-force-graph-3d';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';

/* ─── Nebula canvas painted by Three.js ─── */
function NebulaBackground() {
  const canvasRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x01000a);
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2500);
    camera.position.z = 500;

    /* --- Deep starfield: 3 parallax layers --- */
    const starConfigs = [
      { count: 4000, spread: 900, sizeRange: [0.3, 1.0], speedY: 0.00004 },
      { count: 1200, spread: 700, sizeRange: [1.0, 2.2], speedY: 0.00010 },
      { count: 300,  spread: 400, sizeRange: [2.0, 4.5], speedY: 0.00018 },
    ];

    const starMeshes = starConfigs.map(({ count, spread, sizeRange, speedY }) => {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const colors    = new Float32Array(count * 3);
      const sizes     = new Float32Array(count);

      const palette = [
        [0.85, 0.90, 1.00], // blue-white
        [1.00, 0.95, 0.80], // warm white
        [1.00, 0.80, 0.60], // amber
        [0.70, 0.80, 1.00], // cool blue
        [1.00, 1.00, 1.00], // pure white
        [0.90, 0.70, 1.00], // soft purple
      ];

      for (let i = 0; i < count; i++) {
        const r = 200 + Math.random() * spread;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        const c = palette[Math.floor(Math.random() * palette.length)];
        const bright = 0.5 + Math.random() * 0.5;
        colors[i * 3]     = c[0] * bright;
        colors[i * 3 + 1] = c[1] * bright;
        colors[i * 3 + 2] = c[2] * bright;

        sizes[i] = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
      }

      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
      geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `
          attribute float size;
          attribute vec3 color;
          varying vec3 vColor;
          uniform float uTime;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float twinkle = 0.75 + 0.25 * sin(uTime * 1.8 + position.x * 0.7 + position.y * 0.5);
            gl_PointSize = size * (220.0 / -mv.z) * twinkle;
            gl_Position  = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            float a = 1.0 - smoothstep(0.05, 0.5, d);
            gl_FragColor = vec4(vColor, a);
          }
        `,
        transparent: true,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const pts = new THREE.Points(geo, mat);
      scene.add(pts);
      return { pts, mat, speedY };
    });

    /* --- Nebula dust clouds --- */
    const nebulaColors = [0x1a0533, 0x0d1b4a, 0x1a2a0d, 0x3d0a1a, 0x001a3d, 0x1a001a];
    for (let n = 0; n < 5; n++) {
      const geo = new THREE.BufferGeometry();
      const pCount = 900;
      const pos = new Float32Array(pCount * 3);
      const cx = (Math.random() - 0.5) * 700, cy = (Math.random() - 0.5) * 350, cz = -300 - Math.random() * 300;
      const spreadR = 100 + Math.random() * 150;
      for (let i = 0; i < pCount; i++) {
        pos[i*3]   = cx + (Math.random()-0.5) * spreadR * 2;
        pos[i*3+1] = cy + (Math.random()-0.5) * spreadR;
        pos[i*3+2] = cz + (Math.random()-0.5) * 80;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: nebulaColors[n % nebulaColors.length], size: 10,
        transparent: true, opacity: 0.055,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      scene.add(new THREE.Points(geo, mat));
    }

    /* --- Shooting star --- */
    let shootLine = null, shootT = 0, shootStart = new THREE.Vector3(), shootDir = new THREE.Vector3();

    const spawnShoot = () => {
      if (shootLine) scene.remove(shootLine);
      shootStart.set((Math.random()-0.5)*500, 160 + Math.random()*80, -30);
      shootDir.set((Math.random()-0.2)*180, -90-Math.random()*60, 0).normalize();
      const end = shootStart.clone().addScaledVector(shootDir, 140);
      const geo = new THREE.BufferGeometry().setFromPoints([shootStart, end]);
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
      shootLine = new THREE.Line(geo, mat);
      scene.add(shootLine);
      shootT = 0;
    };
    setTimeout(spawnShoot, 2500 + Math.random() * 4000);

    /* --- Animate --- */
    let t = 0, rafId;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      t += 0.003;

      starMeshes.forEach(({ pts, mat, speedY }) => {
        mat.uniforms.uTime.value = t;
        pts.rotation.y += speedY;
        pts.rotation.x += speedY * 0.25;
      });

      if (shootLine) {
        shootT += 0.025;
        shootLine.material.opacity = Math.max(0, 1 - shootT);
        shootLine.position.addScaledVector(shootDir, 6);
        if (shootT >= 1.2) {
          scene.remove(shootLine);
          shootLine = null;
          setTimeout(spawnShoot, 3500 + Math.random() * 9000);
        }
      }
      renderer.render(scene, camera);
    };
    tick();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
    />
  );
}

/* ─── Main Universe (space/dark mode) ─── */
export default function Universe({ data, onNodeClick, highlightNodes, loading }) {
  const fgRef  = useRef();
  const wrapRef = useRef();
  const [assembled, setAssembled] = useState(false);

  /* Scatter-then-assemble entrance */
  useEffect(() => {
    if (loading || !data.nodes.length) return;
    setAssembled(false);

    // Stagger zoom-to-fit after force simulation settles
    const t1 = setTimeout(() => {
      fgRef.current?.zoomToFit(2200, 90);
    }, 500);
    const t2 = setTimeout(() => setAssembled(true), 2800);

    // GSAP: fade the wrapper in
    if (wrapRef.current) {
      gsap.fromTo(wrapRef.current, { opacity: 0 }, { opacity: 1, duration: 2.2, ease: 'power2.out' });
    }

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading, data.nodes.length]);

  /* Node appearance */
  const nodeColor = useCallback((node) => {
    if (highlightNodes.has(node.id)) return '#fde047';
    if (node.__selected) return '#f472b6';
    const palette = ['#60a5fa','#34d399','#f472b6','#fb923c','#a78bfa','#38bdf8','#4ade80','#e879f9'];
    return palette[(node.cluster || 0) % palette.length];
  }, [highlightNodes]);

  const nodeVal = useCallback((node) => {
    return highlightNodes.has(node.id) ? 5 : node.__selected ? 6 : 2.5;
  }, [highlightNodes]);

  /* Custom node label (HTML tooltip) */
  const nodeLabel = useCallback((node) => `
    <div style="
      font-family: 'Share Tech Mono', 'Courier New', monospace;
      font-size: 11px; color: #dde5ff;
      background: rgba(5,2,22,0.9);
      border: 1px solid rgba(99,102,241,0.45);
      padding: 6px 12px; border-radius: 2px;
      letter-spacing: 2px; text-transform: uppercase;
    ">${node.label || 'UNTITLED'}</div>
  `, []);

  const handleClick = useCallback((node) => {
    data.nodes.forEach(n => { n.__selected = false; });
    node.__selected = true;
    onNodeClick({ ...node });

    fgRef.current?.cameraPosition(
      { x: node.x, y: node.y, z: (node.z || 0) + 180 },
      { x: node.x, y: node.y, z: node.z || 0 },
      1400
    );
  }, [data.nodes, onNodeClick]);

  return (
    <div ref={wrapRef} style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* Three.js nebula */}
      <NebulaBackground />

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 20,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(1,0,10,0.6)', backdropFilter: 'blur(8px)',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
              style={{
                width: 56, height: 56,
                border: '1px solid rgba(99,102,241,0.2)',
                borderTop: '1.5px solid #6366f1',
                borderRadius: '50%', marginBottom: 28,
              }}
            />
            <motion.p
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{
                fontFamily: "'Share Tech Mono', 'Courier New', monospace",
                fontSize: 11, letterSpacing: 5, textTransform: 'uppercase',
                color: 'rgba(150,155,210,0.75)',
              }}
            >
              ASSEMBLING NEURAL MAP
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Radial glow burst on assembly */}
      <AnimatePresence>
        {!loading && !assembled && (
          <motion.div
            initial={{ opacity: 0.5, scale: 0.4 }}
            animate={{ opacity: 0, scale: 2.5 }}
            transition={{ duration: 2.8, ease: 'easeOut' }}
            style={{
              position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
              background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.18) 0%, transparent 65%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ForceGraph3D */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {!loading && (
          <ForceGraph3D
            ref={fgRef}
            graphData={data}
            backgroundColor="rgba(0,0,0,0)"
            nodeLabel={nodeLabel}
            nodeColor={nodeColor}
            nodeVal={nodeVal}
            nodeResolution={16}
            nodeOpacity={0.92}
            linkColor={link => link.semantic
              ? 'rgba(168,85,247,0.22)'
              : 'rgba(99,102,241,0.18)'}
            linkWidth={link => link.semantic ? 0.6 : 0.35}
            linkDirectionalParticles={link => link.semantic ? 0 : 3}
            linkDirectionalParticleWidth={0.9}
            linkDirectionalParticleSpeed={0.0045}
            linkDirectionalParticleColor={() => 'rgba(148,163,255,0.85)'}
            onNodeClick={handleClick}
            enableNodeDrag
            showNavInfo={false}
            cooldownTicks={assembled ? 0 : 180}
          />
        )}
      </div>

      {/* Radial vignette for depth */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(1,0,10,0.68) 100%)',
      }} />

      {/* Node count */}
      <div style={{
        position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, pointerEvents: 'none', textAlign: 'center',
      }}>
        <p style={{
          fontFamily: "'Share Tech Mono','Courier New',monospace",
          fontSize: 9, color: 'rgba(150,155,210,0.32)',
          letterSpacing: 4, textTransform: 'uppercase',
        }}>
          {data.nodes.length} nodes · {data.links?.length || 0} connections · drag to explore
        </p>
      </div>
    </div>
  );
}