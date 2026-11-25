"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Movimento 3D legato allo scorrimento, senza librerie: ogni figlio con `data-depth` si sposta
 * e ruota in base a quanto è lontano dal centro dello schermo.
 *
 * Attributi (numeri):
 * - data-depth: spostamento verticale in px per mezza altezza di schermo (parallasse);
 * - data-rx0, data-ry0, data-rz0: rotazione di partenza in gradi;
 * - data-rx, data-ry, data-rz: rotazione aggiuntiva per mezza altezza di schermo.
 *
 * Solo trasformazioni (niente ridisegno del layout); con «riduci movimento» tutto resta fermo.
 */
export default function Parallax({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = [...el.querySelectorAll<HTMLElement>("[data-depth]")];
    const num = (n: HTMLElement, k: string) => Number(n.dataset[k] ?? 0);
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = innerHeight;
      for (const n of items) {
        const b = (n.parentElement ?? n).getBoundingClientRect();
        if (b.bottom < -vh || b.top > vh * 2) continue; // fuori schermo: niente calcoli
        const p = (b.top + b.height / 2 - vh / 2) / (vh / 2); // 0 al centro, ±1 a mezzo schermo
        n.style.transform =
          `translate3d(0, ${(-p * num(n, "depth")).toFixed(1)}px, 0) ` +
          `rotateX(${(num(n, "rx0") + p * num(n, "rx")).toFixed(2)}deg) ` +
          `rotateY(${(num(n, "ry0") + p * num(n, "ry")).toFixed(2)}deg) ` +
          `rotateZ(${(num(n, "rz0") + p * num(n, "rz")).toFixed(2)}deg)`;
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(raf); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); };
  }, []);

  return <div ref={root} className={className}>{children}</div>;
}
