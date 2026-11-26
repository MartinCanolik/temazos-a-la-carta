import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { useBuscarCatalogo } from '@/hooks/useCancionesMusico'
import { useDebounce } from '@/hooks/useDebounce'
import { useFormacion } from '@/hooks/useFormacion'
import { usePerfilesPorId } from '@/hooks/usePerfiles'
import {
  fetchRepertorio,
  useBorrarRepertorio,
  useGuardarRepertorio,
  useRepertorio,
  useRepertorios,
  type RepertorioResumen,
} from '@/hooks/useRepertorios'
import {
  analizarFormacion,
  coberturaRepertorio,
  etiquetaCobertura,
  type AnalisisFormacion,
  type CancionAnalizada,
} from '@/lib/compatibilidad'
import type { CancionCatalogo } from '@/lib/database.types'
import {
  agregarItem,
  alternarPreparar,
  estadoDeItem,
  moverItem,
  quitarItem,
  repertoriosRecientes,
  resumenRepertorio,
  type ItemRepertorio,
} from '@/lib/repertorio'
import { AgregarMusico, ChipsFormacion } from './FormacionPicker'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

interface Inicial {
  nombre: string
  notas: string
  items: ItemRepertorio[]
  basadoEn: string | null
  creadoPor: string | null
}

const VACIO: Inicial = { nombre: '', notas: '', items: [], basadoEn: null, creadoPor: null }

const aItem = (c: { cancion_id: string; titulo: string; artista: string }): ItemRepertorio => ({
  cancion_id: c.cancion_id,
  titulo: c.titulo,
  artista: c.artista,
  a_preparar: false,
  notas: null,
})

/**
 * Armador de repertorios. Rutas: /panel/repertorios/nuevo (acepta ?m= y ?desde=) y /panel/repertorios/:id.
 * Carga el repertorio de origen y recién ahí monta el armador, así el estado local arranca con datos reales.
 */
export function ArmarRepertorio() {
  const { id } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const desde = id ? null : params.get('desde')
  const origenId = id ?? desde ?? undefined

  const { data: origen, isLoading, isError } = useRepertorio(origenId)

  // Without ?m=, start from the lineup the setlist was built for.
  const sinFormacionEnUrl = !params.get('m')
  const otrosIds = origen && sinFormacionEnUrl ? origen.musicoIds.filter((m) => m !== user?.id) : []
  const { data: perfilesOrigen } = usePerfilesPorId(otrosIds)
  const sembrado = useRef(false)
  useEffect(() => {
    if (sembrado.current || !sinFormacionEnUrl || !perfilesOrigen) return
    const slugs = perfilesOrigen.map((p) => p.slug).filter((s): s is string => !!s)
    if (slugs.length === 0) return
    sembrado.current = true
    const next = new URLSearchParams(params)
    next.set('m', slugs.join(','))
    setParams(next, { replace: true })
  }, [perfilesOrigen, sinFormacionEnUrl, params, setParams])

  const titulo = id ? 'Editar repertorio' : 'Armar repertorio'

  if (origenId && isLoading) {
    return (
      <PanelLayout backTo="/panel/repertorios">
        <h1 className={styles.title}>{titulo}</h1>
        <p className={styles.muted}>Cargando repertorio…</p>
      </PanelLayout>
    )
  }
  if (origenId && (isError || !origen)) {
    return (
      <PanelLayout backTo="/panel/repertorios">
        <h1 className={styles.title}>{titulo}</h1>
        <p className={styles.error}>
          {isError ? 'No se pudo cargar el repertorio. Probá de nuevo.' : 'No encontramos ese repertorio.'}
        </p>
        <Link to="/panel/repertorios" className={styles.btnLink}>
          Ver mis repertorios
        </Link>
      </PanelLayout>
    )
  }

  const inicial: Inicial = origen
    ? id
      ? { nombre: origen.nombre, notas: origen.notas ?? '', items: origen.items, basadoEn: origen.basado_en, creadoPor: origen.creado_por }
      : { nombre: `${origen.nombre} (copia)`, notas: origen.notas ?? '', items: origen.items, basadoEn: origen.id, creadoPor: null }
    : VACIO

  return <Armador key={id ?? desde ?? 'nuevo'} id={id ?? null} titulo={titulo} inicial={inicial} />
}

function Armador({ id, titulo, inicial }: { id: string | null; titulo: string; inicial: Inicial }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const f = useFormacion()
  const guardar = useGuardarRepertorio()
  const borrar = useBorrarRepertorio()

  const [nombre, setNombre] = useState(inicial.nombre)
  const [notas, setNotas] = useState(inicial.notas)
  const [items, setItems] = useState<ItemRepertorio[]>(inicial.items)
  const [basadoEn, setBasadoEn] = useState<string | null>(inicial.basadoEn)
  const [mensaje, setMensaje] = useState<string | null>(
    (location.state as { creado?: boolean } | null)?.creado ? 'Repertorio guardado ✓' : null,
  )
  const [error, setError] = useState<string | null>(null)

  const analisis = useMemo(() => analizarFormacion(f.musicos), [f.musicos])
  // Statuses only mean something once every member's repertoire is loaded.
  const listo = !!f.repertorios && !f.cargandoPerfiles
  const resumen = useMemo(() => resumenRepertorio(items, analisis, f.musicos), [items, analisis, f.musicos])
  const enLista = useMemo(() => new Set(items.map((i) => i.cancion_id)), [items])

  const todos = analisis.todos.filter((c) => !enLista.has(c.cancion_id))
  const parcial = analisis.parcial.filter((c) => !enLista.has(c.cancion_id))

  const modificar = (fn: (prev: ItemRepertorio[]) => ItemRepertorio[]) => {
    setItems(fn)
    setMensaje(null)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMensaje(null)
    try {
      const guardadoId = await guardar.mutateAsync({
        id,
        nombre,
        notas,
        musicoIds: f.miembros.map((m) => m.id),
        items,
        basadoEn,
      })
      if (!id) {
        const query = f.slugs.length > 0 ? `?m=${f.slugs.join(',')}` : ''
        navigate(`/panel/repertorios/${guardadoId}${query}`, { replace: true, state: { creado: true } })
      } else {
        setMensaje('Repertorio guardado ✓')
      }
    } catch {
      setError('No se pudo guardar el repertorio. Revisá la conexión y probá de nuevo.')
    }
  }

  async function handleBorrar() {
    if (!id || !window.confirm('¿Borrar este repertorio? No se puede deshacer.')) return
    setError(null)
    try {
      await borrar.mutateAsync(id)
      navigate('/panel/repertorios', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar el repertorio.')
    }
  }

  async function usarComoBase(r: RepertorioResumen) {
    if (items.length > 0 && !window.confirm('Esto reemplaza los temas que ya tenés en la lista. ¿Seguir?')) return
    setError(null)
    try {
      const detalle = await fetchRepertorio(r.id)
      if (!detalle) throw new Error('missing')
      setItems(detalle.items)
      setBasadoEn(r.id)
      if (!nombre.trim()) setNombre(`${r.nombre} (copia)`)
      setMensaje(`Cargamos «${r.nombre}» como base. Ajustalo y guardalo.`)
    } catch {
      setError('No se pudo cargar ese repertorio. Probá de nuevo.')
    }
  }

  const puedeGuardar = nombre.trim().length > 0 && items.length > 0 && !guardar.isPending
  const soyCreador = !!id && inicial.creadoPor === user?.id

  return (
    <PanelLayout backTo="/panel/repertorios">
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>{titulo}</h1>
      </div>
      <p className={styles.subtitle}>
        Sumá a los músicos con los que vas a tocar, mirá qué sabemos entre todos y armá el orden del show.
      </p>

      <ChipsFormacion miembros={f.miembros} miId={f.miId} onQuitar={f.quitar} noEncontrados={f.noEncontrados} />
      <AgregarMusico excluirId={f.miId} seleccionados={f.slugs} lleno={f.lleno} onAgregar={f.agregar} />

      {f.cargando && <p className={styles.muted}>Comparando repertorios…</p>}
      {f.error && <p className={styles.error}>No se pudo cargar la formación. Probá de nuevo.</p>}

      {listo && (
        <div className={styles.stats} role="group" aria-label="Resumen del repertorio">
          <div className={styles.stat}>
            <span className={styles.statValue}>{f.miembros.length}</span>
            <span className={styles.statLabel}>{f.miembros.length === 1 ? 'músico' : 'músicos'}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{resumen.listas}</span>
            <span className={styles.statLabel}>listas</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{resumen.porPreparar}</span>
            <span className={styles.statLabel}>a preparar</span>
          </div>
        </div>
      )}
      {listo && items.length > 0 && (
        <p className={styles.subtitle} role="status">
          {resumen.cobertura.porcentaje}% del repertorio lo sabe toda la formación ({resumen.cobertura.listas} de{' '}
          {resumen.cobertura.total}).
        </p>
      )}

      <form className={styles.card} onSubmit={(e) => void handleGuardar(e)} aria-label="Repertorio">
        <div className={styles.field}>
          <label className={styles.label} htmlFor="rep-nombre">
            Nombre
          </label>
          <input
            id="rep-nombre"
            className="input-field"
            placeholder="Ej: Casamiento Fernández"
            maxLength={120}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="rep-notas">
            Notas (opcional)
          </label>
          <textarea
            id="rep-notas"
            className={styles.textarea}
            maxLength={1000}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>

        <h2 className={styles.cardTitle}>Lista · {items.length} {items.length === 1 ? 'tema' : 'temas'}</h2>
        {items.length === 0 ? (
          <p className={styles.cardMuted}>Todavía no hay temas. Sumalos desde las sugerencias o buscá en el catálogo.</p>
        ) : (
          <ol className={styles.list}>
            {items.map((item, i) => (
              <FilaRepertorio
                key={item.cancion_id}
                item={item}
                indice={i}
                ultimo={i === items.length - 1}
                listo={listo}
                analisis={analisis}
                musicos={f.musicos}
                onMover={(delta) => modificar((p) => moverItem(p, i, delta))}
                onPreparar={() => modificar((p) => alternarPreparar(p, item.cancion_id))}
                onQuitar={() => modificar((p) => quitarItem(p, item.cancion_id))}
              />
            ))}
          </ol>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {mensaje && (
          <p className={styles.success} role="status">
            {mensaje}
          </p>
        )}
        {items.length === 0 && nombre.trim() && <span className={styles.hint}>Sumá al menos un tema para guardar.</span>}
        <button type="submit" className="btn-primary" disabled={!puedeGuardar}>
          {guardar.isPending ? 'Guardando…' : id ? 'Guardar cambios' : 'Guardar repertorio'}
        </button>
        {soyCreador && (
          <button type="button" className={styles.btnLink} onClick={() => void handleBorrar()} disabled={borrar.isPending}>
            Borrar repertorio
          </button>
        )}
      </form>

      {listo && (
        <>
          <Sugerencias
            id="rep-todos"
            titulo="✅ Las saben todos"
            vacio="No quedan temas que sepan todos."
            canciones={todos}
            onAgregar={(c) => modificar((p) => agregarItem(p, aItem(c)))}
            onAgregarTodas={() => modificar((p) => todos.reduce((acc, c) => agregarItem(acc, aItem(c)), p))}
          />
          <Sugerencias
            id="rep-parcial"
            titulo="🛠 Las sabe una parte"
            ayuda="Si las sumás quedan marcadas como «no la saben todos» hasta que se ensayen."
            vacio="No quedan temas para sumar de este grupo."
            canciones={parcial}
            onAgregar={(c) => modificar((p) => agregarItem(p, aItem(c)))}
          />
        </>
      )}

      <BuscarCancion enLista={enLista} onAgregar={(c) => modificar((p) => agregarItem(p, aItem({ ...c, cancion_id: c.id })))} />

      <Historial
        musicoIds={f.miembros.map((m) => m.id)}
        miId={f.miId}
        excluirId={id}
        analisis={analisis}
        listo={listo}
        onUsar={(r) => void usarComoBase(r)}
      />
    </PanelLayout>
  )
}

function FilaRepertorio({
  item,
  indice,
  ultimo,
  listo,
  analisis,
  musicos,
  onMover,
  onPreparar,
  onQuitar,
}: {
  item: ItemRepertorio
  indice: number
  ultimo: boolean
  listo: boolean
  analisis: AnalisisFormacion
  musicos: { id: string; nombre: string }[]
  onMover: (delta: -1 | 1) => void
  onPreparar: () => void
  onQuitar: () => void
}) {
  const estado = listo ? estadoDeItem(item, analisis, musicos) : null
  return (
    <li className={styles.setlistRow}>
      <div className={styles.setlistHead}>
        <span className={styles.setlistNum} aria-hidden="true">
          {indice + 1}
        </span>
        <div className={styles.listMain}>
          <span className={styles.listTitle}>
            {item.titulo} — {item.artista}
          </span>
          {estado && (
            <>
              <span className={styles.wrapSub}>{etiquetaCobertura(estado.cantidad, estado.total)}</span>
              {estado.faltan.length > 0 && <span className={styles.wrapSub}>No la saben: {estado.faltan.join(', ')}</span>}
            </>
          )}
        </div>
      </div>
      {estado && (
        <div className={styles.badges}>
          {estado.razones.length === 0 && <span className={`${styles.badge} ${styles.badgeOk}`}>✅ Lista</span>}
          {estado.razones.includes('manual') && <span className={`${styles.badge} ${styles.badgePrep}`}>🛠 A preparar</span>}
          {estado.razones.includes('falta') && (
            <span className={`${styles.badge} ${styles.badgeFalta}`}>⚠ No la saben todos</span>
          )}
        </div>
      )}
      <div className={styles.setlistActions}>
        <button type="button" className={styles.toggleBtn} aria-pressed={item.a_preparar} onClick={onPreparar}>
          A preparar
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={`Subir ${item.titulo}`}
          disabled={indice === 0}
          onClick={() => onMover(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          aria-label={`Bajar ${item.titulo}`}
          disabled={ultimo}
          onClick={() => onMover(1)}
        >
          ↓
        </button>
        <button type="button" className={styles.btnLink} aria-label={`Quitar ${item.titulo}`} onClick={onQuitar}>
          Quitar
        </button>
      </div>
    </li>
  )
}

const VISIBLES = 10

function Sugerencias({
  id,
  titulo,
  ayuda,
  vacio,
  canciones,
  onAgregar,
  onAgregarTodas,
}: {
  id: string
  titulo: string
  ayuda?: string
  vacio: string
  canciones: CancionAnalizada[]
  onAgregar: (c: CancionAnalizada) => void
  onAgregarTodas?: () => void
}) {
  const [todas, setTodas] = useState(false)
  const visibles = todas ? canciones : canciones.slice(0, VISIBLES)
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {titulo} · {canciones.length}
      </h2>
      {ayuda && <p className={styles.cardMuted}>{ayuda}</p>}
      {canciones.length === 0 ? (
        <p className={styles.cardMuted}>{vacio}</p>
      ) : (
        <>
          {onAgregarTodas && (
            <button type="button" className={styles.btnSecondary} onClick={onAgregarTodas}>
              Agregar todas
            </button>
          )}
          <ul className={styles.list}>
            {visibles.map((c) => (
              <li key={c.cancion_id} className={styles.listItem}>
                <div className={styles.listMain}>
                  <span className={styles.listTitle}>{c.titulo}</span>
                  <span className={styles.listSub}>
                    {c.artista} · {etiquetaCobertura(c.cantidad, c.total)}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.btnLink}
                  aria-label={`Agregar ${c.titulo}`}
                  onClick={() => onAgregar(c)}
                >
                  + Agregar
                </button>
              </li>
            ))}
          </ul>
          {canciones.length > VISIBLES && (
            <button type="button" className={styles.btnLink} onClick={() => setTodas((v) => !v)}>
              {todas ? 'Ver menos' : `Ver las ${canciones.length}`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

function BuscarCancion({
  enLista,
  onAgregar,
}: {
  enLista: Set<string>
  onAgregar: (c: CancionCatalogo) => void
}) {
  const [texto, setTexto] = useState('')
  const consulta = useDebounce(texto, 250)
  const { data, isFetching } = useBuscarCatalogo(consulta)
  const resultados = (data ?? []).filter((c) => !enLista.has(c.id))

  return (
    <section className={styles.card} aria-labelledby="rep-buscar">
      <h2 id="rep-buscar" className={styles.cardTitle}>
        Buscar en el catálogo
      </h2>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="rep-buscar-input">
          Título o artista
        </label>
        <input
          id="rep-buscar-input"
          className="input-field"
          placeholder="Ej: Soda Stereo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
        />
      </div>
      {consulta.trim().length >= 2 && (
        <div aria-live="polite">
          {isFetching && <p className={styles.cardMuted}>Buscando…</p>}
          {!isFetching && resultados.length === 0 && (
            <p className={styles.cardMuted}>
              No encontramos temas nuevos con eso. Podés cargarlo desde <Link to="/panel/repertorio">Mi repertorio</Link>.
            </p>
          )}
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
                  aria-label={`Agregar ${c.titulo}`}
                  onClick={() => onAgregar(c)}
                >
                  + Agregar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/** Repertorios anteriores de los músicos elegidos (si hay otros además de mí, sólo cuentan ellos). */
function Historial({
  musicoIds,
  miId,
  excluirId,
  analisis,
  listo,
  onUsar,
}: {
  musicoIds: string[]
  miId: string | undefined
  excluirId: string | null
  analisis: AnalisisFormacion
  listo: boolean
  onUsar: (r: RepertorioResumen) => void
}) {
  const { data: todos, isLoading, isError } = useRepertorios()
  const referencia = musicoIds.length > 1 ? musicoIds.filter((m) => m !== miId) : musicoIds
  const recientes = useMemo(
    () => repertoriosRecientes((todos ?? []).map((r) => ({ ...r, musicoIds: r.musicoIds })), referencia, excluirId),
    // `referencia` is rebuilt on each render; its content is captured by the joined key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todos, referencia.join(','), excluirId],
  )
  const idsMusicos = useMemo(() => [...new Set(recientes.flatMap((r) => r.musicoIds))], [recientes])
  const { data: perfiles } = usePerfilesPorId(idsMusicos)
  const nombres = new Map((perfiles ?? []).map((p) => [p.id, p.nombre ?? p.slug ?? 'Músico']))

  return (
    <section className={styles.card} aria-labelledby="rep-historial">
      <h2 id="rep-historial" className={styles.cardTitle}>
        Últimos repertorios de esta formación
      </h2>
      {isLoading && <p className={styles.cardMuted}>Cargando…</p>}
      {isError && <p className={styles.error}>No se pudo cargar el historial.</p>}
      {todos && recientes.length === 0 && (
        <p className={styles.cardMuted}>Todavía no hay repertorios armados con estos músicos.</p>
      )}
      <ul className={styles.list}>
        {recientes.map((r) => {
          const cobertura = listo ? coberturaRepertorio(r.cancionIds, analisis) : null
          return (
            <li key={r.id} className={styles.listItem}>
              <div className={styles.listMain}>
                <span className={styles.listTitle}>{r.nombre}</span>
                <span className={styles.listSub}>
                  {r.cancionIds.length} {r.cancionIds.length === 1 ? 'tema' : 'temas'} ·{' '}
                  {new Date(r.updated_at).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })}
                </span>
                <span className={styles.wrapSub}>{r.musicoIds.map((m) => nombres.get(m) ?? '…').join(', ')}</span>
                {cobertura && cobertura.total > 0 && (
                  <span className={styles.wrapSub}>
                    {cobertura.porcentaje}% lo sabe esta formación ({cobertura.listas} de {cobertura.total})
                  </span>
                )}
              </div>
              <button type="button" className={styles.btnLink} onClick={() => onUsar(r)}>
                Usar como base
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
