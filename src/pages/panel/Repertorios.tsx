import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { usePerfilesPorId } from '@/hooks/usePerfiles'
import { useDuplicarRepertorio, useRepertorios } from '@/hooks/useRepertorios'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

const formatearFechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' })

/** Mis repertorios: los que creé o donde estoy en la formación, el más reciente primero. */
export function Repertorios() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: todos, isLoading, isError } = useRepertorios()
  const duplicar = useDuplicarRepertorio()
  const [errorDup, setErrorDup] = useState<string | null>(null)

  const mios = useMemo(
    () => (todos ?? []).filter((r) => r.creado_por === user?.id || r.musicoIds.includes(user?.id ?? '')),
    [todos, user?.id],
  )
  const idsMusicos = useMemo(() => [...new Set(mios.flatMap((r) => r.musicoIds))], [mios])
  const { data: perfiles } = usePerfilesPorId(idsMusicos)
  const nombres = useMemo(
    () => new Map((perfiles ?? []).map((p) => [p.id, p.nombre ?? p.slug ?? 'Músico'])),
    [perfiles],
  )

  async function handleDuplicar(id: string) {
    setErrorDup(null)
    try {
      const nuevo = await duplicar.mutateAsync(id)
      navigate(`/panel/repertorios/${nuevo}`)
    } catch {
      setErrorDup('No se pudo duplicar el repertorio. Probá de nuevo.')
    }
  }

  return (
    <PanelLayout>
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>Repertorios</h1>
      </div>
      <p className={styles.subtitle}>
        Los repertorios que armaste o donde sos parte de la formación. Abrilos para ajustarlos o duplicalos para la
        próxima fecha.
      </p>

      <Link to="/panel/repertorios/nuevo" className="btn-primary" style={{ textAlign: 'center' }}>
        + Armar un repertorio
      </Link>

      {isLoading && <p className={styles.muted}>Cargando repertorios…</p>}
      {isError && <p className={styles.error}>No se pudieron cargar los repertorios. Probá de nuevo.</p>}
      {errorDup && <p className={styles.error}>{errorDup}</p>}

      {todos && mios.length === 0 && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Todavía no tenés repertorios</p>
          <p className={styles.cardMuted}>
            Elegí con quién vas a tocar, mirá qué temas saben todos y armá el orden del show.
          </p>
          <Link to="/panel/repertorios/nuevo" className="btn-primary" style={{ textAlign: 'center' }}>
            Armar un repertorio
          </Link>
        </div>
      )}

      {mios.length > 0 && (
        <section className={styles.card} aria-label="Mis repertorios">
          <ul className={styles.list}>
            {mios.map((r) => {
              const lineup = r.musicoIds.map((id) => nombres.get(id) ?? '…').join(', ')
              return (
                <li key={r.id} className={styles.setlistRow}>
                  <div className={styles.listMain}>
                    <Link to={`/panel/repertorios/${r.id}`} className={styles.listTitle}>
                      {r.nombre}
                    </Link>
                    <span className={styles.listSub}>
                      {formatearFechaCorta(r.updated_at)} · {r.cancionIds.length}{' '}
                      {r.cancionIds.length === 1 ? 'tema' : 'temas'}
                    </span>
                    {lineup && <span className={styles.wrapSub}>{lineup}</span>}
                  </div>
                  <div className={styles.setlistActions}>
                    {r.aPreparar > 0 && <span className={`${styles.badge} ${styles.badgePrep}`}>🛠 {r.aPreparar} a preparar</span>}
                    <Link to={`/panel/repertorios/${r.id}`} className={styles.btnLink}>
                      Abrir
                    </Link>
                    <button
                      type="button"
                      className={styles.btnLink}
                      disabled={duplicar.isPending}
                      onClick={() => void handleDuplicar(r.id)}
                      aria-label={`Duplicar ${r.nombre}`}
                    >
                      Duplicar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </PanelLayout>
  )
}
