/** Pure logic for shared shows: agenda split, labels, played-songs list and fee helpers. */
import type {
  CobroInput,
  EstadoCobro,
  EstadoParticipacion,
  EstadoShow,
  Moneda,
  Show,
  ShowDatosInput,
  VisibilidadShow,
} from './database.types'

export const MONEDAS: Moneda[] = ['UYU', 'USD', 'ARS']

export const ESTADOS_SHOW: EstadoShow[] = ['programado', 'realizado', 'cancelado']
export const VISIBILIDADES: VisibilidadShow[] = ['privado', 'publico']

// ─── Dates and money ────────────────────────────────────────────────────────

/** Today as YYYY-MM-DD (local time). */
export function hoyISO(ahora: Date = new Date()): string {
  const mm = String(ahora.getMonth() + 1).padStart(2, '0')
  const dd = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mm}-${dd}`
}

/** "2026-11-14" → local Date (no time zone shift). */
export function fechaLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** "2026-11-14" → "vie 14 nov" */
export function formatearFecha(iso: string): string {
  return fechaLocal(iso).toLocaleDateString('es-UY', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** "21:30:00" → "21:30" */
export function formatearHora(hora: string | null): string | null {
  return hora ? hora.slice(0, 5) : null
}

/**
 * Always prefixes the ISO code ("UYU 12.000", "ARS 12.000", "USD 50"): a bare "$" is ambiguous
 * between Argentine and Uruguayan pesos.
 */
export function formatearPlata(monto: number, moneda: Moneda): string {
  const numero = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 0 }).format(monto)
  return `${moneda} ${numero}`
}

/** Is `fecha` in the same month as `hoy`? (both YYYY-MM-DD) */
export function esDelMes(fecha: string, hoy: string): boolean {
  return fecha.slice(0, 7) === hoy.slice(0, 7)
}

// ─── Agenda ─────────────────────────────────────────────────────────────────

export interface Participacion {
  musico_id: string
  estado: EstadoParticipacion
  invitado_por: string | null
}

/** A show with its lineup (the `show_musicos` rows readable by the caller). */
export interface ShowConParticipantes extends Show {
  participantes: Participacion[]
}

/** My participation state in a show (null if I am not part of it). */
export function miEstado(show: Pick<ShowConParticipantes, 'participantes'>, miId: string | undefined): EstadoParticipacion | null {
  if (!miId) return null
  return show.participantes.find((p) => p.musico_id === miId)?.estado ?? null
}

/** Who invited me (null when I created it or there is no invitation). */
export function invitadoPor(show: Pick<ShowConParticipantes, 'participantes' | 'creado_por'>, miId: string | undefined): string | null {
  if (!miId) return null
  return show.participantes.find((p) => p.musico_id === miId)?.invitado_por ?? show.creado_por
}

export interface AgendaDividida<T extends ShowConParticipantes> {
  /** Pending invitations, soonest first. */
  invitaciones: T[]
  /** Accepted, today or later, not cancelled; soonest first. */
  proximos: T[]
  /** Everything else I accepted (past, or cancelled); latest first. Declined shows are left out. */
  anteriores: T[]
}

const porFechaHora = <T extends Show>(a: T, b: T) =>
  a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? '')

/**
 * Splits a musician's shows. `hoy` is injected (YYYY-MM-DD) so the result is deterministic.
 * Only accepted participation counts for "próximos" / "anteriores".
 */
export function dividirAgenda<T extends ShowConParticipantes>(
  shows: T[],
  miId: string | undefined,
  hoy: string,
): AgendaDividida<T> {
  const invitaciones: T[] = []
  const proximos: T[] = []
  const anteriores: T[] = []
  for (const s of shows) {
    const estado = miEstado(s, miId)
    if (estado === 'pendiente') invitaciones.push(s)
    else if (estado === 'aceptado') {
      if (s.fecha >= hoy && s.estado !== 'cancelado') proximos.push(s)
      else anteriores.push(s)
    }
  }
  return {
    invitaciones: invitaciones.sort(porFechaHora),
    proximos: proximos.sort(porFechaHora),
    anteriores: anteriores.sort((a, b) => porFechaHora(b, a)),
  }
}

/** Past, not cancelled and the played songs were never confirmed. */
export function necesitaConfirmacion(
  show: Pick<Show, 'fecha' | 'estado' | 'canciones_confirmadas_en'>,
  hoy: string,
): boolean {
  return show.fecha < hoy && show.estado !== 'cancelado' && !show.canciones_confirmadas_en
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export function etiquetaEstado(estado: EstadoShow): string {
  return { programado: 'Programado', realizado: 'Realizado', cancelado: 'Cancelado' }[estado]
}

export function etiquetaVisibilidad(v: VisibilidadShow): string {
  return v === 'publico' ? 'Público' : 'Privado'
}

/** One-line explanation shown next to the visibility selector. */
export function explicarVisibilidad(v: VisibilidadShow): string {
  return v === 'publico'
    ? 'Cualquiera podrá verlo en «Música en vivo» (próximamente). Tu cachet nunca se publica.'
    : 'Sólo lo ven los músicos del show.'
}

export function etiquetaParticipacion(estado: EstadoParticipacion): string {
  return { pendiente: 'Pendiente', aceptado: 'Aceptó', rechazado: 'Rechazó' }[estado]
}

export function etiquetaCobro(estado: EstadoCobro): string {
  return estado === 'cobrado' ? 'Cobrado' : 'Pendiente de cobro'
}

/** "3500 UYU · cobrado" style summary of MY fee for the agenda. */
export function resumenCobro(c: { importe: number; moneda: Moneda; estado_cobro: EstadoCobro }): string {
  return `${formatearPlata(Number(c.importe), c.moneda)} · ${c.estado_cobro === 'cobrado' ? 'cobrado' : 'a cobrar'}`
}

// ─── Fees ───────────────────────────────────────────────────────────────────

export type TotalesPorMoneda = Partial<Record<Moneda, number>>

/** Sums amounts per currency (currencies are never mixed). */
export function totalesPorMoneda(items: { importe: number; moneda: Moneda }[]): TotalesPorMoneda {
  const totales: TotalesPorMoneda = {}
  for (const i of items) totales[i.moneda] = (totales[i.moneda] ?? 0) + Number(i.importe)
  return totales
}

/** "UYU 3.500 + US$ 80" or "—" when empty. */
export function formatearTotales(totales: TotalesPorMoneda): string {
  const partes = MONEDAS.filter((m) => totales[m] != null).map((m) => formatearPlata(totales[m]!, m))
  return partes.length === 0 ? '—' : partes.join(' + ')
}

/** Parses an amount typed by a musician. Blank → no fee (valor null). "1.500,50" and "1500.5" both work. */
export function parsearImporte(texto: string): { valido: boolean; valor: number | null } {
  const limpio = texto.trim().replace(/\s/g, '')
  if (!limpio) return { valido: true, valor: null }
  // "1.500,50" and "3.500" use dots as thousands separators; "1500.5" keeps its decimal dot.
  const puntosDeMiles = /,/.test(limpio) || /^\d{1,3}(\.\d{3})+$/.test(limpio)
  const normal = puntosDeMiles ? limpio.replace(/\./g, '').replace(',', '.') : limpio
  const n = Number(normal)
  if (!Number.isFinite(n) || n < 0) return { valido: false, valor: null }
  return { valido: true, valor: n }
}

export interface FormCobro {
  importe: string
  moneda: Moneda
  estado: EstadoCobro
  cobradoEn: string
  notas: string
}

/** Payload for `p_cobro`. Undefined when the amount is invalid. */
export function construirCobro(f: FormCobro, hoy: string): CobroInput | undefined {
  const { valido, valor } = parsearImporte(f.importe)
  if (!valido) return undefined
  if (valor == null) return { importe: null }
  return {
    importe: valor,
    moneda: f.moneda,
    estado_cobro: f.estado,
    cobrado_en: f.estado === 'cobrado' ? f.cobradoEn || hoy : null,
    notas: f.notas.trim() || null,
  }
}

// ─── Show payload ───────────────────────────────────────────────────────────

export interface FormShow {
  nombre: string
  fecha: string
  hora: string
  lugar: string
  ciudad: string
  zona: string
  estado: EstadoShow
  visibilidad: VisibilidadShow
  entradaInfo: string
  entradaUrl: string
  repertorioId: string
  invitados: string
  notas: string
}

const vacioANull = (s: string) => s.trim() || null

/** Payload for `p_datos`. The server trims and validates again. */
export function construirDatosShow(f: FormShow): ShowDatosInput {
  return {
    nombre: f.nombre.trim(),
    fecha: f.fecha,
    hora: f.hora || null,
    lugar: vacioANull(f.lugar),
    ciudad: vacioANull(f.ciudad),
    zona: vacioANull(f.zona),
    estado: f.estado,
    visibilidad: f.visibilidad,
    entrada_info: vacioANull(f.entradaInfo),
    entrada_url: vacioANull(f.entradaUrl),
    repertorio_id: f.repertorioId || null,
    invitados: vacioANull(f.invitados),
    notas: vacioANull(f.notas),
  }
}

/** Only http(s) links are accepted by the database. */
export function urlValida(texto: string): boolean {
  const t = texto.trim()
  return t === '' || /^https?:\/\/\S+$/i.test(t)
}

// ─── Lineup ─────────────────────────────────────────────────────────────────

/**
 * Lineup changes to send to `guardar_show`: `agregar` only adds or keeps (the server never deletes from it),
 * `quitar` lists the explicit removals. Only participants the form could resolve (`resolubles`: ids whose
 * profile is public) can be removed; anyone else (e.g. invited by someone else meanwhile) is never touched.
 */
export function musicosAGuardar(
  elegidos: string[],
  existentes: string[],
  resolubles: Set<string>,
): { agregar: string[]; quitar: string[] } {
  const agregar = [...new Set(elegidos)]
  const quitar = existentes.filter((id) => resolubles.has(id) && !elegidos.includes(id))
  return { agregar, quitar: [...new Set(quitar)] }
}

// ─── Played songs ───────────────────────────────────────────────────────────

export interface Tema {
  cancion_id: string
  titulo: string
  artista: string
}

export interface TemaTocado extends Tema {
  tocado: boolean
}

/**
 * Starting list for the "songs played" checklist: the confirmed songs when there are any,
 * otherwise the setlist. Everything starts checked.
 */
export function temasIniciales(setlist: Tema[], confirmados: Tema[]): TemaTocado[] {
  const base = confirmados.length > 0 ? confirmados : setlist
  const vistos = new Set<string>()
  const lista: TemaTocado[] = []
  for (const t of base) {
    if (vistos.has(t.cancion_id)) continue
    vistos.add(t.cancion_id)
    lista.push({ ...t, tocado: true })
  }
  return lista
}

/** Adds a song at the end (ignored when it is already in the list). */
export function sumarTema(lista: TemaTocado[], tema: Tema): TemaTocado[] {
  if (lista.some((t) => t.cancion_id === tema.cancion_id)) return lista
  return [...lista, { ...tema, tocado: true }]
}

export function alternarTocado(lista: TemaTocado[], cancionId: string): TemaTocado[] {
  return lista.map((t) => (t.cancion_id === cancionId ? { ...t, tocado: !t.tocado } : t))
}

/** Moves item `indice` one position (-1 up, +1 down). Same list when it cannot move. */
export function moverTema<T>(lista: T[], indice: number, delta: -1 | 1): T[] {
  const destino = indice + delta
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) return lista
  const copia = [...lista]
  ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
  return copia
}

/** Ids to send to `confirmar_canciones_tocadas`: the checked songs, in order. */
export function idsTocados(lista: TemaTocado[]): string[] {
  return lista.filter((t) => t.tocado).map((t) => t.cancion_id)
}

/** Counts how many times each song appears and returns the top `limite`, most played first. */
export function masTocadas(cancionIds: string[], limite: number): { cancion_id: string; veces: number }[] {
  const cuenta = new Map<string, number>()
  for (const id of cancionIds) cuenta.set(id, (cuenta.get(id) ?? 0) + 1)
  return [...cuenta.entries()]
    .map(([cancion_id, veces]) => ({ cancion_id, veces }))
    .sort((a, b) => b.veces - a.veces || a.cancion_id.localeCompare(b.cancion_id))
    .slice(0, limite)
}
