/**
 * Pure helpers of the public agenda ("Música en vivo"): date-chip ranges, grouping by day, labels,
 * safe ticket links and the city / zone filter options. `hoy` is always injected (YYYY-MM-DD).
 */
import type { AgendaPublicaFila, UbicacionConShows } from './database.types'
import { normalizarTexto } from './canciones'
import { rangoPeriodo } from './estadisticas'
import { fechaLocal, formatearFecha, hoyISO } from './shows'

// ─── Date chips ─────────────────────────────────────────────────────────────

export type ChipFecha = 'hoy' | 'finde' | 'semana' | 'mes' | 'todo'

export const CHIPS_FECHA: { valor: ChipFecha; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: 'finde', etiqueta: 'Este finde' },
  { valor: 'semana', etiqueta: 'Próximos 7 días' },
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'todo', etiqueta: 'Todo' },
]

export const CHIP_INICIAL: ChipFecha = 'todo'

/** Inclusive bounds; `hasta: null` means open ended. */
export interface RangoAgenda {
  desde: string
  hasta: string | null
}

/** `iso` plus `dias` days (negative allowed), without time zone shifts. */
export function sumarDias(iso: string, dias: number): string {
  const d = fechaLocal(iso)
  d.setDate(d.getDate() + dias)
  return hoyISO(d)
}

/**
 * Date window of a chip. "Este finde" is Friday to Sunday: on Friday or Saturday it starts today,
 * on Sunday it is just today, and from Monday to Thursday it is the coming Friday to Sunday.
 */
export function rangoChip(chip: ChipFecha, hoy: string): RangoAgenda {
  switch (chip) {
    case 'hoy':
      return { desde: hoy, hasta: hoy }
    case 'finde': {
      const dia = fechaLocal(hoy).getDay() // 0 = Sunday
      if (dia === 0) return { desde: hoy, hasta: hoy }
      if (dia >= 5) return { desde: hoy, hasta: sumarDias(hoy, 7 - dia) }
      return { desde: sumarDias(hoy, 5 - dia), hasta: sumarDias(hoy, 7 - dia) }
    }
    case 'semana':
      return { desde: hoy, hasta: sumarDias(hoy, 6) }
    case 'mes':
      return { desde: hoy, hasta: rangoPeriodo('este-mes', hoy).hasta }
    case 'todo':
      return { desde: hoy, hasta: null }
  }
}

// ─── Grouping and labels ────────────────────────────────────────────────────

export interface GrupoFecha<T> {
  fecha: string
  items: T[]
}

/** Groups consecutive items by `fecha`, keeping the incoming order (the server already sorts by date). */
export function agruparPorFecha<T extends { fecha: string }>(items: T[]): GrupoFecha<T>[] {
  const grupos: GrupoFecha<T>[] = []
  for (const item of items) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.fecha === item.fecha) ultimo.items.push(item)
    else grupos.push({ fecha: item.fecha, items: [item] })
  }
  return grupos
}

/** "Hoy", "Mañana" or "vie 14 nov". */
export function etiquetaDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy'
  if (fecha === sumarDias(hoy, 1)) return 'Mañana'
  return formatearFecha(fecha)
}

/** "Café Vinilo · CABA (Palermo)": venue, then city with its zone. Null when there is nothing to show. */
export function lineaLugar(show: Pick<AgendaPublicaFila, 'lugar' | 'ciudad' | 'zona'>): string | null {
  const zona = show.zona?.trim() || null
  const ciudad = show.ciudad?.trim() || null
  const lugar = show.lugar?.trim() || null
  const zonaCiudad = ciudad && zona ? `${ciudad} (${zona})` : (ciudad ?? zona)
  const partes = [lugar, zonaCiudad].filter((p): p is string => !!p)
  return partes.length > 0 ? partes.join(' · ') : null
}

/** "con: Tito (batería)" for the free-text guests of a show, or null. */
export function lineaInvitados(invitados: string | null): string | null {
  const t = invitados?.trim()
  return t ? `con: ${t}` : null
}

/**
 * The ticket link to render, or null. Only absolute http(s) URLs pass (never `javascript:` and
 * friends), so a bad value stored by mistake is simply not shown as a button.
 */
export function urlEntradaSegura(url: string | null | undefined): string | null {
  const t = url?.trim()
  if (!t) return null
  try {
    const u = new URL(t)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

// ─── City / zone filter ─────────────────────────────────────────────────────

export interface OpcionUbicacion {
  /** Stable select value: '' (everything), 'c:<ciudad>' or 'z:<ciudad>|<zona>'. */
  valor: string
  etiqueta: string
  ciudad: string | null
  zona: string | null
}

export const TODAS_LAS_UBICACIONES: OpcionUbicacion = {
  valor: '',
  etiqueta: 'Todas las ciudades',
  ciudad: null,
  zona: null,
}

/**
 * Options for the city / zone select: everything, then each city followed by its zones. Spellings
 * that normalize the same ("CABA" / "caba") collapse into the first one seen.
 */
export function opcionesUbicacion(lugares: UbicacionConShows[]): OpcionUbicacion[] {
  const ciudades = new Map<string, { etiqueta: string; zonas: Map<string, string> }>()
  const sinCiudad = new Map<string, string>()

  for (const l of lugares) {
    const ciudad = l.ciudad?.trim() || null
    const zona = l.zona?.trim() || null
    if (ciudad) {
      const clave = normalizarTexto(ciudad)
      const entrada = ciudades.get(clave) ?? { etiqueta: ciudad, zonas: new Map<string, string>() }
      if (zona && !entrada.zonas.has(normalizarTexto(zona))) entrada.zonas.set(normalizarTexto(zona), zona)
      ciudades.set(clave, entrada)
    } else if (zona && !sinCiudad.has(normalizarTexto(zona))) {
      sinCiudad.set(normalizarTexto(zona), zona)
    }
  }

  const opciones: OpcionUbicacion[] = [TODAS_LAS_UBICACIONES]
  const porNombre = (a: [string, unknown], b: [string, unknown]) => a[0].localeCompare(b[0])
  for (const [, { etiqueta, zonas }] of [...ciudades.entries()].sort(porNombre)) {
    opciones.push({ valor: `c:${etiqueta}`, etiqueta, ciudad: etiqueta, zona: null })
    for (const [, zona] of [...zonas.entries()].sort(porNombre)) {
      opciones.push({ valor: `z:${etiqueta}|${zona}`, etiqueta: `${etiqueta} · ${zona}`, ciudad: etiqueta, zona })
    }
  }
  for (const [, zona] of [...sinCiudad.entries()].sort(porNombre)) {
    opciones.push({ valor: `z:|${zona}`, etiqueta: zona, ciudad: null, zona })
  }
  return opciones
}

/** The option for a select value (everything when it no longer exists, e.g. after the data changed). */
export function buscarOpcion(opciones: OpcionUbicacion[], valor: string): OpcionUbicacion {
  return opciones.find((o) => o.valor === valor) ?? TODAS_LAS_UBICACIONES
}
