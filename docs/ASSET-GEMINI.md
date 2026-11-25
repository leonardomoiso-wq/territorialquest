# Asset visivi da generare con Gemini

Guida per produrre le illustrazioni che mancano ad Atlante, toppe, racconto e design system.
Tutti gli asset seguono il linguaggio **carta e mappa**: ritagli di carta sovrapposti, grana, curve di livello, sentieri a puntini.

## Chi fa che cosa

| Che cosa | Chi | Perché |
|---|---|---|
| Illustrazioni (Atlante, toppe, racconto, stati vuoti) | **Gemini** | Immagini ricche, a ritaglio di carta |
| Texture (carta, bordo strappato) | **Gemini** | Materia reale, difficile da disegnare in codice |
| **Icone dell'interfaccia** | **Claude, in SVG** | Devono essere nitide a 20 px, con tratto identico e colore dal tema. Un generatore di immagini non le rende coerenti |
| Caselle vuote dell'Atlante | **Claude, in codice** | Si ricavano dalle piene: sagoma grigia e bordo tratteggiato |
| Immagini d'archivio dei capitoli | **Archivi veri, non Gemini** | Una foto storica inventata falsa la ricerca. Per esempio: Archivio Storico della Città, Europeana, Wikimedia Commons, con licenza e fonte |

## Colori: si generano in grigio, li mette l'app

I colori della piattaforma possono cambiare. Un'immagine generata a colori li terrebbe «stampati» per sempre.
Per questo **tutti gli asset si generano in scala di grigi** e l'app li colora con i colori del tema:

- **grigi scuri** diventano il colore inchiostro;
- **grigi chiari e bianco** diventano il colore carta;
- **grigio medio** diventa il colore d'accento: quello del tipo di luogo, della forma o della squadra.

Le texture invece si sovrappongono al colore in moltiplicazione, come una carta sopra una tinta, e lo lasciano trasparire.

Vantaggi: si cambia la palette in un solo punto e cambiano anche le illustrazioni; la stessa toppa prende il colore di ogni squadra.
Per questo ogni soggetto deve avere **un solo colore d'accento** (le zone in grigio medio), oltre a inchiostro e carta.
Nei prompt qui sotto la parte d'accento è indicata come *mid-grey*: non serve scrivere colori.
Se un'immagine esce colorata lo stesso, aggiungi in fondo: *«Convert to pure grayscale, keep only the three tonal groups.»*

## Regole tecniche

- **Formato**: PNG, il più grande che Gemini permette. Riduco io a WebP nelle misure giuste.
- **Sfondo**:
  - per gli oggetti ritagliati (toppe, caselle, figure) chiedi uno **sfondo verde pieno #00FF00**: lo tolgo io. È l'unico colore ammesso, e solo come sfondo;
  - per scene e texture, sfondo **bianco** (diventa il colore carta).
- **Niente testo** nelle immagini: le scritte le metto io, così si possono tradurre e restano leggibili.
- **Coerenza**: quando un'immagine ti piace, allegala alle richieste successive con la frase
  *«Use the attached image as the exact style reference: same paper texture, same palette, same lighting, same line weight.»*
- **Nomi dei file**: usa esattamente quelli indicati qui sotto.
- **Come farmeli avere**: caricali qui nella chat oppure in una cartella `asset-sorgenti/` del repository.

## Prompt di stile (da mettere all'inizio di ogni richiesta)

I prompt sono in inglese perché i generatori di immagini lo seguono con più precisione.

```
Flat paper-cut collage illustration made of layered hand-cut paper, slightly irregular cut edges,
soft short drop shadows between layers, visible fine paper grain.
GRAYSCALE ONLY, exactly three tonal groups: near-black for outlines and dark details,
near-white for paper surfaces, and one flat mid-grey (about 50%) for the accent parts.
Wherever a color is mentioned below, render that part in the flat mid-grey instead.
Recurring motifs: topographic contour lines, dotted walking trails, small hexagons.
Calm, warm, field-notebook mood. No text, no letters, no numbers, no logos, no gradients,
no 3D render, no photorealism, no recognizable faces. Centered subject, generous empty margin.
```

---

## 1. Texture (3 file)

| File | Misura | Prompt (dopo lo stile) |
|---|---|---|
| `texture-carta.png` | quadrato, ripetibile | `Seamless tileable grayscale texture of recycled paper, almost white with subtle fibers and grain, no objects, perfectly even lighting, edges must tile seamlessly.` |
| `texture-strappo.png` | largo 4:1 | `A long horizontal strip of near-white torn paper seen from above, the bottom edge ragged and fibrous like freshly torn paper, top edge straight, on a solid #00FF00 background, no shadow on the background.` |
| `texture-curve.png` | quadrato, ripetibile | `Seamless tileable pattern of thin light-grey topographic contour lines on white, irregular organic hills, no labels.` |

Usi: sfondo delle schede, **nebbia che si strappa** mentre il gruppo cammina, fondo del taccuino.

## 2. Atlante: forme di raccolta (7 file)

Una casella per forma, **quadrata**, soggetto unico al centro, sfondo #00FF00.

| File | Prompt (dopo lo stile) |
|---|---|
| `atlante-forma-immagine.png` | `A paper-cut instant photo print with a tiny landscape inside (hill, tree, path), tilted slightly, moss green accents.` |
| `atlante-forma-flusso.png` | `Three paper-cut curved arrows flowing along a dotted path, like movement of people along a street, mid-grey accents.` |
| `atlante-forma-percezione.png` | `A paper-cut ear and a small sun and wind swirl together, representing senses and atmosphere, mid-grey accents.` |
| `atlante-forma-dato.png` | `A paper-cut tally counter and a small ruler with tick marks, mid-grey accents.` |
| `atlante-forma-informazione.png` | `A paper-cut speech bubble with an old folded letter tucked behind it, mid-grey accents.` |
| `atlante-forma-idea.png` | `A paper-cut seed sprouting with a small glowing spark above it, mid-grey accents.` |
| `atlante-forma-indagine.png` | `A paper-cut clipboard with a magnifying glass resting on a tiny map, mid-grey accents.` |

## 3. Atlante: tipi di luogo (7 file)

Quadrati, sfondo #00FF00, ognuno come un **cartello da sentiero in piedi** con il simbolo del tipo.

| File | Prompt (dopo lo stile) |
|---|---|
| `atlante-luogo-storico.png` | `A paper-cut trail sign post with a small stone arch bridge and an old tower, mid-grey board.` |
| `atlante-luogo-naturalistico.png` | `A paper-cut trail sign post with an oak leaf, a small bird and a pine, mid-grey board.` |
| `atlante-luogo-culturale.png` | `A paper-cut trail sign post with a theatre curtain and a small museum facade, mid-grey board.` |
| `atlante-luogo-sociale.png` | `A paper-cut trail sign post with a bench under a tree and a small market stall, mid-grey board.` |
| `atlante-luogo-paesaggio.png` | `A paper-cut trail sign post with layered hills and a viewpoint telescope, mid-grey board.` |
| `atlante-luogo-ospitalita.png` | `A paper-cut trail sign post with a small house, a cup and a bed, mid-grey board.` |
| `atlante-luogo-altro.png` | `A paper-cut trail sign post with a question-mark-shaped dotted path (no actual letter), mid-grey board.` |

## 4. Atlante: ambienti (7 file)

Esagoni di carta in rilievo, quadrati, sfondo #00FF00.

| File | Prompt (dopo lo stile) |
|---|---|
| `atlante-ambiente-urbano.png` | `A single paper-cut hexagon tile seen at a slight angle, with tiny paper buildings and streets on top, mid-grey.` |
| `atlante-ambiente-verde.png` | `A single paper-cut hexagon tile with tiny paper trees and a lawn, mid-grey.` |
| `atlante-ambiente-acqua.png` | `A single paper-cut hexagon tile with a river and small waves, mid-grey.` |
| `atlante-ambiente-rilievo.png` | `A single paper-cut hexagon tile with layered paper hills and contour lines, mid-grey.` |
| `atlante-ambiente-rurale.png` | `A single paper-cut hexagon tile with striped fields and a haystack, mid-grey.` |
| `atlante-ambiente-costa.png` | `A single paper-cut hexagon tile with a sandy shore and pebbles, mid-grey.` |
| `atlante-ambiente-industriale.png` | `A single paper-cut hexagon tile with a small warehouse, a chimney and rails, mid-grey.` |

## 5. Toppe di gruppo (12 file)

Toppe **ricamate e cucite**, rotonde o a scudo, bordo a punto festone, quadrate, sfondo #00FF00.
Aggiungi allo stile: `Embroidered fabric patch with a satin-stitch border, visible thread texture, sewn-on look.`

| File | Si guadagna quando… | Prompt (dopo lo stile) |
|---|---|---|
| `toppa-prima-alba.png` | prima uscita prima delle 8 | `Round patch with a rising sun over a hill, mid-grey accent.` |
| `toppa-ultima-luce.png` | uscita dopo il tramonto | `Round patch with a crescent moon and a lit street lamp, mid-grey accent.` |
| `toppa-fiume.png` | celle d'acqua percorse | `Round patch with a winding river and a small bridge, mid-grey accent.` |
| `toppa-dieci-voci.png` | 10 informazioni raccolte | `Round patch with overlapping speech bubbles, mid-grey accent.` |
| `toppa-primo-luogo.png` | primo luogo raggiunto | `Shield patch with a trail sign and a check stamp, mid-grey accent.` |
| `toppa-percorso.png` | percorso completato | `Shield patch with a dotted trail connecting three dots, mid-grey accent.` |
| `toppa-cento-celle.png` | 100 celle accese | `Round patch with a honeycomb of small hexagons lit up, mid-grey accent.` |
| `toppa-tutte-le-forme.png` | almeno un rilievo per forma | `Round patch with seven small mid-grey dots arranged in a circle.` |
| `toppa-corale.png` | indagine corale completata | `Round patch with three small paper figures holding hands around a sign, mid-grey accent.` |
| `toppa-scambio.png` | 20 conferme tra team | `Round patch with two hands passing a small map, mid-grey accent.` |
| `toppa-meta-mappa.png` | metà mappa accesa | `Round patch with a hexagon half filled, mid-grey accent.` |
| `toppa-pioggia.png` | uscita sotto la pioggia | `Round patch with an umbrella and rain drops over a path, mid-grey accent.` |
| `stemma-base.png` | base vuota dello stemma di squadra | `Blank fabric shield badge, near-white fabric with a near-black stitched border, nothing inside.` |

## 6. Racconto e momenti (9 file)

Scene **orizzontali 3:2**, mid-grey.

| File | Dove | Prompt (dopo lo stile) |
|---|---|---|
| `racconto-parti.png` | Come si gioca 1 | `A small group of paper-cut walkers (no faces) at the edge of a pale paper map, morning light.` |
| `racconto-cammina.png` | Come si gioca 2 | `A dotted trail across hexagon tiles that light up in moss green behind a walking paper figure.` |
| `racconto-osserva.png` | Come si gioca 3 | `A paper-cut hand holding a phone framing a facade, with small floating paper notes around.` |
| `racconto-conferma.png` | Come si gioca 4 | `Two paper-cut figures from different teams meeting at a sign post, exchanging a stamped card.` |
| `vuoto-rilievi.png` | elenco vuoto | `An open empty field notebook with a pencil and a single dotted path, very sparse.` |
| `vuoto-luoghi.png` | nessun luogo | `A single blank trail sign post on an empty paper hill.` |
| `senza-rete.png` | pagina Senza rete | `A paper-cut walker in a valley with a small antenna far away, dotted signal waves fading.` |
| `taccuino-fondo.png` | riepilogo a taccuino | `A top view of an open lined field notebook on paper, empty pages, a pencil and a paper clip on the edge.` |
| `maxischermo-fondo.png` | momento corale | `A wide dark paper cityscape silhouette along the bottom, empty sky above, very calm. Aspect 16:9.` |

## 7. Icone: tavola di riferimento (facoltativa, 1 file)

Le icone le disegno io in SVG. Se vuoi orientare lo stile, genera una tavola di riferimento:

```
An icon style sheet on white paper: 16 simple line icons in a 4x4 grid, 1.7 px rounded ink strokes,
geometric and friendly, for a field research map app: camera, walking person, trail sign, hexagon,
compass, map pin, check stamp, notebook, magnifier, speech bubble, seed, counter, wave, team flag,
layers, route. No text, consistent line weight, no fill.
```

File: `icone-riferimento.png`. Non la uso così com'è: ridisegno ogni icona in SVG con lo stesso spirito.

---

## Che cosa ne faccio quando arrivano

1. Tolgo lo sfondo verde, ritaglio e riduco in WebP (Atlante e toppe a 512 e 256 px, scene a 1600 px).
   Normalizzo i grigi nei tre gruppi (inchiostro, accento, carta) così la colorazione dal tema è pulita.
2. Ricavo da sole le **caselle vuote** dell'Atlante (sagoma tenue e bordo tratteggiato).
3. Creo la pagina **Design system** aggiornata (`/design`) con colori, caratteri, icone SVG, illustrazioni e regole d'uso.
4. Costruisco **Atlante** e **toppe** nell'app.

Il minimo per partire con l'Atlante sono le sezioni **2, 3 e 5**: 7 forme, 7 tipi di luogo, 12 toppe e lo stemma.
