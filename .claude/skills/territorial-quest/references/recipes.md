# Procedure frequenti

Ogni procedura finisce con la verifica descritta in SKILL.md.

## Nuova forma di raccolta (es. «audio»)

1. `src/domain/forms.ts`: aggiungi l'id al tipo `Form`, la voce in `FORMS` (etichetta, domanda guida, colore, icona SVG 24×24), la regola in `kindOf()` e il caso in `summary()`.
2. Campi propri: estendi `FormData` e il pannello `Details` in `src/campo/Collect.tsx`. I dati specifici vanno in `observations.data` (jsonb), non in colonne nuove, a meno che servano filtri o indici.
3. Database: nuova migrazione che ricrea `observations_form_check` includendo il nuovo id (e `contributions.form` se vale anche per il pubblico); per i file, aggiorna i `allowed_mime_types` del bucket in un blocco tollerante.
4. Export: colonne in `rows()` e `CSV_HEAD` di `src/domain/export.ts`.
5. Regia e mappa pubblica mostrano la forma tramite `FormTag` e `summary()`: controlla che il riassunto sia leggibile.
6. Test: `kindOf`, `summary` ed export in `scoring.test.ts`.

## Nuovo tipo di domanda per l'indagine sul sito

1. `src/domain/survey.ts`: tipo in `QuestionType`, voce in `QUESTION_TYPES`, formattazione in `formatAnswer()`; eventualmente nelle `SURVEY_TEMPLATES`.
2. `src/campo/Survey.tsx`: ramo in `Step` (grande, a prova di pollice, una domanda per schermata).
3. `src/studio/SurveyEditor.tsx`: campi di configurazione del tipo.
4. Le risposte sono jsonb: nessuna migrazione, a meno di file da caricare (come le foto, caricate prima dell'invio e salvate come percorso).

## Nuova sezione della regia

1. Componente in `src/studio/<Nome>.tsx` che riceve `Ctx` (`data`, `me`, `now`, `refresh`) da `shared.tsx`.
2. Registra la vista in `VIEWS` e nel corpo di `src/app/studio/[id]/page.tsx` (con contatore se c'è una coda).
3. Layout: mappa a sinistra e colonna a destra su desktop; tutto in colonna su telefono.

## Nuova tabella o colonna

Segui le convenzioni in `data-model.md`. Poi: tipi in `src/domain/types.ts`, caricamento in `loadCampaign()` (le tabelle nuove non bloccano l'apertura della campagna se mancano: escludile dal controllo degli errori), tabella in `LIVE_TABLES` se serve il tempo reale, funzioni in `src/lib/data.ts`, controllo in `/stato`, dati di prova in `scripts/dev/fake-supabase.mjs`. Ricorda all'utente di eseguire `supabase/update.sql` sul progetto giusto.

## Regole di punteggio o nuova missione

1. Modifica `src/domain/scoring.ts` mantenendo il principio cooperativo: niente classifiche, niente premi alla sola quantità, nessun vantaggio per chi ha quartieri «più pieni».
2. Una nuova missione: tipo in `MissionKind`, conteggio in `missionProgress()`, etichetta in `MISSION_KIND`, vincolo `missions_kind_check` in una migrazione.
3. Aggiorna `docs/ARCHITETTURA.md` e `references/game-and-method.md`: le regole sono pubbliche per i giocatori.

## Nuovo contenuto sulla mappa pubblica

Aggiungi il campo a `public_map()` (mai `author_id`, email o nomi di persone), al tipo `PublicMap` in `src/lib/data.ts` e alla pagina `src/app/mappa/[id]/page.tsx`. Verifica con `check-schema.mjs` che un utente non autenticato non veda nulla se la mappa non è pubblica.
