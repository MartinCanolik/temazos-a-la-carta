import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { claveCancion } from '@/lib/canciones'
import type { CancionMusico, CancionMusicoInsert } from '@/lib/database.types'

export const cancionesKey = (musicoId: string | undefined) => ['canciones', musicoId] as const

/** Repertorio de un músico, ordenado por título. */
export function useCancionesDe(musicoId: string | undefined) {
  return useQuery({
    queryKey: cancionesKey(musicoId),
    enabled: !!musicoId,
    queryFn: async (): Promise<CancionMusico[]> => {
      const { data, error } = await supabase
        .from('musico_canciones')
        .select('*')
        .eq('musico_id', musicoId!)
        .order('titulo', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

/** Agrega canciones al repertorio propio, salteando las que ya están (mismo título + artista). */
export function useAgregarCanciones(musicoId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nuevas: CancionMusicoInsert[]): Promise<{ agregadas: number; repetidas: number }> => {
      const existentes = new Set(
        (queryClient.getQueryData<CancionMusico[]>(cancionesKey(musicoId)) ?? []).map((c) =>
          claveCancion(c.titulo, c.artista),
        ),
      )
      const vistas = new Set<string>()
      const filas = nuevas
        .map((c) => ({ ...c, titulo: c.titulo.trim(), artista: c.artista.trim() }))
        .filter((c) => {
          const clave = claveCancion(c.titulo, c.artista)
          if (existentes.has(clave) || vistas.has(clave)) return false
          vistas.add(clave)
          return true
        })

      if (filas.length > 0) {
        const { error } = await supabase.from('musico_canciones').insert(filas)
        if (error) {
          if (error.code === '23505') throw new Error('Esa canción ya está en tu repertorio.')
          throw error
        }
      }
      return { agregadas: filas.length, repetidas: nuevas.length - filas.length }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: cancionesKey(musicoId) }),
  })
}

export function useActualizarCancion(musicoId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...cambios }: { id: string } & Partial<CancionMusicoInsert>) => {
      const { error } = await supabase.from('musico_canciones').update(cambios).eq('id', id)
      if (error) {
        if (error.code === '23505') throw new Error('Esa canción ya está en tu repertorio.')
        throw error
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: cancionesKey(musicoId) }),
  })
}

export function useBorrarCancion(musicoId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('musico_canciones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: cancionesKey(musicoId) }),
  })
}
