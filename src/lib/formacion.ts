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

/** ¿Ya no entran más músicos? Cuenta los slugs crudos (lo que recorta `parsearSlugs`) y los miembros resueltos. */
export function formacionLlena(slugs: string[], otrosResueltos: number): boolean {
  return slugs.length >= MAX_OTROS || otrosResueltos >= MAX_OTROS
}

/** Slugs tras sumar `slug`; devuelve la misma lista si ya está, es el propio o la formación está llena. */
export function agregarSlug(slugs: string[], slug: string, propioSlug?: string | null, otrosResueltos = 0): string[] {
  if (formacionLlena(slugs, otrosResueltos) || slugs.includes(slug) || slug === propioSlug) return slugs
  return [...slugs, slug]
}

/**
 * Ids de la formación a guardar: yo + los guardados (por id, tengan o no slug público) + los elegidos ahora,
 * menos los que se quitaron explícitamente. Un elegido gana sobre un quitado (se volvió a sumar).
 */
export function idsParaGuardar(
  yoId: string | undefined,
  guardados: string[],
  seleccionados: string[],
  quitados: Iterable<string> = [],
): string[] {
  const fuera = new Set(quitados)
  const ids = [
    ...(yoId ? [yoId] : []),
    ...guardados.filter((id) => !fuera.has(id)),
    ...seleccionados,
  ]
  return [...new Set(ids)]
}

/** Miembros guardados que todavía no están entre los elegidos (sin perfil público o con la URL sin sembrar). */
export function guardadosPendientes(
  yoId: string | undefined,
  guardados: string[],
  seleccionados: string[],
  quitados: Iterable<string> = [],
): string[] {
  const excluidos = new Set([...(yoId ? [yoId] : []), ...seleccionados, ...quitados])
  return [...new Set(guardados)].filter((id) => !excluidos.has(id))
}
