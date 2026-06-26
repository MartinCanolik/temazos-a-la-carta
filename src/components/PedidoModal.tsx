import { useState } from 'react'
import { useCartStore } from '@/store/cartStore'
import { useCrearPedidos, PedidoDuplicadoError } from '@/hooks/useCrearPedidos'
import styles from './PedidoModal.module.css'

interface PedidoModalProps {
  onClose: () => void
}

export function PedidoModal({ onClose }: PedidoModalProps) {
  const [name, setName] = useState('')
  const [wantsToSing, setWantsToSing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)

  const { mutate: crearPedidos, isPending } = useCrearPedidos()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || items.length === 0) return
    setErrorMsg(null)

    crearPedidos(
      { tracks: items, requester: name, wantsToSing },
      {
        onSuccess: () => {
          setSuccess(true)
          clearCart()
          setTimeout(onClose, 1200)
        },
        onError: (err) => {
          if (err instanceof PedidoDuplicadoError) {
            setErrorMsg('Alguna de esas canciones ya está en la cola. Refrescá y elegí otra.')
          } else {
            setErrorMsg('Algo salió mal. Intentá de nuevo.')
          }
        },
      },
    )
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Pedido de canciones">
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <h2 className={styles.title}>TEMAZOS</h2>

        <ul className={styles.items}>
          {items.map((track) => (
            <li key={track.id} className={styles.item}>
              <div className={styles.cover}>
                {track.albumImage ? (
                  <img src={track.albumImage} alt="" />
                ) : (
                  <div className={styles.coverPlaceholder} aria-hidden="true" />
                )}
              </div>

              <div className={styles.info}>
                <span className={styles.trackName}>{track.name}</span>
                <span className={styles.artist}>{track.artist}</span>
              </div>

              <button
                className={styles.remove}
                onClick={() => removeItem(track.id)}
                aria-label={`Quitar ${track.name}`}
                disabled={isPending || success}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {success ? (
          <p className={styles.successMsg}>¡Pedido enviado! 🎶</p>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.label} htmlFor="requester-name">
              Tu nombre
            </label>
            <input
              id="requester-name"
              type="text"
              className="input-field"
              placeholder="Sofía Gómez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              disabled={isPending}
            />

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={wantsToSing}
                onChange={(e) => setWantsToSing(e.target.checked)}
                className={styles.checkbox}
                disabled={isPending}
              />
              Quiero cantar &lt;3
            </label>

            {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={isPending || !name.trim() || items.length === 0}
            >
              {isPending ? 'Enviando…' : 'Pedir temazo'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
