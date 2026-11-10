import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './authContext'

/** Protege rutas del panel: exige sesión iniciada con rol músico (o admin). */
export function RequireMusico({ children }: { children: ReactNode }) {
  const { loading, session, isMusico } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <p style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Cargando…
      </p>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isMusico) {
    return (
      <p style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        Tu cuenta todavía no tiene acceso al panel de músicos.
      </p>
    )
  }

  return <>{children}</>
}
