import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/authContext'
import { PEDIDOS_QUERY_KEY, usePedidos } from '@/hooks/usePedidos'
import type { Pedido } from '@/lib/database.types'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

/** Cola de pedidos para la banda (sólo admin): marcar como "ya sonó" o vaciar. */
export function GestionCola() {
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const { data: pedidos, isLoading, isError } = usePedidos()
  const [borrando, setBorrando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function sacarDelCache(filtro: (p: Pedido) => boolean) {
    queryClient.setQueryData<Pedido[]>(PEDIDOS_QUERY_KEY, (prev) => (prev ?? []).filter(filtro))
  }

  async function yaSono(pedido: Pedido) {
    setError(null)
    setBorrando(pedido.id)
    const { error: err } = await supabase.from('pedidos').delete().eq('id', pedido.id)
    setBorrando(null)
    if (err) {
      setError('No se pudo sacar el pedido. ¿Tu cuenta tiene rol admin?')
      return
    }
    sacarDelCache((p) => p.id !== pedido.id)
  }

  async function vaciar() {
    if (!window.confirm('¿Vaciar toda la cola? Se borran todos los pedidos.')) return
    setError(null)
    setBorrando('todos')
    const { error: err } = await supabase
      .from('pedidos')
      .delete()
      .gte('created_at', '1970-01-01')
    setBorrando(null)
    if (err) {
      setError('No se pudo vaciar la cola.')
      return
    }
    sacarDelCache(() => false)
  }

  const lista = pedidos ?? []
  const cantores = lista.filter((p) => p.wants_to_sing).length

  if (!isAdmin) {
    return (
      <PanelLayout>
        <h1 className={styles.title}>Cola de pedidos</h1>
        <p className={styles.subtitle}>Esta sección es sólo para la banda (rol admin).</p>
      </PanelLayout>
    )
  }

  return (
    <PanelLayout>
      <div>
        <p className={styles.kicker}>Banda</p>
        <h1 className={styles.title}>Cola de pedidos</h1>
      </div>
      <p className={styles.subtitle}>
        {lista.length} en cola{cantores > 0 && ` · 🎤 ${cantores} quieren cantar`}. Se actualiza en
        vivo.
      </p>

      {error && <p className={styles.error} style={{ color: 'var(--color-white)' }}>{error}</p>}

      <section className={styles.card} aria-label="Pedidos en cola">
        {isLoading && <p className={styles.cardMuted}>Cargando…</p>}
        {isError && <p className={styles.error}>No se pudo cargar la cola.</p>}
        {!isLoading && lista.length === 0 && <p className={styles.cardMuted}>La cola está vacía.</p>}

        {lista.length > 0 && (
          <ol className={styles.list}>
            {lista.map((p, idx) => (
              <li key={p.id} className={styles.listItem}>
                <span className={styles.chip}>{idx + 1}</span>
                <div className={styles.listMain}>
                  <span className={styles.listTitle}>{p.track_name}</span>
                  <span className={styles.listSub}>
                    {p.artist_name} · pidió {p.requester}
                    {p.wants_to_sing && ' · 🎤 quiere cantar'}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.btnLink}
                  disabled={borrando !== null}
                  onClick={() => void yaSono(p)}
                >
                  {borrando === p.id ? '…' : '✓ Sonó'}
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {lista.length > 0 && (
        <button
          type="button"
          className="btn-outline"
          disabled={borrando !== null}
          onClick={() => void vaciar()}
        >
          {borrando === 'todos' ? 'Vaciando…' : 'Vaciar cola (fin del show)'}
        </button>
      )}
    </PanelLayout>
  )
}
