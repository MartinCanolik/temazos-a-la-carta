import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { useToques } from '@/hooks/useToques'
import { formatearFecha, formatearHora, formatearPlata, hoyISO } from '@/lib/toques'
import type { Toque } from '@/lib/database.types'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

export function MisToques() {
  const { user } = useAuth()
  const { data: toques, isLoading, isError } = useToques(user?.id)

  const hoy = hoyISO()
  const proximos = (toques ?? []).filter((t) => t.fecha >= hoy).reverse() // el más cercano primero
  const anteriores = (toques ?? []).filter((t) => t.fecha < hoy)

  return (
    <PanelLayout>
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>Mis toques</h1>
      </div>

      <Link to="/panel/toques/nuevo" className="btn-primary">
        + Registrar toque
      </Link>

      {isLoading && <p className={styles.muted}>Cargando…</p>}
      {isError && <p className={styles.muted}>No se pudieron cargar tus toques.</p>}
      {toques && toques.length === 0 && (
        <p className={styles.muted}>
          Todavía no registraste toques. Anotá los que tenés agendados y los que ya hiciste.
        </p>
      )}

      {proximos.length > 0 && <ListaToques titulo="Próximos" toques={proximos} />}
      {anteriores.length > 0 && <ListaToques titulo="Anteriores" toques={anteriores} />}
    </PanelLayout>
  )
}

function ListaToques({ titulo, toques }: { titulo: string; toques: Toque[] }) {
  return (
    <section className={styles.card} aria-label={titulo}>
      <h2 className={styles.cardTitle}>
        {titulo} · {toques.length}
      </h2>
      <ul className={styles.list}>
        {toques.map((t) => (
          <li key={t.id}>
            <Link to={`/panel/toques/${t.id}`} className={styles.listItem}>
              <div className={styles.listMain}>
                <span className={styles.listTitle}>{t.lugar}</span>
                <span className={styles.listSub}>
                  {[formatearFecha(t.fecha), formatearHora(t.hora), t.ciudad, t.formato]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              {t.paga != null && <span className={styles.chip}>{formatearPlata(t.paga, t.moneda)}</span>}
              <span aria-hidden="true" style={{ color: 'rgba(0,0,0,0.35)' }}>
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
