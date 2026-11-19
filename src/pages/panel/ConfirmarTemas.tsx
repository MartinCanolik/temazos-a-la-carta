import { useMemo, useState } from 'react'
import { useBuscarCatalogo } from '@/hooks/useCancionesMusico'
import { useDebounce } from '@/hooks/useDebounce'
import { useRepertorio } from '@/hooks/useRepertorios'
import { useConfirmarTocadas, useTocadas } from '@/hooks/useShows'
import {
  alternarTocado,
  idsTocados,
  moverTema,
  sumarTema,
  temasIniciales,
  type Tema,
  type TemaTocado,
} from '@/lib/shows'
import styles from './panel.module.css'

interface Props {
  showId: string
  repertorioId: string | null
  /** The songs were already confirmed once (the checklist then starts from them). */
  confirmado: boolean
}

/** Checklist of the songs actually played: starts from the setlist, everything checked. */
export function ConfirmarTemas({ showId, repertorioId, confirmado }: Props) {
  const { data: setlist, isLoading: cargandoSetlist } = useRepertorio(repertorioId ?? undefined)
  const { data: tocadas, isLoading: cargandoTocadas } = useTocadas(showId)

  if ((repertorioId && cargandoSetlist) || cargandoTocadas) {
    return (
      <section className={styles.card} aria-label="Temas tocados">
        <p className={styles.cardMuted}>Cargando temas…</p>
      </section>
    )
  }

  const base: Tema[] = (setlist?.items ?? []).map((i) => ({ cancion_id: i.cancion_id, titulo: i.titulo, artista: i.artista }))
  return (
    <Checklist
      key={showId}
      showId={showId}
      confirmado={confirmado}
      inicial={temasIniciales(base, tocadas ?? [])}
    />
  )
}

function Checklist({ showId, confirmado, inicial }: { showId: string; confirmado: boolean; inicial: TemaTocado[] }) {
  const confirmar = useConfirmarTocadas()
  const [lista, setLista] = useState<TemaTocado[]>(inicial)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const enLista = useMemo(() => new Set(lista.map((t) => t.cancion_id)), [lista])
  const marcados = idsTocados(lista).length

  const cambiar = (fn: (prev: TemaTocado[]) => TemaTocado[]) => {
    setLista(fn)
    setMensaje(null)
  }

  async function handleConfirmar() {
    setError(null)
    setMensaje(null)
    try {
      await confirmar.mutateAsync({ showId, cancionIds: idsTocados(lista) })
      setMensaje('Temas confirmados ✓')
    } catch {
      setError('No se pudieron confirmar los temas. Probá de nuevo.')
    }
  }

  return (
    <section className={styles.card} aria-labelledby="temas-tocados">
      <h2 id="temas-tocados" className={styles.cardTitle}>
        Temas que tocaron {lista.length > 0 && `· ${marcados} de ${lista.length}`}
      </h2>
      <p className={styles.cardMuted}>
        {confirmado
          ? 'Ya confirmaste los temas. Podés corregirlos si hace falta.'
          : 'Destildá los que no tocaron y sumá los que se agregaron. Es lo que cuenta para tus estadísticas.'}
      </p>

      {lista.length === 0 ? (
        <p className={styles.cardMuted}>Todavía no hay temas. Buscalos en el catálogo para sumarlos.</p>
      ) : (
        <ol className={styles.list}>
          {lista.map((t, i) => (
            <li key={t.cancion_id} className={styles.listItem}>
              <input
                type="checkbox"
                id={`tocado-${t.cancion_id}`}
                checked={t.tocado}
                onChange={() => cambiar((p) => alternarTocado(p, t.cancion_id))}
                style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--color-red)', flexShrink: 0 }}
              />
              <label htmlFor={`tocado-${t.cancion_id}`} className={styles.listMain} style={{ cursor: 'pointer' }}>
                <span className={styles.listTitle} style={t.tocado ? undefined : { textDecoration: 'line-through', opacity: 0.55 }}>
                  {t.titulo}
                </span>
                <span className={styles.listSub}>{t.artista}</span>
              </label>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Subir ${t.titulo}`}
                disabled={i === 0}
                onClick={() => cambiar((p) => moverTema(p, i, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Bajar ${t.titulo}`}
                disabled={i === lista.length - 1}
                onClick={() => cambiar((p) => moverTema(p, i, 1))}
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
      )}

      <SumarTema enLista={enLista} onSumar={(t) => cambiar((p) => sumarTema(p, t))} />

      {error && <p className={styles.error}>{error}</p>}
      {mensaje && (
        <p className={styles.success} role="status">
          {mensaje}
        </p>
      )}
      <button type="button" className="btn-primary" disabled={confirmar.isPending} onClick={() => void handleConfirmar()}>
        {confirmar.isPending ? 'Confirmando…' : 'Confirmar temas tocados'}
      </button>
    </section>
  )
}

/** Search the shared catalog to add a song that was not in the setlist. */
function SumarTema({ enLista, onSumar }: { enLista: Set<string>; onSumar: (t: Tema) => void }) {
  const [texto, setTexto] = useState('')
  const consulta = useDebounce(texto, 250)
  const { data, isFetching } = useBuscarCatalogo(consulta)
  const resultados = (data ?? []).filter((c) => !enLista.has(c.id))

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor="tocados-buscar">
        Sumar otro tema
      </label>
      <input
        id="tocados-buscar"
        className="input-field"
        placeholder="Título o artista"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoComplete="off"
      />
      {consulta.trim().length >= 2 && (
        <div aria-live="polite">
          {isFetching && <p className={styles.cardMuted}>Buscando…</p>}
          {!isFetching && resultados.length === 0 && <p className={styles.cardMuted}>No encontramos temas nuevos con eso.</p>}
          <ul className={styles.list}>
            {resultados.map((c) => (
              <li key={c.id} className={styles.listItem}>
                <div className={styles.listMain}>
                  <span className={styles.listTitle}>{c.titulo}</span>
                  <span className={styles.listSub}>{c.artista}</span>
                </div>
                <button
                  type="button"
                  className={styles.btnLink}
                  aria-label={`Sumar ${c.titulo}`}
                  onClick={() => {
                    onSumar({ cancion_id: c.id, titulo: c.titulo, artista: c.artista })
                    setTexto('')
                  }}
                >
                  + Sumar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
