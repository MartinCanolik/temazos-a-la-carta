import { useNavigate, Link } from 'react-router-dom'
import { usePedidosCount } from '@/hooks/usePedidos'
import styles from './Home.module.css'

export function Home() {
  const navigate = useNavigate()
  const pedidosCount = usePedidosCount()

  return (
    <div className={styles.home}>
      {/* Gradiente superior para legibilidad del título */}
      <div className={styles.gradientTop} aria-hidden="true" />

      {/* Nav */}
      <nav className={styles.nav}>
        <span />
        <Link to="/pedidos" className={styles.pedidosLink} aria-label={`Ver pedidos${pedidosCount > 0 ? `, ${pedidosCount} en cola` : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.981l7.5-4.039a2.25 2.25 0 012.134 0l7.5 4.039a2.25 2.25 0 011.183 1.98V19.5z" />
          </svg>
          <span>Pedidos</span>
          {pedidosCount > 0 && (
            <span className={styles.badge} aria-hidden="true">
              {pedidosCount > 99 ? '99+' : pedidosCount}
            </span>
          )}
        </Link>
      </nav>

      {/* Título */}
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>
          TEMAZOS
        </h1>
        <p className={styles.titleSub}>A LA CARTA</p>
      </div>

      {/* Imagen de artistas — ancla al fondo de la pantalla */}
      <div className={styles.artistsWrap} aria-hidden="true">
        <div className={styles.artistsFade} />
        <img
          src="/artistas.jpeg"
          alt=""
          className={styles.artistsImg}
          draggable={false}
        />
      </div>

      {/* CTA */}
      <div className={styles.cta}>
        <button className="btn-outline" onClick={() => navigate('/repertorio')}>
          Ver repertorio
        </button>
      </div>
    </div>
  )
}
