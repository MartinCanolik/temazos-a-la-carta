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
      shows: {
        Row: {
          id: string
          creado_por: string
          nombre: string
          fecha: string
          hora: string | null
          lugar: string | null
          ciudad: string | null
          /** Neighbourhood / area, used by zone filters. */
          zona: string | null
          estado: EstadoShow
          visibilidad: VisibilidadShow
          /** Price / how to book. */
          entrada_info: string | null
          entrada_url: string | null
          repertorio_id: string | null
          /** Free-text guests without an account. */
          invitados: string | null
          notas: string | null
          /** Set when the songs actually played were confirmed. */
          canciones_confirmadas_en: string | null
          created_at: string
          updated_at: string
        }
        /** Clients write shows through the `guardar_show` RPC (only DELETE is direct, creator only). */
        Insert: {
          id?: string
          creado_por?: string
          nombre: string
          fecha: string
          hora?: string | null
          lugar?: string | null
          ciudad?: string | null
          zona?: string | null
          estado?: EstadoShow
          visibilidad?: VisibilidadShow
          entrada_info?: string | null
          entrada_url?: string | null
          repertorio_id?: string | null
          invitados?: string | null
          notas?: string | null
          canciones_confirmadas_en?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['shows']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'shows_repertorio_id_fkey'
            columns: ['repertorio_id']
            isOneToOne: false
            referencedRelation: 'repertorios'
            referencedColumns: ['id']
          },
        ]
      }
      show_musicos: {
        Row: {
          show_id: string
          musico_id: string
          estado: EstadoParticipacion
          invitado_por: string | null
          respondido_en: string | null
        }
        /** Written only through the show RPCs. */
        Insert: {
          show_id: string
          musico_id: string
          estado?: EstadoParticipacion
          invitado_por?: string | null
          respondido_en?: string | null
        }
        Update: Partial<Database['public']['Tables']['show_musicos']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'show_musicos_show_id_fkey'
            columns: ['show_id']
            isOneToOne: false
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
        ]
      }
      /** Private fee of one musician for one show. Owner-only RLS. */
      show_cobros: {
        Row: {
          show_id: string
          musico_id: string
          importe: number
          moneda: Moneda
          estado_cobro: EstadoCobro
          cobrado_en: string | null
          notas: string | null
        }
        Insert: {
          show_id: string
          musico_id?: string
          importe: number
          moneda?: Moneda
          estado_cobro?: EstadoCobro
          cobrado_en?: string | null
          notas?: string | null
        }
        Update: Partial<Database['public']['Tables']['show_cobros']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'show_cobros_show_id_fkey'
            columns: ['show_id']
            isOneToOne: false
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
        ]
      }
      show_canciones_tocadas: {
        Row: {
          show_id: string
          cancion_id: string
          orden: number
        }
        /** Written only through `confirmar_canciones_tocadas`. */
        Insert: {
          show_id: string
          cancion_id: string
          orden: number
        }
        Update: Partial<Database['public']['Tables']['show_canciones_tocadas']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'show_canciones_tocadas_show_id_fkey'
            columns: ['show_id']
            isOneToOne: false
            referencedRelation: 'shows'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'show_canciones_tocadas_cancion_id_fkey'
            columns: ['cancion_id']
            isOneToOne: false
            referencedRelation: 'canciones'
            referencedColumns: ['id']
          },
        ]
      }
      repertorios: {
        Row: {
          id: string
          creado_por: string
          nombre: string
          notas: string | null
          /** Setlist this one was duplicated / started from. */
          basado_en: string | null
          created_at: string
          updated_at: string
        }
        /** Clients write setlists through the `guardar_repertorio` / `duplicar_repertorio` RPCs (only DELETE is direct, creator only). */
        Insert: {
          id?: string
          creado_por?: string
          nombre: string
          notas?: string | null
          basado_en?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['repertorios']['Insert']>
        Relationships: []
      }
      repertorio_musicos: {
        Row: {
          repertorio_id: string
          musico_id: string
        }
        Insert: {
          repertorio_id: string
          musico_id: string
        }
        Update: Partial<Database['public']['Tables']['repertorio_musicos']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'repertorio_musicos_repertorio_id_fkey'
            columns: ['repertorio_id']
            isOneToOne: false
            referencedRelation: 'repertorios'
            referencedColumns: ['id']
          },
        ]
      }
      repertorio_canciones: {
        Row: {
          repertorio_id: string
          cancion_id: string
          orden: number
          /** Manual "needs rehearsal" mark. */
          a_preparar: boolean
          notas: string | null
        }
        Insert: {
          repertorio_id: string
          cancion_id: string
          orden: number
          a_preparar?: boolean
          notas?: string | null
        }
        Update: Partial<Database['public']['Tables']['repertorio_canciones']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'repertorio_canciones_repertorio_id_fkey'
            columns: ['repertorio_id']
            isOneToOne: false
            referencedRelation: 'repertorios'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'repertorio_canciones_cancion_id_fkey'
            columns: ['cancion_id']
            isOneToOne: false
            referencedRelation: 'canciones'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      obtener_o_crear_cancion: {
        Args: { p_titulo: string; p_artista: string; p_spotify_track_id?: string | null }
        Returns: string
      }
      guardar_repertorio: {
        Args: {
          p_id: string | null
          p_nombre: string
          p_notas: string | null
          p_musicos: string[]
          p_canciones: RepertorioCancionInput[]
          p_basado_en?: string | null
        }
        Returns: string
      }
      duplicar_repertorio: {
        Args: { p_id: string; p_nombre?: string | null }
        Returns: string
      }
      guardar_show: {
        Args: { p_id: string | null; p_datos: ShowDatosInput; p_musicos: string[]; p_cobro?: CobroInput | null; p_quitar?: string[] }
        Returns: string
      }
      responder_invitacion: {
        Args: { p_show_id: string; p_aceptar: boolean }
        Returns: undefined
      }
      salir_de_show: {
        Args: { p_show_id: string }
        Returns: undefined
      }
      confirmar_canciones_tocadas: {
        Args: { p_show_id: string; p_cancion_ids: string[] }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
  }
}

/** One song of the `p_canciones` payload of `guardar_repertorio`. */
export interface RepertorioCancionInput {
  cancion_id: string
  orden: number
  a_preparar: boolean
  notas: string | null
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
export type EstadoShow = 'programado' | 'realizado' | 'cancelado'
export type VisibilidadShow = 'publico' | 'privado'
export type EstadoParticipacion = 'pendiente' | 'aceptado' | 'rechazado'
export type EstadoCobro = 'pendiente' | 'cobrado'
export type Show = Database['public']['Tables']['shows']['Row']
export type ShowMusico = Database['public']['Tables']['show_musicos']['Row']
export type ShowCobro = Database['public']['Tables']['show_cobros']['Row']
export type ShowCancionTocada = Database['public']['Tables']['show_canciones_tocadas']['Row']

/** Payload `p_datos` of `guardar_show`. On update, `estado` / `visibilidad` keep their value when left out; the rest is replaced. */
export interface ShowDatosInput {
  nombre: string
  fecha: string
  hora?: string | null
  lugar?: string | null
  ciudad?: string | null
  zona?: string | null
  estado?: EstadoShow
  visibilidad?: VisibilidadShow
  entrada_info?: string | null
  entrada_url?: string | null
  repertorio_id?: string | null
  invitados?: string | null
  notas?: string | null
}

/** Payload `p_cobro` of `guardar_show`: the caller's own fee. A null `importe` removes it. */
export interface CobroInput {
  importe: number | null
  moneda?: Moneda
  estado_cobro?: EstadoCobro
  cobrado_en?: string | null
  notas?: string | null
}
export type Repertorio = Database['public']['Tables']['repertorios']['Row']
export type RepertorioMusicoRow = Database['public']['Tables']['repertorio_musicos']['Row']
export type RepertorioCancionRow = Database['public']['Tables']['repertorio_canciones']['Row']
