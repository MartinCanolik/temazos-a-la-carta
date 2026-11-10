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
