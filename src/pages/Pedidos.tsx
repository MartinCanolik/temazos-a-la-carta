import { Navbar } from '@/components/Navbar'
import { usePedidos } from '@/hooks/usePedidos'
import styles from './Pedidos.module.css'

export function Pedidos() {
  const { data: pedidos, isLoading, isError } = usePedidos()

  return (
    <div className={styles.page}>
      <Navbar showBack />

      <div className={styles.content}>
        <h2 className={styles.heading}>Pedidos</h2>

        {isLoading && <p className={styles.empty}>Cargando pedidos…</p>}

        {isError && (
          <p className={styles.empty}>No se pudieron cargar los pedidos. Intentá de nuevo.</p>
        )}

        {!isLoading && !isError && (pedidos ?? []).length === 0 && (
          <p className={styles.empty}>Todavía no hay pedidos. ¡Sé el primero!</p>
        )}

        {!isLoading && !isError && (pedidos ?? []).length > 0 && (
          <ol className={styles.list}>
            {pedidos!.map((pedido, idx) => (
              <li key={pedido.id} className={styles.item}>
                <span className={styles.num}>{idx + 1}</span>

                <div className={styles.cover}>
                  {pedido.album_image ? (
                    <img src={pedido.album_image} alt="" />
                  ) : (
                    <div className={styles.coverPlaceholder} aria-hidden="true" />
                  )}
                </div>

                <div className={styles.info}>
                  <span className={styles.trackName}>{pedido.track_name}</span>
                  <span className={styles.requester}>{pedido.requester}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
