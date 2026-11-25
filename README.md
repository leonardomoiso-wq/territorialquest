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
| `/design` | Design system, nel linguaggio «carta e mappa» |

## Come si gioca: l'Uscita

La mappa parte spenta. Un'uscita a piedi, con telefono o tablet, ha quattro gesti:

1. **Parti** — l'app conta distanza e tempo e indica la zona spenta più vicina.
2. **Cammina** — le celle attraversate si accendono per tutti i team.
3. **Osserva** — sei forme di raccolta; lo *scatto rapido* salva foto e posizione, la didascalia si scrive dopo.
4. **Conferma** — passando dove ha lavorato un altro team si confermano i suoi rilievi sul posto.

Al rientro un riepilogo mostra che cosa l'uscita ha portato al punteggio comune.
Delle uscite si salvano le celle attraversate e la distanza, non il tracciato GPS.

### Vista esplora

Durante l'uscita la mappa si inclina e segue chi cammina:

- **Sagoma di carta** al centro, con l'anello d'azione di 80 m; i compagni di squadra sono sagome più piccole.
- **Cartelli in piedi** per i luoghi: freccia se sono da raggiungere, spunta se raggiunti,
  timbro ocra se completati dal team.
- **Nebbia di carta** leggera sulle zone mai attraversate. Le celle che si accendono hanno una breve dissolvenza nel colore della squadra.
- **Barra in basso**, uguale dentro e fuori dall'uscita: a sinistra lo stemma della squadra (mappa accesa %) che apre lo
  **Zaino**, al centro il gesto principale (*Raccogli* con lo scatto rapido in uscita, *Parti* con il rilievo veloce fuori),
  a destra *Vicino a te* con i prossimi luoghi.
  con lo scatto rapido, *Vicino a te* con i prossimi luoghi.
- **Zaino**: tutte le funzioni in riquadri grandi (Conferma, Foto da completare, Diario, Atlante, Luoghi e percorsi,
  Vicino a te, Squadra e missioni, Vista, Strati, Come si gioca, Rientra); un pallino sullo stemma conta ciò che aspetta.
  Sulla mappa restano solo bussola e «Dove sono».
- **Ricompense**: all'arrivo il cartello esce dal terreno e si alza (0,6 s) e il timbro si calca sulla carta (0,9 s);
  dopo una raccolta la foto vera, come una polaroid, vola nel **Diario**. Ogni momento si chiude con un tocco.
- **Diario**: le proprie raccolte e i luoghi raggiunti, giorno per giorno, con lo stato di conferma e i punti.
- **Atlante del gruppo** (nel pannello del Diario): forme raccolte, tipi di luogo raggiunti e ambienti attraversati
  da tutti i team insieme; le caselle vuote mostrano un invito. Illustrazioni da `public/assets/atlante/`, ricolorate
  con il colore della forma, del tipo o dell'ambiente; dove l'immagine manca c'è l'icona.
- **Riepilogo a taccuino**: pagina a righe con la mini mappa delle celle attraversate (non il tracciato GPS),
  i luoghi raggiunti, i rilievi raccolti e i punti in arrivo per il gruppo.
- **Vista**: Esplora o Piatta; grafica Automatica, Ricca (edifici in rilievo, cielo dell'ora del giorno) o Essenziale.
  In automatica, sotto i 30 fotogrammi al secondo edifici e cielo si spengono da soli.
  Se il telefono chiede meno movimento, le animazioni si fermano.
- **Sicurezza e batteria**: schermo acceso solo durante l'uscita; oltre i 10 km/h compare l'invito a guardare la strada.
- **Mappa di riserva**: se la mappa vettoriale non risponde, sotto resta una mappa chiara a immagini (© OpenStreetMap © CARTO).

### Su telefono

- **App installabile**: dal browser «Aggiungi a schermata Home» (iPhone: Condividi, Aggiungi alla schermata Home).
  Si apre a schermo intero con l'icona di Territorial Quest e parte da «Entra».
- **Senza rete**: le pagine già aperte si riaprono; quelle mai viste mostrano «Senza rete».
  Il service worker conserva solo pagine e file dell'app, mai i dati di Supabase né le tessere della mappa.
- **Foto ridotte prima dell'invio**: lato lungo 1600 px in JPEG (circa 300–500 KB invece di 4–8 MB),
  senza i metadati dello scatto (posizione GPS, modello del telefono). Le immagini sovrapposte alle aree restano a 4096 px.
- **Dove sono**: in Campo e nei contributi; se la posizione non arriva, spiega perché (permesso, localizzazione del computer, segnale).
- Su touch screen i pulsanti piccoli diventano alti 40 px; i pulsanti di zoom compaiono solo su schermi larghi.

## Colori

Tutti i colori stanno in `src/domain/palette.ts`: base (carta, inchiostro), tinte, tipi di luogo, forme, ambienti,
serie dei grafici, squadre, cielo della vista esplora, mappa. Dopo una modifica:

```bash
npm run palette
```

riscrive i token `--color-*` di `src/app/globals.css`. Il test `palette.test.ts` fallisce se CSS e palette non coincidono
o se compare un colore esadecimale scritto a mano fuori dalla palette.
Le illustrazioni si generano in scala di grigi e prendono i colori da qui (vedi `docs/ASSET-GEMINI.md`).

Le immagini generate vanno in `asset-sorgenti/`; `npm run assets` toglie lo sfondo verde, le porta in grigio,
le salva in WebP in `public/assets/` e aggiorna l'elenco `src/domain/assets.generated.ts`.
Nell'interfaccia si mostrano con `<Tinted name="toppe/fiume" accent={colore} />`, che le ricolora con inchiostro, accento e carta.

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

## Dati del territorio (sezione Fonti)

Si trascinano nella sezione **Fonti** della regia più file insieme. Ognuno viene riconosciuto:

- **Indicatori** — CSV con una riga per Comune (o altra chiave), anche per anno o per categoria:
  diventano schede del territorio, confronti a barre e serie nel tempo. Si collegano alle aree
  che si chiamano come i Comuni.
- **Strati di punti** — CSV con coordinate (OSM, Wikidata…): punti sulla mappa; quelli scelti
  (per categoria e distanza dal tracciato) diventano luoghi del gioco.
- **Tabelle** — elenchi e schede descrittive; un elenco senza coordinate diventa luoghi
  «da posizionare», che la regia colloca sulla mappa dalla sezione Luoghi.
- **GeoJSON** — confini (diventano aree), tracciati (strato a puntini), punti.

Le etichette delle colonne sono ricavate dai nomi (con un dizionario per Istat, ISPRA, MEF, OSM)
e si correggono prima di salvare. Fonte e licenza compaiono nella mappa pubblica.

## Punti sulla mappa e contributi sui punti

- Strati di punti, rilievi e contributi si raggruppano in **grappoli** con il numero dei punti; un
  tocco sul grappolo avvicina la mappa. I luoghi del gioco restano sempre singoli.
- Dalla scheda di un luogo o di un punto di uno strato chiunque abbia un profilo può aggiungere
  **foto, informazioni, dati o correzioni** a un valore del file. Passa tutto dalla regia
  (sezione Pubblico). Una correzione approvata si può applicare al file con un tocco. I contributi
  approvati compaiono nella scheda del punto, in «Dalla comunità». Chi partecipa alla campagna può
  contribuire anche quando i contributi pubblici sono chiusi.

## Accesso di regia e accesso giocatori

Ci sono due ingressi separati:

- **`/regia`** — per chi crea e coordina le campagne. Si accede con email e password personali;
  per diventare regia serve il **codice di regia**, che il proprietario del progetto imposta una
  volta dall'SQL Editor di Supabase:

  ```sql
  select public.set_organizer_code('la-tua-parola-segreta');
  ```

  Solo la regia crea campagne (lo impone il database). I tutor non hanno bisogno del codice:
  li promuove il master dalla sezione Team della campagna.
- **`/accedi`** — per chi partecipa. Si entra in una campagna con il codice campagna.

## Recupero della password

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
