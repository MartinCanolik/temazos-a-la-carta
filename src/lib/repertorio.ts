/** Lógica pura del armador de repertorios (setlists): orden, estado de cada tema frente a una formación e historial. */
import {
  coberturaRepertorio,
  type AnalisisFormacion,
  type CancionAnalizada,
  type CoberturaRepertorio,
} from './compatibilidad'

export interface ItemRepertorio {
  cancion_id: string
  titulo: string
  artista: string
  /** Marca manual: "hay que prepararla". */
  a_preparar: boolean
  notas: string | null
}

/** Mueve el item `indice` una posición (delta -1 sube, +1 baja). Devuelve la misma lista si no se puede. */
export function moverItem(items: ItemRepertorio[], indice: number, delta: -1 | 1): ItemRepertorio[] {
  const destino = indice + delta
  if (indice < 0 || indice >= items.length || destino < 0 || destino >= items.length) return items
  const copia = [...items]
  ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
  return copia
}

/** Agrega al final; si el tema ya está, no hace nada. */
export function agregarItem(items: ItemRepertorio[], item: ItemRepertorio): ItemRepertorio[] {
  return items.some((i) => i.cancion_id === item.cancion_id) ? items : [...items, item]
}

export function quitarItem(items: ItemRepertorio[], cancionId: string): ItemRepertorio[] {
  return items.filter((i) => i.cancion_id !== cancionId)
}

export function alternarPreparar(items: ItemRepertorio[], cancionId: string): ItemRepertorio[] {
  return items.map((i) => (i.cancion_id === cancionId ? { ...i, a_preparar: !i.a_preparar } : i))
}

/** Payload de `guardar_repertorio`: `orden` contiguo 0..n-1 según la posición. */
export function aPayload(items: ItemRepertorio[]) {
  return items.map((i, orden) => ({
    cancion_id: i.cancion_id,
    orden,
    a_preparar: i.a_preparar,
    notas: i.notas,
  }))
}

export type EstadoItem = 'lista' | 'a_preparar' | 'falta'
export type RazonItem = 'manual' | 'falta'

export interface EstadoDeItem {
  /** Lo que se muestra primero: la marca manual gana, después lo que falta. */
  estado: EstadoItem
  /** Todos los motivos que aplican (pueden ser los dos). */
  razones: RazonItem[]
  /** Nombres de quienes de la formación no la saben. */
  faltan: string[]
  cantidad: number
  total: number
}

export interface MusicoNombre {
  id: string
  nombre: string
}

/**
 * Estado de un tema del repertorio frente a una formación:
 * 'lista' (la saben todos y no está marcada), 'a_preparar' (marca manual) o 'falta' (no la saben todos).
 */
export function estadoDeItem(
  item: Pick<ItemRepertorio, 'cancion_id' | 'a_preparar'>,
  analisis: AnalisisFormacion,
  musicos: MusicoNombre[],
): EstadoDeItem {
  const analizada: CancionAnalizada | undefined = analisis.canciones.find((c) => c.cancion_id === item.cancion_id)
  const conocen = new Set(analizada?.conocen.map((k) => k.musicoId))
  const faltan = musicos.filter((m) => !conocen.has(m.id)).map((m) => m.nombre)
  const total = musicos.length
  const razones: RazonItem[] = []
  if (item.a_preparar) razones.push('manual')
  if (faltan.length > 0) razones.push('falta')
  const estado: EstadoItem = item.a_preparar ? 'a_preparar' : faltan.length > 0 ? 'falta' : 'lista'
  return { estado, razones, faltan, cantidad: total - faltan.length, total }
}

export interface ResumenRepertorio {
  cobertura: CoberturaRepertorio
  /** Temas sin ningún motivo pendiente. */
  listas: number
  /** Temas con alguna marca manual o que alguien no sabe. */
  porPreparar: number
}

export function resumenRepertorio(
  items: ItemRepertorio[],
  analisis: AnalisisFormacion,
  musicos: MusicoNombre[],
): ResumenRepertorio {
  const cobertura = coberturaRepertorio(
    items.map((i) => i.cancion_id),
    analisis,
  )
  const porPreparar = items.filter((i) => estadoDeItem(i, analisis, musicos).razones.length > 0).length
  return { cobertura, listas: items.length - porPreparar, porPreparar }
}

export interface RepertorioHistorial {
  id: string
  updated_at: string
  musicoIds: string[]
}

/** Repertorios cuya formación incluye a alguno de los músicos actuales, sin el que se está editando; el más reciente primero. */
export function repertoriosRecientes<T extends RepertorioHistorial>(
  repertorios: T[],
  musicoIds: string[],
  excluirId?: string | null,
  max = 5,
): T[] {
  const actuales = new Set(musicoIds)
  return repertorios
    .filter((r) => r.id !== excluirId && r.musicoIds.some((id) => actuales.has(id)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, max)
}
