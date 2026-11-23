"use client";

import { useState } from "react";
import HexField from "@/ui/HexField";
import Topo from "@/ui/Topo";
import { Button, cx, Label } from "@/ui/kit";

const STEPS = [
  { kicker: "La premessa", line: ["La mappa è", "spenta."], body: "Questo territorio lo attraversano in tanti, ma nessuno lo conosce davvero. Per ora è una distesa grigia." },
  { kicker: "Cammina", line: ["Camminando", "la accendi."], body: "Inizia un'uscita e muoviti: ogni zona che attraversi si accende, per te e per tutti gli altri team." },
  { kicker: "Osserva", line: ["Osservando le", "dai colore."], body: "Una foto, un flusso, una percezione, un dato, un'informazione, un'idea. Uno scatto rapido ora, i dettagli quando ti fermi." },
  { kicker: "Conferma", line: ["Conta solo", "insieme."], body: "Un rilievo vale quando un altro team passa di lì e lo conferma. Non c'è classifica: c'è un solo punteggio, ed è di tutti." },
];

/** Racconto d'apertura: una schermata per volta, come si gioca e perché. */
export default function Story({ campaign, onDone }: { campaign: string; onDone: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i], last = i === STEPS.length - 1;
  return (
    <div className="on-ink fixed inset-0 z-[60] flex flex-col overflow-hidden" role="dialog" aria-modal aria-label="Come si gioca">
      <HexField dark density={24} key={i > 0 ? "lit" : "dark"} className={cx("absolute inset-0 size-full transition-opacity duration-1000 [mask-image:linear-gradient(to_bottom,transparent_15%,black_90%)]", i === 0 ? "opacity-20 grayscale" : i === 1 ? "opacity-50 grayscale-[60%]" : "opacity-90")} />
      <Topo seed={2.6 + i * 0.4} cx={0.8} cy={0.2} n={13} className="pointer-events-none absolute inset-0 size-full" opacity={0.12} />
      <div className="relative flex items-center justify-between p-5 sm:p-7">
        <Label>{campaign}</Label>
        <button onClick={onDone} className="label soft transition hover:text-paper">Salta</button>
      </div>
      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-7 pb-10" key={i}>
        <Label className="animate-rise">{String(i + 1).padStart(2, "0")} – {step.kicker}</Label>
        <h2 className="serif mt-4 animate-rise text-[clamp(3.25rem,13vw,6rem)] leading-[0.95] [animation-delay:70ms]">
          {step.line[0]}<br /><span className={cx(i > 0 && "text-glow")}>{step.line[1]}</span>
        </h2>
        <p className="soft mt-6 max-w-md animate-rise text-lg leading-snug [animation-delay:140ms]">{step.body}</p>
      </div>
      <div className="relative flex items-center gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {STEPS.map((_, n) => <span key={n} className={cx("h-1 rounded-full transition-all duration-500", n === i ? "w-10 bg-glow" : n < i ? "w-4 bg-paper/60" : "w-4 bg-paper/20")} />)}
        </div>
        {i > 0 && <Button variant="ghost" onClick={() => setI(i - 1)}>Indietro</Button>}
        <Button variant="glow" size="lg" onClick={() => (last ? onDone() : setI(i + 1))}>{last ? "Ho capito, si parte" : "Avanti"}</Button>
      </div>
    </div>
  );
}
