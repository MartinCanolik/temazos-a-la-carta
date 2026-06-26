# Música a la Carta — Plan de construcción

App **serverless mobile-first** para shows en vivo: el público pide canciones de una
playlist para que la banda las toque. Este documento es la guía para que un ingeniero
(Sonnet) construya la app de punta a punta.

---

## 1. Decisiones cerradas (alcance)

| Tema | Decisión |
|---|---|
| Nombre | Música a la Carta |
| Plataforma | Mobile-first (web app / PWA-ready) |
| Stack frontend | Vite + React + TypeScript + TanStack Query (+ Zustand solo si hace falta) |
| Backend | Supabase (Postgres + Realtime + Edge Functions) |
| Hosting frontend | Vercel (producción pública; desactivar protección de previews si molesta) |
| Auth Spotify | **Client Credentials flow** detrás de una **Supabase Edge Function** (el `client_secret` nunca llega al browser). Sin login de usuarios finales. |
| Scope de búsqueda | Solo dentro de la **playlist del show** (filtrado por nombre de canción/artista) |
| Pantalla "Pedidos" | **Cola GLOBAL** de pedidos de todos (vista compartida del show) |
| Tiempo real | **Sí**, Supabase Realtime sobre la tabla de pedidos |
| Identidad usuario | **Anónimo**: nombre + `device_id` en `localStorage` (para reconocer "mis pedidos") |
| Shows | **Uno solo** activo por ahora (una sola playlist) |
| Panel de banda | **Fuera de alcance** por ahora |
| Duplicados | **Bloqueados**: si una canción ya está pedida en la cola, no se puede volver a pedir (el `+` queda deshabilitado) |
| Límite de carrito | Sin límite por ahora |
| Idioma | Solo español |

### Datos que el cliente debe proveer (estado: parcial)
- [ ] `SPOTIFY_CLIENT_ID`
- [ ] `SPOTIFY_CLIENT_SECRET`
- [ ] `SPOTIFY_PLAYLIST_ID`
- [ ] Proyecto Supabase creado (URL + anon key + service role key)

> Mientras falten, el ingeniero puede avanzar con un **mock** de la playlist y dejar
> las llamadas reales detrás de variables de entorno.

---

## 2. Arquitectura

```
┌─────────────────────┐        ┌──────────────────────────┐        ┌─────────────────┐
│  React SPA (Vercel) │        │  Supabase                │        │   Spotify API   │
│                     │        │                          │        │                 │
│  TanStack Query ────┼──GET──▶│ Edge Function: spotify   ├──CC───▶│ /playlists/{id} │
│  Realtime client ◀──┼──WS───▶│ Realtime (tabla pedidos) │        │   /tracks       │
│  localStorage(devId)│        │ Postgres: pedidos        │        └─────────────────┘
│                     ├──RPC──▶│ (RLS + policies)         │
└─────────────────────┘        └──────────────────────────┘
```

Puntos clave:
- El frontend **nunca** habla directo con Spotify. Siempre vía Edge Function.
- El frontend habla con Postgres vía supabase-js (con RLS) para leer/crear pedidos.
- Realtime empuja los `INSERT`/`DELETE` de la cola a todos los clientes.

### Nota crítica sobre Spotify (riesgo a validar primero)
El 401 que ya vieron tiene 2 causas probables: (a) llamaban desde el browser sin token
de servidor, y (b) el endpoint correcto es `/v1/playlists/{id}/tracks`, no `/items`.
Con **Client Credentials** se puede leer una playlist **pública**. 

**Contingencia:** si Spotify devuelve 401/403 con Client Credentials para esa playlist
(p. ej. por ser colaborativa/privada o por restricciones de la app), el fallback es
**Authorization Code flow** logueando una sola vez la cuenta dueña y guardando el
`refresh_token` en Supabase; la misma Edge Function lo renueva. **Validar esto en la Fase 1
antes de seguir.**

---

## 3. Modelo de datos (Supabase / Postgres)

Por ahora un solo show ⇒ tabla mínima. Diseñada para extender a multi-show luego.

```sql
-- Pedidos de canciones (cola global del show)
create table public.pedidos (
  id            uuid primary key default gen_random_uuid(),
  track_id      text not null,              -- Spotify track id (para bloquear duplicados)
  track_name    text not null,
  artist_name   text not null,
  album_image   text,                       -- url del cover
  requester     text not null,              -- nombre que puso el usuario
  device_id     text not null,              -- id anónimo del dispositivo (localStorage)
  wants_to_sing boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Un track no puede estar dos veces en la cola (bloqueo de duplicados)
create unique index pedidos_track_unico on public.pedidos (track_id);

create index pedidos_created_at_idx on public.pedidos (created_at);

alter table public.pedidos enable row level security;

-- Lectura pública (necesaria también para que Realtime entregue eventos)
create policy "pedidos_select_public"
  on public.pedidos for select
  using (true);

-- Inserción pública (cualquiera puede pedir)
create policy "pedidos_insert_public"
  on public.pedidos for insert
  with check (true);

-- Activar Realtime
alter publication supabase_realtime add table public.pedidos;
```

> El bloqueo de duplicados se hace en DB (índice único) **y** en UI (deshabilitar el `+`).
> El índice único es la garantía dura ante condiciones de carrera.

---

## 4. Pantallas (según mockups)

1. **Home** — banner "Temazos a la Carta", botón **Ver repertorio**, acceso a **Pedidos** (con badge de cantidad).
2. **Repertorio / Search** — buscador "Nombre de la canción/artista" + lista numerada de la playlist con cover, título, artista y botón `+`. Tracks ya pedidos → `+` deshabilitado.
3. **Modal de pedido** — carrito con las canciones seleccionadas (con borrar), input "Tu nombre" (requerido), checkbox "Quiero cantar", botón **Pedir temazo**.
4. **Pedidos** — cola global en tiempo real: lista numerada con canción + nombre del que la pidió.

---

## 5. Plan por fases y procesos

### Fase 0 — Setup del proyecto
- **P0.1** Inicializar Vite + React + TS. Estructura de carpetas (`src/pages`, `src/components`, `src/lib`, `src/hooks`, `src/store`).
- **P0.2** Instalar deps: `@tanstack/react-query`, `@supabase/supabase-js`, router, `zustand` (opcional).
- **P0.3** Config de entorno: `.env` con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Crear `.env.example`.
- **P0.4** Tooling: ESLint + Prettier + tsconfig estricto. Theming base (rojo del mockup, tipografías, estilos mobile-first).
- **P0.5** Layout base mobile (max-width centrado, safe areas).

### Fase 1 — Backend Spotify (Edge Function) ⚠️ validar riesgo acá
- **P1.1** Crear Edge Function `spotify-playlist`: pide token vía Client Credentials, cachea token en memoria hasta expiración.
- **P1.2** Endpoint que devuelve los tracks de la playlist (normalizados: `id`, `name`, `artist`, `albumImage`) paginando `/tracks`.
- **P1.3** Manejo de errores + **validar Client Credentials contra la playlist real**. Si falla → implementar fallback Authorization Code + refresh token.
- **P1.4** Secrets en Supabase (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_PLAYLIST_ID`). Nunca exponer al cliente.

### Fase 2 — Base de datos y Realtime
- **P2.1** Aplicar el SQL de la sección 3 (tabla, índice único, RLS, policies, publication).
- **P2.2** Cliente supabase-js en el frontend (`src/lib/supabase.ts`).
- **P2.3** Hook `usePedidos` (TanStack Query) para fetch inicial de la cola.
- **P2.4** Suscripción Realtime (INSERT/DELETE) que invalida/actualiza la cache de TanStack Query. Cleanup correcto al desmontar.

### Fase 3 — Home
- **P3.1** Componente banner (imagen de fondo + título + recortes de artistas, según mockup).
- **P3.2** Botón "Ver repertorio" → ruta de búsqueda.
- **P3.3** Acceso "Pedidos" con badge contando los pedidos actuales.

### Fase 4 — Repertorio / Search
- **P4.1** Hook `usePlaylist` (TanStack Query) llamando a la Edge Function.
- **P4.2** Lista numerada con cover/título/artista + estados loading/empty/error.
- **P4.3** Buscador con filtro client-side (debounce) por nombre/artista dentro de la playlist.
- **P4.4** Botón `+`: agrega al carrito. Deshabilitado si el track ya está en la cola global (cruzar contra `usePedidos`).

### Fase 5 — Carrito + Modal de pedido
- **P5.1** Estado del carrito (Zustand o context). Agregar/quitar tracks.
- **P5.2** Modal con lista del carrito (borrar item), input nombre (validación requerida), checkbox "Quiero cantar".
- **P5.3** Submit: inserta una fila por track en `pedidos` (con `device_id`, `requester`, `wants_to_sing`). Persistir `device_id` en localStorage.
- **P5.4** Manejo del bloqueo de duplicados: si el índice único rechaza (carrera), mostrar mensaje "esa canción ya fue pedida" y refrescar.
- **P5.5** Feedback de éxito y limpiar carrito.

### Fase 6 — Pedidos (cola global en vivo)
- **P6.1** Pantalla con la cola global ordenada por `created_at`, en tiempo real.
- **P6.2** Cada item: número, cover, canción y nombre del que la pidió.
- **P6.3** (Opcional) resaltar "mis pedidos" comparando `device_id`.

### Fase 7 — Pulido y deploy
- **P7.1** Estados de carga/skeletons, vacíos y errores en todas las pantallas.
- **P7.2** Accesibilidad básica + responsive fino (mobile-first real).
- **P7.3** Deploy a Vercel (env vars de producción). Desactivar protección de previews si se quiere.
- **P7.4** Deploy de la Edge Function y verificación end-to-end con datos reales.
- **P7.5** README con instrucciones de setup y variables de entorno.

---

## 6. Variables de entorno

**Frontend (Vercel / `.env`)**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_EDGE_URL=        # base url de las edge functions
```

**Supabase (secrets de Edge Functions)**
```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_PLAYLIST_ID=
```

---

## 7. Riesgos y notas
- **Spotify Client Credentials** podría no servir para esa playlist → fallback Auth Code (validar en Fase 1, es lo primero a resolver).
- **RLS + Realtime**: sin policy de `SELECT` no llegan eventos. Ya contemplado.
- **Duplicados en condición de carrera**: cubierto por índice único en DB.
- **Rate limits de Spotify**: cachear token y, si hace falta, cachear la respuesta de la playlist unos minutos en la Edge Function.
- **Multi-show futuro**: hoy una sola playlist/cola; si se necesita, agregar tabla `shows` y `show_id` en `pedidos`.
```
