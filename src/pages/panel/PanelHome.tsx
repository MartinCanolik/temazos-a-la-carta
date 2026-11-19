import { useAuth } from '@/auth/authContext'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

/** Inicio del panel de músico. Las secciones se van sumando en los próximos PRs. */
export function PanelHome() {
  const { profile, user } = useAuth()
  const nombre = profile?.nombre ?? user?.email?.split('@')[0] ?? 'músico'

  return (
    <PanelLayout backTo="/">
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>Hola, {nombre}</h1>
      </div>

      <p className={styles.subtitle}>
        Desde acá vas a manejar tu perfil, tu repertorio y tus toques.
      </p>
    </PanelLayout>
  )
}
