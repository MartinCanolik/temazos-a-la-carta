# Handoff — Música a la Carta

Estado al 25 jun 2026. Actualizar al inicio de cada sesión de trabajo.

---

## Fase 0 — COMPLETADA
Proyecto inicializado. Stack: Vite + React + TypeScript + TanStack Query + Zustand + Supabase.

Estructura relevante:
```
src/
  main.tsx, App.tsx          — Router + QueryClientProvider
  index.css                  — design tokens (rojo, Anton/Inter, mobile-first)
  pages/  Home | Repertorio | Pedidos  (+ .module.css)
  components/  Layout | Navbar | PedidoModal
  store/cartStore.ts         — Zustand (carrito)
  hooks/
    usePedidos.ts            — fetch + count + trackIds + realtime
    useCrearPedidos.ts       — mutación INSERT + manejo de duplicado
  lib/  supabase.ts | database.types.ts | deviceId.ts | spotifyApi.ts
  types/spotify.ts
public/  fondo.webp | artistas.jpeg
```

---

## Fase 1 — COMPLETADA
Edge Function `spotify-playlist` deployada. Devuelve `{ tracks: Track[], cached }`.

**Aprendizajes Spotify (cambios feb/mar 2026):**
- Client Credentials ya no puede leer playlists → se usa Authorization Code + refresh token.
- Endpoint correcto: `/v1/playlists/{id}/items` (el campo de track es `item`, no `track`).
- La cuenta dueña necesita ser collaborator/owner de la playlist y tener Premium.
- `scripts/get-spotify-refresh-token.mjs` obtiene el refresh token (levanta server en `http://127.0.0.1:3000/callback`, registrá esa URI en el dashboard de Spotify).

**Secrets en Supabase (Settings → Edge Functions → Secrets):**
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`  ← ⚠️ rotar antes de producción
- `SPOTIFY_REFRESH_TOKEN`
- `SPOTIFY_PLAYLIST_ID` = `1hzqzUtqzX5mHcOEpdAWnl`

**Deploy:**
```
supabase functions deploy spotify-playlist --project-ref ipyticieruuqvxlwidcp --no-verify-jwt
```
`config.toml` ya tiene `verify_jwt = false` para esta función.

---

## Fase 2 — COMPLETADA
Base de datos + Realtime conectados al frontend.

### SQL aplicado
Archivo: `supabase/migrations/20260625000000_pedidos.sql`

**Cómo aplicarlo en tu entorno:**
- Opción A (recomendada): pegarlo en Supabase Studio → SQL Editor y ejecutar.
- Opción B: `supabase db push` (si tenés el CLI linkeado al proyecto).

Incluye:
- Tabla `public.pedidos` con CHECK constraints de longitud.
- Índice único `pedidos_track_unico (track_id)` — bloqueo duro de duplicados.
- RLS habilitado + policies `SELECT` e `INSERT` públicas.
- Sin policy `DELETE`/`UPDATE` a propósito (se habilitará con el panel de banda).
- Realtime activado vía `supabase_realtime` publication.

### Frontend
- `usePedidos` — fetch inicial + helpers `usePedidosCount` y `usePedidosTrackIds`.
- `usePedidosRealtime` — suscripción Realtime montada una sola vez en `Layout`.
  Escucha `INSERT` y `DELETE`, actualiza el cache de TanStack Query directamente.
  Limpieza correcta con `supabase.removeChannel` al desmontar (compatible con StrictMode).
- `useCrearPedidos` — mutación `INSERT`. Lanza `PedidoDuplicadoError` (código `23505`) si hay condición de carrera.
- `PedidoModal` — inserta pedidos reales, muestra mensaje de duplicado o éxito, limpia carrito.
- `Pedidos.tsx` — cola global en tiempo real (datos reales, estados loading/error/vacío).
- `Repertorio.tsx` — usa `usePedidosTrackIds` para deshabilitar el `+` de canciones ya pedidas.

---

## Fase 3 — PENDIENTE (Home)
- Banner con imagen de fondo + título.
- Botón "Ver repertorio" → `/repertorio`.
- Acceso "Pedidos" con badge en tiempo real.

> `Home.tsx` ya tiene el layout base; falta pulir el banner visual.

---

## Fase 4 — PENDIENTE (Repertorio con datos reales)
- Hook `usePlaylist` (TanStack Query) → llama `spotifyApi.fetchPlaylist()`.
- Reemplazar `MOCK_TRACKS` en `Repertorio.tsx`.
- Buscador con debounce (hoy ya hay un filtro client-side, falta debounce).

---

## Fase 5 — PENDIENTE (Carrito + Modal)
- El modal ya hace INSERT real (ver Fase 2).
- Pendiente: feedback visual de éxito más elaborado, animación de salida.

---

## Fase 6 — PENDIENTE (Pedidos en vivo)
- `Pedidos.tsx` ya muestra la cola real en tiempo real.
- Opcional: resaltar "mis pedidos" comparando `device_id`.

---

## Fase 7 — PENDIENTE (Pulido + deploy)
- Skeletons en Repertorio y Pedidos.
- Deploy a Vercel con env vars de producción.
- README con instrucciones de setup.

---

## Pendientes de seguridad (antes de producción)
1. Rotar el client secret de Spotify (quedó expuesto en una sesión anterior).
2. Regenerar el refresh token con el nuevo client secret.
3. Actualizar los secrets en Supabase.
4. Rotar el `SUPABASE_ACCESS_TOKEN`.

---

## Notas del entorno
- OS Windows, terminal PowerShell.
  - Sintaxis de env vars: `$env:VAR="valor"` (no `export`).
- `supabase secrets set` en CLI no acepta `--project-ref` → cargar por Dashboard.
- Deploy de Edge Functions: `supabase functions deploy <nombre> --project-ref <ref> --no-verify-jwt`.
- Project ref Supabase: `ipyticieruuqvxlwidcp`.
