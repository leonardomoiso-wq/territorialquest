import HexField from "@/ui/HexField";
import { ArrowIcon, Dock, Label, LinkButton, Logo, Ring, Tag } from "@/ui/kit";

const SURFACES = [
  { n: "01", name: "Field", color: "var(--color-field)", title: "Il rilievo, in tasca.", body: "Un'osservazione in meno di trenta secondi: tema, posizione, foto, percezione. Sul territorio, dal telefono." },
  { n: "02", name: "Studio", color: "var(--color-desk)", title: "La regia del master.", body: "Tempi, aree, team e giocatori sotto controllo. Vedi chi è sul campo, cosa manca, dove serve aiuto." },
  { n: "03", name: "Stage", color: "var(--color-feel)", title: "I dati vanno in scena.", body: "La mappa prende colore mentre arrivano i rilievi. Pensata per lo schermo grande e per il pubblico." },
];

const STORY = [
  { title: "Parti", color: "#8b8f98", body: "La mappa è spenta. Inizi un'uscita: da qui l'app conta i passi e ti indica la zona non esplorata più vicina." },
  { title: "Cammina", color: "#f4f3ee", body: "Ogni zona che attraversi si accende, per te e per tutti gli altri team. Nessuno ci tornerà per niente." },
  { title: "Osserva", color: "#37e08b", body: "Foto, flussi, percezioni, dati, informazioni, idee. Uno scatto rapido ora, la didascalia quando ti fermi." },
  { title: "Conferma", color: "#ff9cc2", body: "Passando dove ha lavorato un altro team, confermi i loro rilievi sul posto. Solo allora diventano punti di tutti." },
];

const INDICATORS = [
  { label: "Copertura", v: 0.62, color: "var(--color-glow)", body: "Quanta parte del territorio è stata esplorata." },
  { label: "Equilibrio", v: 0.78, color: "#7fb0ff", body: "Field, Desk e Feel crescono insieme." },
  { label: "Affidabilità", v: 0.54, color: "#ff9cc2", body: "Rilievi confermati da un altro team." },
  { label: "Scambio", v: 0.41, color: "#f5c75a", body: "Validazioni che attraversano i team." },
];

export default function Home() {
  return (
    <main>
      {/* ------------------------------------------------------------ scena */}
      <section className="relative flex min-h-dvh flex-col overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#ffffff_0%,#eef4ee_45%,#dfe9e3_100%)]">
        <HexField className="absolute inset-0 size-full [mask-image:linear-gradient(to_bottom,transparent_0%,transparent_30%,black_78%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[70%] bg-[radial-gradient(60%_70%_at_50%_45%,rgb(255_255_255/0.92),transparent)]" />

        <header className="relative z-10 flex items-start justify-between p-5 sm:p-7">
          <Logo />
          <div className="hidden flex-col items-center gap-1.5 sm:flex">
            <span className="ruler h-2.5 w-56 text-ink/50" />
            <Label>Copertura 62% · 3 team sul campo</Label>
          </div>
          <span className="glass inline-flex h-9 items-center gap-2 rounded-full px-3.5">
            <span className="size-2 rounded-full bg-glow" />
            <span className="num text-sm">1 284</span>
            <span className="label soft whitespace-nowrap">pt insieme</span>
          </span>
        </header>

        <div className="relative z-10 mx-auto mt-[9dvh] max-w-4xl px-6 text-center">
          <Tag className="animate-rise bg-white/60">Ricerca sul campo cooperativa</Tag>
          <h1 className="display mt-6 animate-rise text-[clamp(2.75rem,8vw,6.5rem)] [animation-delay:80ms]">
            Esplora un territorio. <span className="serif italic tracking-normal">Insieme.</span>
          </h1>
          <p className="soft mx-auto mt-6 max-w-xl animate-rise text-lg leading-snug tracking-[-0.01em] [animation-delay:160ms]">
            Team diversi, una sola mappa. Ogni rilievo validato le dà colore: nessuna classifica, si vince
            quando il territorio è conosciuto.
          </p>
        </div>

        <div className="relative z-10 mt-auto flex justify-center pb-28">
          <span className="label soft inline-flex items-center gap-2">
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
            Un&apos;uscita a piedi, <span className="serif italic tracking-normal text-glow">quattro gesti.</span>
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
            Pensato per chi cammina con il telefono o il tablet in mano: la mappa ti segue, uno scatto rapido salva la foto e la
            posizione, i dettagli si scrivono quando ci si ferma.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------- superfici */}
      <section className="on-paper px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <Label>Tre superfici, un solo sistema</Label>
          <h2 className="display mt-3 max-w-3xl text-[clamp(2rem,5vw,3.75rem)]">
            Dal marciapiede allo schermo grande, <span className="soft">senza perdere un dato.</span>
          </h2>
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {SURFACES.map((s) => (
              <article key={s.name} className="surface group relative overflow-hidden rounded-panel border hairline p-7 transition duration-500 hover:-translate-y-1 hover:shadow-float">
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
      <section className="on-ink relative overflow-hidden rounded-t-[48px] px-6 py-28">
        <HexField dark density={22} className="absolute inset-0 size-full opacity-60 [mask-image:radial-gradient(70%_60%_at_80%_100%,black,transparent)]" />
        <div className="relative mx-auto max-w-6xl">
          <Label>Gamification cooperativa</Label>
          <h2 className="display mt-3 max-w-3xl text-[clamp(2rem,5vw,3.75rem)]">
            Un solo punteggio. <span className="serif italic tracking-normal text-glow">Di tutti.</span>
          </h2>
          <p className="soft mt-5 max-w-xl text-lg leading-snug">
            Un rilievo vale solo quando un altro team lo conferma. I doppioni rendono sempre meno. Conta
            aprire zone nuove, non riempire la mappa di puntini.
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
            <Label>Valore di un rilievo</Label>
            <code className="num text-[15px]">
              base(<span className="text-glow">tipo</span>) × <span className="text-[#7fb0ff]">novità</span> ×{" "}
              <span className="text-[#ff9cc2]">qualità</span>
            </code>
            <span className="soft text-sm sm:ml-auto">Le regole sono pubbliche e uguali per tutti.</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ dati */}
      <section className="on-paper px-6 py-28">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-2 md:items-end">
          <div>
            <Label>Interoperabile</Label>
            <h2 className="display mt-3 text-[clamp(2rem,5vw,3.75rem)]">I dati restano tuoi. E si aprono ovunque.</h2>
          </div>
          <div>
            <p className="soft text-lg leading-snug">
              Ogni osservazione nasce geografica. Si esporta in formati standard e si apre in QGIS, R,
              Python o in un foglio di calcolo, con foto e coordinate.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["GeoJSON", "CSV", "EPSG:4326", "Griglia H3", "Media originali", "Tempo reale"].map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- via */}
      <section className="on-ink grid min-h-[80dvh] place-items-center px-6 pb-40 text-center">
        <div>
          <h2 className="serif text-[clamp(4rem,12vw,9rem)]">Pronti?</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/entra" size="lg">Entra con un codice</LinkButton>
            <LinkButton href="/studio" size="lg" variant="outline">Crea una campagna</LinkButton>
          </div>
          <p className="label soft mt-16">Territorial Quest · dalla ricerca «Learners, Players, Designers»</p>
        </div>
      </section>

      <Dock>
        <LinkButton href="/entra" className="min-w-44">
          Entra con un codice <ArrowIcon />
        </LinkButton>
        <LinkButton href="/accedi" variant="ghost">Accedi</LinkButton>
        <LinkButton href="/design" variant="ghost" className="!px-3.5" aria-label="Design system" title="Design system">
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden><circle cx="5" cy="5" r="3" fill="var(--color-field)" /><circle cx="11" cy="5" r="3" fill="var(--color-desk)" /><circle cx="8" cy="11" r="3" fill="var(--color-feel)" /></svg>
        </LinkButton>
      </Dock>
    </main>
  );
}
