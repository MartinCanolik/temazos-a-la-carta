import { Link, useParams } from 'react-router-dom'
import { TarjetaShow } from '@/components/TarjetaShow'
import { useShowPublico } from '@/hooks/useAgenda'
import { etiquetaDia } from '@/lib/agenda'
import { hoyISO } from '@/lib/shows'
import { PanelLayout } from './panel/PanelLayout'
import styles from './panel/panel.module.css'

/** Detail of one public show (/shows/:id). Private, cancelled or past shows come back empty and read as "not found". */
export function ShowPublico() {
  const { id } = useParams<{ id: string }>()
  const { data: show, isLoading, isError } = useShowPublico(id)

  return (
    <PanelLayout backTo="/shows" showSignOut={false}>
      {isLoading && <p className={styles.muted}>Cargando show…</p>}
      {isError && <p className={styles.muted}>No se pudo cargar el show.</p>}
      {!isLoading && !isError && !show && (
        <>
          <p className={styles.muted}>No encontramos ese show. Puede que ya haya pasado o que no sea público.</p>
          <Link to="/shows" className="btn-primary">
            Ver música en vivo
          </Link>
        </>
      )}

      {show && (
        <>
          <div>
            <p className={styles.kicker}>{etiquetaDia(show.fecha, hoyISO())}</p>
            <h1 className={styles.title}>{show.nombre}</h1>
          </div>
          <TarjetaShow show={show} detalle />
          <Link to="/shows" className={styles.muted} style={{ textAlign: 'center' }}>
            Ver más shows
          </Link>
        </>
      )}
    </PanelLayout>
  )
}
