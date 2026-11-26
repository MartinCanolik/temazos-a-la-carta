import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFormacion } from '@/hooks/useFormacion'
import { normalizarTexto } from '@/lib/canciones'
import {
  analizarFormacion,
  compatibilidad,
  etiquetaCobertura,
  type CancionAnalizada,
  type MusicoFormacion,
} from '@/lib/compatibilidad'
import { PanelLayout } from './PanelLayout'
import { AgregarMusico, ChipsFormacion } from './FormacionPicker'
import styles from './panel.module.css'

/** Armar una formación: elegí músicos y mirá qué saben todos y qué hay que ensayar. La selección vive en ?m=slug1,slug2. */
export function Formacion() {
  const f = useFormacion()

  return (
    <PanelLayout>
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>Formación</h1>
      </div>
      <p className={styles.subtitle}>
        Sumá a los músicos con los que vas a tocar y mirá qué temas saben todos y cuáles hay que
        ensayar. Compartí el link de esta pantalla para que otros vean la misma formación.
      </p>

      <ChipsFormacion miembros={f.miembros} miId={f.miId} onQuitar={f.quitar} noEncontrados={f.noEncontrados} />

      <AgregarMusico excluirId={f.miId} seleccionados={f.slugs} lleno={f.lleno} onAgregar={f.agregar} />

      {f.slugs.length === 0 && <p className={styles.muted}>Sumá al menos a un músico para comparar repertorios.</p>}
      {f.cargando && <p className={styles.muted}>Comparando repertorios…</p>}
      {f.error && <p className={styles.error}>No se pudo cargar la formación. Probá de nuevo.</p>}

      {f.repertorios && !f.cargandoPerfiles && f.otros.length > 0 && (
        <>
          <Link
            to={`/panel/repertorios/nuevo?m=${f.slugs.join(',')}`}
            className="btn-primary"
            style={{ textAlign: 'center' }}
          >
            🎼 Armar repertorio con esta formación
          </Link>
          <Resultado musicos={f.musicos} />
        </>
      )}

      <Link to="/panel/comparar" className={styles.muted} style={{ textAlign: 'center' }}>
        Comparar con un solo músico
      </Link>
    </PanelLayout>
  )
}

function Resultado({ musicos }: { musicos: MusicoFormacion[] }) {
  const [filtro, setFiltro] = useState('')
  const analisis = useMemo(() => analizarFormacion(musicos), [musicos])

  const pares = useMemo(() => {
    const out: { a: string; b: string; enComun: number; porcentaje: number }[] = []
    for (let i = 0; i < musicos.length; i++) {
      for (let j = i + 1; j < musicos.length; j++) {
        const c = compatibilidad(
          musicos[i].canciones.map((x) => x.cancion_id),
          musicos[j].canciones.map((x) => x.cancion_id),
        )
        out.push({ a: musicos[i].nombre, b: musicos[j].nombre, enComun: c.enComun, porcentaje: c.porcentaje })
      }
    }
    return out.sort((x, y) => y.porcentaje - x.porcentaje)
  }, [musicos])

  const q = normalizarTexto(filtro)
  const filtrar = (lista: CancionAnalizada[]) =>
    q ? lista.filter((c) => normalizarTexto(`${c.titulo} ${c.artista}`).includes(q)) : lista
  const todos = filtrar(analisis.todos)
  const parcial = filtrar(analisis.parcial)

  return (
    <>
      <div className={styles.stats} role="group" aria-label="Resumen de la formación">
        <div className={styles.stat}>
          <span className={styles.statValue}>{analisis.total}</span>
          <span className={styles.statLabel}>músicos</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analisis.todos.length}</span>
          <span className={styles.statLabel}>las saben todos</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{analisis.parcial.length}</span>
          <span className={styles.statLabel}>a ensayar</span>
        </div>
      </div>

      <section className={styles.card} aria-labelledby="formacion-pares">
        <h2 id="formacion-pares" className={styles.cardTitle}>
          {pares.length === 1 ? 'Compatibilidad' : 'Compatibilidad de a dos'}
        </h2>
        {pares.length === 1 ? (
          <>
            <span className={styles.pct}>{pares[0].porcentaje}%</span>
            <p className={styles.cardMuted}>
              {pares[0].porcentaje}% de compatibilidad · {pares[0].enComun}{' '}
              {pares[0].enComun === 1 ? 'canción' : 'canciones'} en común
            </p>
          </>
        ) : (
          <ul className={styles.list}>
            {pares.map((p) => (
              <li key={`${p.a}|${p.b}`} className={styles.listItem}>
                <div className={styles.listMain}>
                  <span className={styles.listTitle}>
                    {p.a} + {p.b}
                  </span>
                  <span className={styles.listSub}>
                    {p.enComun} {p.enComun === 1 ? 'canción' : 'canciones'} en común
                  </span>
                </div>
                <span className={styles.chip}>{p.porcentaje}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {analisis.canciones.length === 0 ? (
        <p className={styles.muted}>Todavía nadie de la formación cargó canciones.</p>
      ) : (
        <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="formacion-filtro">
              Filtrar canciones
            </label>
            <input
              id="formacion-filtro"
              className="input-field"
              placeholder="Título o artista"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>

          <ListaCanciones
            id="formacion-todos"
            titulo={`✅ Las saben todos · ${todos.length}`}
            vacio={q ? 'Ninguna coincide con el filtro.' : 'Todavía no hay temas que sepan todos.'}
            canciones={todos}
          />
          <ListaCanciones
            id="formacion-parcial"
            titulo={`🛠 Las sabe una parte · ${parcial.length}`}
            vacio={q ? 'Ninguna coincide con el filtro.' : 'No hay temas que haya que ensayar.'}
            canciones={parcial}
          />
        </>
      )}
    </>
  )
}

function ListaCanciones({
  id,
  titulo,
  vacio,
  canciones,
}: {
  id: string
  titulo: string
  vacio: string
  canciones: CancionAnalizada[]
}) {
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {titulo}
      </h2>
      {canciones.length === 0 ? (
        <p className={styles.cardMuted}>{vacio}</p>
      ) : (
        <ul className={styles.list}>
          {canciones.map((c) => (
            <li key={c.cancion_id} className={styles.listItem}>
              <div className={styles.listMain}>
                <span className={styles.listTitle}>{c.titulo}</span>
                <span className={styles.listSub}>{c.artista}</span>
                <span className={styles.wrapSub}>{etiquetaCobertura(c.cantidad, c.total)}</span>
                <span className={styles.wrapSub}>
                  {c.conocen
                    .map((k) => {
                      const extra = [k.tonalidad, k.version, k.instrumento].filter(Boolean).join(', ')
                      return extra ? `${k.nombre} (${extra})` : k.nombre
                    })
                    .join(' · ')}
                </span>
              </div>
              {c.tonalidadesDistintas && (
                <span className={styles.chip} title="La tocan en distinta tonalidad">
                  ⚠ tono
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
