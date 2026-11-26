import { useQuery } from '@tanstack/react-query'
import { fetchPlaylist } from '@/lib/spotifyApi'

export const PLAYLIST_QUERY_KEY = ['playlist'] as const

export function usePlaylist() {
  return useQuery({
    queryKey: PLAYLIST_QUERY_KEY,
    queryFn: fetchPlaylist,
    staleTime: 5 * 60_000, // 5 min — la playlist no cambia frecuentemente en un show
    // The edge function can fail (e.g. no Spotify secrets locally): one retry, then fall back to the error state.
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
