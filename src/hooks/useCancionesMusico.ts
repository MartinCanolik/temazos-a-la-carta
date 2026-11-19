import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { claveCancion, normalizarTexto } from '@/lib/canciones'
import { busquedaValida, sanitizarBusqueda } from '@/lib/formacion'
import type {
  CancionCatalogo,
  CancionMusico,
  CancionMusicoInsert,
  CancionMusicoRow,
} from '@/lib/database.types'

export const cancionesKey = (musicoId: string | undefined) => ['canciones', musicoId] as const

const SELECT_REPERTORIO = '*, cancion:canciones(id, titulo, artista, spotify_track_id)'
const YA_TENES = 'Ya tenés este tema en tu repertorio.'

type FilaRepertorio = CancionMusicoRow & { cancion: CancionCatalogo | null }

/** Repertorio de un músico con la canción del catálogo aplanada (titulo, artista, spotify_track_id). */
async function fetchRepertorio(musicoId: string): Promise<CancionMusico[]> {
  const { data, error } = await supabase
    .from('musico_canciones')
    .select(SELECT_REPERTORIO)
    .eq('musico_id', musicoId)
  if (error) throw error
  return ((data ?? []) as unknown as FilaRepertorio[])
    .filter((fila) => fila.cancion)
    .map(({ cancion, ...fila }) => ({
      ...fila,
      titulo: cancion!.titulo,
      artista: cancion!.artista,
      spotify_track_id: cancion!.spotify_track_id,
    }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }))
}

/** Repertorio de un músico, ordenado por título. */
export function useCancionesDe(musicoId: string | undefined) {
  return useQuery({
    queryKey: cancionesKey(musicoId),
    enabled: !!musicoId,
    queryFn: () => fetchRepertorio(musicoId!),
  })
}

/** Busca en el catálogo compartido por título o artista (máx. 8). */
export function useBuscarCatalogo(texto: string) {
  const q = texto.trim()
  return useQuery({
    queryKey: ['catalogo', q],
    // Judged on the sanitized text, so wildcard-only input never reaches the query.
    enabled: busquedaValida(q),
    staleTime: 60_000,
    queryFn: async (): Promise<CancionCatalogo[]> => {
      const seguro = sanitizarBusqueda(q)
      const clave = normalizarTexto(q)
      const filtros = [`titulo.ilike.%${seguro}%`, `artista.ilike.%${seguro}%`]
      if (clave) filtros.push(`clave.ilike.%${clave}%`)
      const { data, error } = await supabase
        .from('canciones')
        .select('id, titulo, artista, spotify_track_id')
        .or(filtros.join(','))
        .order('titulo', { ascending: true })
        .limit(8)
      if (error) throw error
      return data ?? []
    },
  })
}

/** Datos por músico de una canción (lo que no vive en el catálogo). */
export type DatosCancionMusico = Pick<
  CancionMusicoInsert,
  'tonalidad' | 'version' | 'referencia_url' | 'notas' | 'instrumento'
>

export interface NuevaCancion extends DatosCancionMusico {
  titulo: string
  artista: string
  spotify_track_id?: string | null
}

async function obtenerOCrearCancion(c: {
  titulo: string
  artista: string
  spotify_track_id?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('obtener_o_crear_cancion', {
    p_titulo: c.titulo,
    p_artista: c.artista,
    p_spotify_track_id: c.spotify_track_id ?? null,
  })
  if (error) throw error
  return data
}

/** Ejecuta `fn` sobre los items con a lo sumo `limite` llamadas en vuelo, conservando el orden. */
async function conLimite<T, R>(items: T[], limite: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(items.length)
  let siguiente = 0
  const worker = async () => {
    while (siguiente < items.length) {
      const i = siguiente++
      resultados[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, worker))
  return resultados
}

/**
 * Agrega canciones al repertorio propio: resuelve cada una contra el catálogo (la crea si no existe)
 * y saltea las que el músico ya tiene.
 */
export function useAgregarCanciones(musicoId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (nuevas: NuevaCancion[]): Promise<{ agregadas: number; repetidas: number }> => {
      const actuales = await queryClient.fetchQuery({
        queryKey: cancionesKey(musicoId),
        queryFn: () => fetchRepertorio(musicoId!),
        staleTime: 30_000,
      })
      const idsTenidos = new Set(actuales.map((c) => c.cancion_id))
      const clavesTenidas = new Set(actuales.map((c) => claveCancion(c.titulo, c.artista)))

      // Cheap pre-filter by key so we do not call the RPC for songs the musician already has.
      const vistas = new Set<string>()
      const candidatas = nuevas
        .map((c) => ({ ...c, titulo: c.titulo.trim(), artista: c.artista.trim() }))
        .filter((c) => {
          const clave = claveCancion(c.titulo, c.artista)
          if (clavesTenidas.has(clave) || vistas.has(clave)) return false
          vistas.add(clave)
          return true
        })

      const resueltas = await conLimite(candidatas, 4, async (c) => ({
        ...c,
        cancion_id: await obtenerOCrearCancion(c),
      }))

      const filas: CancionMusicoInsert[] = []
      for (const c of resueltas) {
        if (idsTenidos.has(c.cancion_id)) continue
        idsTenidos.add(c.cancion_id)
        filas.push({
          cancion_id: c.cancion_id,
          tonalidad: c.tonalidad,
          version: c.version,
          referencia_url: c.referencia_url,
          notas: c.notas,
          instrumento: c.instrumento,
        })
      }

      if (filas.length > 0) {
        const { error } = await supabase.from('musico_canciones').insert(filas)
        if (error) {
          if (error.code === '23505') throw new Error(YA_TENES)
          throw error
        }
      }
      return { agregadas: filas.length, repetidas: nuevas.length - filas.length }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: cancionesKey(musicoId) }),
  })
}

interface ActualizarInput extends DatosCancionMusico {
  /** Fila actual del repertorio. */
  actual: CancionMusico
  titulo: string
  artista: string
}

export function useActualizarCancion(musicoId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ actual, titulo, artista, ...datos }: ActualizarInput) => {
      const cambios: Partial<CancionMusicoInsert> = { ...datos }
      // Title/artist live in the catalog: if they changed, point the row at the right song.
      if (claveCancion(titulo, artista) !== claveCancion(actual.titulo, actual.artista)) {
        cambios.cancion_id = await obtenerOCrearCancion({
          titulo: titulo.trim(),
          artista: artista.trim(),
        })
      }
      const { error } = await supabase.from('musico_canciones').update(cambios).eq('id', actual.id)
      if (error) {
        if (error.code === '23505') throw new Error(YA_TENES)
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
