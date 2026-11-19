import { describe, expect, it } from 'vitest'
import {
  analizarFormacion,
  coberturaRepertorio,
  compatibilidad,
  etiquetaCobertura,
  type CancionDeMusico,
  type MusicoFormacion,
} from './compatibilidad'

const cancion = (id: string, titulo: string, extra: Partial<CancionDeMusico> = {}): CancionDeMusico => ({
  cancion_id: id,
  titulo,
  artista: 'X',
  ...extra,
})

describe('compatibilidad', () => {
  it('computes shared over union', () => {
    expect(compatibilidad(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual({
      enComun: 2,
      union: 4,
      porcentaje: 50,
    })
  })

  it('rounds the percentage', () => {
    expect(compatibilidad(['a', 'b', 'c'], ['a']).porcentaje).toBe(33)
    expect(compatibilidad(['a', 'b', 'c'], ['a', 'b']).porcentaje).toBe(67)
  })

  it('returns 0 when both repertoires are empty', () => {
    expect(compatibilidad([], [])).toEqual({ enComun: 0, union: 0, porcentaje: 0 })
  })

  it('is 0% with no overlap and 100% when identical', () => {
    expect(compatibilidad(['a'], ['b']).porcentaje).toBe(0)
    expect(compatibilidad(['a', 'b'], ['b', 'a']).porcentaje).toBe(100)
  })

  it('dedupes repeated ids', () => {
    expect(compatibilidad(['a', 'a', 'b'], ['a', 'a'])).toEqual({ enComun: 1, union: 2, porcentaje: 50 })
  })
})

const ana: MusicoFormacion = {
  id: 'ana',
  nombre: 'Ana',
  canciones: [cancion('1', 'Zamba', { tonalidad: 'C' }), cancion('2', 'Bolero'), cancion('3', 'Cumbia')],
}
const bruno: MusicoFormacion = {
  id: 'bruno',
  nombre: 'Bruno',
  canciones: [cancion('1', 'Zamba', { tonalidad: 'D' }), cancion('2', 'Bolero'), cancion('4', 'Rock')],
}
const caro: MusicoFormacion = {
  id: 'caro',
  nombre: 'Caro',
  canciones: [cancion('1', 'Zamba', { tonalidad: 'C', instrumento: 'Voz' }), cancion('3', 'Cumbia')],
}

describe('analizarFormacion', () => {
  const analisis = analizarFormacion([ana, bruno, caro])

  it('groups songs everyone knows and partial ones', () => {
    expect(analisis.total).toBe(3)
    expect(analisis.todos.map((c) => c.cancion_id)).toEqual(['1'])
    expect(analisis.parcial.map((c) => c.cancion_id)).toEqual(['2', '3', '4'])
  })

  it('sorts by count desc then title in Spanish', () => {
    // Bolero and Cumbia are known by 2 musicians (Bolero < Cumbia); Rock by 1.
    expect(analisis.parcial.map((c) => c.titulo)).toEqual(['Bolero', 'Cumbia', 'Rock'])
  })

  it('reports who knows each song and the percentage', () => {
    const zamba = analisis.todos[0]
    expect(zamba.cantidad).toBe(3)
    expect(zamba.porcentaje).toBe(100)
    expect(zamba.todos).toBe(true)
    expect(zamba.conocen.map((k) => k.nombre)).toEqual(['Ana', 'Bruno', 'Caro'])
    expect(zamba.conocen[2].instrumento).toBe('Voz')
    expect(analisis.parcial[0].porcentaje).toBe(67)
  })

  it('flags differing keys only when two or more keys differ', () => {
    expect(analisis.todos[0].tonalidadesDistintas).toBe(true)
    expect(analisis.parcial.every((c) => !c.tonalidadesDistintas)).toBe(true)
  })

  it('keeps a song known by a single musician as partial', () => {
    const rock = analisis.parcial.find((c) => c.cancion_id === '4')!
    expect(rock.cantidad).toBe(1)
    expect(rock.todos).toBe(false)
  })

  it('handles an empty lineup and a lineup of one', () => {
    expect(analizarFormacion([])).toEqual({ total: 0, canciones: [], todos: [], parcial: [] })
    const solo = analizarFormacion([ana])
    expect(solo.todos).toHaveLength(3)
    expect(solo.parcial).toHaveLength(0)
  })

  it('ignores duplicate songs within one repertoire', () => {
    const dup = analizarFormacion([{ ...ana, canciones: [...ana.canciones, cancion('1', 'Zamba')] }, bruno])
    expect(dup.canciones.find((c) => c.cancion_id === '1')!.cantidad).toBe(2)
  })
})

describe('coberturaRepertorio', () => {
  const analisis = analizarFormacion([ana, bruno, caro])

  it('measures the share of the setlist the whole lineup knows', () => {
    expect(coberturaRepertorio(['1', '2', '3', '9'], analisis)).toEqual({
      listas: 1,
      total: 4,
      porcentaje: 25,
      requierenPreparacion: ['2', '3', '9'],
    })
  })

  it('dedupes ids and handles an empty setlist', () => {
    expect(coberturaRepertorio(['1', '1'], analisis).total).toBe(1)
    expect(coberturaRepertorio([], analisis)).toEqual({
      listas: 0,
      total: 0,
      porcentaje: 0,
      requierenPreparacion: [],
    })
  })
})

describe('etiquetaCobertura', () => {
  it('uses the plural for several musicians', () => {
    expect(etiquetaCobertura(3, 4)).toBe('75% · 3 de 4 músicos')
  })

  it('uses the singular for a lineup of one', () => {
    expect(etiquetaCobertura(1, 1)).toBe('100% · 1 de 1 músico')
  })

  it('does not divide by zero', () => {
    expect(etiquetaCobertura(0, 0)).toBe('0% · 0 de 0 músicos')
  })
})
