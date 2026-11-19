/** Instrumentos sugeridos en el editor de perfil (también se pueden escribir otros). */
export const INSTRUMENTOS_SUGERIDOS = [
  'Voz',
  'Guitarra',
  'Bajo',
  'Batería',
  'Teclado',
  'Piano',
  'Percusión',
  'Saxo',
  'Trompeta',
  'Violín',
  'Coros',
] as const

/** Convierte un texto en un slug válido para la URL del perfil (a-z, 0-9 y guiones). */
export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** URL pública del perfil de un músico. */
export function perfilUrl(slug: string): string {
  return `${window.location.origin}/m/${slug}`
}

/** Link de WhatsApp a partir de un número escrito libremente (+598 99 123 456 → 59899123456). */
export function whatsappUrl(numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, '')}`
}

/** Link de Instagram a partir de "@usuario" o "usuario". */
export function instagramUrl(usuario: string): string {
  return `https://instagram.com/${usuario.trim().replace(/^@/, '')}`
}
