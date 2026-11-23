# Installazione, aggiornamento, diagnosi

## Progetto collegato

`src/utils/supabase/env.ts` fissa URL e chiave publishable del progetto in uso (oggi `xhqisgmygaqcnhytdwao`). L'integrazione Vercel–Supabase imposta da sola `NEXT_PUBLIC_SUPABASE_URL`/`_KEY`, a volte verso un altro progetto: per questo sono ignorate. Per cambiare progetto: modifica `env.ts` oppure imposta `NEXT_PUBLIC_TQ_SUPABASE_URL` e `NEXT_PUBLIC_TQ_SUPABASE_KEY` su Vercel e ripubblica. Verifica sempre che chiave e URL appartengano allo stesso progetto: `curl https://<ref>.supabase.co/auth/v1/settings -H "apikey: <chiave>"` deve rispondere 200.

## Database

1. Supabase → SQL Editor → New query del **progetto giusto** (link diretto: `https://supabase.com/dashboard/project/<ref>/sql/new`).
2. Database nuovo: incolla `supabase/setup.sql`. Database già installato: `supabase/update.sql`. Su GitHub usa «Copy raw file» per copiare tutto.
3. Run; se compare l'avviso su operazioni distruttive, conferma (sono `drop policy` per ricreare le regole). L'ultima riga dice l'esito.
4. Regia: nuova query `select public.set_organizer_code('…almeno 8 caratteri…');`, poi registrazione da `/regia` con email, password scelta (≥ 10) e codice.
5. Facoltativo per le prove: Authentication → Sign In / Providers → Email → disattiva «Confirm email».
6. Apri `/stato` sul sito: progetto collegato, sessione e una riga per ogni parte del database.

`/stato` e il messaggio d'errore dell'app («Il database collegato (ref) non è aggiornato: manca X») nominano il progetto: se il progetto indicato non è quello in cui l'utente ha eseguito lo script, il problema è il collegamento, non lo script.

Si possono controllare tabelle e funzioni dall'esterno con la chiave publishable: `GET /rest/v1/<tabella>?select=…&limit=1` (PGRST205 = tabella assente, 42703 = colonna assente) e `POST /rest/v1/rpc/<funzione>` (PGRST202 = funzione assente). Per raggiungere un host Supabase da un ambiente cloud può servire aggiungerlo agli host consentiti.

## Vercel

Produzione dal branch `main`. Il worker di MapLibre viene copiato in `public/` da `postinstall` (`scripts/copy-map-worker.mjs`). Nessuna variabile d'ambiente obbligatoria.

## Prove senza database reale

- `npm run check-db` — schema e regole su PGlite (Postgres in memoria con pgcrypto), due passate per l'idempotenza, e `setup.sql` completo su un database senza Storage né Realtime.
- `npm run fake-db` — backend simulato su `localhost:54321` con la campagna di prova «Aurora, quartiere creativo» (team, aree, 140 rilievi, luoghi con indagine, percorso, contributi). Qualsiasi password funziona; codice di regia «Aurora 2026!». Le immagini caricate non vengono servite.
- Con Playwright: nascondi il pulsante di sviluppo di Next (`nextjs-portal`), attendi `networkidle` prima di compilare i moduli, usa `context.setGeolocation` per simulare una camminata.

## Inciampi noti

- Dopo l'accesso si naviga con `window.location.replace` e non con il router: il router ricordava il reindirizzamento all'accesso di quando la sessione non c'era.
- In mappa, mentre si sceglie un punto o si disegna, il tocco posiziona; non apre i dettagli degli elementi sotto.
- Le tessere OpenFreeMap, il satellite Esri e il rilievo AWS possono non essere raggiungibili da ambienti chiusi: la mappa ripiega su un fondo neutro e i dati restano visibili.
- Le foto degli scatti rapidi restano su IndexedDB finché non vengono completate.
