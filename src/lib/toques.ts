import type { Moneda } from './database.types'

export const MONEDAS: Moneda[] = ['UYU', 'USD', 'ARS']

export const FORMATOS_SUGERIDOS = ['Solista', 'Dúo', 'Trío', 'Banda completa', 'Acústico']

/** Fecha de hoy en formato YYYY-MM-DD (hora local). */
export function hoyISO(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** "2026-11-14" → Date local (sin corrimiento por zona horaria). */
export function fechaLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** "2026-11-14" → "vie 14 nov" */
export function formatearFecha(iso: string): string {
  return fechaLocal(iso).toLocaleDateString('es-UY', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** "21:30:00" → "21:30" */
export function formatearHora(hora: string | null): string | null {
  return hora ? hora.slice(0, 5) : null
}

export function formatearPlata(monto: number, moneda: Moneda): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(monto)
}
