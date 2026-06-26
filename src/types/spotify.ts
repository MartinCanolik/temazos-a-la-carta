/** Track normalizado que devuelve la Edge Function de Spotify */
export interface Track {
  id: string
  name: string
  artist: string
  albumImage: string | null
  previewUrl: string | null
}
