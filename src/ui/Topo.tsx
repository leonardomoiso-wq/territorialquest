"use client";

import { useMemo } from "react";

/**
 * Curve di livello generate (come nella skill «slide-html-territorio»):
 * per ogni anello k, raggio k·step deformato da tre sinusoidi, x allungata di 1,3.
 * Deterministiche: lo stesso seme dà sempre la stessa forma.
 */
export default function Topo({ seed = 1.7, cx = 0.7, cy = 0.4, n = 14, className, opacity = 0.2 }: {
  seed?: number; cx?: number; cy?: number; n?: number; className?: string; opacity?: number;
}) {
  const W = 1600, H = 900;
  const paths = useMemo(() => {
    const step = Math.max(W, H) / (n * 1.15);
    return Array.from({ length: n }, (_, i) => {
      const k = i + 1, r = k * step;
      const pts = Array.from({ length: 121 }, (_, j) => {
        const a = (j / 120) * Math.PI * 2;
        const rr = r * (1 + 0.2 * Math.sin(3 * a + seed + 0.17 * k) + 0.1 * Math.sin(5 * a + 2 * seed - 0.11 * k) + 0.05 * Math.sin(9 * a + 3 * seed));
        return `${(cx * W + rr * 1.3 * Math.cos(a)).toFixed(1)},${(cy * H + rr * Math.sin(a)).toFixed(1)}`;
      });
      return `M${pts.join("L")}Z`;
    });
  }, [seed, cx, cy, n]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden className={className}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="1.3" vectorEffect="non-scaling-stroke" opacity={opacity + (i % 3 === 0 ? 0.08 : 0)} />
      ))}
    </svg>
  );
}
