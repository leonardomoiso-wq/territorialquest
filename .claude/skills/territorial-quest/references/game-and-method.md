# Gioco e metodo

## Punteggio cooperativo (`src/domain/scoring.ts`)

```
valore di un rilievo = base(sorgente) × novità × qualità
base: field 10 · desk 6 · feel 8
novità: 1, ½, ¼, ⅛, 1/16 per rilievi successivi nella stessa cella H3 e nello stesso tema (i segnalati non consumano novità)
qualità: 0 finché non è validato · bassa 0.5 · media 1 · alta 1.5
```

- **Luoghi**: per ciascun team valgono `points/2` all'arrivo e `points/2` al primo rilievo raccolto lì e confermato (l'indagine sul sito o un rilievo libero).
- **Camminare** accende le celle ma non dà punti: i punti restano legati a ciò che viene confermato.
- **Griglia adattiva** (`gridResolution` in `src/domain/geo.ts`): i rilievi si salvano sempre in celle H3 di risoluzione 10 (circa 65 m), ma copertura, nebbia e modello usano una risoluzione unica per campagna scelta perché il territorio resti sotto 12.000 celle (10 su un quartiere, 9 sui sei Comuni di un tratto, 8 su una provincia). Le celle fini si riportano a quella grande con `toRes`.
- **Indicatori collettivi**: Copertura (celle del territorio con almeno un rilievo), Equilibrio (min/max tra Field, Desk, Feel), Affidabilità (quota validata), Scambio (validazioni fatte da un team diverso dall'autore).
- **Missioni**: traguardi comuni a tempo — raccolta (n rilievi), esplorazione (n celle), verifica (n validati), scambio (n validazioni tra team) — con filtri per tema e area; alla scadenza si chiudono.
- Il contributo di un team (`byTeam`) si mostra come «punti portati al totale», mai in classifica.

## Ciclo dell'uscita (`src/app/campo/[id]`, `src/campo/useWalk.ts`)

Parti → cammina (le celle attraversate si accendono per tutti; bussola verso la zona spenta più vicina o verso la tappa del percorso) → osserva (scatto rapido salvato sul dispositivo, didascalia dopo) → conferma i rilievi degli altri quando sei entro 80 m → rientra (riepilogo). Arrivo automatico ai luoghi entrando nel raggio. Ricompense brevi a tutto schermo con vibrazione; schermo tenuto acceso. I passi GPS contano solo se plausibili (4–120 m, precisione ≤ 50 m).

## Impianto di raccolta (`src/domain/forms.ts`, `src/domain/survey.ts`)

Tre coordinate indipendenti:
- **Forma** — immagine, flusso (tracciato e conteggio → passaggi/ora), percezione (sensazione, intensità 1–5, sensi), dato (valore e unità), informazione (fatto, ruolo dell'interlocutore), idea; più **indagine** (solo da un luogo).
- **Lente AEIOU** — attività, ambiente, interazioni, oggetti, persone (facoltativa).
- **Sorgente** — Field / Desk / Feel, ricavata: percezione e idea → feel; dato e informazione → field se sul posto, desk se da fonte; il resto → field.

Indagine sul sito: tipi di domanda foto, conteggio, misura, scala 1–5, scelta, multipla, sì/no, testo; schede modello per categoria di luogo; domande salvate insieme alle risposte.

## Riferimenti metodologici (da verificare prima di citarli)

- Rilievo olistico del Design Sistemico — Bistagnino (2011) *Systemic Design*; Battistoni, Giraldo Nohra, Barbero (2019) *Sustainability* 11(16) 4458.
- AEIOU — Doblin Group (1991); Martin & Hanington (2012) *Universal Methods of Design*.
- Studio della vita pubblica — Gehl & Svarre (2013) *How to Study Public Life*; Whyte (1980) *The Social Life of Small Urban Spaces*.
- Percezione — Lynch (1960) *The Image of the City*; Pink (2015) *Doing Sensory Ethnography*; Schafer (1977) *The Tuning of the World*.
- Citizen science e VGI — Goodchild (2007) *GeoJournal* 69; Bonney et al. (2009) *BioScience* 59(11); Shirk et al. (2012) *Ecology and Society* 17(2) (team = modello collaborativo, contributi individuali = contributivo); Haklay (2013).
- PPGIS — Sieber (2006) *Annals AAG* 96(3).
- Qualità dei dati — Kosmala et al. (2016) *Frontiers in Ecology and the Environment* 14(10).
- Gamification e motivazione — Deterding et al. (2011); Deci & Ryan (2000); Zagal, Rick & Hsi (2006) *Simulation & Gaming* 37(1).
- Cornice — Research through Design: Zimmerman, Forlizzi, Evenson (2007) *CHI*.

Lacune dichiarate: campionamento di convenienza, nessun protocollo di fasce orarie per i conteggi, questionari TAM/SUS/GEQ non ancora integrati, niente audio e video.
