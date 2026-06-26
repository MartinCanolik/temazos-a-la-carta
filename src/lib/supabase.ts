import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Variables de entorno no configuradas. ' +
      'Copiá .env.example a .env y completá los valores.',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
