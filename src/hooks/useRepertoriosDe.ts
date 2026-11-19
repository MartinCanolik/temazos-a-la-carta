import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CancionDeMusico } from '@/lib/compatibilidad'
import type { CancionCatalogo, CancionMusicoRow } from '@/lib/database.types'

type Fila = CancionMusicoRow & { cancion: CancionCatalogo | null }

/** Repertorios de varios músicos en una sola consulta, agrupados por músico (cada uno con todas las claves, aunque esté vacío). */
export type RepertoriosPorMusico = Record<string, CancionDeMusico[]>

export function useRepertoriosDe(musicoIds: string[]) {
  const clave = [...musicoIds].sort().join(',')
  return useQuery({
    queryKey: ['repertorios', clave],
    enabled: musicoIds.length > 0,
    queryFn: async (): Promise<RepertoriosPorMusico> => {
      const { data, error } = await supabase
        .from('musico_canciones')
        .select('*, cancion:canciones(id, titulo, artista, spotify_track_id)')
        .in('musico_id', musicoIds)
      if (error) throw error
      const porMusico: RepertoriosPorMusico = Object.fromEntries(musicoIds.map((id) => [id, []]))
      for (const fila of (data ?? []) as unknown as Fila[]) {
        if (!fila.cancion) continue
        porMusico[fila.musico_id]?.push({
          cancion_id: fila.cancion_id,
          titulo: fila.cancion.titulo,
          artista: fila.cancion.artista,
          tonalidad: fila.tonalidad,
          version: fila.version,
          instrumento: fila.instrumento,
        })
      }
      return porMusico
    },
  })
}
