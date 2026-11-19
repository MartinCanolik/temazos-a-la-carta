import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { useDebounce } from '@/hooks/useDebounce'
import { useBuscarPerfiles, usePerfilesPorSlug } from '@/hooks/usePerfiles'
import { useRepertoriosDe } from '@/hooks/useRepertoriosDe'
import { normalizarTexto, slugDesdeLink } from '@/lib/canciones'
import {
  analizarFormacion,
  compatibilidad,
  etiquetaCobertura,
  type CancionAnalizada,
  type MusicoFormacion,
} from '@/lib/compatibilidad'
import type { Profile } from '@/lib/database.types'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

/** Máximo de músicos además de uno mismo. */
const MAX_OTROS = 7

interface Miembro {
  id: string
  nombre: string
  slug: string | null
}

/** Armar una formación: elegí músicos y mirá qué saben todos y qué hay que ensayar. La selección vive en ?m=slug1,slug2. */
export function Formacion() {
  const { profile: miPerfil, user } = useAuth()
  const [params, setParams] = useSearchParams()

  const slugs = useMemo(() => {
    const crudos = (params.get('m') ?? '').split(',').map((s) => slugDesdeLink(s))
    const validos = crudos.filter((s): s is string => !!s && s !== miPerfil?.slug)
    return [...new Set(validos)]
  }, [params, miPerfil?.slug])

  const { data: perfiles, isLoading: cargandoPerfiles, isError: errorPerfiles } = usePerfilesPorSlug(slugs)

  // Keep the URL order and drop slugs that do not resolve to a public profile.
  const otros = useMemo(() => {
    const porSlug = new Map((perfiles ?? []).map((p) => [p.slug, p]))
    return slugs.map((s) => porSlug.get(s)).filter((p): p is Profile => !!p)
  }, [slugs, perfiles])
  const noEncontrados = perfiles ? slugs.filter((s) => !perfiles.some((p) => p.slug === s)) : []

  const miembros = useMemo<Miembro[]>(() => {
    const yo = user?.id ? [{ id: user.id, nombre: miPerfil?.nombre ?? 'Yo', slug: miPerfil?.slug ?? null }] : []
    return [...yo, ...otros.map((p) => ({ id: p.id, nombre: p.nombre ?? p.slug ?? 'Músico', slug: p.slug }))]
  }, [user?.id, miPerfil, otros])

  const { data: repertorios, isLoading: cargandoRep, isError: errorRep } = useRepertoriosDe(
    miembros.map((m) => m.id),
  )

  const musicos = useMemo<MusicoFormacion[]>(
    () => miembros.map((m) => ({ id: m.id, nombre: m.nombre, canciones: repertorios?.[m.id] ?? [] })),
    [miembros, repertorios],
  )

  function setSlugs(nuevos: string[]) {
    const next = new URLSearchParams(params)
    if (nuevos.length > 0) next.set('m', nuevos.join(','))
    else next.delete('m')
    setParams(next, { replace: true })
  }

  const agregar = (slug: string) => {
    if (slugs.includes(slug) || slug === miPerfil?.slug || slugs.length >= MAX_OTROS) return
    setSlugs([...slugs, slug])
  }
  const quitar = (slug: string | null) => setSlugs(slugs.filter((s) => s !== slug))

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

      <ChipsFormacion miembros={miembros} miId={user?.id} onQuitar={quitar} noEncontrados={noEncontrados} />

      <AgregarMusico
        excluirId={user?.id}
        seleccionados={slugs}
        lleno={slugs.length >= MAX_OTROS}
        onAgregar={agregar}
      />

      {slugs.length === 0 && (
        <p className={styles.muted}>Sumá al menos a un músico para comparar repertorios.</p>
      )}
      {slugs.length > 0 && (cargandoPerfiles || cargandoRep) && (
        <p className={styles.muted}>Comparando repertorios…</p>
      )}
      {(errorPerfiles || errorRep) && (
        <p className={styles.error}>No se pudo cargar la formación. Probá de nuevo.</p>
      )}

      {repertorios && !cargandoPerfiles && otros.length > 0 && <Resultado musicos={musicos} />}

      <Link to="/panel/comparar" className={styles.muted} style={{ textAlign: 'center' }}>
        Comparar con un solo músico
      </Link>
    </PanelLayout>
  )
}

function ChipsFormacion({
  miembros,
  miId,
  onQuitar,
  noEncontrados,
}: {
  miembros: Miembro[]
  miId: string | undefined
  onQuitar: (slug: string | null) => void
  noEncontrados: string[]
}) {
  return (
    <section
      aria-label="Músicos de la formación"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
    >
      <div className={styles.chips}>
        {miembros.map((m) =>
          m.id === miId ? (
            <span key={m.id} className={styles.chipRemovable} style={{ paddingRight: '0.75rem' }}>
              {m.nombre} (vos)
            </span>
          ) : (
            <span key={m.id} className={styles.chipRemovable}>
              {m.nombre}
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Quitar a ${m.nombre}`}
                onClick={() => onQuitar(m.slug)}
              >
                ×
              </button>
            </span>
          ),
        )}
      </div>
      {noEncontrados.map((s) => (
        <p key={s} className={styles.error}>
          No encontramos a «{s}».{' '}
          <button type="button" className={styles.btnLink} onClick={() => onQuitar(s)}>
            Sacar
          </button>
        </p>
      ))}
    </section>
  )
}

const ES_LINK = /\/m\//

function AgregarMusico({
  excluirId,
  seleccionados,
  lleno,
  onAgregar,
}: {
  excluirId: string | undefined
  seleccionados: string[]
  lleno: boolean
  onAgregar: (slug: string) => void
}) {
  const [texto, setTexto] = useState('')
  const [errorLink, setErrorLink] = useState(false)
  const debounced = useDebounce(texto, 300)
  const { data: resultados, isFetching } = useBuscarPerfiles(debounced, excluirId)

  const disponibles = (resultados ?? []).filter((p) => p.slug && !seleccionados.includes(p.slug))
  const pegoLink = ES_LINK.test(texto)

  function agregarLink(e: React.FormEvent) {
    e.preventDefault()
    // A pasted link (".../m/slug") is added directly; plain text is only a search.
    if (!pegoLink) return
    const slug = slugDesdeLink(texto)
    if (!slug) {
      setErrorLink(true)
      return
    }
    onAgregar(slug)
    setTexto('')
  }

  return (
    <form className={styles.card} onSubmit={agregarLink}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="formacion-buscar">
          Sumar un músico
        </label>
        <input
          id="formacion-buscar"
          className="input-field"
          placeholder="Nombre, usuario o link de perfil"
          value={texto}
          disabled={lleno}
          onChange={(e) => {
            setTexto(e.target.value)
            setErrorLink(false)
          }}
          autoComplete="off"
        />
        {lleno && <span className={styles.hint}>Llegaste al máximo de músicos por formación.</span>}
        {errorLink && <span className={styles.error}>Ese link no parece un perfil de músico.</span>}
      </div>

      {!lleno && !pegoLink && debounced.trim().length >= 2 && (
        <div aria-live="polite">
          {isFetching && <p className={styles.cardMuted}>Buscando…</p>}
          {!isFetching && disponibles.length === 0 && (
            <p className={styles.cardMuted}>No encontramos músicos con ese nombre.</p>
          )}
          <ul className={styles.list}>
            {disponibles.map((p) => (
              <li key={p.id} className={styles.listItem}>
                <button
                  type="button"
                  className={`${styles.listMain} ${styles.resultButton}`}
                  onClick={() => {
                    onAgregar(p.slug!)
                    setTexto('')
                  }}
                  aria-label={`Sumar a ${p.nombre ?? p.slug}`}
                >
                  <span className={styles.listTitle}>{p.nombre ?? p.slug}</span>
                  <span className={styles.listSub}>
                    {[p.ciudad, p.instrumentos.join(', ')].filter(Boolean).join(' · ') || `/m/${p.slug}`}
                  </span>
                </button>
                <span className={styles.chip} aria-hidden="true">
                  + Sumar
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pegoLink && (
        <button type="submit" className="btn-primary">
          Sumar con este link
        </button>
      )}
    </form>
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
