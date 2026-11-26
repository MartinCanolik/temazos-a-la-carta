import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SelectUbicacion } from '@/components/SelectUbicacion'
import cardStyles from '@/components/TarjetaShow.module.css'
import { useRankingCanciones, useRankingLugares, useRankingMusicos, useRankingZonas } from '@/hooks/useRankings'
import { buscarOpcion, opcionesUbicacion } from '@/lib/agenda'
import type { PeriodoRanking } from '@/lib/database.types'
import {
  etiquetaCantidad,
  PERIODO_RANKING_INICIAL,
  PERIODOS_RANKING,
  posiciones,
  textoVacioRanking,
  TIPOS_RANKING,
  type TipoRanking,
} from '@/lib/rankings'
import { PanelLayout } from './panel/PanelLayout'
import styles from './panel/panel.module.css'

/** "Rankings" (/rankings): community ranking of musicians, songs and venues. Public, aggregates only. */
export function Rankings() {
  const [tipo, setTipo] = useState<TipoRanking>('musicos')
  const [periodo, setPeriodo] = useState<PeriodoRanking>(PERIODO_RANKING_INICIAL)
  const [ubicacion, setUbicacion] = useState('')

  const zonas = useRankingZonas()
  const opciones = useMemo(() => opcionesUbicacion(zonas.data ?? []), [zonas.data])
  const { ciudad, zona } = buscarOpcion(opciones, ubicacion)
  const filtros = { periodo, ciudad, zona }

  const musicos = useRankingMusicos(filtros, tipo === 'musicos')
  const canciones = useRankingCanciones(filtros, tipo === 'canciones')
  const lugares = useRankingLugares(filtros, tipo === 'lugares')
  const activo = tipo === 'musicos' ? musicos : tipo === 'canciones' ? canciones : lugares

  return (
    <PanelLayout backTo="/" showSignOut={false}>
      <div>
        <p className={styles.kicker}>Comunidad</p>
        <h1 className={styles.title}>Rankings</h1>
        <p className={styles.subtitle}>Quién toca más, qué temas suenan y dónde, con los shows ya realizados.</p>
      </div>

      <div className={styles.segmented} role="group" aria-label="Ranking">
        {TIPOS_RANKING.map((t) => (
          <button
            key={t.valor}
            type="button"
            className={styles.segment}
            aria-pressed={tipo === t.valor}
            onClick={() => setTipo(t.valor)}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      <div className={styles.segmented} role="group" aria-label="Período">
        {PERIODOS_RANKING.map((p) => (
          <button
            key={p.valor}
            type="button"
            className={styles.segment}
            aria-pressed={periodo === p.valor}
            onClick={() => setPeriodo(p.valor)}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <SelectUbicacion opciones={opciones} valor={ubicacion} onChange={setUbicacion} />

      {activo.isLoading && <p className={styles.muted}>Cargando ranking…</p>}
      {activo.isError && (
        <p className={styles.error} role="alert">
          No pudimos cargar el ranking. Probá de nuevo en un rato.
        </p>
      )}

      {!activo.isLoading && !activo.isError && (
        <>
          {tipo === 'musicos' && (
            <Lista
              tipo={tipo}
              filas={(musicos.data ?? []).map((m) => ({
                clave: m.slug,
                cantidad: m.shows,
                principal: <Link to={`/m/${m.slug}`}>{m.nombre ?? m.slug}</Link>,
              }))}
            />
          )}
          {tipo === 'canciones' && (
            <Lista
              tipo={tipo}
              filas={(canciones.data ?? []).map((c) => ({
                clave: `${c.titulo}|${c.artista}`,
                cantidad: c.veces,
                principal: c.titulo,
                secundario: c.artista,
              }))}
            />
          )}
          {tipo === 'lugares' && (
            <Lista
              tipo={tipo}
              filas={(lugares.data ?? []).map((l) => ({
                clave: `${l.lugar}|${l.ciudad ?? ''}`,
                cantidad: l.shows,
                principal: l.lugar,
                secundario: l.ciudad,
              }))}
            />
          )}
        </>
      )}

      <div className={cardStyles.crossLinks}>
        <Link to="/shows">Música en vivo</Link>
      </div>
    </PanelLayout>
  )
}

interface FilaRanking {
  clave: string
  cantidad: number
  principal: ReactNode
  secundario?: string | null
}

function Lista({ tipo, filas }: { tipo: TipoRanking; filas: FilaRanking[] }) {
  if (filas.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.cardMuted}>{textoVacioRanking(tipo)}</p>
      </div>
    )
  }

  const pos = posiciones(filas.map((f) => f.cantidad))
  return (
    <section className={styles.card} aria-label="Ranking">
      <ol className={styles.list}>
        {filas.map((f, i) => (
          <li key={f.clave} className={cardStyles.rankRow}>
            <span className={cardStyles.pos}>{pos[i]}</span>
            <div className={styles.listMain}>
              <span className={styles.listTitle}>{f.principal}</span>
              {f.secundario && <span className={styles.listSub}>{f.secundario}</span>}
            </div>
            <span className={styles.chip}>{etiquetaCantidad(tipo, f.cantidad)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
