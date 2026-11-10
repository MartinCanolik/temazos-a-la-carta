import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Toque, ToqueCancion, ToqueInsert } from '@/lib/database.types'

export const toquesKey = (musicoId: string | undefined) => ['toques', musicoId] as const
export const setlistKey = (toqueId: string | undefined) => ['setlist', toqueId] as const
export const setlistsKey = (musicoId: string | undefined) => ['setlists', musicoId] as const

/** Todos los toques del músico, del más reciente al más viejo. */
export function useToques(musicoId: string | undefined) {
  return useQuery({
    queryKey: toquesKey(musicoId),
    enabled: !!musicoId,
    queryFn: async (): Promise<Toque[]> => {
      const { data, error } = await supabase
        .from('toques')
        .select('*')
        .eq('musico_id', musicoId!)
        .order('fecha', { ascending: false })
        .order('hora', { ascending: false, nullsFirst: false })
      if (error) throw error
      return data ?? []
    },
  })
}

/** Setlist de un toque (ids de canciones en orden). */
export function useSetlist(toqueId: string | undefined) {
  return useQuery({
    queryKey: setlistKey(toqueId),
    enabled: !!toqueId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('toque_canciones')
        .select('*')
        .eq('toque_id', toqueId!)
        .order('orden', { ascending: true })
      if (error) throw error
      return (data ?? []).map((r) => r.cancion_id)
    },
  })
}

/** Todas las filas de setlists del músico (para estadísticas). RLS ya filtra por dueño. */
export function useSetlists(musicoId: string | undefined) {
  return useQuery({
    queryKey: setlistsKey(musicoId),
    enabled: !!musicoId,
    queryFn: async (): Promise<ToqueCancion[]> => {
      const { data, error } = await supabase.from('toque_canciones').select('*')
      if (error) throw error
      return data ?? []
    },
  })
}

interface GuardarToqueInput {
  id?: string
  datos: ToqueInsert
  setlist: string[]
}

/** Crea o actualiza un toque y reemplaza su setlist. Devuelve el id. */
export function useGuardarToque(musicoId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, datos, setlist }: GuardarToqueInput): Promise<string> => {
      let toqueId = id
      if (toqueId) {
        const { error } = await supabase.from('toques').update(datos).eq('id', toqueId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('toques').insert(datos).select('id').single()
        if (error) throw error
        toqueId = data.id
      }

      const { error: delError } = await supabase
        .from('toque_canciones')
        .delete()
        .eq('toque_id', toqueId)
      if (delError) throw delError

      if (setlist.length > 0) {
        const { error: insError } = await supabase
          .from('toque_canciones')
          .insert(setlist.map((cancion_id, orden) => ({ toque_id: toqueId!, cancion_id, orden })))
        if (insError) throw insError
      }
      return toqueId
    },
    onSuccess: (toqueId) => {
      void queryClient.invalidateQueries({ queryKey: toquesKey(musicoId) })
      void queryClient.invalidateQueries({ queryKey: setlistKey(toqueId) })
      void queryClient.invalidateQueries({ queryKey: setlistsKey(musicoId) })
    },
  })
}

export function useBorrarToque(musicoId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('toques').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: toquesKey(musicoId) })
      void queryClient.invalidateQueries({ queryKey: setlistsKey(musicoId) })
    },
  })
}
