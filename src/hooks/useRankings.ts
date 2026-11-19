import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  PeriodoRanking,
  RankingCancionFila,
  RankingLugarFila,
  RankingMusicoFila,
  UbicacionConShows,
} from '@/lib/database.types'

export interface FiltrosRanking {
  periodo: PeriodoRanking
  ciudad?: string | null
  zona?: string | null
}

const args = (f: FiltrosRanking) => ({
  p_periodo: f.periodo,
  p_ciudad: f.ciudad ?? null,
  p_zona: f.zona ?? null,
})

export function useRankingMusicos(filtros: FiltrosRanking, enabled = true) {
  return useQuery({
    queryKey: ['ranking-musicos', filtros],
    enabled,
    queryFn: async (): Promise<RankingMusicoFila[]> => {
      const { data, error } = await supabase.rpc('ranking_musicos', args(filtros))
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRankingCanciones(filtros: FiltrosRanking, enabled = true) {
  return useQuery({
    queryKey: ['ranking-canciones', filtros],
    enabled,
    queryFn: async (): Promise<RankingCancionFila[]> => {
      const { data, error } = await supabase.rpc('ranking_canciones', args(filtros))
      if (error) throw error
      return data ?? []
    },
  })
}

export function useRankingLugares(filtros: FiltrosRanking, enabled = true) {
  return useQuery({
    queryKey: ['ranking-lugares', filtros],
    enabled,
    queryFn: async (): Promise<RankingLugarFila[]> => {
      const { data, error } = await supabase.rpc('ranking_lugares', args(filtros))
      if (error) throw error
      return data ?? []
    },
  })
}

/** Cities / zones with at least one finished show, for the filter. */
export function useRankingZonas() {
  return useQuery({
    queryKey: ['ranking-zonas'],
    staleTime: 60_000,
    queryFn: async (): Promise<UbicacionConShows[]> => {
      const { data, error } = await supabase.rpc('ranking_zonas')
      if (error) throw error
      return data ?? []
    },
  })
}
