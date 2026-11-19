import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/authContext'
import { supabase } from '@/lib/supabase'
import { aPayload, type ItemRepertorio } from '@/lib/repertorio'
import type { Repertorio } from '@/lib/database.types'

export const repertoriosKey = ['repertorios-lista'] as const
export const repertorioKey = (id: string | undefined) => ['repertorio', id] as const

/** Un repertorio con su formación y las canciones (ids, en orden). */
export interface RepertorioResumen extends Repertorio {
  musicoIds: string[]
  /** Ids del catálogo en el orden del repertorio. */
  cancionIds: string[]
  /** Cantidad de temas con la marca manual "a preparar". */
  aPreparar: number
}

export interface RepertorioDetalle extends RepertorioResumen {
  items: ItemRepertorio[]
}

interface FilaResumen extends Repertorio {
  musicos: { musico_id: string }[]
  canciones: { cancion_id: string; orden: number; a_preparar: boolean }[]
}

interface FilaDetalle extends Repertorio {
  musicos: { musico_id: string }[]
  canciones: {
    cancion_id: string
    orden: number
    a_preparar: boolean
    notas: string | null
    cancion: { titulo: string; artista: string } | null
  }[]
}

function resumir(f: FilaResumen | FilaDetalle): RepertorioResumen {
  const ordenadas = [...f.canciones].sort((a, b) => a.orden - b.orden)
  const { musicos, canciones, ...base } = f
  void canciones
  return {
    ...base,
    musicoIds: musicos.map((m) => m.musico_id),
    cancionIds: ordenadas.map((c) => c.cancion_id),
    aPreparar: ordenadas.filter((c) => c.a_preparar).length,
  }
}

const SELECT_RESUMEN =
  '*, musicos:repertorio_musicos(musico_id), canciones:repertorio_canciones(cancion_id, orden, a_preparar)'

/** Repertorios por id, el más reciente primero. */
async function fetchResumenes(ids: string[], excluirId?: string | null, limite = 200): Promise<RepertorioResumen[]> {
  if (ids.length === 0) return []
  let q = supabase.from('repertorios').select(SELECT_RESUMEN).in('id', ids)
  if (excluirId) q = q.neq('id', excluirId)
  const { data, error } = await q.order('updated_at', { ascending: false }).limit(limite)
  if (error) throw error
  return ((data ?? []) as unknown as FilaResumen[]).map(resumir)
}

/** Mis repertorios: los que creé o donde estoy en la formación (filtrado en el servidor), el más reciente primero. */
export function useRepertorios(enabled = true) {
  const { user } = useAuth()
  const miId = user?.id
  return useQuery({
    queryKey: [...repertoriosKey, miId],
    enabled: enabled && !!miId,
    queryFn: async (): Promise<RepertorioResumen[]> => {
      const { data: mios, error: errorMios } = await supabase
        .from('repertorio_musicos')
        .select('repertorio_id')
        .eq('musico_id', miId!)
      if (errorMios) throw errorMios
      const idsMiembro = (mios ?? []).map((r) => r.repertorio_id)
      // `id.in.()` is invalid PostgREST, so only add it when I belong to some lineup.
      const filtro =
        idsMiembro.length > 0 ? `creado_por.eq.${miId},id.in.(${idsMiembro.join(',')})` : `creado_por.eq.${miId}`
      const { data, error } = await supabase
        .from('repertorios')
        .select(SELECT_RESUMEN)
        .or(filtro)
        .order('updated_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return ((data ?? []) as unknown as FilaResumen[]).map(resumir)
    },
  })
}

/** Últimos repertorios (máx. 5) cuya formación incluye a alguno de estos músicos, sin el que se está editando. */
export function useRepertoriosDeFormacion(musicoIds: string[], excluirId: string | null) {
  const clave = [...musicoIds].sort().join(',')
  return useQuery({
    queryKey: ['repertorios-formacion', clave, excluirId],
    enabled: musicoIds.length > 0,
    queryFn: async (): Promise<RepertorioResumen[]> => {
      const { data, error } = await supabase
        .from('repertorio_musicos')
        .select('repertorio_id')
        .in('musico_id', musicoIds)
      if (error) throw error
      const ids = [...new Set((data ?? []).map((r) => r.repertorio_id))]
      return fetchResumenes(ids, excluirId, 5)
    },
  })
}

/** Detalle de un repertorio con sus temas en orden. */
export async function fetchRepertorio(id: string): Promise<RepertorioDetalle | null> {
  const { data, error } = await supabase
    .from('repertorios')
    .select(
      '*, musicos:repertorio_musicos(musico_id), canciones:repertorio_canciones(cancion_id, orden, a_preparar, notas, cancion:canciones(titulo, artista))',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const fila = data as unknown as FilaDetalle
  const items: ItemRepertorio[] = [...fila.canciones]
    .sort((a, b) => a.orden - b.orden)
    .filter((c) => c.cancion)
    .map((c) => ({
      cancion_id: c.cancion_id,
      titulo: c.cancion!.titulo,
      artista: c.cancion!.artista,
      a_preparar: c.a_preparar,
      notas: c.notas,
    }))
  return { ...resumir(fila), items }
}

export function useRepertorio(id: string | undefined) {
  return useQuery({
    queryKey: repertorioKey(id),
    enabled: !!id,
    queryFn: () => fetchRepertorio(id!),
  })
}

export interface GuardarRepertorioInput {
  id: string | null
  nombre: string
  notas: string
  musicoIds: string[]
  items: ItemRepertorio[]
  basadoEn: string | null
}

/** Crea o actualiza un repertorio de forma atómica (RPC `guardar_repertorio`). Devuelve el id. */
export function useGuardarRepertorio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (i: GuardarRepertorioInput): Promise<string> => {
      const { data, error } = await supabase.rpc('guardar_repertorio', {
        p_id: i.id,
        p_nombre: i.nombre.trim(),
        p_notas: i.notas.trim() || null,
        p_musicos: i.musicoIds,
        p_canciones: aPayload(i.items),
        p_basado_en: i.basadoEn,
      })
      if (error) throw error
      return data
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: repertoriosKey })
      void queryClient.invalidateQueries({ queryKey: repertorioKey(id) })
    },
  })
}

export function useDuplicarRepertorio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      const { data, error } = await supabase.rpc('duplicar_repertorio', { p_id: id })
      if (error) throw error
      return data
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: repertoriosKey }),
  })
}

/** Sólo el creador puede borrar (lo impone RLS). */
export function useBorrarRepertorio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase.from('repertorios').delete({ count: 'exact' }).eq('id', id)
      if (error) throw error
      if (!count) throw new Error('Sólo quien creó el repertorio puede borrarlo.')
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: repertoriosKey }),
  })
}
