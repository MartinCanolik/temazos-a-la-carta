import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { useToques, useSetlists } from '@/hooks/useToques'
import { useCancionesDe } from '@/hooks/useCancionesMusico'
import { usePedidosCount } from '@/hooks/usePedidos'
import { formatearFecha, formatearHora, formatearPlata, hoyISO } from '@/lib/toques'
import type { Moneda } from '@/lib/database.types'
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
      to: '/panel/toques',
      icon: '📅',
      title: 'Mis toques',
      text: 'Agenda, paga y setlist de cada toque.',
    },
    {
      to: '/panel/repertorio',
      icon: '🎼',
      title: 'Mi repertorio',
      text: 'Las canciones que tocás y tu versión.',
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

/** Estadísticas: próximo toque, toques y plata del mes, repertorio y canciones más tocadas. */
function Resumen({ musicoId }: { musicoId: string | undefined }) {
  const { data: toques } = useToques(musicoId)
  const { data: setlists } = useSetlists(musicoId)
  const { data: canciones } = useCancionesDe(musicoId)

  const datos = useMemo(() => {
    const hoy = hoyISO()
    const mes = hoy.slice(0, 7)
    const lista = toques ?? []
    const proximos = lista.filter((t) => t.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))
    const delMes = lista.filter((t) => t.fecha.startsWith(mes))

    const plataMes = new Map<Moneda, number>()
    for (const t of delMes) {
      if (t.paga != null) plataMes.set(t.moneda, (plataMes.get(t.moneda) ?? 0) + Number(t.paga))
    }

    const vecesPorCancion = new Map<string, number>()
    for (const s of setlists ?? []) {
      vecesPorCancion.set(s.cancion_id, (vecesPorCancion.get(s.cancion_id) ?? 0) + 1)
    }
    const porId = new Map((canciones ?? []).map((c) => [c.id, c]))
    const masTocadas = [...vecesPorCancion.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, veces]) => ({ cancion: porId.get(id), veces }))
      .filter((x) => x.cancion)

    return { proximo: proximos[0], cantProximos: proximos.length, delMes, plataMes, masTocadas }
  }, [toques, setlists, canciones])

  if (!toques) return null

  const plataTexto =
    datos.plataMes.size === 0
      ? '—'
      : [...datos.plataMes.entries()].map(([m, v]) => formatearPlata(v, m)).join(' + ')

  return (
    <>
      {datos.proximo ? (
        <Link to={`/panel/toques/${datos.proximo.id}`} className={styles.card}>
          <span className={styles.cardMuted}>Próximo toque</span>
          <span className={styles.cardTitle} style={{ fontSize: 'var(--text-lg)' }}>
            {datos.proximo.lugar}
          </span>
          <span className={styles.cardMuted}>
            {[
              formatearFecha(datos.proximo.fecha),
              formatearHora(datos.proximo.hora),
              datos.proximo.ciudad,
              datos.proximo.formato,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </Link>
      ) : (
        <Link to="/panel/toques/nuevo" className={styles.card}>
          <span className={styles.cardTitle}>📅 No tenés toques agendados</span>
          <span className={styles.cardMuted}>Registrá el próximo →</span>
        </Link>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{datos.delMes.length}</span>
          <span className={styles.statLabel}>toques este mes</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue} style={{ fontSize: plataTexto.length > 9 ? 'var(--text-base)' : undefined }}>
            {plataTexto}
          </span>
          <span className={styles.statLabel}>cobrado este mes</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{canciones?.length ?? 0}</span>
          <span className={styles.statLabel}>canciones</span>
        </div>
      </div>

      {datos.masTocadas.length > 0 && (
        <section className={styles.card} aria-labelledby="mas-tocadas">
          <h2 id="mas-tocadas" className={styles.cardTitle}>
            🔥 Las que más tocás
          </h2>
          <ol className={styles.list}>
            {datos.masTocadas.map(({ cancion, veces }) => (
              <li key={cancion!.id} className={styles.listItem}>
                <div className={styles.listMain}>
                  <span className={styles.listTitle}>{cancion!.titulo}</span>
                  <span className={styles.listSub}>{cancion!.artista}</span>
                </div>
                <span className={styles.chip}>
                  {veces} {veces === 1 ? 'vez' : 'veces'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}
