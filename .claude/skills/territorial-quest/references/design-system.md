> **Colori**: unica fonte `src/domain/palette.ts` (BASE, HUE, ON_INK, ROLE, PLACE_COLOR, FORM_COLOR, ENV_COLOR, SERIES, TEAM_COLORS,
> INDICATOR, PUBLIC_LAYER, SKY, MAP). `npm run palette` rigenera i token CSS; il test vieta esadecimali scritti a mano altrove.
> Illustrazioni in scala di grigi (inchiostro, accento grigio medio, carta), ricolorate dall'app.
> Neutri senza seppia: carta #f3f2ee, schede #fbfaf7, inchiostro #1c1e22, grigi freddi; ombre rgb(20 22 26). Il calore viene solo dagli accenti.

# Design system

Idea guida: **il territorio è la scena**, carta che prende colore con i dati. Prima versione ispirata a why.zero.university (HUD, dock, una cosa per volta); linguaggio attuale dalla skill `slide-html-territorio`. Pagina di riferimento viva: `/design`.

## Token (`src/app/globals.css`, Tailwind v4 `@theme`)

Linguaggio **carta e mappa** dalla skill `slide-html-territorio` (mappe dei parchi, ritagli di carta, curve di livello, poster di viaggio), palette Appennino:

- Colori: `ink #2b2118` (inchiostro bruno), `brown #3a2a1c` (fondi scuri su lino), `paper #ebe6d8`, `paper-2`, `card #f5f1e6` (ritagli), `edge #fbf8f0` (bordo bianco), `line`, `mute`, `graphite`; `leaf #4a6b43` (verde), `sage #b4c49c`, `glow #d6993e` (ocra: punteggio collettivo e stati dal vivo), `field #4a6b43`, `desk #3d6f99`, `feel #b8573f`, `alert #a8473a`.
- Caratteri: Bricolage Grotesque 500 per i titoli (`display`, `serif` senza corsivo: le parole in evidenza prendono il colore), Hanken Grotesk per il testo, IBM Plex Mono maiuscolo per etichette e numeri (`label`, `num`).
- Texture senza immagini: grana della carta su tutta la pagina (`body::after`, SVG feTurbulence), lino sui fondi scuri (`.on-ink`).
- Utility: `ritaglio` (bordo bianco 5 px, ombra, rotazione alternata −0,35°/+0,4°), `sentiero` (riga a puntini), `cartello` (riquadro mono con bordo; componente `Kick` con numero ocra), `glass`/`glass-ink` per i pannelli sulla mappa, `ruler`.
- Curve di livello: componente `Topo` (anelli deformati da tre sinusoidi, seme deterministico) sulle schermate di soglia e sui fondi scuri.
- Grafici (`src/ui/charts.tsx`): `Bars`, `Lines` (etichette dirette, cursore con valori), `Spark`, `ValueTable`; palette categorica `SERIES` in `src/domain/datasets.ts` verificata sul fondo carta: verde, ocra, blu, rosso, viola, terra, in quest'ordine e assegnata alla chiave, mai al rango.
- Niente punto mediano (·) nei testi: si usa la virgola o il trattino lungo.

## Componenti (`src/ui/kit.tsx`)

`Button`/`LinkButton` (primary, glow, ghost, outline, danger; sm/md/lg; a pillola, comode al pollice), `Kick`, `IconButton`, `Label`, `Tag` (colorato), `Dot` (con `live`), `Card`, `SectionTitle`, `Stat`, `Meter`, `Ring`, `Field`, `Area`, `Select`, `Segmented`, `Dock` (barra flottante in basso: l'azione primaria vive lì), `Sheet` (foglio dal basso su telefono, centrato su desktop; in un portale su `document.body`, sopra ogni intestazione; Esc chiude), `Empty` (titolo in serif corsivo che spiega che cosa fare), `Notice` (info, ok, error), `Spinner`.

Componenti di dominio riutilizzabili: `FormTag`, `FormIcon` (`src/campo/Collect.tsx`), `SurveyAnswers` (`src/campo/Survey.tsx`), `KindTag`, `Swatches`, `backdrop()` (`src/studio/shared.tsx`), `MapView` (props per aree, rilievi, flussi, luoghi, percorsi, contributi, strati, giocatori, raggio d'azione, nebbia e celle accese, modalità `2d` o `model`, disegno, modifica vertici, pennello, sfondi; ridisegna solo le sorgenti i cui ingressi sono cambiati).

## Pattern

- **Campo (telefono)**: mappa a tutto schermo, HUD in alto (campagna e fase a sinistra, pillola «pt insieme» a destra, chip di stato al centro), dock in basso con l'azione principale grande. Durante l'uscita i messaggi si riducono a una riga.
- **Regia (desktop)**: intestazione appiccicosa con fase, codice e Avvia/Pausa; schede `?vista=`; mappa grande a sinistra, colonna di schede a destra.
- **Soglie** (accesso, regia, racconto, riepilogo): fondo inchiostro, titolo serif grande, un solo pulsante.
- Colore per significato: Field/Desk/Feel e forme hanno colori fissi ovunque (mappa, tag, grafici); categorie dei luoghi da `PLACE_CATEGORIES`.
- Mobile prima di tutto: controlla sempre 390×844; niente scroll orizzontale della pagina; bersagli tattili ≥ 40px.

## Prestazioni della mappa

- Niente «3D reale» (rilievo del terreno ed edifici): era pesante sui telefoni e poco utile alla ricerca. Il «Modello» a celle resta solo nell'editor delle aree e come vista facoltativa in regia e sulla mappa pubblica, mai sul campo.
- `MapView` confronta gli ingressi di ogni sorgente (`put`) e ricalcola solo ciò che è cambiato: passa array stabili (memo) e non oggetti ricreati a ogni render.
- La griglia del territorio non supera circa 12.000 celle (griglia adattiva). I calcoli H3 hanno una cache in `cellsOf`.
- Rilievi, contributi e strati di punti usano sorgenti a grappolo (`cluster: true`, raggio 44, fino allo zoom 15): un tocco sul grappolo chiama `getClusterExpansionZoom`. I numeri sui grappoli richiedono i caratteri della mappa di base. I luoghi si raggruppano solo da lontano (fino allo zoom 12, grappolo chiaro con bordo rosso mattone); da vicino sono singoli, con dimensione proporzionata allo zoom, cerchio del raggio d'arrivo e nome dallo zoom 14. Un punto di uno strato già diventato luogo non viene disegnato due volte. Scegliere un luogo dall'elenco lo inquadra.
- `PointSheet` (`src/ui/Layers.tsx`) e le schede dei luoghi includono `Community` e aprono `ContributeSheet` (`src/ui/Contribute.tsx`).
- Le colonne laterali delle sezioni con mappa (Luoghi, Aree) scorrono da sole su schermi larghi (`lg:sticky lg:overflow-y-auto`, alte quanto lo schermo), così la mappa resta ferma; l'elenco dei luoghi ha ricerca e filtro per tipo.
