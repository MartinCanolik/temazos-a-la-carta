/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_EDGE_URL: string
  readonly VITE_RED_MUSICOS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
