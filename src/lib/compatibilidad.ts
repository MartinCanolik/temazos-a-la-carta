/** Compatibilidad entre repertorios y análisis de formaciones (todo sobre ids del catálogo). */

export interface Compatibilidad {
  enComun: number
  union: number
  /** round(enComun / union × 100); 0 si no hay canciones. */
  porcentaje: number
}

/** Compatibilidad de a dos: canciones en común sobre la unión de ambos repertorios. */
export function compatibilidad(aIds: string[], bIds: string[]): Compatibilidad {
  const a = new Set(aIds)
  const b = new Set(bIds)
  let enComun = 0
  for (const id of a) if (b.has(id)) enComun++
  const union = a.size + b.size - enComun
  return { enComun, union, porcentaje: union === 0 ? 0 : Math.round((enComun / union) * 100) }
}

export interface CancionDeMusico {
  cancion_id: string
  titulo: string
  artista: string
  tonalidad?: string | null
  version?: string | null
  instrumento?: string | null
}

export interface MusicoFormacion {
  id: string
  nombre: string
  canciones: CancionDeMusico[]
}

export interface Conoce {
  musicoId: string
  nombre: string
  tonalidad: string | null
  version: string | null
  instrumento: string | null
}

export interface CancionAnalizada {
  cancion_id: string
  titulo: string
  artista: string
  conocen: Conoce[]
  cantidad: number
  /** Tamaño de la formación. */
  total: number
  porcentaje: number
  /** La saben todos los músicos de la formación. */
  todos: boolean
  /** Hay al menos dos tonalidades distintas entre quienes la tocan. */
  tonalidadesDistintas: boolean
}

export interface AnalisisFormacion {
  total: number
  canciones: CancionAnalizada[]
  todos: CancionAnalizada[]
  parcial: CancionAnalizada[]
}

function porCantidadYTitulo(a: CancionAnalizada, b: CancionAnalizada): number {
  return b.cantidad - a.cantidad || a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' })
}

/**
 * Cruza los repertorios de una formación. Una canción conocida por un solo músico
 * (en una formación de 2 o más) sigue siendo "parcial": el resto tiene que ensayarla.
 */
export function analizarFormacion(musicos: MusicoFormacion[]): AnalisisFormacion {
  const total = musicos.length
  const porCancion = new Map<string, CancionAnalizada>()

  for (const musico of musicos) {
    const vistas = new Set<string>()
    for (const c of musico.canciones) {
      if (vistas.has(c.cancion_id)) continue
      vistas.add(c.cancion_id)
      let item = porCancion.get(c.cancion_id)
      if (!item) {
        item = {
          cancion_id: c.cancion_id,
          titulo: c.titulo,
          artista: c.artista,
          conocen: [],
          cantidad: 0,
          total,
          porcentaje: 0,
          todos: false,
          tonalidadesDistintas: false,
        }
        porCancion.set(c.cancion_id, item)
      }
      item.conocen.push({
        musicoId: musico.id,
        nombre: musico.nombre,
        tonalidad: c.tonalidad ?? null,
        version: c.version ?? null,
        instrumento: c.instrumento ?? null,
      })
    }
  }

  const canciones = [...porCancion.values()].sort(porCantidadYTitulo)
  for (const c of canciones) {
    c.cantidad = c.conocen.length
    c.porcentaje = total === 0 ? 0 : Math.round((c.cantidad / total) * 100)
    c.todos = total > 0 && c.cantidad === total
    c.tonalidadesDistintas = new Set(c.conocen.map((k) => k.tonalidad).filter(Boolean)).size > 1
  }

  return {
    total,
    canciones,
    todos: canciones.filter((c) => c.todos),
    parcial: canciones.filter((c) => !c.todos),
  }
}

export interface CoberturaRepertorio {
  /** Canciones del setlist que sabe toda la formación. */
  listas: number
  total: number
  porcentaje: number
  /** Ids de las canciones del setlist que alguien de la formación no sabe (o nadie sabe). */
  requierenPreparacion: string[]
}

/** Qué parte de un setlist (ids del catálogo) sabe la formación completa. */
export function coberturaRepertorio(
  cancionIds: string[],
  analisis: AnalisisFormacion,
): CoberturaRepertorio {
  const ids = [...new Set(cancionIds)]
  const listasIds = new Set(analisis.todos.map((c) => c.cancion_id))
  const requierenPreparacion = ids.filter((id) => !listasIds.has(id))
  const listas = ids.length - requierenPreparacion.length
  return {
    listas,
    total: ids.length,
    porcentaje: ids.length === 0 ? 0 : Math.round((listas / ids.length) * 100),
    requierenPreparacion,
  }
}

/** "75% · 3 de 4 músicos" (singular si la formación es de uno). */
export function etiquetaCobertura(cantidad: number, total: number): string {
  const porcentaje = total === 0 ? 0 : Math.round((cantidad / total) * 100)
  return `${porcentaje}% · ${cantidad} de ${total} ${total === 1 ? 'músico' : 'músicos'}`
}
