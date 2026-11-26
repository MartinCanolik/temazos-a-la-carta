import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { useFormacion } from '@/hooks/useFormacion'
import { usePerfilesPorId } from '@/hooks/usePerfiles'
import { useRepertorio, useRepertorios } from '@/hooks/useRepertorios'
import {
  useBorrarShow,
  useGuardarShow,
  useMisCobros,
  useResponderInvitacion,
  useSalirDeShow,
  useShow,
} from '@/hooks/useShows'
import { analizarFormacion, coberturaRepertorio } from '@/lib/compatibilidad'
import type { EstadoCobro, EstadoShow, Moneda, ShowCobro, VisibilidadShow } from '@/lib/database.types'
import {
  ESTADOS_SHOW,
  MONEDAS,
  VISIBILIDADES,
  construirCobro,
  construirDatosShow,
  etiquetaCobro,
  etiquetaEstado,
  etiquetaParticipacion,
  etiquetaVisibilidad,
  explicarVisibilidad,
  formatearFecha,
  formatearHora,
  hoyISO,
  invitadoPor,
  miEstado,
  musicosAGuardar,
  necesitaConfirmacion,
  urlValida,
  type ShowConParticipantes,
} from '@/lib/shows'
import { AgregarMusico } from './FormacionPicker'
import { ConfirmarTemas } from './ConfirmarTemas'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

/** Alta (/panel/shows/nuevo) y edición (/panel/shows/:id) de un show compartido. */
export function EditarShow() {
  const { id } = useParams<{ id: string }>()
  const esNuevo = !id || id === 'nuevo'
  const { user } = useAuth()
  const { data: show, isLoading, isError } = useShow(esNuevo ? undefined : id)
  const { data: cobros, isLoading: cargandoCobros } = useMisCobros(!!user)

  const titulo = esNuevo ? 'Nuevo show' : 'Show'
  const cabecera = (
    <div>
      <p className={styles.kicker}>Mis shows</p>
      <h1 className={styles.title}>{titulo}</h1>
    </div>
  )

  if (!esNuevo && (isLoading || cargandoCobros)) {
    return (
      <PanelLayout backTo="/panel/shows">
        {cabecera}
        <p className={styles.muted}>Cargando…</p>
      </PanelLayout>
    )
  }
  if (!esNuevo && (isError || !show)) {
    return (
      <PanelLayout backTo="/panel/shows">
        {cabecera}
        <p className={styles.error} style={{ color: 'var(--color-white)' }}>
          {isError ? 'No se pudo cargar el show. Probá de nuevo.' : 'No encontramos ese show.'}
        </p>
        <Link to="/panel/shows" className="btn-outline">
          Ver mis shows
        </Link>
      </PanelLayout>
    )
  }

  // Invited (or declined) musicians see the details and the answer buttons, not the editor.
  if (show && miEstado(show, user?.id) !== 'aceptado') {
    return (
      <PanelLayout backTo="/panel/shows">
        {cabecera}
        <Invitacion show={show} miId={user?.id} />
      </PanelLayout>
    )
  }

  return (
    <PanelLayout backTo="/panel/shows">
      {cabecera}
      <Formulario key={show?.id ?? 'nuevo'} show={show ?? null} cobro={show ? cobros?.get(show.id) ?? null : null} />
    </PanelLayout>
  )
}

// ─── Invitation view ────────────────────────────────────────────────────────

function Invitacion({ show, miId }: { show: ShowConParticipantes; miId: string | undefined }) {
  const responder = useResponderInvitacion()
  const [error, setError] = useState<string | null>(null)
  const estado = miEstado(show, miId)
  const quien = invitadoPor(show, miId)
  const ids = [...new Set([...show.participantes.map((p) => p.musico_id), ...(quien ? [quien] : [])])]
  const { data: perfiles } = usePerfilesPorId(ids)
  const nombre = (id: string) => perfiles?.find((p) => p.id === id)?.nombre ?? 'Músico'

  async function contestar(aceptar: boolean) {
    setError(null)
    try {
      await responder.mutateAsync({ showId: show.id, aceptar })
    } catch {
      setError('No se pudo responder. Probá de nuevo.')
    }
  }

  return (
    <section className={styles.card} aria-labelledby="invitacion-titulo">
      <h2 id="invitacion-titulo" className={styles.cardTitle}>
        {estado === 'rechazado' ? 'Rechazaste esta invitación' : `Te invitaron a ${show.nombre}`}
      </h2>
      <p className={styles.cardMuted}>
        {[formatearFecha(show.fecha), formatearHora(show.hora), show.lugar, show.ciudad].filter(Boolean).join(' · ')}
      </p>
      <p className={styles.cardMuted}>Te invitó {quien ? nombre(quien) : 'un músico'}.</p>
      <ul className={styles.list} aria-label="Músicos del show">
        {show.participantes.map((p) => (
          <li key={p.musico_id} className={styles.listItem}>
            <span className={styles.listTitle}>{p.musico_id === miId ? 'Vos' : nombre(p.musico_id)}</span>
            <span className={styles.chip}>{etiquetaParticipacion(p.estado)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.cardMuted}>El show recién cuenta en tu agenda y tus estadísticas cuando lo aceptás.</p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.setlistActions}>
        <button type="button" className="btn-primary" disabled={responder.isPending} onClick={() => void contestar(true)}>
          Aceptar
        </button>
        {estado === 'pendiente' && (
          <button type="button" className={styles.btnSecondary} disabled={responder.isPending} onClick={() => void contestar(false)}>
            Rechazar
          </button>
        )}
      </div>
    </section>
  )
}

// ─── Editor ─────────────────────────────────────────────────────────────────

function Formulario({ show, cobro }: { show: ShowConParticipantes | null; cobro: ShowCobro | null }) {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [params] = useSearchParams()
  const f = useFormacion()
  const guardar = useGuardarShow()
  const borrar = useBorrarShow()
  const salir = useSalirDeShow()
  const { data: misRepertoriosLista } = useRepertorios()
  // The setlist already linked to the show may belong to someone else's lineup; keep it selectable.
  const { data: repertorioDelShow } = useRepertorio(show?.repertorio_id ?? undefined)
  const repertorios = useMemo(
    () =>
      repertorioDelShow && !misRepertoriosLista?.some((r) => r.id === repertorioDelShow.id)
        ? [...(misRepertoriosLista ?? []), repertorioDelShow]
        : misRepertoriosLista,
    [misRepertoriosLista, repertorioDelShow],
  )

  const hoy = hoyISO()
  const miId = user?.id
  const soyCreador = !show || show.creado_por === miId

  // ── Form state
  const [nombre, setNombre] = useState(show?.nombre ?? '')
  const [fecha, setFecha] = useState(show?.fecha ?? hoy)
  const [hora, setHora] = useState(show?.hora?.slice(0, 5) ?? '')
  const [lugar, setLugar] = useState(show?.lugar ?? '')
  const [ciudad, setCiudad] = useState(show?.ciudad ?? '')
  const [zona, setZona] = useState(show?.zona ?? '')
  const [estado, setEstado] = useState<EstadoShow>(show?.estado ?? 'programado')
  const [visibilidad, setVisibilidad] = useState<VisibilidadShow>(show?.visibilidad ?? 'privado')
  const [entradaInfo, setEntradaInfo] = useState(show?.entrada_info ?? '')
  const [entradaUrl, setEntradaUrl] = useState(show?.entrada_url ?? '')
  const [invitados, setInvitados] = useState(show?.invitados ?? '')
  const [notas, setNotas] = useState(show?.notas ?? '')
  const [repertorioId, setRepertorioId] = useState(show?.repertorio_id ?? '')
  const [importe, setImporte] = useState(cobro ? String(cobro.importe) : '')
  const [moneda, setMoneda] = useState<Moneda>(cobro?.moneda ?? 'UYU')
  const [estadoCobro, setEstadoCobro] = useState<EstadoCobro>(cobro?.estado_cobro ?? 'pendiente')
  const [cobradoEn, setCobradoEn] = useState(cobro?.cobrado_en ?? '')
  const [notasCobro, setNotasCobro] = useState(cobro?.notas ?? '')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Lineup: seeded from the show's participants (as ?m=slugs) the first time
  const existentes = useMemo(() => show?.participantes.map((p) => p.musico_id) ?? [], [show])
  const otrosExistentes = useMemo(() => existentes.filter((id) => id !== miId), [existentes, miId])
  const { data: perfilesExistentes, isError: errorPerfiles } = usePerfilesPorId(otrosExistentes)
  const [sembrado, setSembrado] = useState(otrosExistentes.length === 0 || !!params.get('m'))
  useEffect(() => {
    if (sembrado) return
    // A failed profile fetch must not block saving: participants are kept by id, shown as «Músico».
    if (errorPerfiles) {
      setSembrado(true)
      return
    }
    if (!perfilesExistentes) return
    const slugs = perfilesExistentes.map((p) => p.slug).filter((s): s is string => !!s)
    if (slugs.length > 0) f.setSlugs(slugs)
    setSembrado(true)
  }, [sembrado, perfilesExistentes, errorPerfiles, f])

  const resolubles = useMemo(
    () => new Set((perfilesExistentes ?? []).filter((p) => p.slug).map((p) => p.id)),
    [perfilesExistentes],
  )
  const estadoDe = (id: string) => show?.participantes.find((p) => p.musico_id === id)?.estado ?? null
  const nombreDe = (id: string) => (id === miId ? (profile?.nombre ?? 'Vos') : perfilesExistentes?.find((p) => p.id === id)?.nombre ?? 'Músico')
  const miembroIds = f.miembros.map((m) => m.id)
  // Existing participants the form cannot show as chips (no public profile): listed read-only.
  const sinChip = existentes.filter((id) => id !== miId && !miembroIds.includes(id) && !resolubles.has(id))
  const lineupListo = sembrado && !f.cargandoPerfiles

  // ── Setlist and coverage for the current lineup
  const misRepertorios = useMemo(
    () => (repertorios ?? []).filter((r) => r.id === show?.repertorio_id || r.creado_por === miId || r.musicoIds.includes(miId ?? '')),
    [repertorios, miId, show?.repertorio_id],
  )
  const elegido = repertorios?.find((r) => r.id === repertorioId)
  const analisis = useMemo(() => analizarFormacion(f.musicos), [f.musicos])
  const cobertura = elegido && f.repertorios && lineupListo ? coberturaRepertorio(elegido.cancionIds, analisis) : null

  const hoyOPasado = !!show && (show.fecha <= hoy || show.estado === 'realizado') && show.estado !== 'cancelado'
  const faltaConfirmar = !!show && necesitaConfirmacion(show, hoy)

  async function handleGuardar() {
    setError(null)
    setMensaje(null)
    if (!nombre.trim()) return setError('Poné un nombre para el show.')
    if (!fecha) return setError('Elegí la fecha.')
    if (!urlValida(entradaUrl)) return setError('El link de entradas tiene que empezar con http:// o https://.')
    const cobroPayload = construirCobro({ importe, moneda, estado: estadoCobro, cobradoEn, notas: notasCobro }, hoy)
    if (!cobroPayload) return setError('El cobro tiene que ser un número.')

    const { agregar, quitar } = musicosAGuardar(miembroIds, existentes, resolubles)
    if (!soyCreador && quitar.length > 0) {
      return setError('Sólo quien creó el show puede sacar músicos. Volvé a sumarlos para guardar.')
    }

    try {
      await guardar.mutateAsync({
        id: show?.id ?? null,
        datos: construirDatosShow({
          nombre, fecha, hora, lugar, ciudad, zona, estado, visibilidad, entradaInfo, entradaUrl, repertorioId, invitados, notas,
        }),
        musicoIds: agregar,
        quitarIds: quitar,
        cobro: cobroPayload,
      })
      if (!show) navigate('/panel/shows', { replace: true })
      else setMensaje('Show guardado ✓')
    } catch (e) {
      const code = (e as { code?: string } | null)?.code
      setError(
        code === '42501'
          ? 'No tenés permiso para hacer ese cambio (sólo quien creó el show puede sacar músicos).'
          : 'No se pudo guardar el show. Revisá los datos y probá de nuevo.',
      )
    }
  }

  async function handleBorrar() {
    if (!show || !window.confirm('¿Borrar este show para todos los músicos? No se puede deshacer.')) return
    setError(null)
    try {
      await borrar.mutateAsync(show.id)
      navigate('/panel/shows', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar el show.')
    }
  }

  async function handleSalir() {
    if (!show || !window.confirm('¿Salir de este show? Se borra también tu cobro.')) return
    setError(null)
    try {
      await salir.mutateAsync(show.id)
      navigate('/panel/shows', { replace: true })
    } catch {
      setError('No se pudo salir del show. Probá de nuevo.')
    }
  }

  const confirmar = show && hoyOPasado && (
    <ConfirmarTemas showId={show.id} repertorioId={show.repertorio_id} confirmado={!!show.canciones_confirmadas_en} />
  )

  return (
    <>
      {faltaConfirmar && confirmar}

      <section className={styles.card} aria-label="Datos del show">
        <div className={styles.field}>
          <label className={styles.label} htmlFor="s-nombre">
            Nombre
          </label>
          <input
            id="s-nombre"
            className="input-field"
            placeholder="Ej: Noche de covers"
            value={nombre}
            maxLength={120}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="s-fecha">
              Fecha
            </label>
            <input id="s-fecha" type="date" className="input-field" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className={styles.field} style={{ flex: '0 0 7.5rem' }}>
            <label className={styles.label} htmlFor="s-hora">
              Hora
            </label>
            <input id="s-hora" type="time" className="input-field" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="s-lugar">
            Lugar
          </label>
          <input
            id="s-lugar"
            className="input-field"
            placeholder="Bar, sala, evento…"
            value={lugar}
            maxLength={120}
            onChange={(e) => setLugar(e.target.value)}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="s-ciudad">
              Ciudad
            </label>
            <input id="s-ciudad" className="input-field" value={ciudad} maxLength={80} onChange={(e) => setCiudad(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="s-zona">
              Zona / barrio
            </label>
            <input id="s-zona" className="input-field" value={zona} maxLength={80} onChange={(e) => setZona(e.target.value)} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="s-estado">
              Estado
            </label>
            <select id="s-estado" className={styles.select} value={estado} onChange={(e) => setEstado(e.target.value as EstadoShow)}>
              {ESTADOS_SHOW.map((e) => (
                <option key={e} value={e}>
                  {etiquetaEstado(e)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="s-visibilidad">
              Visibilidad
            </label>
            <select
              id="s-visibilidad"
              className={styles.select}
              value={visibilidad}
              aria-describedby="s-visibilidad-ayuda"
              onChange={(e) => setVisibilidad(e.target.value as VisibilidadShow)}
            >
              {VISIBILIDADES.map((v) => (
                <option key={v} value={v}>
                  {etiquetaVisibilidad(v)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p id="s-visibilidad-ayuda" className={styles.hint}>
          {explicarVisibilidad(visibilidad)}
        </p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="s-entrada-info">
            Entradas (precio, cómo reservar)
          </label>
          <input
            id="s-entrada-info"
            className="input-field"
            placeholder="Ej: $500 en boletería"
            value={entradaInfo}
            maxLength={300}
            onChange={(e) => setEntradaInfo(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="s-entrada-url">
            Link de entradas
          </label>
          <input
            id="s-entrada-url"
            type="url"
            className="input-field"
            placeholder="https://…"
            value={entradaUrl}
            maxLength={300}
            onChange={(e) => setEntradaUrl(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="s-notas">
            Notas
          </label>
          <textarea
            id="s-notas"
            className={styles.textarea}
            placeholder="Sonido, horarios, contacto del lugar…"
            value={notas}
            maxLength={1000}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
      </section>

      <section className={styles.card} aria-labelledby="s-musicos">
        <h2 id="s-musicos" className={styles.cardTitle}>
          Músicos
        </h2>
        <p className={styles.cardMuted}>
          Cada músico que sumes recibe una invitación. El show cuenta en su agenda cuando la acepta.
        </p>
        <ul className={styles.list}>
          {f.miembros.map((m) => {
            const est = estadoDe(m.id)
            const existente = est !== null
            const puedeSacar = m.id !== miId && (!existente || soyCreador)
            return (
              <li key={m.id} className={styles.listItem}>
                <span className={styles.listTitle}>{m.id === miId ? `${nombreDe(m.id)} (vos)` : m.nombre}</span>
                <span className={styles.chip}>{est ? etiquetaParticipacion(est) : 'Se invita al guardar'}</span>
                {puedeSacar && (
                  <button type="button" className={styles.btnLink} aria-label={`Sacar a ${m.nombre}`} onClick={() => f.quitar(m.slug)}>
                    Sacar
                  </button>
                )}
              </li>
            )
          })}
          {sinChip.map((id) => (
            <li key={id} className={styles.listItem}>
              <span className={styles.listTitle}>{nombreDe(id)}</span>
              <span className={styles.chip}>{etiquetaParticipacion(estadoDe(id)!)}</span>
            </li>
          ))}
        </ul>
        {errorPerfiles && (
          <p className={styles.hint} role="status">
            No pudimos cargar los nombres de los músicos invitados. Se mantienen igual al guardar.
          </p>
        )}
        {f.noEncontrados.map((s) => (
          <p key={s} className={styles.error}>
            No encontramos a «{s}».{' '}
            <button type="button" className={styles.btnLink} onClick={() => f.quitar(s)}>
              Sacar
            </button>
          </p>
        ))}
        {show && !soyCreador && (
          <p className={styles.hint}>Sólo quien creó el show puede sacar a otros músicos.</p>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="s-invitados">
            Invitados sin cuenta
          </label>
          <input
            id="s-invitados"
            className="input-field"
            placeholder="Ej: Lu (percusión), Cano (saxo)"
            value={invitados}
            maxLength={200}
            onChange={(e) => setInvitados(e.target.value)}
          />
          <span className={styles.hint}>Sólo aparecen como texto: no suman a estadísticas ni rankings.</span>
        </div>
      </section>

      <AgregarMusico excluirId={miId} seleccionados={f.slugs} lleno={f.lleno} onAgregar={f.agregar} />
      {f.cargandoPerfiles && <p className={styles.muted}>Cargando músicos…</p>}
      {f.error && <p className={styles.error}>No se pudo cargar la formación. Probá de nuevo.</p>}

      <section className={styles.card} aria-labelledby="s-repertorio">
        <h2 id="s-repertorio" className={styles.cardTitle}>
          Repertorio
        </h2>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="s-rep">
            Repertorio del show
          </label>
          <select id="s-rep" className={styles.select} value={repertorioId} onChange={(e) => setRepertorioId(e.target.value)}>
            <option value="">Sin repertorio</option>
            {misRepertorios.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre} · {r.cancionIds.length} {r.cancionIds.length === 1 ? 'tema' : 'temas'}
              </option>
            ))}
          </select>
        </div>
        {cobertura && cobertura.total > 0 && (
          <p className={styles.cardMuted} role="status">
            {cobertura.porcentaje}% del repertorio lo sabe toda la formación ({cobertura.listas} de {cobertura.total}).
            {cobertura.requierenPreparacion.length > 0 && ` Hay ${cobertura.requierenPreparacion.length} para preparar.`}
          </p>
        )}
        <Link
          to={`/panel/repertorios/nuevo${f.slugs.length > 0 ? `?m=${f.slugs.join(',')}` : ''}`}
          className={styles.btnLink}
        >
          Armar uno con esta formación →
        </Link>
      </section>

      <section className={styles.card} aria-labelledby="s-cobro" style={{ border: '2px dashed var(--color-red)' }}>
        <h2 id="s-cobro" className={styles.cardTitle}>
          🔒 Tu cobro (solo lo ves vos)
        </h2>
        <p className={styles.cardMuted}>Los demás músicos no ven este dato, ni en el show ni en ningún ranking.</p>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="s-importe">
              Importe
            </label>
            <input
              id="s-importe"
              className="input-field"
              inputMode="decimal"
              placeholder="0"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
            />
          </div>
          <div className={styles.field} style={{ flex: '0 0 6.5rem' }}>
            <label className={styles.label} htmlFor="s-moneda">
              Moneda
            </label>
            <select id="s-moneda" className={styles.select} value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
              {MONEDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="s-estado-cobro">
              Estado del cobro
            </label>
            <select
              id="s-estado-cobro"
              className={styles.select}
              value={estadoCobro}
              onChange={(e) => setEstadoCobro(e.target.value as EstadoCobro)}
            >
              {(['pendiente', 'cobrado'] as EstadoCobro[]).map((c) => (
                <option key={c} value={c}>
                  {etiquetaCobro(c)}
                </option>
              ))}
            </select>
          </div>
          {estadoCobro === 'cobrado' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="s-cobrado-en">
                Cobrado el
              </label>
              <input
                id="s-cobrado-en"
                type="date"
                className="input-field"
                value={cobradoEn || hoy}
                onChange={(e) => setCobradoEn(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="s-notas-cobro">
            Nota del cobro (opcional)
          </label>
          <input
            id="s-notas-cobro"
            className="input-field"
            value={notasCobro}
            maxLength={500}
            onChange={(e) => setNotasCobro(e.target.value)}
          />
        </div>
      </section>

      {error && (
        <p className={styles.error} style={{ color: 'var(--color-white)' }} role="alert">
          {error}
        </p>
      )}
      {mensaje && (
        <p className={styles.success} style={{ color: 'var(--color-white)' }} role="status">
          {mensaje}
        </p>
      )}

      <button
        type="button"
        className="btn-primary"
        style={{ background: 'var(--color-white)', color: 'var(--color-red)' }}
        disabled={guardar.isPending || !lineupListo}
        onClick={() => void handleGuardar()}
      >
        {guardar.isPending ? 'Guardando…' : show ? 'Guardar cambios' : 'Guardar show'}
      </button>

      {show && soyCreador && (
        <button type="button" className="btn-outline" disabled={borrar.isPending} onClick={() => void handleBorrar()}>
          Borrar show
        </button>
      )}
      {show && !soyCreador && (
        <button type="button" className="btn-outline" disabled={salir.isPending} onClick={() => void handleSalir()}>
          Salir del show
        </button>
      )}

      {!faltaConfirmar && confirmar}
    </>
  )
}
