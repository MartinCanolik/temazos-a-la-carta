import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { usePerfilesPorId } from '@/hooks/usePerfiles'
import { useMisCobros, useResponderInvitacion, useShows } from '@/hooks/useShows'
import type { ShowCobro } from '@/lib/database.types'
import {
  dividirAgenda,
  etiquetaEstado,
  etiquetaVisibilidad,
  formatearFecha,
  formatearHora,
  hoyISO,
  invitadoPor,
  necesitaConfirmacion,
  resumenCobro,
  type ShowConParticipantes,
} from '@/lib/shows'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

type Nombres = Map<string, string>

const lugarCorto = (s: ShowConParticipantes) => [s.lugar, s.ciudad].filter(Boolean).join(', ')

/** Agenda de shows (/panel/shows): invitaciones, próximos y anteriores. */
export function Shows() {
  const { user } = useAuth()
  const { data: shows, isLoading, isError } = useShows(!!user)
  const { data: cobros } = useMisCobros(!!user)

  const hoy = hoyISO()
  const agenda = useMemo(() => dividirAgenda(shows ?? [], user?.id, hoy), [shows, user?.id, hoy])

  // Names for the lineup and for whoever invited me (only musicians with a public profile resolve).
  const ids = useMemo(() => {
    const todos = new Set<string>()
    for (const s of shows ?? []) {
      for (const p of s.participantes) todos.add(p.musico_id)
      todos.add(s.creado_por)
    }
    return [...todos]
  }, [shows])
  const { data: perfiles } = usePerfilesPorId(ids)
  const nombres: Nombres = useMemo(
    () => new Map((perfiles ?? []).map((p) => [p.id, p.nombre ?? p.slug ?? 'Músico'])),
    [perfiles],
  )

  const vacio = shows && agenda.invitaciones.length + agenda.proximos.length + agenda.anteriores.length === 0

  return (
    <PanelLayout>
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>Mis shows</h1>
      </div>

      <Link to="/panel/shows/nuevo" className="btn-primary">
        + Cargar un show
      </Link>

      {isLoading && <p className={styles.muted}>Cargando…</p>}
      {isError && <p className={styles.muted}>No se pudieron cargar tus shows.</p>}
      {vacio && (
        <p className={styles.muted}>
          Todavía no tenés shows. Cargá los que tenés agendados y los que ya tocaste: se comparten con los músicos que sumes.
        </p>
      )}

      {agenda.invitaciones.length > 0 && (
        <section className={styles.card} aria-labelledby="invitaciones">
          <h2 id="invitaciones" className={styles.cardTitle}>
            Invitaciones · {agenda.invitaciones.length}
          </h2>
          <ul className={styles.list}>
            {agenda.invitaciones.map((s) => (
              <Invitacion key={s.id} show={s} miId={user?.id} nombres={nombres} />
            ))}
          </ul>
        </section>
      )}

      {agenda.proximos.length > 0 && (
        <ListaShows titulo="Próximos" shows={agenda.proximos} cobros={cobros} hoy={hoy} nombres={nombres} miId={user?.id} />
      )}
      {agenda.anteriores.length > 0 && (
        <ListaShows titulo="Anteriores" shows={agenda.anteriores} cobros={cobros} hoy={hoy} nombres={nombres} miId={user?.id} />
      )}
    </PanelLayout>
  )
}

function ListaShows({
  titulo,
  shows,
  cobros,
  hoy,
  nombres,
  miId,
}: {
  titulo: string
  shows: ShowConParticipantes[]
  cobros: Map<string, ShowCobro> | undefined
  hoy: string
  nombres: Nombres
  miId: string | undefined
}) {
  return (
    <section className={styles.card} aria-label={titulo}>
      <h2 className={styles.cardTitle}>
        {titulo} · {shows.length}
      </h2>
      <ul className={styles.list}>
        {shows.map((s) => {
          const cobro = cobros?.get(s.id)
          const otros = s.participantes
            .filter((p) => p.estado === 'aceptado' && p.musico_id !== miId)
            .map((p) => nombres.get(p.musico_id) ?? 'Músico')
          return (
            <li key={s.id}>
              <Link to={`/panel/shows/${s.id}`} className={styles.listItem} style={{ alignItems: 'flex-start' }}>
                <div className={styles.listMain}>
                  <span className={styles.listTitle}>{s.nombre}</span>
                  <span className={styles.wrapSub}>
                    {[formatearFecha(s.fecha), formatearHora(s.hora), lugarCorto(s)].filter(Boolean).join(' · ')}
                  </span>
                  {otros.length > 0 && <span className={styles.wrapSub}>Con {otros.join(', ')}</span>}
                  <div className={styles.badges} style={{ marginTop: '0.3rem' }}>
                    <span className={styles.chip}>{etiquetaEstado(s.estado)}</span>
                    <span className={styles.chip}>{etiquetaVisibilidad(s.visibilidad)}</span>
                    {necesitaConfirmacion(s, hoy) && (
                      <span className={`${styles.badge} ${styles.badgePrep}`}>Confirmar temas</span>
                    )}
                    {cobro && <span className={`${styles.badge} ${styles.badgeOk}`}>{resumenCobro(cobro)}</span>}
                  </div>
                </div>
                <span aria-hidden="true" style={{ color: 'rgba(0,0,0,0.35)' }}>
                  ›
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Invitación pendiente con aceptar / rechazar. */
function Invitacion({
  show,
  miId,
  nombres,
}: {
  show: ShowConParticipantes
  miId: string | undefined
  nombres: Nombres
}) {
  const responder = useResponderInvitacion()
  const [error, setError] = useState<string | null>(null)
  const quien = invitadoPor(show, miId)
  const lineup = show.participantes
    .filter((p) => p.musico_id !== miId)
    .map((p) => nombres.get(p.musico_id) ?? 'Músico')

  async function contestar(aceptar: boolean) {
    setError(null)
    try {
      await responder.mutateAsync({ showId: show.id, aceptar })
    } catch {
      setError('No se pudo responder. Probá de nuevo.')
    }
  }

  return (
    <li className={styles.setlistRow}>
      <div className={styles.listMain}>
        <Link to={`/panel/shows/${show.id}`} className={styles.listTitle}>
          {show.nombre}
        </Link>
        <span className={styles.wrapSub}>
          {[formatearFecha(show.fecha), formatearHora(show.hora), lugarCorto(show)].filter(Boolean).join(' · ')}
        </span>
        <span className={styles.wrapSub}>
          Te invitó {(quien && nombres.get(quien)) ?? 'un músico'}
          {lineup.length > 0 && ` · Con ${lineup.join(', ')}`}
        </span>
      </div>
      <div className={styles.setlistActions}>
        <button
          type="button"
          className="btn-primary"
          style={{ padding: '0.4rem 1rem' }}
          disabled={responder.isPending}
          aria-label={`Aceptar invitación a ${show.nombre}`}
          onClick={() => void contestar(true)}
        >
          Aceptar
        </button>
        <button
          type="button"
          className={styles.btnSecondary}
          style={{ padding: '0.4rem 1rem' }}
          disabled={responder.isPending}
          aria-label={`Rechazar invitación a ${show.nombre}`}
          onClick={() => void contestar(false)}
        >
          Rechazar
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </li>
  )
}
