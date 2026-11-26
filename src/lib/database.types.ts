/**
 * Tipos generados manualmente que reflejan el esquema de Supabase.
 * En producción se pueden regenerar con: supabase gen types typescript --linked
 */
export type Database = {
  public: {
    Tables: {
      pedidos: {
        Row: {
          id: string
          track_id: string
          track_name: string
          artist_name: string
          album_image: string | null
          requester: string
          device_id: string
          wants_to_sing: boolean
          created_at: string
        }
        Insert: {
          id?: string
          track_id: string
          track_name: string
          artist_name: string
          album_image?: string | null
          requester: string
          device_id: string
          wants_to_sing?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['pedidos']['Insert']>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          role: Rol
          nombre: string | null
          slug: string | null
          instrumentos: string[]
          ciudad: string | null
          bio: string | null
          whatsapp: string | null
          instagram: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: Rol
          nombre?: string | null
          created_at?: string
          updated_at?: string
        }
        /** El cliente sólo puede editar columnas de perfil (nunca `role`). */
        Update: {
          nombre?: string | null
          slug?: string | null
          instrumentos?: string[]
          ciudad?: string | null
          bio?: string | null
          whatsapp?: string | null
          instagram?: string | null
        }
        Relationships: []
      }
      canciones: {
        Row: {
          id: string
          titulo: string
          artista: string
          /** Generated in SQL from normalizar_texto(titulo) | normalizar_texto(artista). */
          clave: string
          spotify_track_id: string | null
          created_by: string | null
          created_at: string
        }
        /** Clients cannot write the catalog directly: use the `obtener_o_crear_cancion` RPC. */
        Insert: {
          id?: string
          titulo: string
          artista: string
          spotify_track_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['canciones']['Insert']>
        Relationships: []
      }
      musico_canciones: {
        Row: {
          id: string
          musico_id: string
          cancion_id: string
          tonalidad: string | null
          version: string | null
          referencia_url: string | null
          notas: string | null
          /** Instrument/role the musician plays on this song. */
          instrumento: string | null
          created_at: string
        }
        Insert: {
          id?: string
          musico_id?: string
          cancion_id: string
          tonalidad?: string | null
          version?: string | null
          referencia_url?: string | null
          notas?: string | null
          instrumento?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['musico_canciones']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'musico_canciones_cancion_id_fkey'
            columns: ['cancion_id']
            isOneToOne: false
            referencedRelation: 'canciones'
            referencedColumns: ['id']
          },
        ]
      }
      toques: {
        Row: {
          id: string
          musico_id: string
          fecha: string
          hora: string | null
          lugar: string
          ciudad: string | null
          formato: string | null
          paga: number | null
          moneda: Moneda
          con_quien: string | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          musico_id?: string
          fecha: string
          hora?: string | null
          lugar: string
          ciudad?: string | null
          formato?: string | null
          paga?: number | null
          moneda?: Moneda
          con_quien?: string | null
          notas?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['toques']['Insert']>
        Relationships: []
      }
      toque_canciones: {
        Row: {
          toque_id: string
          cancion_id: string
          orden: number
        }
        Insert: {
          toque_id: string
          cancion_id: string
          orden: number
        }
        Update: Partial<Database['public']['Tables']['toque_canciones']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      obtener_o_crear_cancion: {
        Args: { p_titulo: string; p_artista: string; p_spotify_track_id?: string | null }
        Returns: string
      }
    }
    Enums: Record<string, never>
  }
}

export type Pedido = Database['public']['Tables']['pedidos']['Row']
export type PedidoInsert = Database['public']['Tables']['pedidos']['Insert']

export type Rol = 'musico' | 'admin'
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Cancion = Database['public']['Tables']['canciones']['Row']
export type CancionCatalogo = Pick<Cancion, 'id' | 'titulo' | 'artista' | 'spotify_track_id'>
export type CancionMusicoRow = Database['public']['Tables']['musico_canciones']['Row']
export type CancionMusicoInsert = Database['public']['Tables']['musico_canciones']['Insert']
/** A musician's repertoire row with its catalog song flattened in (titulo, artista, spotify_track_id). */
export type CancionMusico = CancionMusicoRow & Omit<CancionCatalogo, 'id'>
export type Moneda = 'UYU' | 'USD' | 'ARS'
export type Toque = Database['public']['Tables']['toques']['Row']
export type ToqueInsert = Database['public']['Tables']['toques']['Insert']
export type ToqueCancion = Database['public']['Tables']['toque_canciones']['Row']
