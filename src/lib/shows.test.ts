import { describe, expect, it } from 'vitest'
import type { EstadoParticipacion, Show } from './database.types'
import {
  alternarTocado,
  construirCobro,
  construirDatosShow,
  dividirAgenda,
  esDelMes,
  etiquetaEstado,
  etiquetaParticipacion,
  explicarVisibilidad,
  hoyISO,
  idsTocados,
  invitadoPor,
  masTocadas,
  miEstado,
  moverTema,
  musicosAGuardar,
  necesitaConfirmacion,
  parsearImporte,
  sumarTema,
  temasIniciales,
  totalesPorMoneda,
  urlValida,
  type FormShow,
  type ShowConParticipantes,
} from './shows'

const HOY = '2026-11-18'
const YO = 'me'

function show(id: string, fecha: string, extra: Partial<Show> = {}, miEst: EstadoParticipacion | null = 'aceptado'): ShowConParticipantes {
  return {
    id,
    creado_por: 'creator',
    nombre: id,
    fecha,
    hora: null,
    lugar: null,
    ciudad: null,
    zona: null,
    estado: 'programado',
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
    ],
  }
}

describe('hoyISO', () => {
  it('formats the local date with zero padding', () => {
    expect(hoyISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('esDelMes', () => {
  it('compares year and month only', () => {
    expect(esDelMes('2026-11-01', HOY)).toBe(true)
    expect(esDelMes('2026-10-31', HOY)).toBe(false)
    expect(esDelMes('2025-11-18', HOY)).toBe(false)
  })
})

describe('miEstado / invitadoPor', () => {
  it('reads my participation and who invited me', () => {
    const s = show('a', HOY, {}, 'pendiente')
    expect(miEstado(s, YO)).toBe('pendiente')
    expect(miEstado(s, 'other')).toBeNull()
    expect(miEstado(s, undefined)).toBeNull()
    expect(invitadoPor(s, YO)).toBe('creator')
  })
})

describe('dividirAgenda', () => {
  const shows = [
    show('pasado-viejo', '2026-09-01'),
    show('pasado-reciente', '2026-11-10'),
    show('hoy', HOY),
    show('proximo-tarde', '2026-12-20'),
    show('proximo-temprano', '2026-11-25'),
    show('cancelado-futuro', '2026-12-01', { estado: 'cancelado' }),
    show('invitacion-b', '2026-12-05', {}, 'pendiente'),
    show('invitacion-a', '2026-11-30', {}, 'pendiente'),
    show('rechazado', '2026-12-02', {}, 'rechazado'),
    show('ajeno', '2026-12-03', {}, null),
  ]
  const r = dividirAgenda(shows, YO, HOY)

  it('puts pending invitations first-class, soonest first', () => {
    expect(r.invitaciones.map((s) => s.id)).toEqual(['invitacion-a', 'invitacion-b'])
  })

  it('lists accepted upcoming shows (today included, cancelled excluded), soonest first', () => {
    expect(r.proximos.map((s) => s.id)).toEqual(['hoy', 'proximo-temprano', 'proximo-tarde'])
  })

  it('lists past and cancelled shows latest first and skips declined or foreign ones', () => {
    expect(r.anteriores.map((s) => s.id)).toEqual(['cancelado-futuro', 'pasado-reciente', 'pasado-viejo'])
  })

  it('orders same-day shows by time', () => {
    const r2 = dividirAgenda([show('tarde', HOY, { hora: '22:00:00' }), show('temprano', HOY, { hora: '18:00:00' })], YO, HOY)
    expect(r2.proximos.map((s) => s.id)).toEqual(['temprano', 'tarde'])
  })
})

describe('necesitaConfirmacion', () => {
  it('is true only for past, not cancelled shows without confirmed songs', () => {
    expect(necesitaConfirmacion({ fecha: '2026-11-10', estado: 'programado', canciones_confirmadas_en: null }, HOY)).toBe(true)
    expect(necesitaConfirmacion({ fecha: '2026-11-10', estado: 'realizado', canciones_confirmadas_en: null }, HOY)).toBe(true)
    expect(necesitaConfirmacion({ fecha: '2026-11-10', estado: 'cancelado', canciones_confirmadas_en: null }, HOY)).toBe(false)
    expect(necesitaConfirmacion({ fecha: '2026-11-10', estado: 'realizado', canciones_confirmadas_en: '2026-11-11T00:00:00Z' }, HOY)).toBe(false)
    expect(necesitaConfirmacion({ fecha: HOY, estado: 'programado', canciones_confirmadas_en: null }, HOY)).toBe(false)
    expect(necesitaConfirmacion({ fecha: '2026-12-01', estado: 'programado', canciones_confirmadas_en: null }, HOY)).toBe(false)
  })
})

describe('labels', () => {
  it('translates states', () => {
    expect(etiquetaEstado('realizado')).toBe('Realizado')
    expect(etiquetaParticipacion('pendiente')).toBe('Pendiente')
    expect(explicarVisibilidad('publico')).toMatch(/Música en vivo/)
    expect(explicarVisibilidad('privado')).toMatch(/músicos del show/)
  })
})

describe('fees', () => {
  it('parses typed amounts', () => {
    expect(parsearImporte('')).toEqual({ valido: true, valor: null })
    expect(parsearImporte(' 3500 ')).toEqual({ valido: true, valor: 3500 })
    expect(parsearImporte('1.500,50')).toEqual({ valido: true, valor: 1500.5 })
    expect(parsearImporte('1500.5')).toEqual({ valido: true, valor: 1500.5 })
    expect(parsearImporte('12,5')).toEqual({ valido: true, valor: 12.5 })
    expect(parsearImporte('abc').valido).toBe(false)
    expect(parsearImporte('-5').valido).toBe(false)
  })

  it('sums per currency without mixing them', () => {
    expect(
      totalesPorMoneda([
        { importe: 100, moneda: 'USD' },
        { importe: 3500, moneda: 'UYU' },
        { importe: 50, moneda: 'USD' },
      ]),
    ).toEqual({ USD: 150, UYU: 3500 })
    expect(totalesPorMoneda([])).toEqual({})
  })

  it('builds the fee payload', () => {
    const base = { importe: '3.500', moneda: 'UYU' as const, estado: 'pendiente' as const, cobradoEn: '2026-11-01', notas: '  ' }
    expect(construirCobro(base, HOY)).toEqual({
      importe: 3500,
      moneda: 'UYU',
      estado_cobro: 'pendiente',
      cobrado_en: null,
      notas: null,
    })
    expect(construirCobro({ ...base, estado: 'cobrado', cobradoEn: '' }, HOY)?.cobrado_en).toBe(HOY)
    expect(construirCobro({ ...base, importe: '' }, HOY)).toEqual({ importe: null })
    expect(construirCobro({ ...base, importe: 'x' }, HOY)).toBeUndefined()
  })
})

describe('construirDatosShow', () => {
  const form: FormShow = {
    nombre: '  Noche de covers ',
    fecha: '2026-12-01',
    hora: '',
    lugar: ' La Trastienda ',
    ciudad: '',
    zona: 'Ciudad Vieja',
    estado: 'programado',
    visibilidad: 'publico',
    entradaInfo: '',
    entradaUrl: ' https://example.com ',
    repertorioId: '',
    invitados: '',
    notas: '',
  }
  it('trims and turns blanks into null', () => {
    expect(construirDatosShow(form)).toEqual({
      nombre: 'Noche de covers',
      fecha: '2026-12-01',
      hora: null,
      lugar: 'La Trastienda',
      ciudad: null,
      zona: 'Ciudad Vieja',
      estado: 'programado',
      visibilidad: 'publico',
      entrada_info: null,
      entrada_url: 'https://example.com',
      repertorio_id: null,
      invitados: null,
      notas: null,
    })
  })

  it('validates ticket links', () => {
    expect(urlValida('')).toBe(true)
    expect(urlValida('https://example.com/x')).toBe(true)
    expect(urlValida('javascript:alert(1)')).toBe(false)
    expect(urlValida('example.com')).toBe(false)
  })
})

describe('musicosAGuardar', () => {
  const existentes = ['creator', 'a', 'sin-slug']
  const resolubles = new Set(['creator', 'a'])

  it('lets the creator drop resolvable participants only', () => {
    expect(musicosAGuardar(['creator', 'nuevo'], existentes, true, resolubles).sort()).toEqual(['creator', 'nuevo', 'sin-slug'])
  })

  it('never drops anyone when the caller is not the creator', () => {
    expect(musicosAGuardar(['me', 'nuevo'], existentes, false, resolubles).sort()).toEqual(['a', 'creator', 'me', 'nuevo', 'sin-slug'])
  })
})

describe('played songs', () => {
  const t = (id: string) => ({ cancion_id: id, titulo: `T${id}`, artista: 'X' })

  it('starts from the setlist, all checked', () => {
    const l = temasIniciales([t('1'), t('2'), t('1')], [])
    expect(l.map((x) => x.cancion_id)).toEqual(['1', '2'])
    expect(l.every((x) => x.tocado)).toBe(true)
  })

  it('prefers the already confirmed songs', () => {
    expect(temasIniciales([t('1'), t('2')], [t('3')]).map((x) => x.cancion_id)).toEqual(['3'])
  })

  it('adds extras once, toggles and sends only the checked ones in order', () => {
    let l = temasIniciales([t('1'), t('2')], [])
    l = sumarTema(l, t('3'))
    l = sumarTema(l, t('3'))
    expect(l).toHaveLength(3)
    l = alternarTocado(l, '2')
    expect(idsTocados(l)).toEqual(['1', '3'])
    l = moverTema(l, 2, -1)
    expect(l.map((x) => x.cancion_id)).toEqual(['1', '3', '2'])
    expect(idsTocados(l)).toEqual(['1', '3'])
  })

  it('does not move past the ends', () => {
    const l = [1, 2, 3]
    expect(moverTema(l, 0, -1)).toBe(l)
    expect(moverTema(l, 2, 1)).toBe(l)
  })

  it('ranks the most played songs', () => {
    expect(masTocadas(['a', 'b', 'a', 'c', 'a', 'b'], 2)).toEqual([
      { cancion_id: 'a', veces: 3 },
      { cancion_id: 'b', veces: 2 },
    ])
  })
})
