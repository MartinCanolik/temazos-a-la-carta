import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { slugDesdeLink } from '@/lib/canciones'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

/** Pegar el link de otro músico para ver las canciones en común. */
export function Comparar() {
  const navigate = useNavigate()
  const [link, setLink] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const slug = slugDesdeLink(link)
    if (!slug) {
      setError(true)
      return
    }
    navigate(`/m/${slug}`)
  }

  return (
    <PanelLayout>
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>Canciones en común</h1>
      </div>
      <p className={styles.subtitle}>
        ¿Te cruzaste con otro músico? Pedile el link de su perfil y mirá al toque qué temas pueden
        tocar juntos y en qué tono los hace cada uno.
      </p>

      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="comparar-link">
            Link o usuario del otro músico
          </label>
          <input
            id="comparar-link"
            className="input-field"
            placeholder="…/m/juan-perez"
            value={link}
            onChange={(e) => {
              setLink(e.target.value)
              setError(false)
            }}
            required
          />
          {error && <span className={styles.error}>Ese link no parece un perfil de músico.</span>}
        </div>
        <button type="submit" className="btn-primary" disabled={!link.trim()}>
          Comparar
        </button>
      </form>
    </PanelLayout>
  )
}
