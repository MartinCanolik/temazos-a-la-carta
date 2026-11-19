import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { useRedMusicos } from '@/hooks/useRedMusicos'

/** Gates a route behind the musician network flag; redirects to `to` when hidden. */
export function RequireRedMusicos({ children, to }: { children: ReactNode; to: string }) {
  const { loading } = useAuth()
  const visible = useRedMusicos()

  // Wait for the profile so admins are not redirected before their role is known.
  if (loading && !visible) return null
  if (!visible) return <Navigate to={to} replace />
  return <>{children}</>
}
