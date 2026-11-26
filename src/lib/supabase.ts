import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Variables de entorno no configuradas. ' +
      'Copiá .env.example a .env y completá los valores.',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
