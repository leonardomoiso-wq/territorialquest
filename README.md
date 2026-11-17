# Territorial Quest

Ricerca sul campo cooperativa: team diversi esplorano un territorio, ogni rilievo
validato colora una mappa comune. Nasce dalla tesi di dottorato *Learners, Players,
Designers* e ne corregge il prototipo: niente classifica, un solo punteggio collettivo.

Architettura, modello dei dati e direzione di stile: [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md).

## Cosa c'è

| Percorso | A cosa serve |
|---|---|
| `/` | Presentazione |
| `/accedi` | Accesso e registrazione (email e password) |
| `/entra` | Ingresso dei giocatori con il codice della campagna |
| `/studio` | Elenco delle campagne, creazione |
| `/studio/[id]` | Pannello del master: regia dal vivo, tempi e missioni, editor 3D delle aree, team e giocatori, rilievi, export |
| `/campo/[id]` | App di rilievo per telefono e tablet: uscite a piedi, scatto rapido, sei forme di raccolta, conferma tra team |
| `/mappa/[id]` | Mappa pubblica interattiva: solo contenuti validati, senza nomi; per i membri è anche l'archivio |
| `/contribuisci/[id]` | Contributi individuali, fuori dal gioco dei team, pubblicati dopo la revisione della regia |
| `/stato` | Diagnosi del collegamento al database |
| `/design` | Design system: colori, tipografia, componenti |

## Come si gioca: l'Uscita

La mappa parte spenta. Un'uscita a piedi, con telefono o tablet, ha quattro gesti:

1. **Parti** — l'app conta distanza e tempo e indica la zona spenta più vicina.
2. **Cammina** — le celle attraversate si accendono per tutti i team.
3. **Osserva** — sei forme di raccolta; lo *scatto rapido* salva foto e posizione, la didascalia si scrive dopo.
4. **Conferma** — passando dove ha lavorato un altro team si confermano i suoi rilievi sul posto.

Al rientro un riepilogo mostra che cosa l'uscita ha portato al punteggio comune.
Delle uscite si salvano le celle attraversate e la distanza, non il tracciato GPS.

## Luoghi, percorsi e indagini sul sito

- **Luoghi** (sezione Luoghi della regia): punti di interesse storici, naturalistici, culturali,
  sociali o di paesaggio, con racconto, immagini, raggio di arrivo, punti e domanda guida.
- **Due scale di indagine.** Il territorio si racconta con i rilievi liberi (scala *macro*);
  ogni luogo può avere una **scheda d'indagine sul sito** (scala *micro*): foto, conteggi, misure,
  scale 1–5, scelte, sì/no e testo, compilata sul posto una domanda per schermata. Ci sono schede
  modello per tipo di luogo.
- **Punti**: ogni luogo vale i suoi punti una volta per team, metà all'arrivo (verificato dal
  database sulla distanza) e metà all'indagine o al primo rilievo raccolto lì e confermato da un altro team.
- **Percorsi**: sequenze ordinate di luoghi; sul campo la bussola guida da una tappa alla successiva
  e, durante un'uscita, l'arrivo si registra da solo entrando nel raggio del luogo.

## Mappa pubblica e contributi individuali

Dalla sezione **Pubblico** della regia si accendono la mappa pubblica e i contributi.
La mappa mostra rilievi validati, indagini sui siti, luoghi, percorsi e contributi approvati,
con il nome del team ma mai quello delle persone. Chiunque abbia un profilo può proporre
un contributo su un punto della mappa (licenza CC BY 4.0); la regia lo pubblica o no, con una nota.
I contributi non entrano nel punteggio dei team.

## Accesso e recupero della password

Accesso con email e password. Chi si registra sceglie una **domanda segreta**; chi ha già un
profilo la imposta dal promemoria in Studio. Da «Password dimenticata?» si sceglie una nuova
password rispondendo alla domanda. Le risposte sono salvate cifrate, maiuscole, spazi e accenti non
contano, e dopo 5 errori il recupero si blocca per 15 minuti.

## Raccolta dei dati

Ogni rilievo ha tre coordinate, pensate per la ricerca sul campo:

- **Forma** — che cosa si registra: Immagine, Flusso (tracciato e contato), Percezione
  (intensità e sensi), Dato (valore e unità), Informazione (fatto e fonte), Idea.
- **Lente AEIOU** — di che cosa parla: Attività, Ambiente, Interazioni, Oggetti, Persone. Facoltativa.
- **Field / Desk / Feel** — da dove viene la conoscenza. Si ricava dalla forma, non si chiede.

## Editor 3D delle aree

Nella sezione Aree si disegnano i perimetri, se ne modificano i vertici e si dipinge il
modello a celle con sette ambienti (urbano, verde, acqua, rilievo, rurale, costa,
industriale). Sotto il modello si può tenere in trasparenza la mappa, il satellite, un
servizio di tessere XYZ a scelta oppure un'immagine caricata.

## Avvio

1. **Database.** In Supabase → SQL Editor incolla ed esegui [`supabase/setup.sql`](supabase/setup.sql): contiene tutte le migrazioni in ordine e si può rieseguire senza danni. Poi apri `/stato` sul sito per verificare. L'ultima riga mostrata dall'SQL Editor deve dire «Territorial Quest installato». Se tra gli avvisi compare «Spazio per le foto non configurato», crea da Storage un bucket pubblico chiamato `media`.
2. **Progetto Supabase.** È fissato in `src/utils/supabase/env.ts` (indirizzo e chiave publishable, pubblici per natura). Le variabili `NEXT_PUBLIC_SUPABASE_*` impostate dall'integrazione Vercel vengono ignorate; per puntare a un altro progetto usa `NEXT_PUBLIC_TQ_SUPABASE_URL` e `NEXT_PUBLIC_TQ_SUPABASE_KEY`.
3. **Avvio locale.**

```bash
npm install
npm run dev
```

Su Vercel non serve impostare variabili.

## Verifiche

```bash
npm test              # punteggio, tempi, geografia, export
node scripts/check-schema.mjs   # schema e regole di accesso su Postgres in memoria
npm run build
```

## Struttura

```
src/app        pagine (App Router)
src/studio     sezioni del pannello del master
src/ui         design system (kit, mappa, scena esagonale)
src/domain     logica pura: punteggio, tempi, geografia, export
src/lib        accesso ai dati Supabase e hook
supabase/      migrazioni SQL: tabelle, regole di accesso, funzioni
```

Mappe: MapLibre GL con tessere OpenFreeMap (nessuna chiave richiesta).
