import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import styles from './panel.module.css'

interface PanelLayoutProps {
  children: ReactNode
  /** Ruta del botón ← (por defecto, el inicio del panel). */
  backTo?: string
  /** Mostrar "Salir" (cerrar sesión) arriba a la derecha. */
  showSignOut?: boolean
}

/** Marco común de las pantallas del área de músicos. */
export function PanelLayout({ children, backTo = '/panel', showSignOut = true }: PanelLayoutProps) {
  const { session, signOut } = useAuth()

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link to={backTo} aria-label="Volver" className={styles.backLink}>
          ←
        </Link>
        {showSignOut && session && (
          <button type="button" className={styles.topbarAction} onClick={() => void signOut()}>
            Salir
          </button>
        )}
      </header>

      <main className={styles.content}>{children}</main>
    </div>
  )
}
