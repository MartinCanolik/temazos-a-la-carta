import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { useMisCobros, useShows, useTocadasDeMisShows } from '@/hooks/useShows'
import { useCancionesDe } from '@/hooks/useCancionesMusico'
import { usePedidosCount } from '@/hooks/usePedidos'
import { calcularEstadisticas } from '@/lib/estadisticas'
import { dividirAgenda, formatearFecha, formatearHora, formatearTotales, hoyISO, miEstado } from '@/lib/shows'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

interface Acceso {
  to: string
  icon: string
  title: string
  text: string
}

/** Inicio del panel de músico: resumen + accesos a cada sección. */
export function PanelHome() {
  const { profile, user, isAdmin } = useAuth()
  const nombre = profile?.nombre ?? user?.email?.split('@')[0] ?? 'músico'
  const perfilCompleto = !!profile?.slug
  const enCola = usePedidosCount()

  const accesos: Acceso[] = []
  if (isAdmin) {
    accesos.push({
      to: '/panel/cola',
      icon: '🎶',
      title: 'Cola de pedidos',
      text: enCola > 0 ? `${enCola} en cola ahora. Marcá las que ya sonaron.` : 'La cola está vacía.',
    })
  }
  accesos.push(
    {
      to: '/panel/shows',
      icon: '📅',
      title: 'Shows',
      text: 'Agenda compartida, invitaciones, cobros y temas tocados.',
    },
    {
      to: '/panel/estadisticas',
      icon: '📊',
      title: 'Tus números',
      text: 'Shows, lugares, temas y plata por período.',
    },
    {
      to: '/panel/repertorio',
      icon: '🎼',
      title: 'Mis canciones',
      text: 'Las canciones que tocás y tu versión.',
    },
    {
      to: '/panel/repertorios',
      icon: '📋',
      title: 'Repertorios',
      text: 'Armá el setlist con tu formación y reusá los anteriores.',
    },
    {
      to: '/panel/formacion',
      icon: '🎤',
      title: 'Formación',
      text: 'Qué saben todos y qué hay que ensayar.',
    },
    {
      to: '/panel/comparar',
      icon: '🤝',
      title: 'En común',
      text: 'Compará tu repertorio con otro músico.',
    },
    {
      to: '/panel/perfil',
      icon: '🎸',
      title: 'Mi perfil',
      text: perfilCompleto ? 'Tus datos, instrumentos y contacto.' : 'Completalo para compartirlo.',
    },
  )
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
        <p className={styles.kicker}>Panel de {isAdmin ? 'la banda' : 'músico'}</p>
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

      <Resumen musicoId={user?.id} />

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


/** Estadísticas: próximo show, shows y plata del mes, repertorio y canciones más tocadas. */
function Resumen({ musicoId }: { musicoId: string | undefined }) {
  const { data: shows } = useShows(!!musicoId)
  const { data: cobros } = useMisCobros(!!musicoId)
  const { data: tocadas } = useTocadasDeMisShows(!!musicoId)
  const { data: canciones } = useCancionesDe(musicoId)

  const datos = useMemo(() => {
    const hoy = hoyISO()
    const entrada = { shows: shows ?? [], miId: musicoId, cobros: cobros ?? new Map(), tocadas: tocadas ?? [], hoy }
    // Only shows I accepted count: pending and declined invitations are left out.
    const aceptados = entrada.shows.filter((s) => miEstado(s, musicoId) === 'aceptado')
    const { proximos } = dividirAgenda(aceptados, musicoId, hoy)
    const mes = calcularEstadisticas({ ...entrada, periodo: 'este-mes' })
    const historico = calcularEstadisticas({ ...entrada, periodo: 'historico' })
    return { proximo: proximos[0], mes, topCanciones: historico.temas.slice(0, 5) }
  }, [shows, cobros, tocadas, musicoId])

  if (!shows) return null

  const cobradoTexto = formatearTotales(datos.mes.plata.cobrado)
  const hayPendiente = Object.keys(datos.mes.plata.pendiente).length > 0

  return (
    <>
      {datos.proximo ? (
        <Link to={`/panel/shows/${datos.proximo.id}`} className={styles.card}>
          <span className={styles.cardMuted}>Próximo show</span>
          <span className={styles.cardTitle} style={{ fontSize: 'var(--text-lg)' }}>
            {datos.proximo.nombre}
          </span>
          <span className={styles.cardMuted}>
            {[
              formatearFecha(datos.proximo.fecha),
              formatearHora(datos.proximo.hora),
              datos.proximo.lugar,
              datos.proximo.ciudad,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </Link>
      ) : (
        <Link to="/panel/shows/nuevo" className={styles.card}>
          <span className={styles.cardTitle}>📅 No tenés shows agendados</span>
          <span className={styles.cardMuted}>Cargá el próximo →</span>
        </Link>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{datos.mes.realizados}</span>
          <span className={styles.statLabel}>shows este mes</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue} style={{ fontSize: cobradoTexto.length > 9 ? 'var(--text-base)' : undefined }}>
            {cobradoTexto}
          </span>
          <span className={styles.statLabel}>
            cobrado este mes{hayPendiente && ` · ${formatearTotales(datos.mes.plata.pendiente)} a cobrar`}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{canciones?.length ?? 0}</span>
          <span className={styles.statLabel}>canciones</span>
        </div>
      </div>

      {datos.topCanciones.length > 0 && (
        <section className={styles.card} aria-labelledby="mas-tocadas">
          <h2 id="mas-tocadas" className={styles.cardTitle}>
            🔥 Las que más tocás
          </h2>
          <ol className={styles.list}>
            {datos.topCanciones.map((t) => (
              <li key={t.cancion_id} className={styles.listItem}>
                <div className={styles.listMain}>
                  <span className={styles.listTitle}>{t.titulo}</span>
                  <span className={styles.listSub}>{t.artista}</span>
                </div>
                <span className={styles.chip}>
                  {t.shows} {t.shows === 1 ? 'show' : 'shows'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}
