import { describe, expect, it } from 'vitest'
import type { EstadoParticipacion, Show } from './database.types'
import {
  anchoBarra,
  calcularEstadisticas,
  claveLugar,
  enRango,
  rangoPeriodo,
  type CobroPropio,
  type EntradaStats,
  type Periodo,
  type TocadaStats,
} from './estadisticas'
import type { Participacion, ShowConParticipantes } from './shows'

const HOY = '2026-11-18'
const YO = 'me'

function show(
  id: string,
  fecha: string,
  extra: Partial<Show> = {},
  otros: Participacion[] = [],
  miEst: EstadoParticipacion | null = 'aceptado',
): ShowConParticipantes {
  return {
    id,
    creado_por: 'creator',
    nombre: id,
    fecha,
    hora: null,
    lugar: null,
    ciudad: null,
    zona: null,
    estado: 'realizado',
    visibilidad: 'privado',
    entrada_info: null,
    entrada_url: null,
    repertorio_id: null,
    invitados: null,
    notas: null,
    canciones_confirmadas_en: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...extra,
    participantes: [
      { musico_id: 'creator', estado: 'aceptado', invitado_por: 'creator' },
      ...(miEst ? [{ musico_id: YO, estado: miEst, invitado_por: 'creator' }] : []),
      ...otros,
    ],
  }
}

const acepta = (musico_id: string): Participacion => ({ musico_id, estado: 'aceptado', invitado_por: 'creator' })
const pendiente = (musico_id: string): Participacion => ({ musico_id, estado: 'pendiente', invitado_por: 'creator' })

function stats(
  shows: ShowConParticipantes[],
  extra: { periodo?: Periodo; cobros?: Record<string, CobroPropio>; tocadas?: TocadaStats[]; hoy?: string } = {},
) {
  const entrada: EntradaStats = {
    shows,
    miId: YO,
    cobros: new Map(Object.entries(extra.cobros ?? {})),
    tocadas: extra.tocadas ?? [],
    periodo: extra.periodo ?? 'historico',
    hoy: extra.hoy ?? HOY,
  }
  return calcularEstadisticas(entrada)
}

const cobro = (importe: number, moneda: CobroPropio['moneda'], estado: CobroPropio['estado_cobro'], cobrado_en: string | null = null): CobroPropio => ({
  importe,
  moneda,
  estado_cobro: estado,
  cobrado_en,
})

const tocada = (show_id: string, cancion_id: string, titulo = cancion_id): TocadaStats => ({
  show_id,
  cancion_id,
  titulo,
  artista: 'Artista',
})

describe('rangoPeriodo', () => {
  it('covers the current month, including a short February', () => {
    expect(rangoPeriodo('este-mes', HOY)).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' })
    expect(rangoPeriodo('este-mes', '2028-02-10')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
  })

  it('goes back to December of the previous year from January', () => {
    expect(rangoPeriodo('mes-anterior', '2026-01-05')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' })
    expect(rangoPeriodo('mes-anterior', HOY)).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' })
  })

  it('covers whole years and leaves history unbounded', () => {
    expect(rangoPeriodo('este-anio', HOY)).toEqual({ desde: '2026-01-01', hasta: '2026-12-31' })
    expect(rangoPeriodo('anio-anterior', HOY)).toEqual({ desde: '2025-01-01', hasta: '2025-12-31' })
    expect(rangoPeriodo('historico', HOY)).toEqual({ desde: null, hasta: null })
  })

  it('includes both bounds', () => {
    const r = rangoPeriodo('este-mes', HOY)
    expect(enRango('2026-11-01', r)).toBe(true)
    expect(enRango('2026-11-30', r)).toBe(true)
    expect(enRango('2026-10-31', r)).toBe(false)
    expect(enRango('2026-12-01', r)).toBe(false)
    expect(enRango('1999-01-01', rangoPeriodo('historico', HOY))).toBe(true)
  })
})

describe('calcularEstadisticas: shows', () => {
  it('counts only played shows I accepted inside the period', () => {
    const shows = [
      show('a', '2026-03-01'),
      show('b', '2026-11-10'),
      show('cancelado', '2026-04-01', { estado: 'cancelado' }),
      show('programado', '2026-04-02', { estado: 'programado' }),
      show('pend', '2026-05-01', {}, [], 'pendiente'),
      show('rech', '2026-05-02', {}, [], 'rechazado'),
      show('ajeno', '2026-05-03', {}, [], null),
      show('viejo', '2025-12-31'),
    ]
    expect(stats(shows, { periodo: 'este-anio' }).realizados).toBe(2)
    expect(stats(shows, { periodo: 'este-mes' }).realizados).toBe(1)
    expect(stats(shows, { periodo: 'anio-anterior' }).realizados).toBe(1)
    expect(stats(shows, { periodo: 'historico' }).realizados).toBe(3)
  })

  it('counts upcoming shows: programado, today or later, accepted, in the period', () => {
    const shows = [
      show('hoy', HOY, { estado: 'programado' }),
      show('futuro', '2026-12-20', { estado: 'programado' }),
      show('ayer', '2026-11-17', { estado: 'programado' }),
      show('cancelado', '2026-12-01', { estado: 'cancelado' }),
      show('invitacion', '2026-12-02', { estado: 'programado' }, [], 'pendiente'),
    ]
    expect(stats(shows, { periodo: 'este-anio' }).proximos).toBe(2)
    expect(stats(shows, { periodo: 'este-mes' }).proximos).toBe(1)
    expect(stats(shows, { periodo: 'anio-anterior' }).proximos).toBe(0)
  })
})

describe('calcularEstadisticas: venues', () => {
  it('groups by normalized place and city, ignoring case and accents', () => {
    const shows = [
      show('1', '2026-01-01', { lugar: 'Café Brasilero', ciudad: 'Montevideo' }),
      show('2', '2026-01-02', { lugar: 'cafe brasilero', ciudad: 'montevideo' }),
      show('3', '2026-01-03', { lugar: 'Café Brasilero', ciudad: 'Colonia' }),
      show('4', '2026-01-04', { lugar: 'Sala Camacuá', ciudad: null }),
      show('5', '2026-01-05', { lugar: null }),
      show('6', '2026-01-06', { lugar: 'Café Brasilero', ciudad: 'Montevideo', estado: 'cancelado' }),
    ]
    const { lugares } = stats(shows)
    expect(lugares).toHaveLength(3)
    expect(lugares[0]).toMatchObject({ lugar: 'Café Brasilero', ciudad: 'Montevideo', shows: 2 })
    expect(lugares.map((l) => l.shows)).toEqual([2, 1, 1])
  })

  it('labels a venue with its most used spelling and keeps only the top 5', () => {
    const shows = [
      show('1', '2026-01-01', { lugar: 'el viejo', ciudad: 'Mdeo' }),
      show('2', '2026-01-02', { lugar: 'El Viejo', ciudad: 'Mdeo' }),
      show('3', '2026-01-03', { lugar: 'El Viejo', ciudad: 'Mdeo' }),
      ...['a', 'b', 'c', 'd', 'e'].map((l, i) => show(`x${l}`, `2026-02-0${i + 1}`, { lugar: `Lugar ${l}` })),
    ]
    const { lugares } = stats(shows)
    expect(lugares).toHaveLength(5)
    expect(lugares[0].lugar).toBe('El Viejo')
  })

  it('claveLugar treats blank places as no place', () => {
    expect(claveLugar('  ', 'Mdeo')).toBeNull()
    expect(claveLugar(null, null)).toBeNull()
    expect(claveLugar('Bar Fun Fun!', 'Mdeo')).toBe(claveLugar('bar fun fun', ' MDEO '))
  })
})

describe('calcularEstadisticas: co-musicians', () => {
  it('counts other accepted participants once per played show', () => {
    const shows = [
      show('1', '2026-01-01', {}, [acepta('ana'), acepta('bruno')]),
      show('2', '2026-01-02', {}, [acepta('ana'), acepta('ana'), pendiente('bruno')]),
      show('3', '2026-01-03', { estado: 'cancelado' }, [acepta('ana'), acepta('caro')]),
      show('4', '2026-01-04', { estado: 'programado' }, [acepta('caro')]),
      show('5', '2026-01-05', {}, [{ musico_id: 'dani', estado: 'rechazado', invitado_por: null }]),
    ]
    const { coMusicos } = stats(shows)
    // The helper puts the creator in every show: 1, 2 and 5 are played.
    expect(coMusicos).toEqual([
      { musico_id: 'creator', shows: 3 },
      { musico_id: 'ana', shows: 2 },
      { musico_id: 'bruno', shows: 1 },
    ])
  })

  it('never counts me and ignores shows I did not accept', () => {
    const shows = [show('1', '2026-01-01', {}, [acepta('ana')], 'pendiente'), show('2', '2026-01-02', {}, [acepta('ana')])]
    const { coMusicos } = stats(shows)
    expect(coMusicos.find((c) => c.musico_id === YO)).toBeUndefined()
    expect(coMusicos.find((c) => c.musico_id === 'ana')?.shows).toBe(1)
  })

  it('keeps the top 5, ties broken by id', () => {
    const shows = [show('1', '2026-01-01', { creado_por: 'z' }, ['a', 'b', 'c', 'd', 'e', 'f'].map(acepta))]
    const { coMusicos } = stats(shows)
    expect(coMusicos).toHaveLength(5)
    // The creator (also 1 show) is part of the tie, so it takes its alphabetical place.
    expect(coMusicos.map((c) => c.musico_id)).toEqual(['a', 'b', 'c', 'creator', 'd'])
  })
})

describe('calcularEstadisticas: songs', () => {
  const confirmado = { canciones_confirmadas_en: '2026-02-01T00:00:00Z' }

  it('counts shows per song, only for played shows with confirmed songs', () => {
    const shows = [
      show('1', '2026-01-01', confirmado),
      show('2', '2026-01-02', confirmado),
      show('sinConfirmar', '2026-01-03'),
      show('cancelado', '2026-01-04', { ...confirmado, estado: 'cancelado' }),
      show('pend', '2026-01-05', confirmado, [], 'pendiente'),
    ]
    const tocadas = [
      tocada('1', 'x', 'Sol'),
      tocada('2', 'x', 'Sol'),
      tocada('1', 'y', 'Luna'),
      tocada('sinConfirmar', 'y', 'Luna'),
      tocada('cancelado', 'z', 'Mar'),
      tocada('pend', 'z', 'Mar'),
    ]
    const r = stats(shows, { tocadas })
    expect(r.temas.map((t) => [t.titulo, t.shows])).toEqual([
      ['Sol', 2],
      ['Luna', 1],
    ])
    expect(r.temasDistintos).toBe(2)
  })

  it('counts a repeated row of the same show once', () => {
    const r = stats([show('1', '2026-01-01', confirmado)], { tocadas: [tocada('1', 'x'), tocada('1', 'x')] })
    expect(r.temas[0].shows).toBe(1)
  })

  it('respects the period, keeps the top 10 but counts every distinct song', () => {
    const shows = [show('1', '2026-01-01', confirmado), show('viejo', '2025-01-01', confirmado)]
    const ids = Array.from({ length: 12 }, (_, i) => `c${String(i).padStart(2, '0')}`)
    const tocadas = [...ids.map((id) => tocada('1', id)), tocada('viejo', 'otra')]
    const r = stats(shows, { tocadas, periodo: 'este-anio' })
    expect(r.temas).toHaveLength(10)
    expect(r.temasDistintos).toBe(12)
  })
})

describe('calcularEstadisticas: setlist history', () => {
  it('lists the setlists of my non-cancelled shows in the period, latest first', () => {
    const shows = [
      show('a', '2026-02-01', { repertorio_id: 'r1' }),
      show('b', '2026-05-01', { repertorio_id: 'r2', estado: 'programado' }),
      show('c', '2026-06-01', { repertorio_id: 'r3', estado: 'cancelado' }),
      show('d', '2026-07-01', { repertorio_id: null }),
      show('e', '2025-07-01', { repertorio_id: 'r4' }),
      show('f', '2026-08-01', { repertorio_id: 'r5' }, [], 'pendiente'),
    ]
    const { repertorios } = stats(shows, { periodo: 'este-anio' })
    expect(repertorios.map((r) => r.repertorio_id)).toEqual(['r2', 'r1'])
  })
})

describe('calcularEstadisticas: economics', () => {
  it('separates collected, pending and expected, per currency', () => {
    const shows = [
      show('cobrado', '2026-02-01'),
      show('debido', '2026-03-01'),
      show('debidoUsd', '2026-03-02'),
      show('previsto', '2026-12-01', { estado: 'programado' }),
      show('cobradoArs', '2026-04-01'),
    ]
    const cobros = {
      cobrado: cobro(1000, 'UYU', 'cobrado', '2026-02-05'),
      debido: cobro(2000, 'UYU', 'pendiente'),
      debidoUsd: cobro(50, 'USD', 'pendiente'),
      previsto: cobro(3000, 'UYU', 'pendiente'),
      cobradoArs: cobro(8000, 'ARS', 'cobrado'),
    }
    const { plata } = stats(shows, { cobros, periodo: 'este-anio' })
    expect(plata.cobrado).toEqual({ UYU: 1000, ARS: 8000 })
    expect(plata.pendiente).toEqual({ UYU: 2000, USD: 50 })
    expect(plata.previsto).toEqual({ UYU: 3000 })
    expect(plata.monedas).toEqual(['UYU', 'USD', 'ARS'])
  })

  it('dates collected money by cobrado_en, falling back to the show date', () => {
    const shows = [show('a', '2025-12-20'), show('b', '2026-01-10')]
    const cobros = {
      a: cobro(100, 'UYU', 'cobrado', '2026-01-05'), // played last year, collected this year
      b: cobro(200, 'UYU', 'cobrado'), // no collection date: the show date applies
    }
    expect(stats(shows, { cobros, periodo: 'este-anio' }).plata.cobrado).toEqual({ UYU: 300 })
    expect(stats(shows, { cobros, periodo: 'anio-anterior' }).plata.cobrado).toEqual({})
  })

  it('places pending and expected money by the show date', () => {
    const shows = [show('a', '2025-06-01'), show('b', '2026-12-01', { estado: 'programado' })]
    const cobros = { a: cobro(500, 'UYU', 'pendiente'), b: cobro(700, 'UYU', 'pendiente') }
    expect(stats(shows, { cobros, periodo: 'anio-anterior' }).plata.pendiente).toEqual({ UYU: 500 })
    expect(stats(shows, { cobros, periodo: 'anio-anterior' }).plata.previsto).toEqual({})
    expect(stats(shows, { cobros, periodo: 'este-anio' }).plata.previsto).toEqual({ UYU: 700 })
    expect(stats(shows, { cobros, periodo: 'historico' }).plata.monedas).toEqual(['UYU'])
  })

  it('ignores cancelled shows, past scheduled shows and shows I did not accept for pending and expected', () => {
    const shows = [
      show('cancelado', '2026-03-01', { estado: 'cancelado' }),
      show('colgado', '2026-03-02', { estado: 'programado' }),
      show('pend', '2026-03-03', {}, [], 'pendiente'),
      show('rech', '2026-03-04', {}, [], 'rechazado'),
    ]
    const cobros = Object.fromEntries(shows.map((s) => [s.id, cobro(100, 'UYU', 'pendiente')]))
    const { plata, cobrosPendientes } = stats(shows, { cobros })
    expect(plata.pendiente).toEqual({})
    expect(plata.previsto).toEqual({})
    expect(cobrosPendientes).toEqual([])
    expect(plata.monedas).toEqual([])
  })

  it('does not count fees of shows I did not accept as collected either', () => {
    const shows = [show('a', '2026-03-01', {}, [], 'pendiente')]
    expect(stats(shows, { cobros: { a: cobro(100, 'UYU', 'cobrado', '2026-03-02') } }).plata.cobrado).toEqual({})
  })

  it('lists pending payments oldest first, with the amount and currency', () => {
    const shows = [show('b', '2026-05-01'), show('a', '2026-03-01'), show('c', '2026-12-01', { estado: 'programado' })]
    const cobros = {
      a: cobro(10, 'UYU', 'pendiente'),
      b: cobro(20, 'USD', 'pendiente'),
      c: cobro(30, 'UYU', 'pendiente'),
    }
    expect(stats(shows, { cobros }).cobrosPendientes).toEqual([
      { show_id: 'a', show: 'a', fecha: '2026-03-01', importe: 10, moneda: 'UYU' },
      { show_id: 'b', show: 'b', fecha: '2026-05-01', importe: 20, moneda: 'USD' },
    ])
  })

  it('sums decimals returned by the database as strings', () => {
    const shows = [show('a', '2026-03-01'), show('b', '2026-03-02')]
    const cobros = {
      a: cobro('1500.50' as unknown as number, 'UYU', 'pendiente'),
      b: cobro('500' as unknown as number, 'UYU', 'pendiente'),
    }
    expect(stats(shows, { cobros }).plata.pendiente).toEqual({ UYU: 2000.5 })
  })
})

describe('anchoBarra', () => {
  it('scales to the maximum and never disappears', () => {
    expect(anchoBarra(5, 5)).toBe(100)
    expect(anchoBarra(1, 10)).toBe(10)
    expect(anchoBarra(1, 100)).toBe(4)
    expect(anchoBarra(0, 0)).toBe(0)
  })
})
