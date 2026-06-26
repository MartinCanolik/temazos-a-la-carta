import type { ReactNode } from 'react'
import { usePedidosRealtime } from '@/hooks/usePedidos'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  usePedidosRealtime()
  return <div className="app-container">{children}</div>
}
