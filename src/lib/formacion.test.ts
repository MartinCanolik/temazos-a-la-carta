import { describe, expect, it } from 'vitest'
import {
  MAX_OTROS,
  busquedaValida,
  derivarFormacion,
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
  })
  it('accepts real text', () => {
    expect(busquedaValida('So')).toBe(true)
    expect(sanitizarBusqueda(' Soda,Stereo ')).toBe('Soda Stereo')
  })
})
