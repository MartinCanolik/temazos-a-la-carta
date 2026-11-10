import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { useBorrarToque, useGuardarToque, useSetlist, useToques } from '@/hooks/useToques'
import { useCancionesDe } from '@/hooks/useCancionesMusico'
import { normalizarTexto } from '@/lib/canciones'
import { FORMATOS_SUGERIDOS, MONEDAS, hoyISO } from '@/lib/toques'
import type { CancionMusico, Moneda, Toque } from '@/lib/database.types'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

/** Alta (/panel/toques/nuevo) y edición (/panel/toques/:id) de un toque. */
export function EditarToque() {
  const { id } = useParams<{ id: string }>()
  const esNuevo = !id || id === 'nuevo'
  const { user } = useAuth()
  const { data: toques, isLoading: cargandoToques } = useToques(user?.id)
  const { data: setlist, isLoading: cargandoSetlist } = useSetlist(esNuevo ? undefined : id)
  const { data: canciones } = useCancionesDe(user?.id)

  const toque = esNuevo ? null : (toques ?? []).find((t) => t.id === id) ?? null
  const listo = esNuevo || (!cargandoToques && !cargandoSetlist)

  return (
    <PanelLayout backTo="/panel/toques">
      <div>
        <p className={styles.kicker}>Mis toques</p>
        <h1 className={styles.title}>{esNuevo ? 'Nuevo toque' : 'Editar toque'}</h1>
      </div>

      {!listo && <p className={styles.muted}>Cargando…</p>}
      {listo && !esNuevo && !toque && <p className={styles.muted}>No encontramos ese toque.</p>}
      {listo && (esNuevo || toque) && (
        <ToqueForm
          key={toque?.id ?? 'nuevo'}
          musicoId={user?.id}
          toque={toque}
          setlistInicial={setlist ?? []}
          canciones={canciones ?? []}
        />
      )}
    </PanelLayout>
  )
}

interface ToqueFormProps {
  musicoId: string | undefined
  toque: Toque | null
  setlistInicial: string[]
  canciones: CancionMusico[]
}

function ToqueForm({ musicoId, toque, setlistInicial, canciones }: ToqueFormProps) {
  const navigate = useNavigate()
  const guardar = useGuardarToque(musicoId)
  const borrar = useBorrarToque(musicoId)

  const [fecha, setFecha] = useState(toque?.fecha ?? hoyISO())
  const [hora, setHora] = useState(toque?.hora?.slice(0, 5) ?? '')
  const [lugar, setLugar] = useState(toque?.lugar ?? '')
  const [ciudad, setCiudad] = useState(toque?.ciudad ?? '')
  const [formato, setFormato] = useState(toque?.formato ?? '')
  const [paga, setPaga] = useState(toque?.paga != null ? String(toque.paga) : '')
  const [moneda, setMoneda] = useState<Moneda>(toque?.moneda ?? 'UYU')
  const [conQuien, setConQuien] = useState(toque?.con_quien ?? '')
  const [notas, setNotas] = useState(toque?.notas ?? '')
  const [setlist, setSetlist] = useState<string[]>(setlistInicial)
  const [busqueda, setBusqueda] = useState('')
  const [error, setError] = useState<string | null>(null)

  const porId = useMemo(() => new Map(canciones.map((c) => [c.id, c])), [canciones])
  const q = normalizarTexto(busqueda)
  const sugerencias = useMemo(() => {
    if (!q) return []
    return canciones
      .filter((c) => !setlist.includes(c.id))
      .filter((c) => normalizarTexto(c.titulo).includes(q) || normalizarTexto(c.artista).includes(q))
      .slice(0, 6)
  }, [canciones, setlist, q])

  function mover(idx: number, delta: number) {
    setSetlist((prev) => {
      const next = [...prev]
      const destino = idx + delta
      if (destino < 0 || destino >= next.length) return prev
      ;[next[idx], next[destino]] = [next[destino], next[idx]]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fecha || !lugar.trim()) return
    setError(null)
    const montoNum = paga.trim() ? Number(paga.replace(',', '.')) : null
    if (montoNum != null && (Number.isNaN(montoNum) || montoNum < 0)) {
      setError('La paga tiene que ser un número.')
      return
    }
    try {
      await guardar.mutateAsync({
        id: toque?.id,
        datos: {
          fecha,
          hora: hora || null,
          lugar: lugar.trim(),
          ciudad: ciudad.trim() || null,
          formato: formato.trim() || null,
          paga: montoNum,
          moneda,
          con_quien: conQuien.trim() || null,
          notas: notas.trim() || null,
        },
        setlist,
      })
      navigate('/panel/toques')
    } catch {
      setError('No se pudo guardar el toque. Intentá de nuevo.')
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.card}>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="t-fecha">
              Fecha
            </label>
            <input
              id="t-fecha"
              type="date"
              className="input-field"
              value={fecha}
              required
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className={styles.field} style={{ flex: '0 0 7.5rem' }}>
            <label className={styles.label} htmlFor="t-hora">
              Hora
            </label>
            <input
              id="t-hora"
              type="time"
              className="input-field"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="t-lugar">
            Lugar
          </label>
          <input
            id="t-lugar"
            className="input-field"
            placeholder="Bar, evento, casamiento…"
            value={lugar}
            maxLength={120}
            required
            onChange={(e) => setLugar(e.target.value)}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="t-ciudad">
              Ciudad
            </label>
            <input
              id="t-ciudad"
              className="input-field"
              value={ciudad}
              maxLength={80}
              onChange={(e) => setCiudad(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="t-formato">
              Formato
            </label>
            <input
              id="t-formato"
              className="input-field"
              list="formatos-sugeridos"
              placeholder="Dúo, trío…"
              value={formato}
              maxLength={60}
              onChange={(e) => setFormato(e.target.value)}
            />
            <datalist id="formatos-sugeridos">
              {FORMATOS_SUGERIDOS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="t-paga">
              Paga
            </label>
            <input
              id="t-paga"
              className="input-field"
              inputMode="decimal"
              placeholder="0"
              value={paga}
              onChange={(e) => setPaga(e.target.value)}
            />
          </div>
          <div className={styles.field} style={{ flex: '0 0 6.5rem' }}>
            <label className={styles.label} htmlFor="t-moneda">
              Moneda
            </label>
            <select
              id="t-moneda"
              className={styles.select}
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as Moneda)}
            >
              {MONEDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="t-con">
            Con quién tocaste
          </label>
          <input
            id="t-con"
            className="input-field"
            placeholder="Lu, Cano…"
            value={conQuien}
            maxLength={200}
            onChange={(e) => setConQuien(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="t-notas">
            Notas
          </label>
          <textarea
            id="t-notas"
            className={styles.textarea}
            placeholder="Sonido, contacto del lugar, qué funcionó…"
            value={notas}
            maxLength={1000}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
      </div>

      <section className={styles.card} aria-labelledby="setlist-titulo">
        <h2 id="setlist-titulo" className={styles.cardTitle}>
          Setlist {setlist.length > 0 && `· ${setlist.length}`}
        </h2>

        {canciones.length === 0 ? (
          <p className={styles.cardMuted}>
            Cargá canciones en tu repertorio para armar el setlist.
          </p>
        ) : (
          <>
            <input
              type="search"
              className="input-field"
              placeholder="Buscar en mi repertorio para sumar"
              aria-label="Buscar canción para sumar al setlist"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {sugerencias.length > 0 && (
              <ul className={styles.list}>
                {sugerencias.map((c) => (
                  <li key={c.id} className={styles.listItem}>
                    <div className={styles.listMain}>
                      <span className={styles.listTitle}>{c.titulo}</span>
                      <span className={styles.listSub}>{c.artista}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.btnLink}
                      onClick={() => {
                        setSetlist((prev) => [...prev, c.id])
                        setBusqueda('')
                      }}
                    >
                      + Sumar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {setlist.length > 0 && (
          <ol className={styles.list}>
            {setlist.map((cid, idx) => {
              const c = porId.get(cid)
              return (
                <li key={cid} className={styles.listItem}>
                  <span className={styles.chip}>{idx + 1}</span>
                  <div className={styles.listMain}>
                    <span className={styles.listTitle}>{c?.titulo ?? 'Canción borrada'}</span>
                    {c?.tonalidad && <span className={styles.listSub}>{c.tonalidad}</span>}
                  </div>
                  <button
                    type="button"
                    className={styles.btnLink}
                    aria-label="Subir"
                    disabled={idx === 0}
                    onClick={() => mover(idx, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.btnLink}
                    aria-label="Bajar"
                    disabled={idx === setlist.length - 1}
                    onClick={() => mover(idx, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.btnLink}
                    aria-label={`Quitar ${c?.titulo ?? ''}`}
                    onClick={() => setSetlist((prev) => prev.filter((x) => x !== cid))}
                  >
                    ✕
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {error && <p className={styles.error} style={{ color: 'var(--color-white)' }}>{error}</p>}

      <button
        type="submit"
        className="btn-primary"
        style={{ background: 'var(--color-white)', color: 'var(--color-red)' }}
        disabled={guardar.isPending || !fecha || !lugar.trim()}
      >
        {guardar.isPending ? 'Guardando…' : 'Guardar toque'}
      </button>

      {toque && (
        <button
          type="button"
          className="btn-outline"
          disabled={borrar.isPending}
          onClick={async () => {
            if (!window.confirm('¿Borrar este toque? No se puede deshacer.')) return
            await borrar.mutateAsync(toque.id)
            navigate('/panel/toques')
          }}
        >
          Borrar toque
        </button>
      )}
    </form>
  )
}
