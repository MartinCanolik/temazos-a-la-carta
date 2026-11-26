import { useState } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { useBuscarPerfiles } from '@/hooks/usePerfiles'
import { slugDesdeLink } from '@/lib/canciones'
import type { Miembro } from '@/lib/formacion'
import styles from './panel.module.css'

/** Chips de los músicos de la formación y buscador para sumar más. Compartido por Formación y el armador de repertorios. */
export function ChipsFormacion({
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

export function AgregarMusico({
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
