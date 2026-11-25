import HexField from "@/ui/HexField";
import Parallax from "@/ui/Parallax";
import { Tinted } from "@/ui/Tinted";
import { ArrowIcon, Dock, Kick, Label, LinkButton, Logo, Ring, Tag } from "@/ui/kit";
import { BASE, ENV_COLOR, FORM_COLOR, HUE, INDICATOR, ON_INK, PLACE_COLOR } from "@/domain/palette";

/* Testi: lessico in docs/LESSICO.md (campagna, uscita, rilievo, conferma, squadra, zona, regia). */

const STORY = [
  { title: "Parti", color: BASE.mute, body: "Apri la mappa della campagna e premi Parti. Le zone ancora da esplorare sono velate: l'app ti indica la più vicina." },
  { title: "Cammina", color: ON_INK.cream, body: "Ogni zona che attraversi si accende, per te e per le altre squadre. Così nessuno torna dove si è già stati." },
  { title: "Raccogli", color: HUE.glow, body: "Una foto, un passaggio di persone, una sensazione, un numero, una storia, un'idea. Scatti adesso, scrivi due righe quando ti fermi." },
  { title: "Conferma", color: ON_INK.reliability, body: "Dove è passata un'altra squadra, verifichi i suoi rilievi sul posto. Un rilievo vale punti solo quando qualcun altro lo conferma." },
];

const SURFACES = [
  { n: "01", name: "Campo", color: "var(--color-field)", title: "In tasca, durante l'uscita.", body: "Un rilievo in meno di trenta secondi: posizione, foto, due righe. Il resto si completa con calma, a fine giro." },
  { n: "02", name: "Regia", color: "var(--color-desk)", title: "Chi organizza vede tutto.", body: "Tempi, aree, luoghi, squadre. Chi è in giro, che cosa manca, dove serve una mano. Un messaggio e arriva a tutti." },
  { n: "03", name: "Mappa pubblica", color: "var(--color-feel)", title: "I risultati, per tutti.", body: "La mappa si colora con i rilievi confermati. Si proietta in sala, si apre dal telefono, e chiunque può aggiungere una foto o un ricordo." },
];

const INDICATORS = [
  { label: "Copertura", v: 0.62, color: "var(--color-glow)", body: "Quanta parte del territorio è stata percorsa." },
  { label: "Equilibrio", v: 0.78, color: INDICATOR.balance, body: "Rilievi sul posto, da fonti e di sensazioni crescono insieme." },
  { label: "Affidabilità", v: 0.54, color: INDICATOR.reliability, body: "Quanti rilievi ha confermato un'altra squadra." },
  { label: "Scambio", v: 0.41, color: INDICATOR.exchange, body: "Quante conferme passano da una squadra all'altra." },
];

/** Illustrazione dell'atlante che fluttua: profondità e rotazione dicono quanto si muove scorrendo. */
function Floater({ name, accent, className, depth, rx0 = 0, ry0 = 0, rz0 = 0, rx = 0, ry = 0, rz = 0 }: {
  name: string; accent: string; className: string; depth: number; rx0?: number; ry0?: number; rz0?: number; rx?: number; ry?: number; rz?: number;
}) {
  return (
    <div className={`pointer-events-none absolute [perspective:900px] ${className}`} aria-hidden>
      <div data-depth={depth} data-rx0={rx0} data-ry0={ry0} data-rz0={rz0} data-rx={rx} data-ry={ry} data-rz={rz}
        className="drop-shadow-[0_24px_28px_rgb(20_22_26/.22)] will-change-transform [transform-style:preserve-3d]">
        <Tinted name={name} accent={accent} paper={BASE.edge} className="w-full" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Parallax>
    <main>
      {/* ------------------------------------------------------------ scena */}
      <section className="relative flex min-h-dvh flex-col overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,var(--color-card)_0%,var(--color-paper)_55%,var(--color-paper-2)_100%)]">
        {/* il territorio: un piano inclinato di esagoni che si raddrizza scorrendo, come la vista esplora */}
        <div className="pointer-events-none absolute inset-x-[-20%] bottom-[-6%] h-[72%] [perspective:1100px]" aria-hidden>
          <div data-depth={-60} data-rx0={56} data-rx={38} className="size-full origin-bottom will-change-transform [mask-image:linear-gradient(to_bottom,transparent_0%,black_35%)]">
            <HexField className="size-full" />
          </div>
        </div>
        <Floater name="atlante/ambiente-urbano" accent={ENV_COLOR.urbano.color} depth={140} rx0={8} ry0={-18} ry={14} rz={-4}
          className="top-[58%] -left-10 w-36 sm:top-[46%] sm:left-[4%] sm:w-56" />
        <Floater name="atlante/ambiente-verde" accent={ENV_COLOR.verde.color} depth={220} rx0={6} ry0={20} ry={-16} rz={5}
          className="top-[64%] -right-8 w-32 sm:top-[22%] sm:right-[5%] sm:w-52" />
        <Floater name="atlante/ambiente-acqua" accent={ENV_COLOR.acqua.color} depth={90} ry0={-8} ry={10} rz={3}
          className="hidden sm:block sm:top-[68%] sm:right-[22%] sm:w-40" />

        <header className="relative z-10 flex items-start justify-between p-5 sm:p-7">
          <Logo />
          <div className="hidden flex-col items-center gap-1.5 sm:flex">
            <span className="ruler h-2.5 w-56 text-ink/50" />
            <Label>Copertura 62% – 3 squadre in giro</Label>
          </div>
          <span className="glass inline-flex h-9 items-center gap-2 rounded-full px-3.5">
            <span className="size-2 rounded-full bg-glow" />
            <span className="num text-sm">1 284</span>
            <span className="label soft whitespace-nowrap">pt insieme</span>
          </span>
        </header>

        <div className="relative z-10 mx-auto mt-[8dvh] max-w-4xl px-6 text-center">
          <Kick n="01" className="animate-rise bg-card">Ricerca sul campo, in squadra</Kick>
          <h1 className="display mt-6 animate-rise text-[clamp(2.75rem,8vw,6.5rem)] [animation-delay:80ms]">
            Cammini, e la mappa <span className="text-leaf">si accende.</span>
          </h1>
          <p className="soft mx-auto mt-6 max-w-xl animate-rise text-lg leading-snug tracking-[-0.01em] [animation-delay:160ms]">
            Un gioco di squadra per conoscere un territorio a piedi: si osserva, si fotografa, si raccolgono dati e racconti.
            Nessuna classifica: si vince quando il luogo è conosciuto, da tutti.
          </p>
        </div>

        <div className="relative z-10 mt-auto flex justify-center pb-28">
          <span className="label inline-flex items-center gap-2 rounded-full bg-card/80 px-3 py-1.5 backdrop-blur">
            <span className="inline-block h-5 w-3 rounded-full border border-current/60 after:mx-auto after:mt-1 after:block after:size-1 after:animate-bounce after:rounded-full after:bg-current" />
            Scorri
          </span>
        </div>
      </section>

      {/* ---------------------------------------------------------- storia */}
      <section className="on-ink px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <Label>Come si gioca</Label>
          <h2 className="display mt-3 max-w-3xl text-[clamp(2rem,5vw,3.75rem)]">
            Un&apos;uscita, <span className="text-glow">quattro gesti.</span>
          </h2>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-panel border hairline bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {STORY.map((s, i) => (
              <li key={s.title} className="flex min-h-64 flex-col bg-ink p-7">
                <span className="label soft">{String(i + 1).padStart(2, "0")}</span>
                <span className="mt-6 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((n) => (
                    <svg key={n} viewBox="0 0 24 24" className="size-7"><path d="M12 2 21 7v10l-9 5-9-5V7z" fill={n <= i ? s.color : "transparent"} fillOpacity={n === i ? 1 : 0.35} stroke={n <= i ? s.color : "rgb(255 255 255 / 0.25)"} strokeWidth="1.5" /></svg>
                  ))}
                </span>
                <h3 className="serif mt-auto pt-8 text-[34px]">{s.title}</h3>
                <p className="soft mt-2 text-sm leading-snug">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="soft mt-6 max-w-2xl text-[15px] leading-snug">
            Fatto per camminare con il telefono in mano: la mappa ti segue, i comandi stanno sotto il pollice,
            lo schermo resta acceso finché sei in giro.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- superfici */}
      <section className="on-paper relative overflow-hidden px-6 py-28">
        <Floater name="atlante/luogo-storico" accent={PLACE_COLOR.storico} depth={160} ry0={-14} ry={18} rz={-3}
          className="top-10 -right-14 w-40 opacity-90 sm:top-16 sm:right-[3%] sm:w-56" />
        <Floater name="atlante/luogo-naturalistico" accent={PLACE_COLOR.naturalistico} depth={90} ry0={12} ry={-14} rz={4}
          className="hidden lg:block lg:bottom-6 lg:left-[2%] lg:w-48" />
        <div className="relative mx-auto max-w-6xl">
          <Label>Tre spazi, gli stessi dati</Label>
          <h2 className="display mt-3 max-w-3xl text-[clamp(2rem,5vw,3.75rem)]">
            Dal marciapiede al grande schermo, <span className="soft">senza perdere niente.</span>
          </h2>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {SURFACES.map((s) => (
              <article key={s.name} className="ritaglio group relative overflow-hidden p-7 transition duration-500 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <Tag color={s.color}>{s.name}</Tag>
                  <span className="label soft">{s.n}</span>
                </div>
                <h3 className="display mt-24 text-[30px]">{s.title}</h3>
                <p className="soft mt-3 text-[15px] leading-snug">{s.body}</p>
                <span className="absolute -top-10 -right-10 size-40 rounded-full opacity-15 blur-2xl transition duration-700 group-hover:opacity-35" style={{ background: s.color }} />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- cooperazione */}
      <section className="on-ink relative overflow-hidden px-6 py-28">
        <HexField dark density={22} className="absolute inset-0 size-full opacity-60 [mask-image:radial-gradient(70%_60%_at_80%_100%,black,transparent)]" />
        <div className="relative mx-auto max-w-6xl">
          <Label>Si gioca insieme</Label>
          <h2 className="display mt-3 max-w-3xl text-[clamp(2rem,5vw,3.75rem)]">
            Un solo punteggio. <span className="text-glow">Di tutti.</span>
          </h2>
          <p className="soft mt-5 max-w-xl text-lg leading-snug">
            Non vince una squadra: vince il gruppo. Un rilievo vale solo quando un&apos;altra squadra lo conferma,
            i doppioni valgono sempre meno, le zone nuove valgono di più.
          </p>

          <div className="mt-14 grid gap-px overflow-hidden rounded-panel border hairline bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {INDICATORS.map((i) => (
              <div key={i.label} className="bg-ink p-7">
                <Ring value={i.v} color={i.color} size={72} />
                <h3 className="display mt-8 text-2xl">{i.label}</h3>
                <p className="soft mt-2 text-sm leading-snug">{i.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-panel border hairline px-7 py-5">
            <Label>Quanto vale un rilievo</Label>
            <code className="num text-[15px]">
              base(<span className="text-glow">tipo</span>) × <span className="text-sky-light">novità</span> ×{" "}
              <span className="text-pink-light">qualità</span>
            </code>
            <span className="soft text-sm sm:ml-auto">Regole pubbliche, uguali per tutti.</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ dati */}
      <section className="on-paper relative overflow-hidden px-6 py-28">
        <Floater name="atlante/forma-indagine" accent={FORM_COLOR.indagine} depth={120} ry0={-10} ry={16} rz={-4}
          className="-bottom-8 -left-10 w-36 sm:left-[3%] sm:w-48" />
        <Floater name="atlante/forma-dato" accent={FORM_COLOR.dato} depth={180} ry0={14} ry={-12} rz={3}
          className="hidden md:block md:top-6 md:right-[4%] md:w-56" />
        <div className="relative mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:items-end">
          <div>
            <Label>Dati aperti</Label>
            <h2 className="display mt-3 text-[clamp(2rem,5vw,3.75rem)]">I dati restano vostri. E si aprono ovunque.</h2>
          </div>
          <div>
            <p className="soft text-lg leading-snug">
              Ogni rilievo porta con sé la sua posizione. Si scarica in formati standard e si apre in QGIS, R,
              Python o in un foglio di calcolo, con foto e coordinate.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["GeoJSON", "CSV", "EPSG:4326", "Griglia H3", "Foto originali", "Tempo reale"].map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- via */}
      <section className="on-ink relative grid min-h-[80dvh] place-items-center overflow-hidden px-6 pb-40 text-center">
        <div className="relative">
          <h2 className="serif text-[clamp(4rem,12vw,9rem)]">Si parte?</h2>
          <p className="soft mx-auto mt-4 max-w-md text-lg leading-snug">Ti serve solo il codice della campagna. Te lo dà chi la organizza.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/entra" size="lg">Entra con un codice</LinkButton>
            <LinkButton href="/regia" size="lg" variant="outline">Accesso regia</LinkButton>
          </div>
          <p className="label soft mt-16">Territorial Quest, dalla ricerca «Learners, Players, Designers»</p>
        </div>
      </section>

      <Dock>
        <LinkButton href="/entra" className="min-w-44">
          Entra con un codice <ArrowIcon />
        </LinkButton>
        <LinkButton href="/accedi" variant="ghost">Accedi</LinkButton>
        <LinkButton href="/regia" variant="ghost" className="hidden sm:inline-flex">Regia</LinkButton>
        <LinkButton href="/design" variant="ghost" className="!px-3.5" aria-label="Design system" title="Design system">
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden><circle cx="5" cy="5" r="3" fill="var(--color-field)" /><circle cx="11" cy="5" r="3" fill="var(--color-desk)" /><circle cx="8" cy="11" r="3" fill="var(--color-feel)" /></svg>
        </LinkButton>
      </Dock>
    </main>
    </Parallax>
  );
}
