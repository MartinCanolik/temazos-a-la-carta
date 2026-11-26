import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SelectUbicacion } from '@/components/SelectUbicacion'
import { TarjetaShow } from '@/components/TarjetaShow'
import cardStyles from '@/components/TarjetaShow.module.css'
import { useAgendaLugares, useAgendaPublica } from '@/hooks/useAgenda'
import {
  agruparPorFecha,
  buscarOpcion,
  CHIP_INICIAL,
  CHIPS_FECHA,
  etiquetaDia,
  opcionesUbicacion,
  rangoChip,
  type ChipFecha,
} from '@/lib/agenda'
import { hoyISO } from '@/lib/shows'
import { PanelLayout } from './panel/PanelLayout'
import styles from './panel/panel.module.css'

/** "Música en vivo" (/shows): upcoming public shows, no login needed. */
export function MusicaEnVivo() {
  const hoy = useMemo(() => hoyISO(), [])
  const [chip, setChip] = useState<ChipFecha>(CHIP_INICIAL)
  const [ubicacion, setUbicacion] = useState('')

  const lugares = useAgendaLugares()
  const opciones = useMemo(() => opcionesUbicacion(lugares.data ?? []), [lugares.data])
  const { ciudad, zona } = buscarOpcion(opciones, ubicacion)
  const rango = rangoChip(chip, hoy)

  const agenda = useAgendaPublica({ desde: rango.desde, hasta: rango.hasta, ciudad, zona })
  const grupos = useMemo(() => agruparPorFecha(agenda.data ?? []), [agenda.data])

  return (
    <PanelLayout backTo="/" showSignOut={false}>
      <div>
        <p className={styles.kicker}>Shows en vivo</p>
        <h1 className={styles.title}>Música en vivo</h1>
        <p className={styles.subtitle}>Los próximos shows de los músicos de la comunidad.</p>
      </div>

      <div className={styles.segmented} role="group" aria-label="Fecha">
        {CHIPS_FECHA.map((c) => (
          <button
            key={c.valor}
            type="button"
            className={styles.segment}
            aria-pressed={chip === c.valor}
            onClick={() => setChip(c.valor)}
          >
            {c.etiqueta}
          </button>
        ))}
      </div>

      <SelectUbicacion opciones={opciones} valor={ubicacion} onChange={setUbicacion} />

      {agenda.isLoading && <p className={styles.muted}>Cargando shows…</p>}
      {agenda.isError && (
        <p className={styles.error} role="alert">
          No pudimos cargar los shows. Probá de nuevo en un rato.
        </p>
      )}

      {!agenda.isLoading && !agenda.isError && grupos.length === 0 && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>No hay shows para este filtro</p>
          <p className={styles.cardMuted}>
            Probá con otra fecha o ciudad. Si sos músico, podés publicar tus shows desde el panel.
          </p>
        </div>
      )}

      {grupos.map((g) => (
        <section key={g.fecha} className={cardStyles.group} aria-label={etiquetaDia(g.fecha, hoy)}>
          <h2 className={cardStyles.day}>{etiquetaDia(g.fecha, hoy)}</h2>
          <ul className={cardStyles.cards}>
            {g.items.map((s) => (
              <li key={s.id}>
                <TarjetaShow show={s} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className={cardStyles.crossLinks}>
        <Link to="/rankings">Rankings de la comunidad</Link>
      </div>
    </PanelLayout>
  )
}
