import HexField from "@/ui/HexField";
import Parallax from "@/ui/Parallax";
import { ArrowIcon, Dock, Kick, Label, LinkButton, Logo, Ring, Tag } from "@/ui/kit";
import { BASE, HUE, INDICATOR, ON_INK } from "@/domain/palette";

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
