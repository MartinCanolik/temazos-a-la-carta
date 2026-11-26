import { Link } from 'react-router-dom'
import type { AgendaPublicaFila } from '@/lib/database.types'
import { lineaInvitados, lineaLugar, urlEntradaSegura } from '@/lib/agenda'
import { formatearHora } from '@/lib/shows'
import styles from './TarjetaShow.module.css'

interface TarjetaShowProps {
  show: AgendaPublicaFila
  /** The detail page: no name link (it is the page title). */
  detalle?: boolean
  /** A musician to leave out of the lineup (the profile being viewed). */
  sinMusico?: string
}

/** A public show: when, where, who plays and how to get in. Only public data reaches this component. */
export function TarjetaShow({ show, detalle = false, sinMusico }: TarjetaShowProps) {
  const hora = formatearHora(show.hora)
  const lugar = lineaLugar(show)
  const invitados = lineaInvitados(show.invitados)
  const entradaUrl = urlEntradaSegura(show.entrada_url)
  const musicos = show.musicos.filter((m) => m.slug !== sinMusico)

  return (
    <article className={styles.card}>
      {/* The detail page already shows the name as its title */}
      {(!detalle || hora) && (
        <div className={styles.head}>
          {detalle ? (
            <span />
          ) : (
            <Link to={`/shows/${show.id}`} className={styles.name}>
              {show.nombre}
            </Link>
          )}
          {hora && <span className={styles.hora}>{hora}</span>}
        </div>
      )}

      {lugar && <p className={styles.where}>📍 {lugar}</p>}

      {(musicos.length > 0 || invitados) && (
        <p className={styles.lineup}>
          {musicos.map((m, i) => (
            <span key={m.slug}>
              {i > 0 && ', '}
              <Link to={`/m/${m.slug}`}>{m.nombre ?? m.slug}</Link>
            </span>
          ))}
          {musicos.length > 0 && invitados && ' · '}
          {invitados}
        </p>
      )}

      {show.entrada_info && <p className={styles.entrada}>🎟 {show.entrada_info}</p>}

      {entradaUrl && (
        <a className={`btn-primary ${styles.cta}`} href={entradaUrl} target="_blank" rel="noopener noreferrer">
          Entradas / reservar
        </a>
      )}
    </article>
  )
}
