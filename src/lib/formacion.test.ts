import { describe, expect, it } from 'vitest'
import {
  MAX_OTROS,
  agregarSlug,
  busquedaValida,
  derivarFormacion,
  formacionLlena,
  guardadosPendientes,
  idsParaGuardar,
  parsearSlugs,
  sanitizarBusqueda,
  type Miembro,
} from './formacion'

const yo: Miembro = { id: 'u1', nombre: 'Ana', slug: 'ana' }
const perfil = (id: string, slug: string, nombre: string | null = slug) => ({ id, slug, nombre })

describe('parsearSlugs', () => {
  it('dedupes, lowercases and extracts slugs from links', () => {
    expect(parsearSlugs('bruno, https://x.com/m/Caro,bruno')).toEqual(['bruno', 'caro'])
  })
  it('drops invalid entries and the own slug', () => {
    expect(parsearSlugs('ana,,%%,bruno', 'ana')).toEqual(['bruno'])
  })
  it('caps after deduping', () => {
    const muchos = Array.from({ length: 20 }, (_, i) => `m${i}`)
    const crudo = ['m0', 'm0', ...muchos].join(',')
    const out = parsearSlugs(crudo)
    expect(out).toHaveLength(MAX_OTROS)
    expect(out[0]).toBe('m0')
    expect(out[1]).toBe('m1')
  })
  it('handles empty input', () => {
    expect(parsearSlugs(null)).toEqual([])
    expect(parsearSlugs('')).toEqual([])
  })
})

describe('derivarFormacion', () => {
  it('never adds the viewer twice, even when the own slug is in the URL', () => {
    const r = derivarFormacion(yo, ['ana', 'bruno'], [perfil('u1', 'ana'), perfil('u2', 'bruno')])
    expect(r.miembros.map((m) => m.id)).toEqual(['u1', 'u2'])
    expect(r.otros.map((m) => m.id)).toEqual(['u2'])
    expect(r.noEncontrados).toEqual([])
  })
  it('dedupes by id when two slugs resolve to the same profile', () => {
    const r = derivarFormacion(yo, ['b1', 'b2'], [perfil('u2', 'b1'), perfil('u2', 'b2')])
    expect(r.otros).toHaveLength(1)
  })
  it('keeps URL order and reports unresolved slugs', () => {
    const r = derivarFormacion(yo, ['caro', 'fantasma', 'bruno'], [perfil('u3', 'caro'), perfil('u2', 'bruno')])
    expect(r.otros.map((m) => m.slug)).toEqual(['caro', 'bruno'])
    expect(r.noEncontrados).toEqual(['fantasma'])
  })
  it('does not report anything as missing while profiles are still loading', () => {
    const r = derivarFormacion(yo, ['bruno'], undefined)
    expect(r.noEncontrados).toEqual([])
    expect(r.miembros).toEqual([yo])
  })
  it('works without a session', () => {
    const r = derivarFormacion(null, ['bruno'], [perfil('u2', 'bruno', null)])
    expect(r.miembros).toEqual([{ id: 'u2', nombre: 'bruno', slug: 'bruno' }])
  })
})

describe('busqueda', () => {
  it('rejects text that is only wildcards', () => {
    expect(sanitizarBusqueda('%%')).toBe('')
    expect(busquedaValida('%%')).toBe(false)
    expect(busquedaValida('a_')).toBe(false)
    expect(busquedaValida('a')).toBe(false)
    expect(busquedaValida('')).toBe(false)
  })
  it('accepts real text', () => {
    expect(busquedaValida('So')).toBe(true)
    expect(sanitizarBusqueda(' Soda,Stereo ')).toBe('Soda Stereo')
  })
})

describe('formacionLlena / agregarSlug', () => {
  const siete = Array.from({ length: MAX_OTROS }, (_, i) => `m${i}`)
  it('is full by raw slugs even when some do not resolve', () => {
    expect(formacionLlena(siete, 3)).toBe(true)
    expect(formacionLlena(siete.slice(0, 3), 3)).toBe(false)
  })
  it('does not add past the cap, so an 8th slug is never silently dropped by parsearSlugs', () => {
    expect(agregarSlug(siete, 'extra')).toBe(siete)
    const seis = siete.slice(0, 6)
    const siguiente = agregarSlug(seis, 'extra')
    expect(siguiente).toHaveLength(MAX_OTROS)
    expect(parsearSlugs(siguiente.join(','))).toEqual(siguiente)
  })
  it('ignores duplicates and the own slug', () => {
    expect(agregarSlug(['a'], 'a')).toEqual(['a'])
    expect(agregarSlug(['a'], 'ana', 'ana')).toEqual(['a'])
  })
})

describe('idsParaGuardar', () => {
  it('keeps stored members that are not selected yet (URL not seeded) and those without a slug', () => {
    expect(idsParaGuardar('u1', ['u1', 'u2', 'u3'], [])).toEqual(['u1', 'u2', 'u3'])
  })
  it('unions stored and selected without duplicates, viewer first', () => {
    expect(idsParaGuardar('u1', ['u2'], ['u2', 'u4'])).toEqual(['u1', 'u2', 'u4'])
  })
  it('drops explicit removals but lets a re-added member win', () => {
    expect(idsParaGuardar('u1', ['u2', 'u3'], [], ['u3'])).toEqual(['u1', 'u2'])
    expect(idsParaGuardar('u1', ['u2', 'u3'], ['u3'], ['u3'])).toEqual(['u1', 'u2', 'u3'])
  })
  it('works without a session', () => {
    expect(idsParaGuardar(undefined, ['u2'], ['u3'])).toEqual(['u2', 'u3'])
  })
})

describe('guardadosPendientes', () => {
  it('lists stored members missing from the selection, excluding me and removed ones', () => {
    expect(guardadosPendientes('u1', ['u1', 'u2', 'u3', 'u4'], ['u2'], ['u4'])).toEqual(['u3'])
  })
})
