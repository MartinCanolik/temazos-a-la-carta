import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/database.types'

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
