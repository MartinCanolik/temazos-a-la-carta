# Feature: Musician network — repertoires, shows and live-music discovery

## Objective

Connect musician repertoires, show organization and public live-music discovery. The main value is saving time when building a setlist: pick the lineup, see what everyone knows, reuse past setlists.

## Problem

Today each musician's data is an island:
- Songs are free text per musician (`musico_canciones`).
- Shows (`toques`) are private to one musician, and co-musicians are free text (`con_quien`).
- Setlists only exist inside a single show.
- Nothing is readable across musicians, so lineups, rankings and a public agenda are impossible.

## Scope (from the product brief)

1. Musician profile plus the songs they know, with instrument/role per song, on a shared song catalog.
2. Compatibility: pairwise % = shared / union × 100, always shown with the shared count. Lineup analysis: songs everyone knows, partial songs, who knows each song, % per song ("75% · 3 de 4 músicos"), and the % of a setlist known by the whole lineup.
3. Setlist builder (core): lineup → shared songs → add songs that need rehearsal (visible flag) → reorder → save/edit. Also: browse past setlists, duplicate and adapt, see the last setlists used by the selected musicians.
4. Shared shows. Fields: name, date/time, venue/city/zone, linked musicians, setlist, status (scheduled/done/cancelled), visibility (public/private) and ticket info. Each musician has a private fee, currency and paid status. After the show, a quick confirmation of the songs actually played.
5. Personal stats and economics. Data shown: shows per period, upcoming shows, top venues, top co-musicians, top songs and setlist history. Amounts are split paid vs pending per currency, private to each musician.
6. Community rankings: musicians by shows done, most played songs (confirmed played songs only) and venues. Periods: month, year or all-time, with an optional zone filter. Dedupe: a shared show counts once per participant and once as an event.
7. Public "Música en vivo" section: upcoming public shows, date and city/zone filters, venue, time, musicians with profile links and ticket info. Private shows are excluded.

## Constraints

- Keep the visual identity: red palette, Anton/Inter fonts, the 430px mobile column, CSS modules and tokens in `src/index.css`.
- Mobile-first, simple UX. Reorder uses ↑/↓ buttons.
- Reuse data: a show is loaded once and feeds the agenda, setlist, participation, stats, economics, rankings and public listing.
- Fees are never exposed outside the owning musician (separate table, owner-only RLS; public reads go through views without amounts).
- Existing data in `musico_canciones` and `toques` must be migrated, not dropped.

## Decisions

- **Participation requires confirmation** (user decision, 2026-11-18). When a musician is added to a show, they get a pending invitation. The show only counts for their agenda, stats, rankings and public listing after they accept. The creator is auto-accepted. Rationale: this prevents fake shows inflating rankings and stops anyone listing a musician on a public show without consent.
- **Shared catalog is open.** Any musician can add songs. Dedupe uses a normalized key (the same normalization as `normalizarTexto` in `src/lib/canciones.ts`, mirrored in SQL) plus the Spotify track id when present.
- **Instrument/role per song** is optional and falls back to the profile instruments.
- **Guests without an account** can be added to a show as free-text names. They don't count for compatibility or rankings.
- **Show editing:** accepted participants can edit shared show data. Only the creator can delete.
- **Public visibility:** only musicians with a public profile (slug) appear in rankings and the public agenda.
- **Delivery:** stacked PRs to `main`, one or more per stage, following the existing "Etapa N (k/n)" convention.

## Method

- **TDD:** off. There is no project or session configuration enabling it. Ordinary functional checks plus unit tests for pure logic (Vitest, added in stage 0).
- **Checks per task:**
  - `yarn build` (tsc + vite build)
  - `yarn lint`
  - `yarn test` (from stage 0)
  - `npx supabase db reset` (all migrations plus seed apply cleanly on the local stack)
  - Targeted SQL assertions through `docker exec supabase_db_ipyticieruuqvxlwidcp psql`
- **Review:** RDD is on (default). Run `gentle-ai review assess` after each work-unit commit.

## Tasks

| ID | Task | Route | Status |
|---|---|---|---|
| T0 | Base: Vitest + first tests for `src/lib/canciones.ts`, commit the local Supabase seed and config, sync lockfiles | inline/small | done: 8219f6b, 6d1a110 (branch chore/local-seed); build/lint/test pass; review granted → approved, acknowledged |
| T1 | Shared song catalog: `canciones` table with SQL normalization, migrate `musico_canciones` to reference it, instrument/role per song, catalog autocomplete in MiRepertorio, update seed/types | delegated writer (2+ non-trivial files) | done: 2a3fc71, 42b7e05 (branch feat/catalogo-canciones); db reset, SQL/JS parity, RPC, test (12), lint, build pass; review granted → approved, acknowledged (advisory follow-ups F1–F4 below) |
| T2 | Compatibility and lineup: pure scoring functions with tests, % in the pairwise comparison, lineup picker page with per-song coverage | delegated writer | done: 573db52, 9bd3dcb, d89e8a1 (branch feat/compatibilidad); test (30), lint, build pass; browser check of /panel/formacion as Ana with Bruno+Caro: Ana–Bruno 36%, Ana–Caro 38%, 3 known by all; fixed partial-list sort bug (sorted before counting) with a regression test; review granted → approved, acknowledged (fixes for self-duplication, URL cap and wildcard search folded into T3 as 5e90555) |
| T3 | Setlist builder: standalone setlists (lineup, rehearsal flag, order), create from lineup, duplicate, history, last used by the selected musicians, lineup coverage % | delegated writer | done: 63cec15, 5e90555, 34378b3, 6327f45 (branch feat/repertorios); db reset + RLS/RPC SQL checks, test (55), lint, build pass; browser: as Ana built a 4-song setlist for Ana+Bruno+Caro (add all, add a partial song, reorder, save) → 75% coverage, order and lineup persisted in DB. Decision: setlists readable by any authenticated musician; writable by creator or lineup member; writes only through RPCs; review granted, running |

### Follow-ups from the T1 review (advisory, non-blocking)

- F1: Editing a song's title/artist with only case or accent changes is a no-op, because the spelling lives in the shared catalog. Decide whether the catalog spelling can be corrected, and by whom.
- F2: Catalog search with a query that sanitizes to empty matches anything. Skip the query.
- F3: Catalog migration dedupe should exclude null `cancion_id` from the duplicate window.
- F5 (T3 review, data loss): ArmarRepertorio can save before the stored lineup is seeded into the URL, so `guardar_repertorio` overwrites the lineup with just the viewer. Lineup members without a slug or with unresolved slugs are also dropped on save. Gate saving on the lineup being seeded, and keep members by id.
- F6 (T3 review): `useRepertorios` fetches the latest 200 setlists of the whole community and filters client-side. Filter server-side to the viewer, their lineup memberships, or the selected musicians.
- F7 (T3 review): the `lleno` cap uses resolved members while `parsearSlugs` truncates raw slugs, so an 8th add silently does nothing. Align both.
- F8: the local `spotify-playlist` edge function returns 502 without Spotify secrets, and the client retries it repeatedly. This is pre-existing. Degrade gracefully and limit retries.
- F4: Strengthen tests. Make the "prefers exact catalog match" test discriminating, and cover the add-to-repertoire batch dedupe and the SQL/JS normalization parity.
| T4 | Shared shows: `shows`, participants with invitation state, private fees, played-songs confirmation, migrate `toques`, invitations UI | delegated writer | done: 02c76a5, 3d03a5c, 990de16, c157b46 currency-code fix (branch feat/shows); migration dry-run on old data, db reset, RLS/RPC SQL checks, test (78), lint, build pass; browser as Ana: agenda with invitation/upcoming/past, accepted Caro's invitation (moved to upcoming), show page with lineup states, setlist coverage, private fee and played songs. Review granted → approved, acknowledged; findings G1–G4 sent to the fix pass |
| FX | Fix pass for review follow-ups F1–F3, F5–F8 and G1–G4 | delegated writer | done: c4e3f28, e766e56, 1dd54dd, acba333, 2fb50aa, df88cf4, 3a6b4a0, 62a476e, d6fd38d (branch fix/revisiones-etapas-1-3); db reset, guardar_show stale-save SQL check, test (87), lint, build pass; browser: saved a seeded setlist without ?m= and its 2-member lineup persisted, amounts show "UYU", no spotify retry errors. Review granted → approved, acknowledged |
| FX2 | Second fix pass: H1 pgTAP SQL tests (`supabase test db`) for the RLS/RPC rules (shows: creator-only removal, accepted-only edits, owner-only fees, invitation transitions, salir_de_show, guardar_show additive semantics; setlists: edit permissions; catalog RPC). H2 paginate and order `useRepertoriosDeFormacion` and the membership lookup in `useRepertorios`, server-side, without huge `.in()` URLs. H3 put the history query key under `repertoriosKey` so mutations invalidate it. Note: `guardar_show` was changed in place in its migration, which is acceptable because none of these migrations has been applied outside local dev. Before the first production deploy they ship together. | delegated writer | done: d9ab50b, 9ef0d00, aa8f477, 2be638c, fea0539, 6a9e9ef, 81acc59, 4c02add (branch test/permisos-sql). Includes H1–H4 and J1–J4 (J1 privacy fix: a location-filtered ranking counts public shows only). Checks: db reset; `yarn test:db` (pgTAP 5 files, 100 tests) PASS; test (141); lint; build. Note: fea0539 alone doesn't build (needs 81acc59); the branch tip builds |
| T5 | Personal stats and economics with a period selector | delegated writer | done: 8da78ca, 2c04ac3, 34ddcb4 period selector wrap (branch feat/estadisticas); test (111), lint, build pass; browser as Ana (este año): 3 realizados, 3 próximos, 7 distinct songs, UYU cobrado 3.500 / pendiente 12.000 / previsto 4.000, all matching SQL; "Marcar cobrado" moved 12.000 to cobrado. Review approved and acknowledged. Advisories R3-001 (cobrado_en is `date`, so the string compare is safe) and R3-002 (invalidation verified in the browser) were checked and don't apply; tests for useMarcarCobrado and the PanelHome semantics went to FX2 (H4) |
| T6+T7 | Public "Música en vivo" + community rankings | delegated writer | done: 14867c0, 6bc621e, cbdb4a1, b304bfa (zones filter public-only), c4dfa1b (guests line) (branch feat/musica-en-vivo). Checks passed: db reset; anon SQL asserts; curl (RPCs 200, base tables 401); test (134); lint; build. Browser: Home "Música en vivo" button + Navbar "En vivo"; /shows lists 6 public upcoming shows grouped by date with filters, and excludes Ana from the show where her invitation is pending; /rankings histórico Ana 6 / Bruno 5 / Caro 4, Stand By Me 5. Review approved and acknowledged; J1 (privacy: a location filter counted private shows) and J2–J4 went to FX2. Decision: global rankings count private realizado shows for musicians and songs (aggregates only); venue ranking and any location-filtered ranking count public shows only |
| T6 | Public "Música en vivo" (`/shows`) through a public view without fees | delegated writer | done together with T7 (see the T6+T7 row) |
| T7 | Community rankings (views/RPC, period and zone filters) | delegated writer | done together with T6 (see the T6+T7 row) |

## Progress

- 2026-11-18: Explored the app and mapped it against the brief. Gap analysis done, stages proposed, participation decision taken.

- 2026-11-19: T0–T7 and both fix passes are done, verified and reviewed. Branches are pushed as stacked PRs to `main`.

- 2026-11-19: added a launch flag at the user's request: the app is used live tonight, so Etapa 3 stays hidden. Admins (or everyone with `VITE_RED_MUSICOS=true`) see it. Commit c595631, PR #21. Tests (144), lint and build pass. Browser checks: with the flag off, anonymous and musician users see nothing new and the new routes redirect; an admin sees it. Review assessment returned `under_budget` (278 lines).

## Delivery

Merge the stacked PRs to `main` in order. PR #11 (`vercel.json` SPA rewrite) is independent. Then production setup, which needs the owner of the Supabase project and of Vercel:
- Back up the database.
- Apply the migrations with `supabase db push` (no seed, `migration repair` for objects created by hand).
- Set Auth Site URL and Redirect URLs.
- Set the Vercel env vars and redeploy.
- Assign the admin role.
- Optionally configure custom SMTP.

## Next step

Review and merge the PRs, then run the production setup.
