import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AgendaPublicaFila, UbicacionConShows } from '@/lib/database.types'

export interface FiltrosAgenda {
  desde?: string | null
  hasta?: string | null
  ciudad?: string | null
  zona?: string | null
  musicoSlug?: string | null
  showId?: string | null
}

/** Upcoming public shows (the database only returns public, scheduled, non-past ones). */
async function leerAgenda(f: FiltrosAgenda): Promise<AgendaPublicaFila[]> {
  const { data, error } = await supabase.rpc('agenda_publica', {
    p_desde: f.desde ?? null,
    p_hasta: f.hasta ?? null,
    p_ciudad: f.ciudad ?? null,
    p_zona: f.zona ?? null,
    p_musico_slug: f.musicoSlug ?? null,
    p_show_id: f.showId ?? null,
  })
  if (error) throw error
  return data ?? []
}

export function useAgendaPublica(filtros: FiltrosAgenda) {
  return useQuery({
    queryKey: ['agenda-publica', filtros],
    queryFn: () => leerAgenda(filtros),
  })
}

/** One public show; null when it does not exist, is private, cancelled or already past. */
export function useShowPublico(id: string | undefined) {
  return useQuery({
    queryKey: ['agenda-publica-show', id],
    enabled: !!id,
    queryFn: async (): Promise<AgendaPublicaFila | null> => (await leerAgenda({ showId: id }))[0] ?? null,
  })
}

/** Cities / zones with upcoming public shows, for the filter. */
export function useAgendaLugares() {
  return useQuery({
    queryKey: ['agenda-publica-lugares'],
    staleTime: 60_000,
    queryFn: async (): Promise<UbicacionConShows[]> => {
      const { data, error } = await supabase.rpc('agenda_publica_lugares')
      if (error) throw error
      return data ?? []
    },
  })
}
