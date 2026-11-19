import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { usePerfilesPorId } from '@/hooks/usePerfiles'
import { useNombresRepertorios } from '@/hooks/useRepertorios'
import { useMarcarCobrado, useMisCobros, useShows, useTocadasDeMisShows } from '@/hooks/useShows'
import {
  anchoBarra,
  calcularEstadisticas,
  PERIODO_INICIAL,
  PERIODOS,
  type CobroPendiente,
  type Estadisticas as Stats,
  type Periodo,
} from '@/lib/estadisticas'
import { formatearFecha, formatearPlata, hoyISO } from '@/lib/shows'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

const veces = (n: number) => `${n} ${n === 1 ? 'show' : 'shows'}`

/** "Tus números" (/panel/estadisticas): shows, lugares, compañeros, temas, repertorios y plata del período. */
export function Estadisticas() {
  const { user } = useAuth()
  const miId = user?.id
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_INICIAL)

  const shows = useShows(!!miId)
  const cobros = useMisCobros(!!miId)
  const tocadas = useTocadasDeMisShows(!!miId)

  const hoy = hoyISO()
  const stats = useMemo(
    () =>
      calcularEstadisticas({
        shows: shows.data ?? [],
        miId,
        cobros: cobros.data ?? new Map(),
        tocadas: tocadas.data ?? [],
        periodo,
        hoy,
      }),
    [shows.data, cobros.data, tocadas.data, miId, periodo, hoy],
  )

  const idsCoMusicos = useMemo(() => stats.coMusicos.map((c) => c.musico_id), [stats.coMusicos])
  const perfiles = usePerfilesPorId(idsCoMusicos)
  const idsRepertorios = useMemo(() => stats.repertorios.map((r) => r.repertorio_id), [stats.repertorios])
  const nombresRepertorios = useNombresRepertorios(idsRepertorios)

  const cargando = shows.isLoading || cobros.isLoading || tocadas.isLoading
  const fallo = shows.isError || cobros.isError || tocadas.isError

  return (
    <PanelLayout>
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>Tus números</h1>
      </div>

      <div className={styles.segmented} role="group" aria-label="Período">
        {PERIODOS.map((p) => (
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

      {cargando && <p className={styles.muted}>Cargando…</p>}
      {fallo && (
        <p className={styles.error} role="alert">
          No pudimos cargar todos tus datos, así que algunos números pueden estar incompletos. Probá de nuevo en un rato.
        </p>
      )}

      {!cargando && (
        <>
          <div className={styles.stats}>
            <Tile valor={stats.realizados} etiqueta="shows realizados" />
            <Tile valor={stats.proximos} etiqueta="próximos" />
            <Tile valor={stats.temasDistintos} etiqueta="temas distintos tocados" />
          </div>

          <Plata stats={stats} hoy={hoy} />

          <Seccion id="lugares" titulo="📍 Lugares" hay={stats.lugares.length > 0} vacio="Todavía no hay shows realizados con lugar en este período.">
            <>
              <ol className={styles.list}>
                {stats.lugares.map((l) => (
                  <Barra
                    key={l.clave}
                    principal={l.lugar}
                    secundario={l.ciudad}
                    valor={l.shows}
                    maximo={stats.lugares[0].shows}
                    texto={veces(l.shows)}
                  />
                ))}
              </ol>
            </>
          </Seccion>

          <Seccion id="con-quien" titulo="🤝 Con quién tocás" hay={stats.coMusicos.length > 0} vacio="Cuando compartas shows realizados con otros músicos, van a aparecer acá.">
            <>
              <ol className={styles.list}>
                {stats.coMusicos.map((c) => {
                  const perfil = perfiles.data?.find((p) => p.id === c.musico_id)
                  return (
                    <Barra
                      key={c.musico_id}
                      principal={perfil?.nombre ?? 'Músico'}
                      enlace={perfil?.slug ? `/m/${perfil.slug}` : undefined}
                      valor={c.shows}
                      maximo={stats.coMusicos[0].shows}
                      texto={veces(c.shows)}
                    />
                  )
                })}
              </ol>
            </>
          </Seccion>

          <Seccion
            id="temas"
            hay={stats.temas.length > 0}
            titulo="🔥 Temas que más tocás"
            vacio="Confirmá los temas tocados de tus shows realizados y van a aparecer acá."
          >
            <>
              <ol className={styles.list}>
                {stats.temas.map((t) => (
                  <Barra
                    key={t.cancion_id}
                    principal={t.titulo}
                    secundario={t.artista}
                    valor={t.shows}
                    maximo={stats.temas[0].shows}
                    texto={veces(t.shows)}
                  />
                ))}
              </ol>
            </>
          </Seccion>

          <Seccion id="repertorios" titulo="📋 Repertorios usados" hay={stats.repertorios.length > 0} vacio="Ningún show del período tiene un repertorio asociado."
            pie={
              <Link to="/panel/repertorios" className={styles.btnLink}>
                Ver todos los repertorios →
              </Link>
            }
          >
            <>
              <ul className={styles.list}>
                {stats.repertorios.map((r) => (
                  <li key={r.show_id} className={styles.listItem}>
                    <div className={styles.listMain}>
                      <Link to={`/panel/repertorios/${r.repertorio_id}`} className={styles.listTitle}>
                        {nombresRepertorios.data?.get(r.repertorio_id) ?? 'Repertorio'}
                      </Link>
                      <span className={styles.listSub}>
                        {r.show} · {formatearFecha(r.fecha)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          </Seccion>
        </>
      )}
    </PanelLayout>
  )
}

function Tile({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{valor}</span>
      <span className={styles.statLabel}>{etiqueta}</span>
    </div>
  )
}

function Seccion({ id, titulo, hay, vacio, pie, children }: { id: string; titulo: string; hay: boolean; vacio: string; pie?: ReactNode; children?: ReactNode }) {
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {titulo}
      </h2>
      {hay ? children : <p className={styles.cardMuted}>{vacio}</p>}
      {pie}
    </section>
  )
}

/** One row of a top list: name, count and a bar relative to the first place. */
function Barra({
  principal,
  secundario,
  enlace,
  valor,
  maximo,
  texto,
}: {
  principal: string
  secundario?: string | null
  enlace?: string
  valor: number
  maximo: number
  texto: string
}) {
  return (
    <li className={styles.listItem}>
      <div className={styles.listMain}>
        {enlace ? (
          <Link to={enlace} className={styles.listTitle}>
            {principal}
          </Link>
        ) : (
          <span className={styles.listTitle}>{principal}</span>
        )}
        {secundario && <span className={styles.listSub}>{secundario}</span>}
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${anchoBarra(valor, maximo)}%` }} />
        </span>
      </div>
      <span className={styles.chip}>{texto}</span>
    </li>
  )
}

// ─── Plata ──────────────────────────────────────────────────────────────────

function Plata({ stats, hoy }: { stats: Stats; hoy: string }) {
  const { plata } = stats
  return (
    <section className={styles.card} aria-labelledby="plata">
      <h2 id="plata" className={styles.cardTitle}>
        💰 Plata
      </h2>
      <p className={styles.cardMuted}>🔒 Solo lo ves vos. Cada moneda va por separado.</p>

      {plata.monedas.length === 0 ? (
        <p className={styles.cardMuted}>No hay cachets cargados en este período.</p>
      ) : (
        plata.monedas.map((m) => (
          <div key={m} className={styles.plataMoneda}>
            <span className={styles.plataTitulo}>{m}</span>
            <div className={styles.plataGrid}>
              <Monto etiqueta="Cobrado" valor={plata.cobrado[m]} moneda={m} ok />
              <Monto etiqueta="Pendiente de cobro" valor={plata.pendiente[m]} moneda={m} />
              <Monto etiqueta="Previsto" valor={plata.previsto[m]} moneda={m} />
            </div>
          </div>
        ))
      )}

      {stats.cobrosPendientes.length > 0 && (
        <>
          <h3 className={styles.plataTitulo}>A cobrar</h3>
          <ul className={styles.list}>
            {stats.cobrosPendientes.map((c) => (
              <CobroPendienteFila key={c.show_id} cobro={c} hoy={hoy} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function Monto({ etiqueta, valor, moneda, ok }: { etiqueta: string; valor: number | undefined; moneda: 'UYU' | 'USD' | 'ARS'; ok?: boolean }) {
  return (
    <div className={styles.plataMonto}>
      <span className={ok && valor ? styles.plataOk : styles.plataValor}>
        {valor == null ? '—' : formatearPlata(valor, moneda)}
      </span>
      <span className={styles.plataEtiqueta}>{etiqueta}</span>
    </div>
  )
}

function CobroPendienteFila({ cobro, hoy }: { cobro: CobroPendiente; hoy: string }) {
  const marcar = useMarcarCobrado()
  return (
    <li className={styles.setlistRow}>
      <div className={styles.listMain}>
        <Link to={`/panel/shows/${cobro.show_id}`} className={styles.listTitle}>
          {cobro.show}
        </Link>
        <span className={styles.wrapSub}>
          {formatearFecha(cobro.fecha)} · {formatearPlata(cobro.importe, cobro.moneda)}
        </span>
        {marcar.isError && (
          <span className={styles.error} role="alert">
            No se pudo marcar como cobrado. Probá de nuevo.
          </span>
        )}
      </div>
      <button
        type="button"
        className={styles.toggleBtn}
        disabled={marcar.isPending}
        aria-label={`Marcar cobrado ${cobro.show}`}
        onClick={() => marcar.mutate({ showId: cobro.show_id, hoy })}
      >
        {marcar.isPending ? 'Guardando…' : 'Marcar cobrado'}
      </button>
    </li>
  )
}
