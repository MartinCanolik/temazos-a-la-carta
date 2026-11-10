import { useMemo, useState } from 'react'
import { useAuth } from '@/auth/authContext'
import {
  useActualizarCancion,
  useAgregarCanciones,
  useBorrarCancion,
  useCancionesDe,
} from '@/hooks/useCancionesMusico'
import { usePlaylist } from '@/hooks/usePlaylist'
import { useDebounce } from '@/hooks/useDebounce'
import { TONALIDADES, claveCancion, normalizarTexto, parsearListaCanciones } from '@/lib/canciones'
import type { CancionMusico } from '@/lib/database.types'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

export function MiRepertorio() {
  const { user } = useAuth()
  const musicoId = user?.id
  const { data: canciones, isLoading, isError } = useCancionesDe(musicoId)
  const borrar = useBorrarCancion(musicoId)

  const [editando, setEditando] = useState<CancionMusico | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const q = normalizarTexto(useDebounce(busqueda, 200))

  const filtradas = useMemo(() => {
    if (!canciones) return []
    if (!q) return canciones
    return canciones.filter(
      (c) => normalizarTexto(c.titulo).includes(q) || normalizarTexto(c.artista).includes(q),
    )
  }, [canciones, q])

  return (
    <PanelLayout>
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>Mi repertorio</h1>
      </div>
      <p className={styles.subtitle}>
        Las canciones que podés tocar, con tu versión: tonalidad, arreglo y un link de referencia.
      </p>

      <CancionForm
        key={editando?.id ?? 'nueva'}
        musicoId={musicoId}
        cancion={editando}
        onDone={() => setEditando(null)}
      />

      <ImportarCanciones musicoId={musicoId} />

      <section className={styles.card} aria-labelledby="lista-canciones">
        <div className={styles.row} style={{ alignItems: 'center' }}>
          <h2 id="lista-canciones" className={styles.cardTitle}>
            {canciones ? `${canciones.length} canciones` : 'Canciones'}
          </h2>
        </div>

        {(canciones?.length ?? 0) > 5 && (
          <input
            type="search"
            className="input-field"
            placeholder="Buscar en mi repertorio"
            aria-label="Buscar en mi repertorio"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        )}

        {isLoading && <p className={styles.cardMuted}>Cargando…</p>}
        {isError && <p className={styles.error}>No se pudo cargar tu repertorio.</p>}
        {canciones && canciones.length === 0 && (
          <p className={styles.cardMuted}>
            Todavía no cargaste canciones. Agregalas una por una o importá una lista.
          </p>
        )}

        {filtradas.length > 0 && (
          <ul className={styles.list}>
            {filtradas.map((c) => (
              <li key={c.id} className={styles.listItem}>
                <div className={styles.listMain}>
                  <span className={styles.listTitle}>{c.titulo}</span>
                  <span className={styles.listSub}>{c.artista}</span>
                  {(c.tonalidad || c.version || c.referencia_url) && (
                    <span className={styles.chips}>
                      {c.tonalidad && <span className={styles.chip}>{c.tonalidad}</span>}
                      {c.version && <span className={styles.chip}>{c.version}</span>}
                      {c.referencia_url && (
                        <a
                          className={styles.chip}
                          href={c.referencia_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          ▶ referencia
                        </a>
                      )}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className={styles.btnLink}
                  onClick={() => {
                    setEditando(c)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className={styles.btnLink}
                  disabled={borrar.isPending}
                  aria-label={`Borrar ${c.titulo}`}
                  onClick={() => {
                    if (window.confirm(`¿Sacar "${c.titulo}" de tu repertorio?`)) borrar.mutate(c.id)
                  }}
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PanelLayout>
  )
}

/* ─── Alta / edición de una canción ─────────────────────────────────────────── */

interface CancionFormProps {
  musicoId: string | undefined
  cancion: CancionMusico | null
  onDone: () => void
}

function CancionForm({ musicoId, cancion, onDone }: CancionFormProps) {
  const agregar = useAgregarCanciones(musicoId)
  const actualizar = useActualizarCancion(musicoId)

  const [titulo, setTitulo] = useState(cancion?.titulo ?? '')
  const [artista, setArtista] = useState(cancion?.artista ?? '')
  const [tonalidad, setTonalidad] = useState(cancion?.tonalidad ?? '')
  const [version, setVersion] = useState(cancion?.version ?? '')
  const [referencia, setReferencia] = useState(cancion?.referencia_url ?? '')
  const [notas, setNotas] = useState(cancion?.notas ?? '')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const pending = agregar.isPending || actualizar.isPending

  function limpiar() {
    setTitulo('')
    setArtista('')
    setTonalidad('')
    setVersion('')
    setReferencia('')
    setNotas('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !artista.trim()) return
    setMsg(null)
    const datos = {
      titulo: titulo.trim(),
      artista: artista.trim(),
      tonalidad: tonalidad || null,
      version: version.trim() || null,
      referencia_url: referencia.trim() || null,
      notas: notas.trim() || null,
    }
    try {
      if (cancion) {
        await actualizar.mutateAsync({ id: cancion.id, ...datos })
        onDone()
      } else {
        const { agregadas } = await agregar.mutateAsync([datos])
        if (agregadas === 0) {
          setMsg({ tipo: 'error', texto: 'Esa canción ya está en tu repertorio.' })
          return
        }
        setMsg({ tipo: 'ok', texto: `"${datos.titulo}" agregada.` })
        limpiar()
      }
    } catch (err) {
      setMsg({ tipo: 'error', texto: err instanceof Error ? err.message : 'No se pudo guardar.' })
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <h2 className={styles.cardTitle}>{cancion ? 'Editar canción' : 'Agregar canción'}</h2>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="c-titulo">
            Canción
          </label>
          <input
            id="c-titulo"
            className="input-field"
            value={titulo}
            maxLength={200}
            required
            onChange={(e) => setTitulo(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="c-artista">
            Artista
          </label>
          <input
            id="c-artista"
            className="input-field"
            value={artista}
            maxLength={200}
            required
            onChange={(e) => setArtista(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field} style={{ flex: '0 0 7rem' }}>
          <label className={styles.label} htmlFor="c-tono">
            Tono
          </label>
          <select
            id="c-tono"
            className={styles.select}
            value={tonalidad}
            onChange={(e) => setTonalidad(e.target.value)}
          >
            <option value="">—</option>
            {TONALIDADES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="c-version">
            Versión
          </label>
          <input
            id="c-version"
            className="input-field"
            placeholder="Acústica, versión rock…"
            value={version}
            maxLength={120}
            onChange={(e) => setVersion(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="c-ref">
          Link de referencia
        </label>
        <input
          id="c-ref"
          className="input-field"
          type="url"
          placeholder="YouTube / Spotify de la versión que hacés"
          value={referencia}
          maxLength={500}
          onChange={(e) => setReferencia(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="c-notas">
          Notas
        </label>
        <textarea
          id="c-notas"
          className={styles.textarea}
          style={{ minHeight: '3.5rem' }}
          placeholder="Capo 2, arranca con el estribillo…"
          value={notas}
          maxLength={500}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      {msg && <p className={msg.tipo === 'ok' ? styles.success : styles.error}>{msg.texto}</p>}

      <div className={styles.row}>
        {cancion && (
          <button type="button" className={styles.btnSecondary} onClick={onDone}>
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || !titulo.trim() || !artista.trim()}
        >
          {pending ? 'Guardando…' : cancion ? 'Guardar cambios' : 'Agregar'}
        </button>
      </div>
    </form>
  )
}

/* ─── Importar canciones en bloque ──────────────────────────────────────────── */

function ImportarCanciones({ musicoId }: { musicoId: string | undefined }) {
  const agregar = useAgregarCanciones(musicoId)
  const { data: misCanciones } = useCancionesDe(musicoId)
  const [modo, setModo] = useState<'cerrado' | 'pegar' | 'banda'>('cerrado')
  const [texto, setTexto] = useState('')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<string | null>(null)

  const { data: tracksBanda, isLoading: cargandoBanda } = usePlaylist()

  const misClaves = useMemo(
    () => new Set((misCanciones ?? []).map((c) => claveCancion(c.titulo, c.artista))),
    [misCanciones],
  )
  const bandaDisponibles = useMemo(
    () => (tracksBanda ?? []).filter((t) => !misClaves.has(claveCancion(t.name, t.artist))),
    [tracksBanda, misClaves],
  )

  const parseadas = useMemo(() => parsearListaCanciones(texto), [texto])

  async function importar(filas: { titulo: string; artista: string; spotify_track_id?: string }[]) {
    setMsg(null)
    try {
      const { agregadas, repetidas } = await agregar.mutateAsync(filas)
      setMsg(
        `Listo: ${agregadas} ${agregadas === 1 ? 'canción agregada' : 'canciones agregadas'}` +
          (repetidas ? ` (${repetidas} ya estaban).` : '.'),
      )
      setTexto('')
      setSeleccion(new Set())
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo importar.')
    }
  }

  return (
    <section className={styles.card} aria-labelledby="importar-titulo">
      <h2 id="importar-titulo" className={styles.cardTitle}>
        Importar varias
      </h2>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.btnSecondary}
          aria-pressed={modo === 'pegar'}
          onClick={() => setModo(modo === 'pegar' ? 'cerrado' : 'pegar')}
        >
          Pegar lista
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          aria-pressed={modo === 'banda'}
          onClick={() => setModo(modo === 'banda' ? 'cerrado' : 'banda')}
        >
          De la banda
        </button>
      </div>

      {modo === 'pegar' && (
        <>
          <textarea
            className={styles.textarea}
            style={{ minHeight: '8rem' }}
            aria-label="Lista de canciones"
            placeholder={'Una por línea: Canción - Artista\nPersiana americana - Soda Stereo\nCrimen - Gustavo Cerati'}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={parseadas.length === 0 || agregar.isPending}
            onClick={() => void importar(parseadas)}
          >
            {agregar.isPending
              ? 'Importando…'
              : `Importar ${parseadas.length} ${parseadas.length === 1 ? 'canción' : 'canciones'}`}
          </button>
        </>
      )}

      {modo === 'banda' && (
        <>
          <p className={styles.cardMuted}>
            Marcá las canciones del repertorio de la banda que también tocás.
          </p>
          {cargandoBanda && <p className={styles.cardMuted}>Cargando…</p>}
          {!cargandoBanda && bandaDisponibles.length === 0 && (
            <p className={styles.cardMuted}>Ya tenés todas las canciones de la banda.</p>
          )}
          {bandaDisponibles.length > 0 && (
            <>
              <button
                type="button"
                className={styles.btnLink}
                style={{ alignSelf: 'flex-start' }}
                onClick={() =>
                  setSeleccion(
                    seleccion.size === bandaDisponibles.length
                      ? new Set()
                      : new Set(bandaDisponibles.map((t) => t.id)),
                  )
                }
              >
                {seleccion.size === bandaDisponibles.length ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
              <ul className={styles.list} style={{ maxHeight: '18rem', overflowY: 'auto' }}>
                {bandaDisponibles.map((t) => (
                  <li key={t.id} className={styles.listItem}>
                    <label
                      className={styles.listMain}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={seleccion.has(t.id)}
                        style={{ accentColor: 'var(--color-red)', width: '1.1rem', height: '1.1rem' }}
                        onChange={() => {
                          const next = new Set(seleccion)
                          if (next.has(t.id)) next.delete(t.id)
                          else next.add(t.id)
                          setSeleccion(next)
                        }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span className={styles.listTitle} style={{ display: 'block' }}>
                          {t.name}
                        </span>
                        <span className={styles.listSub} style={{ display: 'block' }}>
                          {t.artist}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn-primary"
                disabled={seleccion.size === 0 || agregar.isPending}
                onClick={() =>
                  void importar(
                    bandaDisponibles
                      .filter((t) => seleccion.has(t.id))
                      .map((t) => ({ titulo: t.name, artista: t.artist, spotify_track_id: t.id })),
                  )
                }
              >
                {agregar.isPending ? 'Importando…' : `Sumar ${seleccion.size} a mi repertorio`}
              </button>
            </>
          )}
        </>
      )}

      {msg && <p className={styles.success}>{msg}</p>}
    </section>
  )
}
