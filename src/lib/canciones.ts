/** Tonalidades para el selector (mayores y menores). */
const NOTAS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const
export const TONALIDADES: string[] = [...NOTAS, ...NOTAS.map((n) => `${n}m`)]

/** Normaliza un texto para comparar canciones: sin acentos, minúsculas, sin "(Remastered)", etc. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]\s*/g, ' ') // quita "(En vivo)", "[Remastered]"
    .replace(/\s+-\s+.*$/, '') // quita " - Remastered 2011"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Clave para identificar la misma canción entre repertorios (título + artista normalizados). */
export function claveCancion(titulo: string, artista: string): string {
  return `${normalizarTexto(titulo)}|${normalizarTexto(artista)}`
}

/**
 * Parsea una lista pegada, una canción por línea: "Título - Artista".
 * También acepta "Título — Artista" o "Título / Artista" (con espacios alrededor del separador).
 */
export function parsearListaCanciones(texto: string): { titulo: string; artista: string }[] {
  return texto
    .split(/\r?\n/)
    .map((linea) => linea.replace(/^\s*\d+[.)-]\s*/, '').trim()) // quita numeración "1. "
    .filter(Boolean)
    .map((linea) => {
      const partes = linea.split(/\s+[-–—/]\s+/)
      const titulo = (partes[0] ?? '').trim()
      const artista = partes.slice(1).join(' - ').trim() || 'Desconocido'
      return { titulo, artista }
    })
    .filter((c) => c.titulo.length > 0)
}

interface CancionComparable {
  titulo: string
  artista: string
  spotify_track_id?: string | null
}

export interface ComparacionRepertorios<T extends CancionComparable> {
  /** Canciones que tocan los dos, con la versión de cada uno. */
  enComun: { mia: T; suya: T }[]
  soloMias: T[]
  soloSuyas: T[]
}

/**
 * Compara dos repertorios. Dos canciones son la misma si comparten el track de Spotify
 * o si coinciden título + artista normalizados (sin acentos, mayúsculas ni "(En vivo)").
 */
export function compararRepertorios<T extends CancionComparable>(
  mias: T[],
  suyas: T[],
): ComparacionRepertorios<T> {
  const suyasPorClave = new Map<string, T>()
  const suyasPorSpotify = new Map<string, T>()
  for (const s of suyas) {
    suyasPorClave.set(claveCancion(s.titulo, s.artista), s)
    if (s.spotify_track_id) suyasPorSpotify.set(s.spotify_track_id, s)
  }

  const enComun: { mia: T; suya: T }[] = []
  const soloMias: T[] = []
  const suyasUsadas = new Set<T>()

  for (const m of mias) {
    const suya =
      (m.spotify_track_id ? suyasPorSpotify.get(m.spotify_track_id) : undefined) ??
      suyasPorClave.get(claveCancion(m.titulo, m.artista))
    if (suya && !suyasUsadas.has(suya)) {
      enComun.push({ mia: m, suya })
      suyasUsadas.add(suya)
    } else {
      soloMias.push(m)
    }
  }

  return { enComun, soloMias, soloSuyas: suyas.filter((s) => !suyasUsadas.has(s)) }
}

/** Extrae el slug de un link de perfil (".../m/juan-perez") o lo devuelve si ya es un slug. */
export function slugDesdeLink(texto: string): string | null {
  const limpio = texto.trim()
  const match = limpio.match(/\/m\/([a-z0-9-]+)/i)
  const slug = (match ? match[1] : limpio).toLowerCase()
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? slug : null
}
