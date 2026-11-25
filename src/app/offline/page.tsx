import type { Metadata } from "next";

export const metadata: Metadata = { title: "Senza rete" };

/** Si apre quando manca la connessione e la pagina non è mai stata visitata. */
export default function Offline() {
  return (
    <main className="on-paper relative grid min-h-dvh place-items-center p-6">
      <div className="curve-carta absolute inset-0" aria-hidden />
      <div className="relative max-w-sm text-center">
        <p className="label soft">Senza rete</p>
        <h1 className="display mt-2 text-[34px] leading-tight">Qui il segnale non arriva.</h1>
        <p className="soft mt-3 text-[15px] leading-relaxed">
          Le foto scattate restano sul telefono e le completi quando torna la rete.
          Le pagine già aperte si possono riaprire anche ora.
        </p>
        <a href="/entra" className="mt-6 inline-flex h-12 items-center rounded-full bg-ink px-6 text-paper">Riprova</a>
      </div>
    </main>
  );
}
