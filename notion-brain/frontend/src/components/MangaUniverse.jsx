import React, { useRef, useEffect, useCallback, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';

/* ─── Static halftone + speed-line background ─── */
function drawBg(ctx, w, h) {
  // Paper tint
  ctx.fillStyle = '#f2ede0';
  ctx.fillRect(0, 0, w, h);

  // Halftone dots grid
  const gap = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.055)';
  for (let x = 0; x < w; x += gap) {
    for (let y = 0; y < h; y += gap) {
      const r = 1.0 + Math.sin((x + y) * 0.017) * 0.55;
      ctx.beginPath();
      ctx.arc(x + Math.sin(y * 0.09) * 2, y + Math.cos(x * 0.09) * 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Radial speed lines from centre
  const cx = w * 0.5, cy = h * 0.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.028)';
  for (let a = 0; a < Math.PI * 2; a += 0.065) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100);
    ctx.lineTo(cx + Math.cos(a) * Math.max(w, h), cy + Math.sin(a) * Math.max(w, h));
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
}

/* ─── Node painter ─── */
function paintNode(node, ctx, scale, highlighted) {
  const { x, y, label = 'UNTITLED', id } = node;
  const isHL  = highlighted.has(id);
  const isSel = node.__selected;
  const r     = isSel ? 22 : isHL ? 20 : 16;

  /* Impact burst lines */
  if (isSel || isHL) {
    ctx.save();
    ctx.translate(x, y);
    const rays = isSel ? 14 : 10;
    for (let i = 0; i < rays; i++) {
      const a    = (i / rays) * Math.PI * 2;
      const near = r + 3;
      const far  = r + (isSel ? 16 : 10) + Math.sin(i * 1.9) * 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * near, Math.sin(a) * near);
      ctx.lineTo(Math.cos(a) * far,  Math.sin(a) * far);
      ctx.strokeStyle = '#000';
      ctx.lineWidth   = isSel ? 2.2 : 1.4;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* Fill */
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = isSel ? '#000' : isHL ? '#222' : node.semantic ? '#6b6b6b' : '#fff';
  ctx.fill();

  /* Outer ink border */
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = isSel ? 3.5 : isHL ? 2.8 : 2.2;
  ctx.stroke();

  /* Inner detail circle */
  if (!isSel) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth   = 0.8;
    ctx.stroke();
  } else {
    // × cross inside selected
    const s = r * 0.33;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    [[-s,-s,s,s],[s,-s,-s,s]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x+x1,y+y1); ctx.lineTo(x+x2,y+y2); ctx.stroke();
    });
  }

  /* Label box */
  if (scale > 0.45) {
    const fs = Math.min(10, Math.max(7, 8 / scale));
    ctx.font = `900 ${fs}px "Arial Black","Arial",sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    const ty  = y + r + fs + 4;
    const tw  = ctx.measureText(label).width + 10;

    // Box
    ctx.fillStyle   = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 1.6;
    ctx.beginPath();
    ctx.rect(x - tw/2, ty - fs/2 - 3, tw, fs + 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000';
    ctx.fillText(label, x, ty);
  }
}

/* ─── Link painter ─── */
function paintLink(link, ctx, highlighted) {
  const s = link.source, e = link.target;
  if (!s || !e || typeof s !== 'object') return;

  const connHL = highlighted.has(s.id) || highlighted.has(e.id);

  ctx.beginPath();
  ctx.moveTo(s.x, s.y);

  if (link.semantic) {
    ctx.setLineDash([4, 7]);
    ctx.strokeStyle = connHL ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.18)';
    ctx.lineWidth   = connHL ? 1.5 : 0.9;
  } else {
    ctx.setLineDash([]);
    ctx.strokeStyle = connHL ? 'rgba(0,0,0,0.80)' : 'rgba(0,0,0,0.28)';
    ctx.lineWidth   = connHL ? 2.2 : 1.3;
  }

  ctx.lineTo(e.x, e.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead (direct links only)
  if (!link.semantic) {
    const dx = e.x - s.x, dy = e.y - s.y;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const ux = dx/len, uy = dy/len;
    const offset = 20;
    const tx = e.x - ux * offset, ty = e.y - uy * offset;
    const al = 7, aw = 3;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - ux*al - uy*aw, ty - uy*al + ux*aw);
    ctx.lineTo(tx - ux*al + uy*aw, ty - uy*al - ux*aw);
    ctx.closePath();
    ctx.fillStyle = connHL ? '#000' : 'rgba(0,0,0,0.35)';
    ctx.fill();
  }
}

/* ─── Ink splash DOM overlay ─── */
function InkSplash({ x, y, onDone }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0.85 }}
      animate={{ scale: 3.5, opacity: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      onAnimationComplete={onDone}
      style={{
        position: 'absolute',
        left: x - 22, top: y - 22,
        width: 44, height: 44,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, transparent 70%)',
        pointerEvents: 'none', zIndex: 30,
      }}
    />
  );
}

/* ─── Main MangaUniverse ─── */
export default function MangaUniverse({ data, onNodeClick, highlightNodes, loading }) {
  const fgRef    = useRef();
  const wrapRef  = useRef();
  const [splashes, setSplashes] = useState([]);
  const splashId = useRef(0);

  /* Entrance animation */
  useEffect(() => {
    if (loading || !data.nodes.length) return;
    const t = setTimeout(() => fgRef.current?.zoomToFit(700, 80), 600);
    if (wrapRef.current) {
      gsap.fromTo(wrapRef.current, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: 'power2.out' });
    }
    return () => clearTimeout(t);
  }, [loading, data.nodes.length]);

  const paintNodeCb = useCallback(
    (node, ctx, gs) => paintNode(node, ctx, gs, highlightNodes),
    [highlightNodes]
  );
  const paintLinkCb = useCallback(
    (link, ctx)    => paintLink(link, ctx, highlightNodes),
    [highlightNodes]
  );
  const paintBgCb  = useCallback(
    (ctx) => drawBg(ctx, ctx.canvas.width, ctx.canvas.height),
    []
  );

  const handleClick = useCallback((node, event) => {
    data.nodes.forEach(n => { n.__selected = false; });
    node.__selected = true;
    onNodeClick({ ...node });

    if (event) {
      const id = ++splashId.current;
      setSplashes(p => [...p, { id, x: event.clientX, y: event.clientY }]);
    }
    fgRef.current?.centerAt(node.x, node.y, 700);
    fgRef.current?.zoom(2.8, 700);
  }, [data.nodes, onNodeClick]);

  const removeSplash = useCallback(id => setSplashes(p => p.filter(s => s.id !== id)), []);

  return (
    <div ref={wrapRef} style={{ width: '100vw', height: '100vh', background: '#f2ede0', position: 'relative', overflow: 'hidden' }}>

      {/* Ink splashes */}
      {splashes.map(s => (
        <InkSplash key={s.id} x={s.x} y={s.y} onDone={() => removeSplash(s.id)} />
      ))}

      {/* Double-border manga frame */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40,
        border: '4px solid #0d0d0d',
        boxShadow: 'inset 0 0 0 10px #f2ede0, inset 0 0 0 14px #0d0d0d',
      }} />

      {/* Corner L-brackets */}
      {[
        { top: 18, left: 18,   d: 'M0,22 L0,0 L22,0'  },
        { top: 18, right: 18,  d: 'M0,0 L22,0 L22,22'  },
        { bottom: 18, left: 18, d: 'M0,0 L0,22 L22,22' },
        { bottom: 18, right: 18, d: 'M22,0 L22,22 L0,22' },
      ].map((cfg, i) => {
        const { d, ...pos } = cfg;
        return (
          <svg key={i} width="22" height="22" viewBox="0 0 22 22"
            style={{ position: 'absolute', pointerEvents: 'none', zIndex: 41, ...pos }}>
            <path d={d} fill="none" stroke="#0d0d0d" strokeWidth="3"/>
          </svg>
        );
      })}

      {/* Loading panel */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.05 }}
            style={{
              position: 'absolute', inset: 0, zIndex: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f2ede0',
            }}
          >
            <motion.div
              animate={{ rotate: [-1.5, 1.5, -1.5] }}
              transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut' }}
              style={{
                border: '3px solid #0d0d0d', background: '#fff',
                padding: '44px 64px', textAlign: 'center',
                boxShadow: '7px 7px 0 #0d0d0d',
              }}
            >
              <div style={{ fontSize: 52, marginBottom: 10, lineHeight: 1 }}>🧠</div>
              <div style={{
                fontFamily: '"Arial Black","Arial Bold",sans-serif',
                fontSize: 24, fontWeight: 900, letterSpacing: 3,
                textTransform: 'uppercase', color: '#0d0d0d',
              }}>LOADING...</div>
              <div style={{
                fontFamily: '"Georgia",serif', fontStyle: 'italic',
                fontSize: 11, color: '#666', marginTop: 8,
              }}>
                Mapping your knowledge universe
              </div>
              {/* Pulse bars */}
              <div style={{ display: 'flex', gap: 7, justifyContent: 'center', marginTop: 20 }}>
                {[0,1,2,3,4].map(i => (
                  <motion.div key={i}
                    animate={{ scaleY: [1, 2.8, 1] }}
                    transition={{ delay: i * 0.1, repeat: Infinity, duration: 0.65 }}
                    style={{ width: 7, height: 14, background: '#0d0d0d', borderRadius: 2, transformOrigin: 'bottom' }}
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ForceGraph2D */}
      {!loading && (
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          nodeCanvasObject={paintNodeCb}
          nodeCanvasObjectMode={() => 'replace'}
          linkCanvasObject={paintLinkCb}
          linkCanvasObjectMode={() => 'replace'}
          onRenderFramePre={paintBgCb}
          onNodeClick={handleClick}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
          cooldownTicks={140}
        />
      )}

      {/* Bottom caption */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 42, pointerEvents: 'none',
        border: '2px solid #0d0d0d', background: '#fff',
        padding: '4px 18px', boxShadow: '3px 3px 0 #0d0d0d',
      }}>
        <p style={{
          fontFamily: '"Arial Black",sans-serif', fontSize: 9,
          letterSpacing: 3, textTransform: 'uppercase', color: '#0d0d0d', margin: 0,
        }}>
          {data.nodes.length} pages · {data.links?.length || 0} connections
        </p>
      </div>
    </div>
  );
}