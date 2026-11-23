# Design system

Riferimenti di stile: why.zero.university, learnwithzero.com, app.zero.university (se ne riprende il linguaggio, non il marchio). Idea guida: **il territorio è la scena** — grigio che prende colore con i dati. Pagina di riferimento viva: `/design`.

## Token (`src/app/globals.css`, Tailwind v4 `@theme`)

- Colori: `ink #0b0b0c`, `ink-2`, `ink-3`, `paper #f4f3ee`, `paper-2`, `card #fff`, `line #d4d3ce`, `mute`, `graphite`; accenti `moss`, `leaf #17804f`, `glow #37e08b` (solo punteggio collettivo e stati dal vivo), `field #17804f`, `desk #2f6fe0`, `feel #e2578f`, `sun`, `alert`.
- Font: Geist (display, peso 400, spaziatura −0.045em → utility `display`), Instrument Serif (momenti di soglia, citazioni → `serif`), Geist Mono maiuscolo spaziato (etichette → `label`, numeri → `num`).
- Superfici: `.on-ink` / `.on-paper` invertono testo e bordi per i figli; `glass` e `glass-ink` per i pannelli sulla mappa; `ruler` per il righello dell'HUD; raggi `rounded-card` 22px e `rounded-panel` 32px.
- Animazioni: `animate-rise`, `animate-fade`, `animate-pulse-ring`, `animate-pop`, `animate-burst`; tutte annullate da `prefers-reduced-motion`.

## Componenti (`src/ui/kit.tsx`)

`Button`/`LinkButton` (primary, glow, ghost, outline, danger; sm/md/lg; sempre a pillola), `IconButton`, `Label`, `Tag` (colorato), `Dot` (con `live`), `Card`, `SectionTitle`, `Stat`, `Meter`, `Ring`, `Field`, `Area`, `Select`, `Segmented`, `Dock` (barra flottante in basso: l'azione primaria vive lì), `Sheet` (foglio dal basso su telefono, centrato su desktop; Esc chiude), `Empty` (titolo in serif corsivo che spiega che cosa fare), `Notice` (info, ok, error), `Spinner`.

Componenti di dominio riutilizzabili: `FormTag`, `FormIcon` (`src/campo/Collect.tsx`), `SurveyAnswers` (`src/campo/Survey.tsx`), `KindTag`, `Swatches`, `backdrop()` (`src/studio/shared.tsx`), `MapView` (props per aree, rilievi, flussi, luoghi, percorsi, contributi, giocatori, nebbia e celle accese, modalità 2d/3d/model, disegno, modifica vertici, pennello, sfondi).

## Pattern

- **Campo (telefono)**: mappa a tutto schermo, HUD in alto (campagna e fase a sinistra, pillola «pt insieme» a destra, chip di stato al centro), dock in basso con l'azione principale grande. Durante l'uscita i messaggi si riducono a una riga.
- **Regia (desktop)**: intestazione appiccicosa con fase, codice e Avvia/Pausa; schede `?vista=`; mappa grande a sinistra, colonna di schede a destra.
- **Soglie** (accesso, regia, racconto, riepilogo): fondo inchiostro, titolo serif grande, un solo pulsante.
- Colore per significato: Field/Desk/Feel e forme hanno colori fissi ovunque (mappa, tag, grafici); categorie dei luoghi da `PLACE_CATEGORIES`.
- Mobile prima di tutto: controlla sempre 390×844; niente scroll orizzontale della pagina; bersagli tattili ≥ 40px.
