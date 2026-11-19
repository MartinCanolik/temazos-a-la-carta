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
| T0 | Base: Vitest + first tests for `src/lib/canciones.ts`, commit the local Supabase seed and config, sync lockfiles | inline/small | pending |
| T1 | Shared song catalog: `canciones` table with SQL normalization, migrate `musico_canciones` to reference it, instrument/role per song, catalog autocomplete in MiRepertorio, update seed/types | delegated writer (2+ non-trivial files) | pending |
| T2 | Compatibility and lineup: pure scoring functions with tests, % in the pairwise comparison, lineup picker page with per-song coverage | delegated writer | pending |
| T3 | Setlist builder: standalone setlists (lineup, rehearsal flag, order), create from lineup, duplicate, history, last used by the selected musicians, lineup coverage % | delegated writer | pending |
| T4 | Shared shows: `shows`, participants with invitation state, private fees, played-songs confirmation, migrate `toques`, invitations UI | delegated writer | pending |
| T5 | Personal stats and economics with a period selector | delegated writer | pending |
| T6 | Public "Música en vivo" (`/shows`) through a public view without fees | delegated writer | pending |
| T7 | Community rankings (views/RPC, period and zone filters) | delegated writer | pending |

## Progress

- 2026-11-18: Explored the app and mapped it against the brief. Gap analysis done, stages proposed, participation decision taken.

## Next step

T0.
