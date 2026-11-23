# Modello dei dati

Tutto in `public`, regole di accesso con RLS. Funzioni di ruolo: `is_member(c)`, `is_staff(c)` (master o tutor), `can_collect(c)` (membro attivo e, per i giocatori, campagna `live` dentro `starts_at…ends_at`), `is_organizer()`, `can_contribute(c)`.

## Tabelle

| Tabella | Contenuto | Chi scrive |
|---|---|---|
| `profiles` | id = auth.users.id, `display_name` | trigger su auth.users o `ensure_profile()` all'accesso |
| `organizers` | utenti di regia (possono creare campagne) | `claim_organizer(code)` |
| `settings` | riga unica: `organizer_code_hash` | solo `set_organizer_code()` dall'SQL Editor |
| `campaigns` | nome, `join_code`, `status` draft/live/paused/closed, `starts_at`/`ends_at`, centro e zoom, `basemap`/`basemap_url`/`basemap_opacity`/`overlay`, `public_map`, `contributions_open`, `public_intro` | regia (insert), staff (update) |
| `memberships` | campagna × utente: `role` master/tutor/player, `team_id`, `field_role`, `status` active/suspended, `last_seen_at`, `last_lng/lat` | `join_campaign`, `choose_team`, `heartbeat`; staff |
| `teams` | nome, colore | staff |
| `areas` | poligono GeoJSON, colore, team assegnato, `opens_at`/`closes_at`, `environment`, `terrain` {cella: ambiente} | staff |
| `themes` | macro-temi (6 creati con la campagna) | staff |
| `missions` | `kind` observations/coverage/validation/exchange, `target`, tema/area, finestra temporale | staff |
| `observations` | rilievo: `kind` field/desk/feel, `form`, `lens`, titolo, nota, `feeling`, `source_url`, `media_path`, `lng/lat`, `cell` H3, `path` (flussi), `data` jsonb, `place_id`, `status` pending/validated/flagged, `quality` 1–3, `validated_by` | autore se `can_collect`; validazione solo via `validate_observation` |
| `announcements` | messaggi della regia, a tutti o a un team | staff |
| `walks` | uscita: `distance_m`, `cells` attraversate, inizio e fine | la persona stessa |
| `places` | luogo: categoria (anche `ospitalita`), racconto, `prompt`, `radius_m`, `points`, `images`, `survey` (domande), `source`, `attributes` (colonne del file d'origine), `placed` (false = da posizionare, invisibile e non raggiungibile) | staff |
| `routes` | percorso: `stops` (id dei luoghi in ordine), colore | staff |
| `visits` | arrivo a un luogo, unico per persona | solo `check_in()` |
| `recovery` | domanda segreta e risposta cifrata, tentativi | solo funzioni |
| `datasets` | dati del territorio: `kind` indicatori/punti/linee/tabella, colonne chiave/tempo/categoria/etichetta, `columns` [{key,label,type,unit}], `rows` jsonb (per le linee una FeatureCollection), fonte, licenza, `public` | staff; pubblico tramite `public_datasets(c)` |
| `contributions` | contributo individuale: forma, testo, foto, posizione, `display_name`, `status` pending/approved/rejected, nota di revisione | autore (pending), staff (revisione) |

Storage: bucket pubblico `media` (foto di rilievi, luoghi, indagini, contributi, sfondi).

## Funzioni (RPC)

- `join_campaign(code)`, `choose_team(c, t, r)`, `heartbeat(c, lng, lat)`
- `validate_observation(obs, q, new_status)` — un giocatore non valida i propri rilievi né quelli del proprio team
- `check_in(p, lng, lat)` — verifica la distanza (raggio + 25 m) e la raccolta aperta; restituisce `{distance, first_for_team}`
- `set_recovery`, `has_recovery`, `recovery_question(email)`, `reset_password(email, answer, new_password)` — risposta normalizzata (maiuscole, spazi, accenti), 5 errori → 15 minuti di blocco; una risposta sbagliata restituisce `false` invece di sollevare errore, così il contatore resta salvato
- `set_organizer_code(code)` (solo SQL Editor), `claim_organizer(code)`, `is_organizer()`
- `public_map(c)` — tutto ciò che è validato, senza `author_id` né nomi; se la campagna non è pubblica la vedono solo i membri; con soli contributi aperti mostra territorio e luoghi ma non i dati
- `ensure_profile()` — rete di sicurezza se il trigger su auth.users non si è potuto creare

## Convenzioni delle migrazioni

- Un file per modifica in `supabase/migrations/AAAAMMGGhhmmss_nome.sql`, **idempotente**: `create … if not exists`, `drop policy if exists` + `create policy`, `alter table … add column if not exists`, vincoli aggiunti dentro `do $$ … if not exists (select from pg_constraint …)`.
- Niente `drop` su `auth.users` o su oggetti di `storage`: nei progetti Supabase recenti può non essere permesso e un errore annulla l'intero script. Le parti che toccano Storage, Realtime e auth stanno in blocchi `do $$ … exception when others then raise warning … end $$`.
- Concedi esplicitamente: `grant` sulle tabelle a `authenticated`, `revoke all … from public, anon` e `grant execute` mirati sulle funzioni.
- Chiudi con `notify pgrst, 'reload schema';`.
- Dopo ogni migrazione: aggiorna `scripts/build-setup.mjs` (numero di tabelle attese, `UPDATE_FROM`), esegui `node scripts/build-setup.mjs`, aggiungi i casi a `scripts/check-schema.mjs`, aggiorna i controlli di `src/app/stato/page.tsx` e i tipi in `src/domain/types.ts`.
