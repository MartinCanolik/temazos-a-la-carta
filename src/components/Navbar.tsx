import { Link } from 'react-router-dom'
import { usePedidosCount } from '@/hooks/usePedidos'
import styles from './Navbar.module.css'

interface NavbarProps {
  showBack?: boolean
  home?: boolean
}

export function Navbar({ showBack = false, home = false }: NavbarProps) {
  const count = usePedidosCount()

  return (
    <nav className={home ? styles.nav : 'navbar'}>
      {home ? (
        <Link to="/donaciones" className={styles.donationsLink} aria-label="Donaciones">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            className="svg-icon"
            fill="currentColor"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M5.5 9.511c.076.954.83 1.697 2.182 1.785V12h.6v-.709c1.4-.098 2.218-.846 2.218-1.932 0-.987-.626-1.496-1.745-1.76l-.473-.112V5.57c.6.068.982.396 1.074.85h1.052c-.076-.919-.864-1.638-2.126-1.716V4h-.6v.719c-1.195.117-2.01.836-2.01 1.853 0 .9.606 1.472 1.613 1.707l.397.098v2.034c-.615-.093-1.022-.43-1.114-.9zm2.177-2.166c-.59-.137-.91-.416-.91-.836 0-.47.345-.822.915-.925v1.76h-.005zm.692 1.193c.717.166 1.048.435 1.048.91 0 .542-.412.914-1.135.982V8.518z" />
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
            <path d="M8 13.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11m0 .5A6 6 0 1 0 8 2a6 6 0 0 0 0 12" />
          </svg>
          <span>Donaciones</span>
        </Link>
      ) : (
        <div className={styles.backSlot}>
          {showBack && (
            <Link to="/" aria-label="Volver" className={styles.backLink}>
              ←
            </Link>
          )}
        </div>
      )}

      <Link
        to="/pedidos"
        className={home ? styles.pedidosLink : 'navbar__pedidos-link'}
        aria-label={`Ver pedidos${count > 0 ? `, ${count} en cola` : ''}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.981l7.5-4.039a2.25 2.25 0 012.134 0l7.5 4.039a2.25 2.25 0 011.183 1.98V19.5z"
          />
        </svg>

        <span>Pedidos</span>

        {count > 0 && <span className={styles.badge}>{count > 99 ? '99+' : count}</span>}
      </Link>
    </nav>
  )
}
