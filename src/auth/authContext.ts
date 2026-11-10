import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/database.types'

export interface AuthState {
  /** true mientras se resuelve la sesión inicial. */
  loading: boolean
  session: Session | null
  user: User | null
  /** Perfil de public.profiles (null si no hay sesión o todavía no cargó). */
  profile: Profile | null
  isMusico: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
  /** Vuelve a leer el perfil (por ejemplo, después de editarlo). */
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
