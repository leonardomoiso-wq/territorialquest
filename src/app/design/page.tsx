"use client";

import Link from "next/link";
import { useState } from "react";
import HexField from "@/ui/HexField";
import { Area, ArrowIcon, Button, Card, Dot, Empty, Field, IconButton, Label, Logo, Meter, Notice, PlusIcon, Ring, Segmented, Select, Sheet, Stat, Tag } from "@/ui/kit";

const COLORS = [
  ["Inchiostro", "#2b2118", "ink"], ["Inchiostro 2", "#151517", "ink-2"], ["Grafite", "#3d4046", "graphite"], ["Muto", "#8a7d68", "mute"],
  ["Linea", "#d4d3ce", "line"], ["Carta 2", "#eae9e2", "paper-2"], ["Carta", "#f1ead9", "paper"], ["Bianco", "#ffffff", "card"],
];
const ACCENTS = [
  ["Muschio", "#1c4839", "moss"], ["Foglia", "#4a6b43", "leaf – field"], ["Bagliore", "#d6993e", "glow"],
  ["Desk", "#3d6f99", "desk"], ["Feel", "#b8573f", "feel"], ["Sole", "#e8a81c", "sun"], ["Allerta", "#d4452f", "alert"],
];

function Block({ title, kicker, children, ink }: { title: string; kicker: string; children: React.ReactNode; ink?: boolean }) {
  return (
    <section className={`${ink ? "on-ink" : "on-paper"} px-6 py-20`}>
      <div className="mx-auto max-w-6xl">
        <Label>{kicker}</Label>
        <h2 className="display mt-2 mb-10 text-[40px]">{title}</h2>
        {children}
      </div>
    </section>
  );
}

const Swatch = ({ c }: { c: string[] }) => (
  <div>
    <div className="h-24 rounded-card border border-black/10" style={{ background: c[1] }} />
    <div className="mt-2 text-sm">{c[0]}</div>
    <div className="label soft">{c[1]} – {c[2]}</div>
  </div>
);

export default function Design() {
  const [seg, setSeg] = useState("field");
  const [sheet, setSheet] = useState(false);

  return (
    <main>
      <header className="on-ink relative overflow-hidden px-6 pt-6 pb-24">
        <HexField dark className="absolute inset-0 size-full opacity-70 [mask-image:linear-gradient(to_bottom,transparent,black)]" />
        <div className="relative mx-auto max-w-6xl">
          <Link href="/"><Logo /></Link>
          <Label className="mt-24 block">Design system – v0.1</Label>
          <h1 className="display mt-3 text-[clamp(3rem,9vw,7rem)]">
            Il territorio <span className="serif italic tracking-normal text-glow">è la scena.</span>
          </h1>
          <p className="soft mt-6 max-w-xl text-lg leading-snug">
            Scale di grigio che prendono colore con i dati. Interfaccia ridotta a un HUD: un righello, una pillola, un dock.
            Una cosa per volta.
          </p>
        </div>
      </header>

      <Block kicker="01 – Colore" title="Carta, inchiostro e tre famiglie di dato">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">{COLORS.map((c) => <Swatch key={c[0]} c={c} />)}</div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">{ACCENTS.map((c) => <Swatch key={c[0]} c={c} />)}</div>
        <p className="soft mt-8 max-w-2xl text-sm">
          Verde, blu e rosa identificano sempre Field, Desk e Feel: in mappa, nei tag e nei grafici. Il verde bagliore
          è riservato al punteggio collettivo e agli stati «dal vivo».
        </p>
      </Block>

      <Block ink kicker="02 – Tipografia" title="Tre voci">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <Label>Display – Geist 400 – −0,045em</Label>
            <p className="display mt-4 text-[64px]">Esplora insieme</p>
            <p className="soft mt-3 text-sm">Titoli, numeri grandi, interfaccia. Peso unico, spaziatura stretta.</p>
          </div>
          <div>
            <Label>Narrativa – Instrument Serif</Label>
            <p className="serif mt-4 text-[64px] italic">Pronti?</p>
            <p className="soft mt-3 text-sm">Momenti di soglia: ingresso, domande, citazioni dal campo.</p>
          </div>
          <div>
            <Label>Etichette – Geist Mono maiuscolo</Label>
            <p className="label mt-6 !text-base">Copertura 62% – 14:32</p>
            <p className="num mt-3 text-[40px] text-glow">1 284</p>
            <p className="soft mt-3 text-sm">Micro-etichette, codici, coordinate, numeri tabulari.</p>
          </div>
        </div>
      </Block>

      <Block kicker="03 – Azioni" title="Pillole e dock">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Nuovo rilievo</Button>
          <Button variant="glow" size="lg">Avvia la campagna</Button>
          <Button variant="outline">Metti in pausa</Button>
          <Button variant="ghost">Annulla</Button>
          <Button variant="danger">Elimina</Button>
          <Button size="sm"><PlusIcon /> Piccolo</Button>
          <Button disabled>Disattivo</Button>
          <IconButton label="Aggiungi"><PlusIcon /></IconButton>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <div className="glass flex items-center gap-2 rounded-full p-1.5">
            <Button className="min-w-40"><PlusIcon /> Nuovo rilievo</Button>
            <Button variant="ghost">Valida</Button>
            <Button variant="ghost">Missioni</Button>
            <IconButton label="Team" className="!shadow-none">TQ</IconButton>
          </div>
          <span className="glass inline-flex h-9 items-center gap-2 rounded-full px-3.5">
            <span className="size-2 rounded-full bg-glow" /><span className="num text-sm">1 284</span><span className="label soft">pt insieme</span>
          </span>
          <div className="flex flex-col items-center gap-1.5"><span className="ruler h-2.5 w-48 text-ink/60" /><Label>Righello di copertura</Label></div>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Segmented value={seg} onChange={setSeg} options={[{ id: "field", label: "Field", color: "var(--color-field)" }, { id: "desk", label: "Desk", color: "var(--color-desk)" }, { id: "feel", label: "Feel", color: "var(--color-feel)" }]} />
          <Tag color="var(--color-field)">Field</Tag><Tag color="var(--color-desk)">Desk</Tag><Tag color="var(--color-feel)">Feel</Tag>
          <Tag>In attesa</Tag>
          <span className="inline-flex items-center gap-2 text-sm"><Dot color="var(--color-leaf)" live /> sul campo</span>
          <Button variant="outline" onClick={() => setSheet(true)}>Apri un foglio <ArrowIcon /></Button>
        </div>
      </Block>

      <Block ink kicker="04 – Dati" title="Numeri che si leggono da lontano">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Punteggio collettivo" value="1 284" unit="pt" hint="+86 in attesa di validazione" color="var(--color-glow)" />
          <Stat label="Rilievi" value="312" hint="Field 140 – Desk 96 – Feel 76" />
          <Stat label="Sul campo ora" value="17" unit="persone" />
          <Stat label="Tempo rimasto" value="3 g" hint="si chiude venerdì alle 18:00" />
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-8">
          <Ring value={0.62} color="var(--color-glow)" size={84} />
          <Ring value={0.78} color="#8fb3d1" size={84} />
          <Ring value={0.54} color="#e08a6e" size={84} />
          <Ring value={0.41} color="#e8c07a" size={84} />
          <div className="min-w-64 flex-1 space-y-4">
            <div><div className="mb-2 flex justify-between text-sm"><span>Apriamo la zona nord</span><span className="num soft">31/40</span></div><Meter value={0.78} color="var(--color-glow)" /></div>
            <div><div className="mb-2 flex justify-between text-sm"><span>Dieci conferme tra team</span><span className="num soft">4/10</span></div><Meter value={0.4} color="#e08a6e" /></div>
          </div>
        </div>
      </Block>

      <Block kicker="05 – Campi e contenitori" title="Moduli e schede">
        <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 md:grid-cols-2">
          <Card className="space-y-3 !p-6">
            <Field label="Titolo" placeholder="Giardino condiviso di via Cuneo" />
            <Select label="Tema"><option>Ambiente fisico</option><option>Flussi di mobilità</option></Select>
            <Area label="Note" placeholder="Che cosa rende utile questo rilievo?" />
            <Notice tone="ok">Zona nuova per questo tema: vale pieno.</Notice>
            <Notice tone="error">La raccolta è in pausa.</Notice>
          </Card>
          <div className="space-y-6">
            <Card className="!p-6">
              <div className="flex items-center justify-between"><Tag color="var(--color-leaf)">In corso</Tag><span className="label soft">Master</span></div>
              <h3 className="display mt-10 text-[28px]">Aurora, quartiere creativo</h3>
              <p className="soft mt-1.5 text-sm">14 nov, 09:00 → 28 nov, 18:00</p>
            </Card>
            <Empty title="Nessuna missione.">Gli stati vuoti spiegano cosa fare, con una voce in serif.</Empty>
          </div>
        </div>
      </Block>

      <Sheet open={sheet} onClose={() => setSheet(false)} kicker="Foglio" title="Una cosa per volta">
        <p className="soft text-[15px]">Su telefono sale dal basso, su schermi grandi si centra. Ogni azione complessa vive qui, mai in una pagina separata.</p>
        <Button size="lg" className="mt-6 w-full" onClick={() => setSheet(false)}>Ho capito</Button>
      </Sheet>
    </main>
  );
}
