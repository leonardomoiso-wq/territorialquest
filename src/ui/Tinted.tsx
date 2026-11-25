"use client";

import { useId, type ReactNode } from "react";
import { ASSETS } from "@/domain/assets.generated";
import { BASE, rgb } from "@/domain/palette";

/**
 * Illustrazione in scala di grigi ricolorata con i colori del tema (mappa a tre toni):
 * nero → inchiostro, grigio medio → accento, bianco → carta.
 * Così le illustrazioni seguono la palette e la stessa toppa prende il colore di ogni squadra.
 *
 * `name` è «gruppo/nome» come in public/assets (es. "atlante/forma-idea", "toppe/fiume").
 * Se l'asset non c'è ancora si mostra `fallback`.
 */
export function Tinted({
  name, accent, ink = BASE.ink, paper = BASE.card, ratio = 1, small, muted, alt = "", className, fallback = null,
}: {
  name: string;
  accent: string;
  ink?: string;
  paper?: string;
  /** Larghezza / altezza dell'immagine (1 per atlante e toppe, 1.5 per le scene). */
  ratio?: number;
  /** Usa la versione ridotta (256 px per atlante e toppe, 800 px per le scene). */
  small?: boolean;
  /** Casella vuota dell'Atlante: sagoma tenue, senza colore. */
  muted?: boolean;
  alt?: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const id = `tq-tint-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!ASSETS.has(name)) return <>{fallback}</>;
  const group = name.split("/")[0];
  const src = `/assets/${name}${small ? (group === "scene" ? "-800" : "-256") : ""}.webp`;
  const tones = muted ? [BASE.line, BASE["paper-2"], BASE.card] : [ink, accent, paper];
  const [a, b, c] = tones.map(rgb);
  const table = (k: 0 | 1 | 2) => `${a[k] / 255} ${b[k] / 255} ${c[k] / 255}`;
  const W = 100, H = 100 / ratio;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>
      <filter id={id} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={table(0)} />
          <feFuncG type="table" tableValues={table(1)} />
          <feFuncB type="table" tableValues={table(2)} />
        </feComponentTransfer>
      </filter>
      <image href={src} width={W} height={H} preserveAspectRatio="xMidYMid meet" filter={`url(#${id})`} opacity={muted ? 0.9 : 1} />
    </svg>
  );
}
