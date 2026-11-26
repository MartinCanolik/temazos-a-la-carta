/**
 * Pure aggregations behind "Tus números": shows, venues, co-musicians, songs, setlists and the
 * private economics of ONE musician. `hoy` is injected (YYYY-MM-DD) so results are deterministic.
 *
 * Rules: only shows where my participation is 'aceptado' count; cancelled shows never count as done;
 * period membership uses the show's `fecha`; currencies are never mixed.
 */
import type { EstadoCobro, Moneda, Show } from './database.types'
import { normalizarTexto } from './canciones'
import { miEstado, MONEDAS, type ShowConParticipantes, type TotalesPorMoneda } from './shows'

// ─── Periods ────────────────────────────────────────────────────────────────

export type Periodo = 'este-mes' | 'mes-anterior' | 'este-anio' | 'anio-anterior' | 'historico'

export const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: 'este-mes', etiqueta: 'Este mes' },
  { valor: 'mes-anterior', etiqueta: 'Mes anterior' },
  { valor: 'este-anio', etiqueta: 'Este año' },
  { valor: 'anio-anterior', etiqueta: 'Año anterior' },
  { valor: 'historico', etiqueta: 'Histórico' },
]

export const PERIODO_INICIAL: Periodo = 'este-anio'

/** Inclusive YYYY-MM-DD bounds; `null` means unbounded. */
export interface RangoFechas {
  desde: string | null
  hasta: string | null
}

const dosDigitos = (n: number) => String(n).padStart(2, '0')

/** Last day of a month (month is 1-12). */
function ultimoDia(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate()
}

/** Date bounds of a period relative to `hoy`. */
export function rangoPeriodo(periodo: Periodo, hoy: string): RangoFechas {
  const anio = Number(hoy.slice(0, 4))
  const mes = Number(hoy.slice(5, 7))
  switch (periodo) {
    case 'este-mes':
      return { desde: `${anio}-${dosDigitos(mes)}-01`, hasta: `${anio}-${dosDigitos(mes)}-${dosDigitos(ultimoDia(anio, mes))}` }
    case 'mes-anterior': {
      const a = mes === 1 ? anio - 1 : anio
      const m = mes === 1 ? 12 : mes - 1
      return { desde: `${a}-${dosDigitos(m)}-01`, hasta: `${a}-${dosDigitos(m)}-${dosDigitos(ultimoDia(a, m))}` }
    }
    case 'este-anio':
      return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` }
    case 'anio-anterior':
      return { desde: `${anio - 1}-01-01`, hasta: `${anio - 1}-12-31` }
    case 'historico':
      return { desde: null, hasta: null }
  }
}

export function enRango(fecha: string, rango: RangoFechas): boolean {
  return (rango.desde == null || fecha >= rango.desde) && (rango.hasta == null || fecha <= rango.hasta)
}

// ─── Inputs and outputs ─────────────────────────────────────────────────────

/** My fee for a show (the owner-only `show_cobros` row). */
export interface CobroPropio {
  importe: number
  moneda: Moneda
  estado_cobro: EstadoCobro
  cobrado_en: string | null
}

/** A confirmed played song of a show. */
export interface TocadaStats {
  show_id: string
  cancion_id: string
  titulo: string
  artista: string
}

export interface EntradaStats {
  shows: ShowConParticipantes[]
  miId: string | undefined
  /** My fees by show id. */
  cobros: ReadonlyMap<string, CobroPropio>
  tocadas: TocadaStats[]
  periodo: Periodo
  hoy: string
}

export interface LugarTop {
  /** Normalized key (lugar + ciudad). */
  clave: string
  lugar: string
  ciudad: string | null
  shows: number
}

export interface CoMusicoTop {
  musico_id: string
  shows: number
}

export interface TemaTop {
  cancion_id: string
  titulo: string
  artista: string
  shows: number
}

export interface UsoRepertorio {
  show_id: string
  show: string
  fecha: string
  repertorio_id: string
}

export interface CobroPendiente {
  show_id: string
  show: string
  fecha: string
  importe: number
  moneda: Moneda
}

export interface Plata {
  /** Money actually collected, dated by `cobrado_en` (the show date when it is missing). */
  cobrado: TotalesPorMoneda
  /** Owed for shows already played. */
  pendiente: TotalesPorMoneda
  /** Expected from upcoming shows. */
  previsto: TotalesPorMoneda
  /** Currencies with any amount, in display order. */
  monedas: Moneda[]
}

export interface Estadisticas {
  rango: RangoFechas
  realizados: number
  proximos: number
  temasDistintos: number
  lugares: LugarTop[]
  coMusicos: CoMusicoTop[]
  temas: TemaTop[]
  repertorios: UsoRepertorio[]
  plata: Plata
  cobrosPendientes: CobroPendiente[]
}

export const TOP_LUGARES = 5
export const TOP_COMUSICOS = 5
export const TOP_TEMAS = 10

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Venue identity: same place with different casing, accents or punctuation is one place. */
export function claveLugar(lugar: string | null, ciudad: string | null): string | null {
  const l = normalizarTexto(lugar ?? '')
  if (!l) return null
  return `${l}|${normalizarTexto(ciudad ?? '')}`
}

/** Sorted by count desc, then by `desempate` asc, so equal counts always list in the same order. */
function ranking<T extends { shows: number }>(items: T[], desempate: (i: T) => string, limite: number): T[] {
  return [...items]
    .sort((a, b) => b.shows - a.shows || desempate(a).localeCompare(desempate(b)))
    .slice(0, limite)
}

function sumar(totales: TotalesPorMoneda, moneda: Moneda, importe: number) {
  totales[moneda] = (totales[moneda] ?? 0) + importe
}

const esProximo = (s: Pick<Show, 'estado' | 'fecha'>, hoy: string) => s.estado === 'programado' && s.fecha >= hoy

// ─── Aggregation ────────────────────────────────────────────────────────────

/** Everything the stats page and the panel summary show, from the data already loaded. */
export function calcularEstadisticas(entrada: EntradaStats): Estadisticas {
  const { miId, cobros, tocadas, hoy } = entrada
  const rango = rangoPeriodo(entrada.periodo, hoy)

  // Pending invitations and declines are left out, and so is anything outside the period.
  const mios = entrada.shows.filter((s) => miEstado(s, miId) === 'aceptado' && enRango(s.fecha, rango))
  const realizados = mios.filter((s) => s.estado === 'realizado')
  const proximos = mios.filter((s) => esProximo(s, hoy))

  // Venues: one count per played show.
  const porLugar = new Map<string, LugarTop & { variantes: Map<string, number> }>()
  for (const s of realizados) {
    const clave = claveLugar(s.lugar, s.ciudad)
    if (!clave) continue
    const actual = porLugar.get(clave) ?? {
      clave,
      lugar: s.lugar!.trim(),
      ciudad: s.ciudad?.trim() || null,
      shows: 0,
      variantes: new Map<string, number>(),
    }
    actual.shows += 1
    // Keep the spelling used most often as the label.
    const escrito = s.lugar!.trim()
    const veces = (actual.variantes.get(escrito) ?? 0) + 1
    actual.variantes.set(escrito, veces)
    if (veces > (actual.variantes.get(actual.lugar) ?? 0)) actual.lugar = escrito
    porLugar.set(clave, actual)
  }
  const lugares = ranking(
    [...porLugar.values()].map(({ variantes, ...l }) => (void variantes, l)),
    (l) => l.clave,
    TOP_LUGARES,
  )

  // Co-musicians: other ACCEPTED participants of my played shows (a lineup row counts once per show).
  const porMusico = new Map<string, number>()
  for (const s of realizados) {
    const otros = new Set(s.participantes.filter((p) => p.estado === 'aceptado' && p.musico_id !== miId).map((p) => p.musico_id))
    for (const id of otros) porMusico.set(id, (porMusico.get(id) ?? 0) + 1)
  }
  const coMusicos = ranking(
    [...porMusico.entries()].map(([musico_id, shows]) => ({ musico_id, shows })),
    (c) => c.musico_id,
    TOP_COMUSICOS,
  )

  // Songs: only the confirmed songs of my played shows, counted once per show.
  const idsConfirmados = new Set(realizados.filter((s) => s.canciones_confirmadas_en).map((s) => s.id))
  const porTema = new Map<string, TemaTop & { vistos: Set<string> }>()
  for (const t of tocadas) {
    if (!idsConfirmados.has(t.show_id)) continue
    const actual = porTema.get(t.cancion_id) ?? { ...tema(t), shows: 0, vistos: new Set<string>() }
    if (actual.vistos.has(t.show_id)) continue
    actual.vistos.add(t.show_id)
    actual.shows += 1
    porTema.set(t.cancion_id, actual)
  }
  const todosLosTemas = [...porTema.values()].map(({ vistos, ...t }) => (void vistos, t))
  const temas = ranking(todosLosTemas, (t) => `${normalizarTexto(t.titulo)}|${t.cancion_id}`, TOP_TEMAS)

  // Setlist history: setlists linked to my shows in the period (cancelled shows never happened).
  const repertorios: UsoRepertorio[] = mios
    .filter((s) => s.estado !== 'cancelado' && s.repertorio_id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.nombre.localeCompare(b.nombre))
    .map((s) => ({ show_id: s.id, show: s.nombre, fecha: s.fecha, repertorio_id: s.repertorio_id! }))

  // Economics: only my own fees, per currency.
  const plata: Plata = { cobrado: {}, pendiente: {}, previsto: {}, monedas: [] }
  const cobrosPendientes: CobroPendiente[] = []
  for (const s of entrada.shows) {
    if (miEstado(s, miId) !== 'aceptado') continue
    const c = cobros.get(s.id)
    if (!c) continue
    const importe = Number(c.importe)
    if (c.estado_cobro === 'cobrado') {
      if (enRango(c.cobrado_en ?? s.fecha, rango)) sumar(plata.cobrado, c.moneda, importe)
    } else if (enRango(s.fecha, rango)) {
      if (s.estado === 'realizado') {
        sumar(plata.pendiente, c.moneda, importe)
        cobrosPendientes.push({ show_id: s.id, show: s.nombre, fecha: s.fecha, importe, moneda: c.moneda })
      } else if (esProximo(s, hoy)) {
        sumar(plata.previsto, c.moneda, importe)
      }
    }
  }
  plata.monedas = MONEDAS.filter((m) => plata.cobrado[m] != null || plata.pendiente[m] != null || plata.previsto[m] != null)
  cobrosPendientes.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.show.localeCompare(b.show))

  return {
    rango,
    realizados: realizados.length,
    proximos: proximos.length,
    temasDistintos: todosLosTemas.length,
    lugares,
    coMusicos,
    temas,
    repertorios,
    plata,
    cobrosPendientes,
  }
}

function tema(t: TocadaStats) {
  return { cancion_id: t.cancion_id, titulo: t.titulo, artista: t.artista }
}

/** Width (0-100) of a bar relative to the top value of its list. */
export function anchoBarra(valor: number, maximo: number): number {
  return maximo <= 0 ? 0 : Math.max(4, Math.round((valor / maximo) * 100))
}
