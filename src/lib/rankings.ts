/** Pure helpers of the community rankings page: tabs, periods, labels and tie-aware positions. */
import type { PeriodoRanking } from './database.types'

export type TipoRanking = 'musicos' | 'canciones' | 'lugares'

export const TIPOS_RANKING: { valor: TipoRanking; etiqueta: string }[] = [
  { valor: 'musicos', etiqueta: 'Músicos' },
  { valor: 'canciones', etiqueta: 'Canciones' },
  { valor: 'lugares', etiqueta: 'Lugares' },
]

export const PERIODOS_RANKING: { valor: PeriodoRanking; etiqueta: string }[] = [
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'anio', etiqueta: 'Este año' },
  { valor: 'historico', etiqueta: 'Histórico' },
]

export const PERIODO_RANKING_INICIAL: PeriodoRanking = 'anio'

/** "1 show" / "5 shows"; songs count "vez" / "veces". */
export function etiquetaCantidad(tipo: TipoRanking, n: number): string {
  if (tipo === 'canciones') return `${n} ${n === 1 ? 'vez' : 'veces'}`
  return `${n} ${n === 1 ? 'show' : 'shows'}`
}

/** What an empty ranking means, for the empty state. */
export function textoVacioRanking(tipo: TipoRanking): string {
  switch (tipo) {
    case 'musicos':
      return 'Todavía no hay shows realizados de músicos con perfil público en este período.'
    case 'canciones':
      return 'Todavía no hay temas confirmados en shows de este período.'
    case 'lugares':
      return 'Todavía no hay shows públicos realizados en este período.'
  }
}

/**
 * Positions of a list sorted by count desc: equal counts share the position ("1, 2, 2, 4"), so a tie
 * is never presented as a winner.
 */
export function posiciones(cantidades: number[]): number[] {
  const resultado: number[] = []
  cantidades.forEach((c, i) => {
    resultado.push(i > 0 && c === cantidades[i - 1] ? resultado[i - 1] : i + 1)
  })
  return resultado
}
