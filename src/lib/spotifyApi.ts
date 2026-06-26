import type { Track } from '@/types/spotify'

const EDGE_URL = import.meta.env.VITE_SUPABASE_EDGE_URL

interface PlaylistResponse {
  tracks: Track[]
  cached?: boolean
}

export async function fetchPlaylist(): Promise<Track[]> {
  if (!EDGE_URL) {
    throw new Error('Falta VITE_SUPABASE_EDGE_URL en el .env')
  }

  const res = await fetch(`${EDGE_URL}/spotify-playlist`)
  if (!res.ok) {
    throw new Error(`Error ${res.status} al traer la playlist`)
  }

  const data = (await res.json()) as PlaylistResponse
  return data.tracks
}
