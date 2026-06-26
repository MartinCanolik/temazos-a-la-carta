# Fase 1 — Edge Function de Spotify (`spotify-playlist`)

> **Actualización jun 2026:** Spotify cambió en feb/mar 2026 el acceso a playlists para
> apps en Development Mode. `GET /playlists/{id}/items` ahora requiere un **token de
> usuario** que sea dueño o colaborador. Client Credentials (sin usuario) siempre da 403.
> Esta guía ya refleja el flujo correcto: **Authorization Code + refresh token**.

Spec auto-contenido para implementar y deployar la función serverless que expone los
tracks de la playlist del show. El frontend nunca habla con Spotify directo.

---

## 0. Objetivo y criterios de aceptación

**Objetivo:** `GET {EDGE_URL}/spotify-playlist` devuelve `{ tracks: Track[] }` con los
tracks reales de la playlist, usando un token de usuario renovado automáticamente.

**Done cuando:**
- [ ] El script `scripts/get-spotify-refresh-token.mjs` produce un `refresh_token` válido.
- [ ] `GET .../functions/v1/spotify-playlist` responde `200` con `{ tracks: Track[] }`.
- [ ] Cada `Track` tiene `{ id, name, artist, albumImage, previewUrl }`.
- [ ] La función renueva el token vía refresh y lo cachea hasta expiración.
- [ ] La respuesta de la playlist se cachea ~60s en memoria del worker.
- [ ] Pagina la playlist completa (>100 tracks) vía `offset`.
- [ ] Maneja errores con `502` y mensaje útil.
- [ ] Responde correctamente a `OPTIONS` (CORS).
- [ ] Está deployada en el proyecto `ipyticieruuqvxlwidcp` con `verify_jwt = false`.

---

## 1. Arquitectura del flujo de autenticación

```
[SETUP - 1 sola vez]
  scripts/get-spotify-refresh-token.mjs
    → abre URL de autorización en browser
    → usuario acepta permisos (scopes: playlist-read-private, playlist-read-collaborative)
    → copia el ?code= de la barra de direcciones
    → script intercambia code por refresh_token
    → cargar refresh_token como Supabase secret

[RUNTIME - cada request al endpoint]
  Edge Function
    → POST /api/token con grant_type=refresh_token (Basic auth con client_id:client_secret)
    → obtiene access_token (válido ~1h, cacheado en memoria del worker)
    → GET /v1/playlists/{id}/items (token de usuario = 200)
    → normaliza a Track[] y cachea 60s
    → devuelve { tracks, cached }
```

---

## 2. Requisitos previos

- **Premium:** la cuenta dueña de la app de Spotify Developer debe tener Premium activo
  (requisito de Development Mode desde feb 2026).
- **Ownership:** la misma cuenta debe ser dueña (o colaboradora) de la playlist.
- **Redirect URI registrada** en el Dashboard de Spotify (Settings → Redirect URIs):
  `http://127.0.0.1:3000/callback` (IP en vez de hostname — evita el conflicto http/https del Dashboard)
- **Supabase CLI** instalado (`npm install -g supabase`).

---

## 3. Datos del proyecto

| Campo | Valor |
|---|---|
| Supabase project ref | `ipyticieruuqvxlwidcp` |
| Edge URL | `https://ipyticieruuqvxlwidcp.supabase.co/functions/v1` |
| Playlist ID | `13T4a15dukAloY9BtFonFn` |
| Redirect URI | `http://127.0.0.1:3000/callback` |

---

## 4. Secrets en Supabase (Dashboard → Settings → Edge Functions → Secrets)

| Secret | Descripción |
|---|---|
| `SPOTIFY_CLIENT_ID` | Client ID de la app de Spotify |
| `SPOTIFY_CLIENT_SECRET` | Client Secret de la app de Spotify |
| `SPOTIFY_PLAYLIST_ID` | `13T4a15dukAloY9BtFonFn` |
| `SPOTIFY_REFRESH_TOKEN` | Output del script (ver paso 5) |

> El `SUPABASE_ACCESS_TOKEN` (para deployar) **nunca** va al repo. Se pasa como variable
> de entorno en la sesión de deploy y debe rotarse después de cada uso compartido.

---

## 5. Pasos de implementación

### 5.1 Obtener el refresh_token (una sola vez)

El script ya está en `scripts/get-spotify-refresh-token.mjs`. Correlo así:

**PowerShell:**
```powershell
$env:SPOTIFY_CLIENT_ID="tu_client_id"
$env:SPOTIFY_CLIENT_SECRET="tu_client_secret"
node scripts/get-spotify-refresh-token.mjs
```

**bash:**
```bash
SPOTIFY_CLIENT_ID="tu_client_id" SPOTIFY_CLIENT_SECRET="tu_client_secret" \
  node scripts/get-spotify-refresh-token.mjs
```

El script:
1. Imprime la URL de autorización.
2. La abrís en el browser y aceptás los permisos.
3. Spotify redirige a `https://localhost:3000/callback?code=XXXX` (la página no carga,
   es normal — solo copiás el valor de `code` de la URL).
4. Pegás el code cuando el script lo pide.
5. El script imprime el `refresh_token`.

> Los codes de Spotify expiran en ~10 minutos. Usalo rápido.

### 5.2 Cargar el refresh_token como secret

```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_xxxxxxxx"
supabase secrets set SPOTIFY_REFRESH_TOKEN="el_valor_que_imprimio_el_script" `
  --project-ref ipyticieruuqvxlwidcp
```

O desde el Dashboard: Settings → Edge Functions → Secrets.

### 5.3 Estructura de archivos (ya creados)

```
supabase/
├── config.toml                              ← project_id + verify_jwt = false
└── functions/
    ├── deno.json
    ├── _shared/
    │   └── cors.ts
    └── spotify-playlist/
        └── index.ts                         ← refresh_token + /items + campo item|track
```

### 5.4 Deploy

```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_xxxxxxxx"
supabase functions deploy spotify-playlist `
  --project-ref ipyticieruuqvxlwidcp `
  --no-verify-jwt
```

### 5.5 Smoke test

**PowerShell:**
```powershell
try {
  Invoke-RestMethod "https://ipyticieruuqvxlwidcp.supabase.co/functions/v1/spotify-playlist"
} catch {
  $_.ErrorDetails.Message
}
```

**bash/curl:**
```bash
curl "https://ipyticieruuqvxlwidcp.supabase.co/functions/v1/spotify-playlist"
```

Respuesta esperada: `{ "tracks": [ { "id": "...", "name": "...", ... } ], "cached": false }`.
Segunda llamada en <60s: `"cached": true`.

---

## 6. Integración en el frontend

El cliente ya está en [`src/lib/spotifyApi.ts`](src/lib/spotifyApi.ts):

```ts
export async function fetchPlaylist(): Promise<Track[]> {
  const res = await fetch(`${EDGE_URL}/spotify-playlist`)
  if (!res.ok) throw new Error(`Error ${res.status}`)
  const data = await res.json()
  return data.tracks
}
```

`VITE_SUPABASE_EDGE_URL` ya está en `.env`:
`https://ipyticieruuqvxlwidcp.supabase.co/functions/v1`

El hook `usePlaylist` con TanStack Query se implementa en Fase 4.

---

## 7. Notas técnicas

- **Endpoint:** `/v1/playlists/{id}/items` (nuevo, feb 2026). El viejo `/tracks` fue removido.
- **Campo de track en response:** `item` en el esquema nuevo, `track` en el viejo. El
  código tolera ambos con `element.item ?? element.track`.
- **Cache:** el access token se renueva 60s antes de expirar. La playlist se cachea 60s
  en memoria del worker (se pierde en cold starts, normal y aceptado).
- **Rate limits:** mitigados por el cache del token y de la playlist.
- **Multi-show futuro:** hoy el PLAYLIST_ID viene de un secret fijo. Si se necesita
  multi-show, pasar el id como query param validado contra una whitelist en la Edge Function.
