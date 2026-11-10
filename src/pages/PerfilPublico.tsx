import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePerfilPublico } from '@/hooks/usePerfiles'
import { useCancionesDe } from '@/hooks/useCancionesMusico'
import { useAuth } from '@/auth/authContext'
import { instagramUrl, perfilUrl, whatsappUrl } from '@/lib/perfil'
import { PanelLayout } from './panel/PanelLayout'
import styles from './panel/panel.module.css'

/** Perfil público de un músico: /m/:slug */
export function PerfilPublico() {
  const { slug } = useParams<{ slug: string }>()
  const { data: perfil, isLoading, isError } = usePerfilPublico(slug)
  const { profile: miPerfil } = useAuth()
  const [copiado, setCopiado] = useState(false)

  const esMio = !!perfil && miPerfil?.id === perfil.id

  async function compartir() {
    if (!perfil?.slug) return
    const url = perfilUrl(perfil.slug)
    const shareData = { title: perfil.nombre ?? 'Músico', text: 'Mirá mi perfil de músico', url }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // cancelado por el usuario → caemos a copiar
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.prompt('Copiá el link de tu perfil:', url)
    }
  }

  return (
    <PanelLayout backTo={miPerfil ? '/panel' : '/'} showSignOut={false}>
      {isLoading && <p className={styles.muted}>Cargando perfil…</p>}
      {isError && <p className={styles.muted}>No se pudo cargar el perfil.</p>}
      {!isLoading && !isError && !perfil && (
        <p className={styles.muted}>No encontramos ese perfil. Revisá el link.</p>
      )}

      {perfil && (
        <>
          <div>
            <p className={styles.kicker}>Músico{perfil.ciudad ? ` · ${perfil.ciudad}` : ''}</p>
            <h1 className={styles.title}>{perfil.nombre}</h1>
          </div>

          {perfil.instrumentos.length > 0 && (
            <div className={styles.chips}>
              {perfil.instrumentos.map((i) => (
                <span
                  key={i}
                  className={styles.chip}
                  style={{ background: 'var(--color-white)', color: 'var(--color-red)' }}
                >
                  {i}
                </span>
              ))}
            </div>
          )}

          {perfil.bio && <p className={styles.subtitle}>{perfil.bio}</p>}

          <div className={styles.row}>
            {perfil.whatsapp && (
              <a className="btn-outline" href={whatsappUrl(perfil.whatsapp)} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            )}
            {perfil.instagram && (
              <a className="btn-outline" href={instagramUrl(perfil.instagram)} target="_blank" rel="noreferrer">
                Instagram
              </a>
            )}
          </div>

          <button type="button" className="btn-primary" onClick={() => void compartir()}>
            {copiado ? '¡Link copiado!' : esMio ? 'Compartir mi perfil' : 'Compartir perfil'}
          </button>

          {esMio && (
            <Link to="/panel/perfil" className={styles.muted} style={{ textAlign: 'center' }}>
              Editar mi perfil
            </Link>
          )}

          <RepertorioPublico musicoId={perfil.id} />
        </>
      )}
    </PanelLayout>
  )
}

function RepertorioPublico({ musicoId }: { musicoId: string }) {
  const { data: canciones, isLoading } = useCancionesDe(musicoId)

  if (isLoading) return <p className={styles.muted}>Cargando repertorio…</p>
  if (!canciones || canciones.length === 0) return null

  return (
    <section className={styles.card} aria-labelledby="repertorio-publico">
      <h2 id="repertorio-publico" className={styles.cardTitle}>
        Repertorio · {canciones.length} {canciones.length === 1 ? 'canción' : 'canciones'}
      </h2>
      <ul className={styles.list}>
        {canciones.map((c) => (
          <li key={c.id} className={styles.listItem}>
            <div className={styles.listMain}>
              <span className={styles.listTitle}>{c.titulo}</span>
              <span className={styles.listSub}>{c.artista}</span>
            </div>
            {c.tonalidad && <span className={styles.chip}>{c.tonalidad}</span>}
            {c.version && <span className={styles.chip}>{c.version}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
