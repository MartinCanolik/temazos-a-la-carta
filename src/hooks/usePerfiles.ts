import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/database.types'
import { busquedaValida, sanitizarBusqueda } from '@/lib/formacion'

/** Perfil público de un músico por su slug (null si no existe). */
export function usePerfilPublico(slug: string | undefined) {
  return useQuery({
    queryKey: ['perfil', slug],
    enabled: !!slug,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Perfiles públicos (con slug) para los slugs pedidos; los que no existen simplemente no vienen. */
export function usePerfilesPorSlug(slugs: string[]) {
  const clave = [...slugs].sort().join(',')
  return useQuery({
    queryKey: ['perfiles-por-slug', clave],
    enabled: slugs.length > 0,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from('profiles').select('*').in('slug', slugs)
      if (error) throw error
      return data ?? []
    },
  })
}

/** Perfiles por id (para mostrar nombres de una formación guardada). */
export function usePerfilesPorId(ids: string[]) {
  const clave = [...ids].sort().join(',')
  return useQuery({
    queryKey: ['perfiles-por-id', clave],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase.from('profiles').select('*').in('id', ids)
      if (error) throw error
      return data ?? []
    },
  })
}

/** Busca perfiles públicos por nombre o slug (máx. 8). Pide 1 extra por si hay que excluir al propio. */
export function useBuscarPerfiles(texto: string, excluirId?: string) {
  const q = texto.trim()
  return useQuery({
    queryKey: ['perfiles-buscar', q, excluirId],
    // Judged on the sanitized text: "%%" would otherwise become an ilike wildcard that matches everyone.
    enabled: busquedaValida(q),
    staleTime: 60_000,
    queryFn: async (): Promise<Profile[]> => {
      const seguro = sanitizarBusqueda(q)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .not('slug', 'is', null)
        .or(`nombre.ilike.%${seguro}%,slug.ilike.%${seguro}%`)
        .order('nombre', { ascending: true })
        .limit(9)
      if (error) throw error
      return (data ?? []).filter((p) => p.id !== excluirId).slice(0, 8)
    },
  })
}
