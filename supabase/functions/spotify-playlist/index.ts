import { corsHeaders } from '../_shared/cors.ts'

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Track {
  id: string
  name: string
  artist: string
  albumImage: string | null
  previewUrl: string | null
}

interface SpotifyArtist {
  name: string
}

interface SpotifyImage {
  url: string
}

// El campo se llama "track" en el esquema viejo, "item" en el nuevo (feb 2026).
interface SpotifyTrackObject {
  id: string | null
  name: string
  preview_url: string | null
  artists: SpotifyArtist[]
  album: { images: SpotifyImage[] }
}

interface SpotifyPlaylistItem {
  track?: SpotifyTrackObject | null // esquema viejo (puede estar presente en algunos responses)
  item?: SpotifyTrackObject | null  // esquema nuevo (feb 2026)
}

// ─── Config ──────────────────────────────────────────────────────────────────
const CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID')!
const CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET')!
const REFRESH_TOKEN = Deno.env.get('SPOTIFY_REFRESH_TOKEN')!
const PLAYLIST_ID = Deno.env.get('SPOTIFY_PLAYLIST_ID')!
const PLAYLIST_TTL_MS = 60_000 // cache de playlist: 60s

// ─── Cache en memoria del worker ──────────────────────────────────────────────
let cachedToken: { value: string; expiresAt: number } | null = null
let cachedPlaylist: { tracks: Track[]; expiresAt: number } | null = null

// ─── Token: Authorization Code refresh flow ────────────────────────────────────
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value
  }

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
    }).toString(),
  })

  if (!resp.ok) {
    const detail = await resp.text()
    throw new Error(`Spotify token error ${resp.status}: ${detail}`)
  }

  const data = await resp.json()
  // Renovar 60s antes de que expire para evitar usar uno vencido.
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return cachedToken.value
}

// ─── Traer y normalizar la playlist (con paginación) ───────────────────────────
async function fetchPlaylistTracks(token: string): Promise<Track[]> {
  const limit = 100
  let offset = 0
  const collected: Track[] = []

  while (true) {
    // Endpoint actualizado: /items (feb 2026). Sin ?fields para evitar
    // inconsistencias por el rename track->item en el esquema de respuesta.
    const url =
      `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/items` +
      `?limit=${limit}&offset=${offset}`

    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!resp.ok) {
      const detail = await resp.text()
      throw new Error(`Spotify playlist error ${resp.status}: ${detail}`)
    }

    const data = await resp.json()
    const items: SpotifyPlaylistItem[] = data.items ?? []

    for (const element of items) {
      // Tolera ambos esquemas: "item" (nuevo) y "track" (viejo/compatibilidad).
      const t = element.item ?? element.track
      if (!t || !t.id) continue // descarta tracks locales o nulos
      collected.push({
        id: t.id,
        name: t.name,
        artist: (t.artists ?? []).map((a) => a.name).join(', '),
        albumImage: t.album?.images?.[0]?.url ?? null,
        previewUrl: t.preview_url ?? null,
      })
    }

    if (items.length < limit) break
    offset += limit
  }

  return collected
}

// ─── Handler HTTP ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    if (cachedPlaylist && cachedPlaylist.expiresAt > Date.now()) {
      return json({ tracks: cachedPlaylist.tracks, cached: true })
    }

    const token = await getAccessToken()
    const tracks = await fetchPlaylistTracks(token)

    cachedPlaylist = { tracks, expiresAt: Date.now() + PLAYLIST_TTL_MS }

    return json({ tracks, cached: false })
  } catch (err) {
    console.error('[spotify-playlist]', err)
    return json(
      {
        error: 'No se pudo obtener la playlist desde Spotify.',
        detail: String(err),
        hint:
          'Verificar: SPOTIFY_REFRESH_TOKEN cargado como secret, ' +
          'la cuenta dueña tiene Premium, y la playlist pertenece a esa cuenta. ' +
          'Ver FASE-1.md para más detalles.',
      },
      502,
    )
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}
