import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

interface Acceso {
  to: string
  icon: string
  title: string
  text: string
}

/** Inicio del panel de músico. */
export function PanelHome() {
  const { profile, user } = useAuth()
  const nombre = profile?.nombre ?? user?.email?.split('@')[0] ?? 'músico'
  const perfilCompleto = !!profile?.slug

  const accesos: Acceso[] = [
    {
      to: '/panel/perfil',
      icon: '🎸',
      title: 'Mi perfil',
      text: perfilCompleto ? 'Tus datos, instrumentos y contacto.' : 'Completalo para compartirlo.',
    },
  ]
  if (profile?.slug) {
    accesos.push({
      to: `/m/${profile.slug}`,
      icon: '🔗',
      title: 'Perfil público',
      text: 'Lo que ven otros músicos. Compartilo.',
    })
  }

  return (
    <PanelLayout backTo="/">
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>Hola, {nombre}</h1>
      </div>

      {!perfilCompleto && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>👋 ¡Bienvenido!</p>
          <p className={styles.cardMuted}>
            Empezá completando tu perfil: elegí tu link y contá qué tocás.
          </p>
          <Link to="/panel/perfil" className="btn-primary">
            Completar perfil
          </Link>
        </div>
      )}

      <nav className={styles.tiles} aria-label="Secciones del panel">
        {accesos.map((a) => (
          <Link key={a.to} to={a.to} className={styles.tile}>
            <span className={styles.tileIcon} aria-hidden="true">
              {a.icon}
            </span>
            <span className={styles.tileTitle}>{a.title}</span>
            <span className={styles.tileText}>{a.text}</span>
          </Link>
        ))}
      </nav>
    </PanelLayout>
  )
}
