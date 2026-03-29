/**
 * WorldBackground.jsx
 * One canvas. Pure 2D context. No Three.js.
 * Aesthetic: technical drafting sheet — construction circles,
 * golden-ratio arcs, dimension arrows, blue accent lines, spec text.
 * GSAP fades everything in over 2 seconds.
 */

import React, { useRef, useEffect } from "react";
import gsap from "gsap";

export default function WorldBackground({ active }) {
  const canvasRef = useRef();
  const alphaRef  = useRef({ v: 0 });

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");

    alphaRef.current = { v: 0 };
    gsap.to(alphaRef.current, { v: 1, duration: 2.4, ease: "power2.out" });

    // ── Geometry ────────────────────────────────────────────────────
    const CX  = W * 0.40;
    const CY  = H * 0.52;
    const PHI = 1.6180339887;
    const R1  = Math.min(W, H) * 0.30;
    const R2  = R1 / PHI;
    const R3  = R2 / PHI;
    const R4  = R3 / PHI;
    const R5  = R4 / PHI;

    // Two palette entries only
    const ink  = (a) => `rgba(20, 18, 14, ${a})`;
    const blue  = (a) => `rgba(72, 108, 190, ${a})`;

    const GRID = 52;

    const specLines = [
      "LOAD FACTOR  1.4×",
      "MATERIAL     GR.304",
      "FINISH       #4 BRUSH",
      "TOL.         ±0.025",
      "SCALE        1:1",
      "SHEET        01 / 03",
      "REV          C",
      "DATE         2026.03",
    ];

    const annotations = [
      { x: CX + R1 * 0.74, y: CY - R1 * 0.30, text: "103",     accent: false },
      { x: CX + R1 * 0.88, y: CY + R1 * 0.04, text: "201",     accent: false },
      { x: CX - R3 * 0.2,  y: CY + R3 * 0.75, text: "FIG.2",   accent: false },
      { x: CX + R2 * 0.55, y: CY - R2 * 1.08, text: "Ø 48.0",  accent: true  },
      { x: CX - R1 * 0.74, y: CY - R1 * 0.48, text: "R = " + Math.round(R1), accent: true },
      { x: CX + R1 * 0.05, y: CY + R1 * 0.98, text: "SEC A–A", accent: false },
      { x: CX - R2 * 1.15, y: CY + R3 * 0.38, text: "∞ 0.05",  accent: true  },
    ];

    let raf;

    const draw = () => {
      const a = alphaRef.current.v;
      ctx.clearRect(0, 0, W, H);

      // Paper ground
      ctx.fillStyle = "#f5f2ec";
      ctx.fillRect(0, 0, W, H);

      // ── 1. Grid ──────────────────────────────────────────────────
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = ink(0.032 * a);
      for (let x = 0; x < W; x += GRID) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += GRID) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.strokeStyle = ink(0.062 * a);
      for (let x = 0; x < W; x += GRID * 4) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += GRID * 4) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // ── 2. Crosshair through CX, CY ────────────────────────────
      ctx.setLineDash([8, 5]);
      ctx.strokeStyle = blue(0.22 * a);
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, CY); ctx.lineTo(W, CY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX, 0); ctx.lineTo(CX, H); ctx.stroke();
      ctx.setLineDash([]);
      // Center pip
      const CM = 14;
      ctx.strokeStyle = blue(0.55 * a);
      ctx.lineWidth = 0.8;
      [[CX - CM, CY, CX - 4, CY], [CX + 4, CY, CX + CM, CY],
       [CX, CY - CM, CX, CY - 4], [CX, CY + 4, CX, CY + CM]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      });
      ctx.beginPath(); ctx.arc(CX, CY, 3, 0, Math.PI * 2);
      ctx.strokeStyle = blue(0.7 * a); ctx.stroke();

      // ── 3. Construction circles ─────────────────────────────────
      // R1 – full ink circle
      ctx.strokeStyle = ink(0.13 * a);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(CX, CY, R1, 0, Math.PI * 2);
      ctx.stroke();

      // R2 – blue dashed
      ctx.strokeStyle = blue(0.32 * a);
      ctx.lineWidth = 0.7;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.arc(CX, CY, R2, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      // R3 – ink
      ctx.strokeStyle = ink(0.16 * a);
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(CX, CY, R3, 0, Math.PI * 2); ctx.stroke();

      // R4 – blue
      ctx.strokeStyle = blue(0.38 * a);
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(CX, CY, R4, 0, Math.PI * 2); ctx.stroke();

      // R5 – ink inner
      ctx.strokeStyle = ink(0.20 * a);
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(CX, CY, R5, 0, Math.PI * 2); ctx.stroke();

      // Bolt holes at R3
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(CX + Math.cos(ang) * R3, CY + Math.sin(ang) * R3, 4, 0, Math.PI * 2);
        ctx.strokeStyle = ink(0.20 * a); ctx.lineWidth = 0.6; ctx.stroke();
      }

      // ── 4. Golden ratio spiral (quarter arcs) ───────────────────
      ctx.strokeStyle = ink(0.07 * a);
      ctx.lineWidth = 0.7;
      [
        { cx: CX,           cy: CY,          r: R5, a0: -Math.PI,      a1: -Math.PI / 2 },
        { cx: CX + R5,      cy: CY,          r: R5, a0: Math.PI / 2,   a1: Math.PI      },
        { cx: CX + R5,      cy: CY - R4,     r: R4, a0: -Math.PI / 2,  a1: 0            },
        { cx: CX + R5 - R3, cy: CY - R4,     r: R3, a0: 0,             a1: Math.PI / 2  },
        { cx: CX + R5 - R3, cy: CY - R4 + R2,r: R2, a0: Math.PI / 2,  a1: Math.PI      },
      ].forEach(s => {
        ctx.beginPath(); ctx.arc(s.cx, s.cy, s.r, s.a0, s.a1); ctx.stroke();
      });

      // ── 5. Radial construction lines ────────────────────────────
      ctx.setLineDash([3, 8]);
      ctx.strokeStyle = ink(0.045 * a);
      ctx.lineWidth = 0.5;
      [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330].forEach(deg => {
        const r = (deg * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(CX + Math.cos(r) * (R5 + 2), CY + Math.sin(r) * (R5 + 2));
        ctx.lineTo(CX + Math.cos(r) * R1 * 1.25, CY + Math.sin(r) * R1 * 1.25);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // ── 6. Dimension lines ───────────────────────────────────────
      ctx.strokeStyle = ink(0.14 * a);
      ctx.lineWidth = 0.6;
      ctx.font = "9px 'Courier New', monospace";

      // Horizontal – diameter of R1
      const dY  = CY + R1 + 34;
      const dX1 = CX - R1, dX2 = CX + R1;
      ctx.beginPath();
      ctx.moveTo(dX1, dY - 8); ctx.lineTo(dX1, dY + 8);
      ctx.moveTo(dX2, dY - 8); ctx.lineTo(dX2, dY + 8);
      ctx.moveTo(dX1, dY);     ctx.lineTo(dX2, dY);
      ctx.stroke();
      const arr = 6;
      ctx.fillStyle = ink(0.28 * a);
      [dX1, dX2].forEach((xp, ii) => {
        const dir = ii === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(xp, dY);
        ctx.lineTo(xp + dir * arr, dY - 3);
        ctx.lineTo(xp + dir * arr, dY + 3);
        ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = ink(0.52 * a);
      ctx.textAlign = "center";
      ctx.fillText("Ø " + (R1 * 2).toFixed(0), (dX1 + dX2) / 2, dY - 6);

      // Vertical – R2 on right
      const vX  = CX + R1 + 38;
      const vY1 = CY - R2, vY2 = CY + R2;
      ctx.beginPath();
      ctx.moveTo(vX - 8, vY1); ctx.lineTo(vX + 8, vY1);
      ctx.moveTo(vX - 8, vY2); ctx.lineTo(vX + 8, vY2);
      ctx.moveTo(vX, vY1);     ctx.lineTo(vX, vY2);
      ctx.stroke();
      [vY1, vY2].forEach((yp, ii) => {
        const dir = ii === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(vX, yp);
        ctx.lineTo(vX - 3, yp + dir * arr);
        ctx.lineTo(vX + 3, yp + dir * arr);
        ctx.closePath(); ctx.fill();
      });
      ctx.save();
      ctx.translate(vX + 14, (vY1 + vY2) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = ink(0.52 * a);
      ctx.textAlign = "center";
      ctx.fillText("R " + R2.toFixed(0), 0, 0);
      ctx.restore();

      // ── 7. Secondary circle (top right) ─────────────────────────
      const SCX = W * 0.80;
      const SCY = H * 0.24;
      const SR  = Math.min(W, H) * 0.085;

      ctx.strokeStyle = ink(0.12 * a);
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(SCX, SCY, SR, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(SCX, SCY, SR * 0.58, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = blue(0.28 * a);
      ctx.beginPath(); ctx.arc(SCX, SCY, SR * 0.30, 0, Math.PI * 2); ctx.stroke();
      // Inner hatching
      ctx.strokeStyle = ink(0.065 * a);
      ctx.lineWidth = 0.4;
      for (let i = -SR * 0.28; i < SR * 0.28; i += 4.5) {
        const half = Math.sqrt(Math.max(0, (SR * 0.28) ** 2 - i * i));
        ctx.beginPath();
        ctx.moveTo(SCX + i, SCY - half);
        ctx.lineTo(SCX + i, SCY + half);
        ctx.stroke();
      }
      // Secondary crosshair
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = blue(0.22 * a);
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(SCX - SR * 1.4, SCY); ctx.lineTo(SCX + SR * 1.4, SCY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(SCX, SCY - SR * 1.4); ctx.lineTo(SCX, SCY + SR * 1.4); ctx.stroke();
      ctx.setLineDash([]);

      // ── 8. Blue section-cut diagonal ────────────────────────────
      ctx.strokeStyle = blue(0.16 * a);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(W * 0.56, 0);
      ctx.lineTo(W * 0.97, H * 0.58);
      ctx.stroke();
      // Hatch marks along it
      const dx = W * 0.97 - W * 0.56;
      const dy = H * 0.58;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len, uy = dy / len;
      const nx = -uy, ny = ux;
      ctx.strokeStyle = blue(0.10 * a);
      ctx.lineWidth = 0.5;
      for (let t = 0.04; t < 0.95; t += 0.055) {
        const px = W * 0.56 + dx * t;
        const py = H * 0.58 * t;
        ctx.beginPath();
        ctx.moveTo(px + nx * 5, py + ny * 5);
        ctx.lineTo(px - nx * 5, py - ny * 5);
        ctx.stroke();
      }

      // ── 9. Annotation labels ─────────────────────────────────────
      ctx.font = "9px 'Courier New', monospace";
      ctx.textAlign = "left";
      annotations.forEach(ann => {
        ctx.fillStyle = ann.accent ? blue(0.55 * a) : ink(0.36 * a);
        ctx.fillText(ann.text, ann.x, ann.y);
      });

      // ── 10. Spec text block ──────────────────────────────────────
      ctx.font = "8px 'Courier New', monospace";
      ctx.fillStyle = ink(0.22 * a);
      ctx.textAlign = "left";
      specLines.forEach((line, i) => {
        ctx.fillText(line, 28, H * 0.35 + i * 13);
      });

      // ── 11. Bottom ruler ticks ───────────────────────────────────
      ctx.strokeStyle = ink(0.10 * a);
      ctx.lineWidth = 0.5;
      const rulerY = H - 28;
      for (let x = 60; x < W - 60; x += 8) {
        const h2 = x % 40 === 0 ? 10 : x % 20 === 0 ? 6 : 3;
        ctx.beginPath(); ctx.moveTo(x, rulerY); ctx.lineTo(x, rulerY + h2); ctx.stroke();
      }
      const rulerX = W - 28;
      for (let y = 60; y < H - 60; y += 8) {
        const w2 = y % 40 === 0 ? 10 : y % 20 === 0 ? 6 : 3;
        ctx.beginPath(); ctx.moveTo(rulerX, y); ctx.lineTo(rulerX + w2, y); ctx.stroke();
      }

      // ── 12. Outer border frame ───────────────────────────────────
      ctx.strokeStyle = ink(0.14 * a);
      ctx.lineWidth = 1;
      const m = 18;
      ctx.strokeRect(m, m, W - m * 2, H - m * 2);
      ctx.strokeStyle = ink(0.05 * a);
      ctx.lineWidth = 0.5;
      ctx.strokeRect(m + 6, m + 6, W - (m + 6) * 2, H - (m + 6) * 2);

      // ── 13. Title block (bottom right) ───────────────────────────
      const tbX = W - 220, tbY = H - 56;
      ctx.strokeStyle = ink(0.14 * a);
      ctx.lineWidth = 0.5;
      ctx.strokeRect(tbX, tbY, 196, 40);
      ctx.beginPath(); ctx.moveTo(tbX, tbY + 16); ctx.lineTo(tbX + 196, tbY + 16); ctx.stroke();
      ctx.font = "7px 'Courier New', monospace";
      ctx.fillStyle = ink(0.30 * a);
      ctx.textAlign = "left";
      ctx.fillText("NOTION BRAIN  //  KNOWLEDGE GRAPH", tbX + 5, tbY + 11);
      ctx.fillText("SYS: NB_MCP_2026   REV.C   UNIT: PX", tbX + 5, tbY + 28);
      ctx.fillText("SCALE 1:1", tbX + 5, tbY + 40);

      raf = requestAnimationFrame(draw);
    };

    draw();

    const onResize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      gsap.killTweensOf(alphaRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed", top: 0, left: 0,
          width: "100%", height: "100%",
          zIndex: 0, pointerEvents: "none",
        }}
      />
      {/* Static paper grain — zero per-frame cost */}
      <div style={{
        position: "fixed", inset: 0,
        zIndex: 1, pointerEvents: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)' opacity='0.028'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "250px 250px",
        mixBlendMode: "multiply",
      }} />
    </>
  );
}