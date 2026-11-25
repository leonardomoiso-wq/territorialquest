"use client";

import { useEffect, useRef } from "react";
import { BASE, HUE } from "@/domain/palette";

// colori pieni della palette: gli esagoni accesi devono farsi notare sul fondo neutro
const COLORS = [HUE.leaf, HUE.river, HUE.terracotta, HUE.glow, HUE.plum, HUE.teal, HUE.brick];

/**
 * Territorio astratto: una griglia esagonale in scala di grigi che prende
 * colore dove "arrivano" i rilievi. È la metafora visiva del punteggio collettivo.
 */
export default function HexField({ className, density = 26, dark = false }: { className?: string; density?: number; dark?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    type Cell = { x: number; y: number; h: number; life: number; target: number; color: string; seed: number };
    let cells: Cell[] = [];
    let w = 0, h = 0, r = density, raf = 0, last = 0;
    const pointer = { x: -9999, y: -9999 };

    // rumore deterministico: disegna "quartieri" con altezze diverse
    const noise = (x: number, y: number) => {
      const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    const smooth = (x: number, y: number) =>
      (Math.sin(x * 0.011) + Math.cos(y * 0.014) + Math.sin((x + y) * 0.007)) / 3;

    const build = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      r = Math.max(16, Math.min(density, w / 22));
      const dx = r * Math.sqrt(3), dy = r * 1.5;
      cells = [];
      for (let row = -1; row * dy < h + r * 2; row++) {
        for (let col = -1; col * dx < w + dx; col++) {
          const x = col * dx + (row % 2 ? dx / 2 : 0), y = row * dy;
          const n = noise(col, row), s = smooth(x, y);
          const cluster = s > 0.12 || (s > -0.1 && n > 0.82);
          cells.push({
            x, y, seed: n,
            h: 2 + Math.max(0, s + 0.4) * 16 * n,
            life: 0,
            target: cluster && n > 0.25 ? 1 : 0,
            color: COLORS[Math.floor(noise(row, col * 3) * (s > 0.3 ? 3 : COLORS.length))],
          });
        }
      }
    };

    const hex = (x: number, y: number, rad: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        ctx.lineTo(x + rad * Math.cos(a), y + rad * Math.sin(a));
      }
      ctx.closePath();
    };

    const draw = (t: number) => {
      const dt = Math.min(64, t - last); last = t;
      ctx.clearRect(0, 0, w, h);
      const wave = (t / 9000) % 1.4; // l'onda di scoperta attraversa il territorio
      for (const c of cells) {
        const d = Math.hypot(c.x - pointer.x, c.y - pointer.y);
        const near = d < r * 4.5;
        const reached = c.x / w + c.seed * 0.25 < wave * 1.1;
        const goal = near ? 1 : c.target && (reduce || reached) ? 1 : 0;
        c.life += (goal - c.life) * Math.min(1, dt * (near ? 0.012 : 0.0025));
        const lift = c.h * (0.35 + c.life * 0.65);
        const top = c.y - lift;
        // grigi neutri: chiari su carta, scuri sui pannelli d'inchiostro
        const base = dark ? 40 + c.seed * 14 : 232 - c.seed * 14;
        const grey = dark ? `rgb(${base},${base + 2},${base + 6})` : `rgb(${base},${base},${base - 3})`;

        // lato in ombra: dà spessore al volume
        ctx.globalAlpha = dark ? 0.9 : 1;
        hex(c.x, c.y, r - 1.5);
        ctx.fillStyle = dark ? BASE.night : "rgba(20,22,26,0.12)";
        ctx.fill();
        // faccia superiore
        hex(c.x, top, r - 1.5);
        ctx.fillStyle = grey;
        ctx.fill();
        if (c.life > 0.02) {
          ctx.globalAlpha = Math.min(1, c.life) * (0.8 + c.seed * 0.2);
          ctx.fillStyle = c.color;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    const move = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      pointer.x = e.clientX - b.left; pointer.y = e.clientY - b.top;
    };
    const resize = () => { build(); if (reduce) draw(performance.now()); };

    build();
    raf = requestAnimationFrame(draw);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("resize", resize);
    };
  }, [density, dark]);

  return <canvas ref={ref} aria-hidden className={className} />;
}
