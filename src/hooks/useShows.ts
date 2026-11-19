import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/authContext'
import { supabase } from '@/lib/supabase'
import { leerTodo } from '@/lib/paginacion'
import type { CobroInput, ShowCobro, ShowDatosInput } from '@/lib/database.types'
import { payloadCobrado, type ShowConParticipantes, type Tema } from '@/lib/shows'

export const showsKey = ['shows'] as const
export const showKey = (id: string | undefined) => ['show', id] as const
export const misCobrosKey = ['mis-cobros'] as const
export const tocadasKey = (id: string | undefined) => ['show-tocadas', id] as const
export const tocadasDeMisShowsKey = ['mis-shows-tocadas'] as const

const COLUMNAS = '*, participantes:show_musicos(musico_id, estado, invitado_por)'

/** Every show I take part in (any invitation state: RLS only returns mine), with its lineup. */
export function useShows(enabled = true) {
  return useQuery({
    queryKey: showsKey,
    enabled,
    queryFn: async (): Promise<ShowConParticipantes[]> => {
      const { data, error } = await supabase
        .from('shows')
        .select(COLUMNAS)
        .order('fecha', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []) as unknown as ShowConParticipantes[]
    },
  })
}

/** One show with its lineup (null when it does not exist or I am not part of it). */
export function useShow(id: string | undefined) {
  return useQuery({
    queryKey: showKey(id),
    enabled: !!id,
    queryFn: async (): Promise<ShowConParticipantes | null> => {
      const { data, error } = await supabase.from('shows').select(COLUMNAS).eq('id', id!).maybeSingle()
      if (error) throw error
      return (data as unknown as ShowConParticipantes | null) ?? null
    },
  })
}

/** My own fees (RLS: owner-only), keyed by show id. */
export function useMisCobros(enabled = true) {
  const { user } = useAuth()
  const miId = user?.id
  return useQuery({
    queryKey: misCobrosKey,
    enabled: enabled && !!miId,
    queryFn: async (): Promise<Map<string, ShowCobro>> => {
      const data = await leerTodo<ShowCobro>((d, h) =>
        supabase
          .from('show_cobros')
          .select('*')
          .eq('musico_id', miId!)
          .order('show_id', { ascending: true })
          .range(d, h),
      )
      return new Map(data.map((c) => [c.show_id, c]))
    },
  })
}

interface FilaTocada {
  cancion_id: string
  orden: number
  cancion: { titulo: string; artista: string } | null
}

/** Songs confirmed as played in a show, in order. */
export function useTocadas(showId: string | undefined) {
  return useQuery({
    queryKey: tocadasKey(showId),
    enabled: !!showId,
    queryFn: async (): Promise<Tema[]> => {
      const { data, error } = await supabase
        .from('show_canciones_tocadas')
        .select('cancion_id, orden, cancion:canciones(titulo, artista)')
        .eq('show_id', showId!)
        .order('orden', { ascending: true })
      if (error) throw error
      return ((data ?? []) as unknown as FilaTocada[])
        .filter((f) => f.cancion)
        .map((f) => ({ cancion_id: f.cancion_id, titulo: f.cancion!.titulo, artista: f.cancion!.artista }))
    },
  })
}

export interface TocadaDeShow extends Tema {
  show_id: string
}

/** Played songs of the shows I accepted (filtered server-side, read page by page). */
export function useTocadasDeMisShows(enabled = true) {
  const { user } = useAuth()
  const miId = user?.id
  return useQuery({
    queryKey: tocadasDeMisShowsKey,
    enabled: enabled && !!miId,
    queryFn: async (): Promise<TocadaDeShow[]> => {
      const data = await leerTodo<unknown>((d, h) =>
        supabase
          .from('show_canciones_tocadas')
          .select('show_id, cancion_id, cancion:canciones(titulo, artista), show:shows!inner(show_musicos!inner(musico_id, estado))')
          .eq('show.show_musicos.musico_id', miId!)
          .eq('show.show_musicos.estado', 'aceptado')
          .order('show_id', { ascending: true })
          .order('cancion_id', { ascending: true })
          .range(d, h),
      )
      return (data as (FilaTocada & { show_id: string })[])
        .filter((f) => f.cancion)
        .map((f) => ({
          show_id: f.show_id,
          cancion_id: f.cancion_id,
          titulo: f.cancion!.titulo,
          artista: f.cancion!.artista,
        }))
    },
  })
}

/** Anything a show write can change: agenda, detail, my fees and played songs. */
function useInvalidarShows() {
  const queryClient = useQueryClient()
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: showsKey })
    void queryClient.invalidateQueries({ queryKey: misCobrosKey })
    void queryClient.invalidateQueries({ queryKey: tocadasDeMisShowsKey })
    if (id) {
      void queryClient.invalidateQueries({ queryKey: showKey(id) })
      void queryClient.invalidateQueries({ queryKey: tocadasKey(id) })
    }
  }
}

export interface GuardarShowInput {
  id: string | null
  datos: ShowDatosInput
  /** Musicians to add or keep; the server never deletes from this list. */
  musicoIds: string[]
  /** Explicit removals (creator only). */
  quitarIds?: string[]
  /** My own fee; leave undefined to keep it untouched. */
  cobro?: CobroInput
}

/** Creates or updates a show atomically (RPC `guardar_show`). Returns its id. */
export function useGuardarShow() {
  const invalidar = useInvalidarShows()
  return useMutation({
    mutationFn: async (i: GuardarShowInput): Promise<string> => {
      const { data, error } = await supabase.rpc('guardar_show', {
        p_id: i.id,
        p_datos: i.datos,
        p_musicos: i.musicoIds,
        p_cobro: i.cobro ?? null,
        p_quitar: i.quitarIds ?? [],
      })
      if (error) throw error
      return data
    },
    onSuccess: (id) => invalidar(id),
  })
}

export function useResponderInvitacion() {
  const invalidar = useInvalidarShows()
  return useMutation({
    mutationFn: async ({ showId, aceptar }: { showId: string; aceptar: boolean }) => {
      const { error } = await supabase.rpc('responder_invitacion', { p_show_id: showId, p_aceptar: aceptar })
      if (error) throw error
    },
    onSuccess: (_d, { showId }) => invalidar(showId),
  })
}

export function useSalirDeShow() {
  const invalidar = useInvalidarShows()
  return useMutation({
    mutationFn: async (showId: string) => {
      const { error } = await supabase.rpc('salir_de_show', { p_show_id: showId })
      if (error) throw error
    },
    onSuccess: (_d, showId) => invalidar(showId),
  })
}

/** Only the creator can delete (enforced by RLS: otherwise zero rows are affected). */
export function useBorrarShow() {
  const invalidar = useInvalidarShows()
  return useMutation({
    mutationFn: async (showId: string) => {
      const { error, count } = await supabase.from('shows').delete({ count: 'exact' }).eq('id', showId)
      if (error) throw error
      if (!count) throw new Error('Sólo quien creó el show puede borrarlo.')
    },
    onSuccess: (_d, showId) => invalidar(showId),
  })
}

/**
 * Marks MY fee as collected (RLS: owner-only direct update, no RPC needed). Zero affected rows means
 * the fee is gone or I am no longer an accepted participant, so it is reported instead of ignored.
 */
export function useMarcarCobrado() {
  const { user } = useAuth()
  const invalidar = useInvalidarShows()
  return useMutation({
    mutationFn: async ({ showId, hoy }: { showId: string; hoy: string }) => {
      const { data, error } = await supabase
        .from('show_cobros')
        .update(payloadCobrado(hoy))
        .eq('show_id', showId)
        .eq('musico_id', user!.id)
        .select('show_id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo marcar como cobrado.')
    },
    onSuccess: (_d, { showId }) => invalidar(showId),
  })
}

export function useConfirmarTocadas() {
  const invalidar = useInvalidarShows()
  return useMutation({
    mutationFn: async ({ showId, cancionIds }: { showId: string; cancionIds: string[] }) => {
      const { error } = await supabase.rpc('confirmar_canciones_tocadas', {
        p_show_id: showId,
        p_cancion_ids: cancionIds,
      })
      if (error) throw error
    },
    onSuccess: (_d, { showId }) => invalidar(showId),
  })
}
