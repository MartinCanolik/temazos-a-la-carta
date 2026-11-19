import { describe, expect, it } from 'vitest'
import { etiquetaCantidad, PERIODOS_RANKING, posiciones, textoVacioRanking, TIPOS_RANKING } from './rankings'

describe('etiquetaCantidad', () => {
  it('pluralizes shows and times', () => {
    expect(etiquetaCantidad('musicos', 1)).toBe('1 show')
    expect(etiquetaCantidad('lugares', 3)).toBe('3 shows')
    expect(etiquetaCantidad('canciones', 1)).toBe('1 vez')
    expect(etiquetaCantidad('canciones', 5)).toBe('5 veces')
  })
})

describe('posiciones', () => {
  it('numbers a strictly decreasing list', () => {
    expect(posiciones([6, 5, 4])).toEqual([1, 2, 3])
  })

  it('shares the position on ties and skips after them', () => {
    expect(posiciones([5, 4, 4, 2])).toEqual([1, 2, 2, 4])
    expect(posiciones([3, 3, 3])).toEqual([1, 1, 1])
  })

  it('handles an empty list', () => {
    expect(posiciones([])).toEqual([])
  })
})

describe('labels', () => {
  it('covers every tab and period', () => {
    expect(TIPOS_RANKING.map((t) => t.valor)).toEqual(['musicos', 'canciones', 'lugares'])
    expect(PERIODOS_RANKING.map((p) => p.valor)).toEqual(['mes', 'anio', 'historico'])
    for (const t of TIPOS_RANKING) expect(textoVacioRanking(t.valor)).not.toBe('')
  })
})
