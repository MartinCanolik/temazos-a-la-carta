import { Link } from 'react-router-dom'
import { usePedidosCount } from '@/hooks/usePedidos'

interface NavbarProps {
  showBack?: boolean
}

export function Navbar({ showBack = false }: NavbarProps) {
  const count = usePedidosCount()

  return (
    <nav className="navbar">
      <div style={{ width: '2rem' }}>
        {showBack && (
          <Link to="/" aria-label="Volver" style={{ color: 'var(--color-white)', fontSize: '1.25rem' }}>
            ←
          </Link>
        )}
      </div>

      <Link to="/">
        <img src="/logo.png" alt="Música a la Carta" className="navbar__logo" />
      </Link>

      <Link to="/pedidos" className="navbar__pedidos-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.981l7.5-4.039a2.25 2.25 0 012.134 0l7.5 4.039a2.25 2.25 0 011.183 1.98V19.5z"
          />
        </svg>
        Pedidos{count > 0 ? ` (${count})` : ''}
      </Link>
    </nav>
  )
}
