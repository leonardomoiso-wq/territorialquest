---
name: territorial-quest
description: Progettare, estendere, installare e mantenere Territorial Quest, la piattaforma di ricerca sul campo cooperativa (Next.js + Supabase + MapLibre) nata dalla tesi «Learners, Players, Designers» — uscite a piedi che accendono una mappa esagonale, sei forme di raccolta (immagine, flusso, percezione, dato, informazione, idea), indagini micro sui luoghi, percorsi, punteggio collettivo senza classifica, regia con codice di regia, mappa pubblica e contributi moderati. Usa questa skill ogni volta che l'utente vuole aggiungere o cambiare qualcosa in Territorial Quest o in una piattaforma simile di citizen science, public engagement o field research gamificata — una nuova forma o domanda di raccolta, una sezione della regia, una regola di punteggio, una missione, un campo del database, una schermata del campo, l'export, la mappa pubblica — oppure quando chiede come installare o aggiornare il database Supabase, perché compare «Il database collegato … non è aggiornato», come si diventa regia, che dati raccoglie lo strumento o su quale metodologia si basa. Usala anche per richieste brevi come «aggiungi un tipo di domanda», «il master non riesce a creare la campagna», «metti l'audio nei rilievi».
---

# Territorial Quest

Piattaforma web per la **ricerca sul campo cooperativa**: team diversi esplorano un territorio a piedi, raccolgono dati e li validano a vicenda; ogni rilievo confermato colora una mappa comune. Nasce dalla tesi di dottorato *Learners, Players, Designers* (Design Studies #2) e ne corregge il prototipo, che usava una classifica competitiva su Figma + Google Sheets.

Repository: `leonardomoiso-wq/territorialquest`. Documentazione di progetto: `docs/ARCHITETTURA.md`, `README.md`.

## Principi da non tradire

Questi principi sono le risposte ai difetti emersi nella sperimentazione. Una modifica che li contraddice va discussa con l'utente prima di essere fatta.

1. **Cooperazione, non competizione.** Esiste un solo punteggio, della campagna. Nessuna classifica tra team: i questionari della tesi mostrano che la classifica riduceva lo scambio tra gruppi e premiava la quantità. Ogni team vede il proprio *contributo* al totale, mai una posizione.
2. **Qualità prima della quantità.** Un rilievo vale zero finché un *altro* team (o la regia) non lo conferma; i doppioni nella stessa cella e tema valgono sempre meno (novità ½, ¼, …).
3. **Due scale.** *Macro* = il territorio, raccontato con rilievi liberi camminando. *Micro* = il sito, raccontato con la scheda d'indagine di un luogo, compilata sul posto.
4. **Riservatezza.** Delle uscite si salvano le celle attraversate e la distanza, non il tracciato GPS. La mappa pubblica non mostra mai nomi di persone, solo il team. Le informazioni orali si attribuiscono a un ruolo, non a un nome.
5. **Una cosa per volta.** Interfaccia ridotta a un HUD (righello, pillola del punteggio, dock in basso); ogni azione complessa vive in un foglio (`Sheet`); onboarding e indagini una domanda per schermata.
6. **Interoperabilità.** I dati nascono geografici (EPSG:4326, griglia H3 risoluzione 10) ed escono in GeoJSON e CSV.
7. **Le regole stanno nel database.** Permessi, tempi di raccolta, validazione tra team, arrivi ai luoghi, chi può creare campagne: tutto è imposto da RLS e funzioni SQL, non solo dall'interfaccia.

## Mappa del codice

```
src/domain/     logica pura, testata (vitest): types, scoring, forms, survey, geo, walk, time, environment, export
src/lib/        data.ts (tutte le chiamate Supabase + hook useCampaign in tempo reale), drafts.ts (scatti offline), hooks.ts
src/ui/         kit.tsx (design system), MapView.tsx (MapLibre: 2D, 3D reale, modello a celle), HexField.tsx, Recovery.tsx
src/campo/      app del giocatore: Collect (forme), Survey (indagine micro), useWalk (uscita), Story, Moments
src/studio/     sezioni della regia: Regia, Tempi, Aree, Luoghi, Team, Rilievi(+Dati), Pubblico, SurveyEditor, shared
src/app/        pagine: / · /accedi · /regia · /entra · /studio · /studio/[id]?vista= · /campo/[id] · /mappa/[id] · /contribuisci/[id] · /stato · /design
src/utils/supabase/  env.ts (progetto fissato nel codice), client/server/middleware; src/proxy.ts protegge le aree riservate
supabase/migrations/ schema in file datati e idempotenti → generano supabase/setup.sql e supabase/update.sql
scripts/        check-schema.mjs, check-setup.mjs, build-setup.mjs, copy-map-worker.mjs, dev/fake-supabase.mjs
```

Next.js in questo repository è una versione recente con convenzioni nuove (per esempio `proxy.ts` al posto di `middleware.ts`): prima di usare un'API di Next leggi la guida in `node_modules/next/dist/docs/`, come chiede `AGENTS.md`.

## Procedure

Per ogni modifica segui il percorso **dominio → database → dati → interfaccia → verifica**. Le procedure dettagliate per i casi frequenti sono in `references/recipes.md`; leggi quella che serve:

- nuova **forma di raccolta** o nuovo campo di una forma
- nuovo **tipo di domanda** per l'indagine sul sito
- nuova **sezione della regia**
- nuova **tabella o colonna** (migrazione)
- cambio alle **regole di punteggio** o nuova **missione**
- nuovo contenuto sulla **mappa pubblica**

Prima di toccare database o punteggio leggi `references/data-model.md` (tabelle, regole di accesso, funzioni) e `references/game-and-method.md` (formule, indicatori, metodologia con la letteratura). Per qualunque schermata leggi `references/design-system.md`.

## Database e installazione: gli inciampi già incontrati

Leggi `references/operations.md` quando l'utente parla di Supabase, Vercel, `/stato`, errori «non aggiornato», regia o password. In breve:

- Il progetto Supabase è **fissato in `src/utils/supabase/env.ts`** (URL e chiave *publishable*, pubbliche per natura). Le variabili `NEXT_PUBLIC_SUPABASE_*` impostate dall'integrazione Vercel vengono ignorate perché puntavano a un altro progetto; per sovrascrivere si usano `NEXT_PUBLIC_TQ_SUPABASE_URL` e `NEXT_PUBLIC_TQ_SUPABASE_KEY`.
- L'utente ha più progetti Supabase: quando un errore dice che manca qualcosa, **verifica prima su quale progetto si è eseguito lo script** e su quale punta l'app (`/stato` lo mostra).
- Installazione da zero: `supabase/setup.sql`. Database già installato: `supabase/update.sql` (solo le migrazioni più recenti). Entrambi si rieseguono senza danni e chiudono con una riga di esito.
- La regia si abilita con `select public.set_organizer_code('…');` dall'SQL Editor, poi registrandosi da `/regia`.
- Non chiedere né conservare la password del database: le migrazioni le esegue l'utente dall'SQL Editor.

## Verifica

Prima di dire che una modifica funziona:

```bash
npx tsc --noEmit && npx eslint src && npm test      # tipi, regole, logica di dominio
npm run check-db                                    # schema e regole di accesso su Postgres in memoria (PGlite)
npm run build
```

Per vedere l'interfaccia senza database reale: `npm run fake-db` in un terminale e l'app con `NEXT_PUBLIC_TQ_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_TQ_SUPABASE_KEY=fake`, poi un giro con Playwright su larghezza telefono (390×844) e desktop. Ogni nuova regola di accesso va aggiunta come caso a `scripts/check-schema.mjs`, ogni nuova formula come test in `src/domain/scoring.test.ts`. Dichiara sempre all'utente che cosa è stato provato sul backend simulato e che cosa sul progetto reale.

## Lingua e tono

Tutta l'interfaccia è in italiano, al «tu», frasi brevi e concrete («Zona nuova per questo tema: vale pieno»). Gli stati vuoti spiegano che cosa fare. I nomi nel codice sono in inglese, i commenti in italiano.
