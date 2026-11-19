/** Estado puro de una formación: slugs de ?m=, miembros resueltos y límites. */
import { slugDesdeLink } from './canciones'

/** Máximo de músicos además de uno mismo. */
export const MAX_OTROS = 7

export interface Miembro {
  id: string
  nombre: string
  slug: string | null
}

/** Lo mínimo que se necesita de un perfil resuelto. */
export interface PerfilBasico {
  id: string
  slug: string | null
  nombre: string | null
}

/**
 * Slugs válidos de `?m=a,b,c`: sin duplicados, sin el propio (si ya se conoce) y con tope de MAX_OTROS.
 * Deduplica antes de recortar, así un link con slugs repetidos no se come el cupo.
 */
export function parsearSlugs(crudo: string | null | undefined, propioSlug?: string | null): string[] {
  const slugs = (crudo ?? '')
    .split(',')
    .map((s) => slugDesdeLink(s))
    .filter((s): s is string => !!s && s !== propioSlug)
  return [...new Set(slugs)].slice(0, MAX_OTROS)
}

export interface FormacionDerivada {
  /** Yo (si hay sesión) + los demás, en el orden de la URL, sin ids repetidos. */
  miembros: Miembro[]
  /** Sólo los demás (sin mí). */
  otros: Miembro[]
  /** Slugs que no resuelven a un perfil público (no incluye el propio). */
  noEncontrados: string[]
}

/**
 * Cruza los slugs de la URL con los perfiles resueltos. Nunca suma a un perfil cuyo id sea el del
 * usuario (aunque el slug propio todavía no esté cargado) y deduplica por id.
 */
export function derivarFormacion(
  yo: Miembro | null,
  slugs: string[],
  perfiles: PerfilBasico[] | undefined,
): FormacionDerivada {
  const porSlug = new Map((perfiles ?? []).map((p) => [p.slug, p]))
  const vistos = new Set<string>(yo ? [yo.id] : [])
  const otros: Miembro[] = []
  const noEncontrados: string[] = []

  for (const slug of slugs) {
    const perfil = porSlug.get(slug)
    if (!perfil) {
      if (perfiles) noEncontrados.push(slug)
      continue
    }
    if (vistos.has(perfil.id)) continue
    vistos.add(perfil.id)
    otros.push({ id: perfil.id, nombre: perfil.nombre ?? perfil.slug ?? 'Músico', slug: perfil.slug })
  }

  return { miembros: yo ? [yo, ...otros] : otros, otros: otros.slice(0, MAX_OTROS), noEncontrados }
}

/** Texto seguro para `ilike` / `or()` de PostgREST: sin comodines ni separadores. */
export function sanitizarBusqueda(texto: string): string {
  return texto.replace(/[,()%*_\\"]/g, ' ').trim()
}

/** ¿Vale la pena consultar? Sólo con 2 o más caracteres útiles tras sanitizar. */
export function busquedaValida(texto: string): boolean {
  return sanitizarBusqueda(texto).length >= 2
}
