import { useState, useMemo } from 'react'
import { Navbar } from '@/components/Navbar'
import { PedidoModal } from '@/components/PedidoModal'
import { useCartStore } from '@/store/cartStore'
import {
  MAX_PEDIDOS_POR_DISPOSITIVO,
  useMisPedidos,
  usePedidosTrackIds,
} from '@/hooks/usePedidos'
import { usePlaylist } from '@/hooks/usePlaylist'
import { useDebounce } from '@/hooks/useDebounce'
import styles from './Repertorio.module.css'

const SKELETON_COUNT = 8

export function Repertorio() {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const addItem = useCartStore((s) => s.addItem)
  const hasItem = useCartStore((s) => s.hasItem)
  const cartCount = useCartStore((s) => s.items.length)
  const pedidosTrackIds = usePedidosTrackIds()
  const misPedidos = useMisPedidos()

  // Lugares libres para este dispositivo (pedidos en cola + canciones en el carrito).
  const lugaresLibres = Math.max(0, MAX_PEDIDOS_POR_DISPOSITIVO - misPedidos.length - cartCount)
  const limiteAlcanzado = lugaresLibres === 0

  const { data: tracks, isLoading, isError, refetch } = usePlaylist()
  const debouncedSearch = useDebounce(search, 250)

  const filtered = useMemo(() => {
    if (!tracks) return []
    const q = debouncedSearch.toLowerCase().trim()
    if (!q) return tracks
    return tracks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q),
    )
  }, [tracks, debouncedSearch])

  return (
    <div className={styles.page}>
      <Navbar showBack />

      <div className={styles.content}>
        <h2 className={styles.heading}>Buscá un temazo</h2>

        <input
          type="search"
          className="input-search"
          placeholder="Nombre de la canción/artista"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar canción o artista"
          disabled={isLoading}
        />

        <p className={styles.limitHint} role="status">
          {misPedidos.length >= MAX_PEDIDOS_POR_DISPOSITIVO
            ? `Ya tenés ${MAX_PEDIDOS_POR_DISPOSITIVO} temazos en la cola. Cuando suenen, vas a poder pedir más.`
            : `Podés pedir hasta ${MAX_PEDIDOS_POR_DISPOSITIVO} temazos · te ${
                lugaresLibres === 1 ? 'queda 1' : `quedan ${lugaresLibres}`
              }`}
        </p>

        {/* Estado de carga — skeletons */}
        {isLoading && (
          <ol className={styles.list} aria-busy="true" aria-label="Cargando repertorio">
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <li key={i} className={styles.track}>
                <span className={`${styles.trackNum} ${styles.skeleton} ${styles.skeletonNum}`} />
                <div className={`${styles.trackCover} ${styles.skeleton}`} />
                <div className={styles.trackInfo}>
                  <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
                  <span className={`${styles.skeleton} ${styles.skeletonArtist}`} />
                </div>
                <span className={`${styles.skeleton} ${styles.skeletonBtn}`} />
              </li>
            ))}
          </ol>
        )}

        {/* Estado de error */}
        {isError && !isLoading && (
          <div className={styles.feedback}>
            <p className={styles.feedbackText}>No se pudo cargar el repertorio.</p>
            <button className="btn-outline" onClick={() => refetch()}>
              Reintentar
            </button>
          </div>
        )}

        {/* Lista real */}
        {!isLoading && !isError && (
          <>
            {filtered.length === 0 && (
              <p className={styles.empty}>
                {debouncedSearch
                  ? `Sin resultados para "${debouncedSearch}".`
                  : 'El repertorio está vacío.'}
              </p>
            )}

            {filtered.length > 0 && (
              <ol className={styles.list}>
                {filtered.map((track, idx) => {
                  const alreadyRequested = pedidosTrackIds.has(track.id)
                  const inCart = hasItem(track.id)
                  const disabled = alreadyRequested || inCart || limiteAlcanzado

                  return (
                    <li key={track.id} className={styles.track}>
                      <span className={styles.trackNum}>{idx + 1}</span>

                      <div className={styles.trackCover}>
                        {track.albumImage ? (
                          <img src={track.albumImage} alt="" loading="lazy" />
                        ) : (
                          <div className={styles.trackCoverPlaceholder} aria-hidden="true" />
                        )}
                      </div>

                      <div className={styles.trackInfo}>
                        <span className={styles.trackName}>{track.name}</span>
                        <span className={styles.trackArtist}>{track.artist}</span>
                      </div>

                      <button
                        className={`btn-add${alreadyRequested ? ' btn-add--done' : ''}`}
                        aria-label={
                          alreadyRequested
                            ? `${track.name} ya está pedida`
                            : inCart
                              ? `${track.name} ya está en tu carrito`
                              : limiteAlcanzado
                                ? `Ya pediste ${MAX_PEDIDOS_POR_DISPOSITIVO} temazos`
                                : `Agregar ${track.name}`
                        }
                        disabled={disabled}
                        onClick={() => {
                          addItem(track)
                          setModalOpen(true)
                        }}
                      >
                        {alreadyRequested ? '✓' : '+'}
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </>
        )}
      </div>

      {modalOpen && <PedidoModal onClose={() => setModalOpen(false)} />}
    </div>
  )
}
