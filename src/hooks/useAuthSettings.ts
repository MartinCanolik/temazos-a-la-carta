import { useQuery } from '@tanstack/react-query'
import { googleHabilitado } from '@/lib/authSettings'
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase'

async function fetchGoogleHabilitado(): Promise<boolean> {
  if (!supabaseUrl || !supabaseAnonKey) return false
  const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabaseAnonKey },
  })
  if (!res.ok) return false
  return googleHabilitado(await res.json())
}

/** Whether the Google provider is enabled in the Supabase project (any error → false). */
export function useGoogleHabilitado(): boolean {
  const { data } = useQuery({
    queryKey: ['auth-settings', 'google'],
    queryFn: fetchGoogleHabilitado,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
  return data === true
}
