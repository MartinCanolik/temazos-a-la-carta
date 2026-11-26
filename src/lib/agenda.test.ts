import { describe, expect, it } from 'vitest'
import {
  agruparPorFecha,
  buscarOpcion,
  esUuid,
  hoyRioplatense,
  etiquetaDia,
  lineaInvitados,
  lineaLugar,
  opcionesUbicacion,
  rangoChip,
  sumarDias,
  TODAS_LAS_UBICACIONES,
  urlEntradaSegura,
} from './agenda'

// 2026-11-18 is a Wednesday
const MIERCOLES = '2026-11-18'

describe('sumarDias', () => {
  it('crosses month and year boundaries', () => {
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('rangoChip', () => {
  it('hoy is just today', () => {
    expect(rangoChip('hoy', MIERCOLES)).toEqual({ desde: MIERCOLES, hasta: MIERCOLES })
  })

  it('finde from Monday to Thursday is the coming Friday to Sunday', () => {
    expect(rangoChip('finde', '2026-11-16')).toEqual({ desde: '2026-11-20', hasta: '2026-11-22' }) // Mon
    expect(rangoChip('finde', MIERCOLES)).toEqual({ desde: '2026-11-20', hasta: '2026-11-22' }) // Wed
    expect(rangoChip('finde', '2026-11-19')).toEqual({ desde: '2026-11-20', hasta: '2026-11-22' }) // Thu
  })

  it('finde starts today on Friday and Saturday, and is just today on Sunday', () => {
    expect(rangoChip('finde', '2026-11-20')).toEqual({ desde: '2026-11-20', hasta: '2026-11-22' })
    expect(rangoChip('finde', '2026-11-21')).toEqual({ desde: '2026-11-21', hasta: '2026-11-22' })
    expect(rangoChip('finde', '2026-11-22')).toEqual({ desde: '2026-11-22', hasta: '2026-11-22' })
  })

  it('semana covers 7 days including today', () => {
    expect(rangoChip('semana', MIERCOLES)).toEqual({ desde: MIERCOLES, hasta: '2026-11-24' })
  })

  it('mes runs from today to the last day of the month', () => {
    expect(rangoChip('mes', MIERCOLES)).toEqual({ desde: MIERCOLES, hasta: '2026-11-30' })
    expect(rangoChip('mes', '2028-02-10')).toEqual({ desde: '2028-02-10', hasta: '2028-02-29' })
  })

  it('todo is open ended', () => {
    expect(rangoChip('todo', MIERCOLES)).toEqual({ desde: MIERCOLES, hasta: null })
  })
})

describe('agruparPorFecha', () => {
  it('groups consecutive items and keeps the order', () => {
    const a = { fecha: '2026-11-19', id: 'a' }
    const b = { fecha: '2026-11-19', id: 'b' }
    const c = { fecha: '2026-11-21', id: 'c' }
    expect(agruparPorFecha([a, b, c])).toEqual([
      { fecha: '2026-11-19', items: [a, b] },
      { fecha: '2026-11-21', items: [c] },
    ])
  })

  it('returns nothing for an empty list', () => {
    expect(agruparPorFecha([])).toEqual([])
  })
})

describe('etiquetaDia', () => {
  it('names today and tomorrow, formats the rest', () => {
    expect(etiquetaDia(MIERCOLES, MIERCOLES)).toBe('Hoy')
    expect(etiquetaDia('2026-11-19', MIERCOLES)).toBe('Mañana')
    expect(etiquetaDia('2026-11-21', MIERCOLES)).not.toMatch(/Hoy|Mañana/)
  })
})

describe('lineaLugar', () => {
  it('joins venue and city with its zone', () => {
    expect(lineaLugar({ lugar: 'Café Vinilo', ciudad: 'CABA', zona: 'Palermo' })).toBe('Café Vinilo · CABA (Palermo)')
  })

  it('copes with missing parts', () => {
    expect(lineaLugar({ lugar: 'Café Vinilo', ciudad: null, zona: null })).toBe('Café Vinilo')
    expect(lineaLugar({ lugar: null, ciudad: 'Rosario', zona: null })).toBe('Rosario')
    expect(lineaLugar({ lugar: ' ', ciudad: null, zona: 'Centro' })).toBe('Centro')
    expect(lineaLugar({ lugar: null, ciudad: null, zona: null })).toBeNull()
  })
})

describe('lineaInvitados', () => {
  it('prefixes the guests or returns null', () => {
    expect(lineaInvitados('Tito (batería)')).toBe('con: Tito (batería)')
    expect(lineaInvitados('con Tito (batería)')).toBe('con: Tito (batería)')
    expect(lineaInvitados('Con: Tito')).toBe('con: Tito')
    expect(lineaInvitados('Concepción')).toBe('con: Concepción')
    expect(lineaInvitados('  ')).toBeNull()
    expect(lineaInvitados(null)).toBeNull()
  })
})

describe('urlEntradaSegura', () => {
  it('accepts http and https links', () => {
    expect(urlEntradaSegura('https://example.com/entradas')).toBe('https://example.com/entradas')
    expect(urlEntradaSegura(' http://example.com ')).toBe('http://example.com/')
  })

  it('rejects anything else', () => {
    expect(urlEntradaSegura('javascript:alert(1)')).toBeNull()
    expect(urlEntradaSegura('ftp://example.com')).toBeNull()
    expect(urlEntradaSegura('example.com')).toBeNull()
    expect(urlEntradaSegura('')).toBeNull()
    expect(urlEntradaSegura(null)).toBeNull()
  })
})

describe('opcionesUbicacion', () => {
  it('lists everything first, then each city followed by its zones', () => {
    const opciones = opcionesUbicacion([
      { ciudad: 'Rosario', zona: 'Centro', shows: 1 },
      { ciudad: 'CABA', zona: 'Villa Crespo', shows: 1 },
      { ciudad: 'CABA', zona: 'Palermo', shows: 2 },
      { ciudad: 'caba', zona: 'palermo', shows: 1 },
    ])
    expect(opciones.map((o) => o.etiqueta)).toEqual([
      'Todas las ciudades',
      'CABA',
      'CABA · Palermo',
      'CABA · Villa Crespo',
      'Rosario',
      'Rosario · Centro',
    ])
    expect(opciones[2]).toMatchObject({ ciudad: 'CABA', zona: 'Palermo' })
  })

  it('handles zones without a city and an empty list', () => {
    expect(opcionesUbicacion([{ ciudad: null, zona: 'Centro', shows: 1 }]).map((o) => o.etiqueta)).toEqual([
      'Todas las ciudades',
      'Centro',
    ])
    expect(opcionesUbicacion([])).toEqual([TODAS_LAS_UBICACIONES])
  })
})

describe('buscarOpcion', () => {
  it('falls back to everything when the value no longer exists', () => {
    const opciones = opcionesUbicacion([{ ciudad: 'CABA', zona: null, shows: 1 }])
    expect(buscarOpcion(opciones, 'c:CABA').ciudad).toBe('CABA')
    expect(buscarOpcion(opciones, 'c:Salta')).toBe(TODAS_LAS_UBICACIONES)
  })
})

describe('esUuid', () => {
  it('accepts well-formed UUIDs and rejects anything else', () => {
    expect(esUuid('d0000000-0000-0000-0000-000000000001')).toBe(true)
    expect(esUuid('D0000000-0000-0000-0000-00000000000A')).toBe(true)
    expect(esUuid('not-a-uuid')).toBe(false)
    expect(esUuid('')).toBe(false)
    expect(esUuid(undefined)).toBe(false)
  })
})

describe('hoyRioplatense', () => {
  it('uses the Buenos Aires date, not the UTC one', () => {
    // 01:30 UTC on the 19th is still 22:30 on the 18th in UTC-3.
    expect(hoyRioplatense(new Date('2026-11-19T01:30:00Z'))).toBe('2026-11-18')
    expect(hoyRioplatense(new Date('2026-11-19T03:00:00Z'))).toBe('2026-11-19')
  })
  it('rolls over the year in local time', () => {
    expect(hoyRioplatense(new Date('2027-01-01T02:59:00Z'))).toBe('2026-12-31')
  })
})
