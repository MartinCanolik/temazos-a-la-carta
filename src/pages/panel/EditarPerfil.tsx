import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/authContext'
import { INSTRUMENTOS_SUGERIDOS, SLUG_REGEX, perfilUrl, slugify } from '@/lib/perfil'
import type { Profile } from '@/lib/database.types'
import { PanelLayout } from './PanelLayout'
import styles from './panel.module.css'

export function EditarPerfil() {
  const { profile } = useAuth()

  return (
    <PanelLayout>
      <div>
        <p className={styles.kicker}>Panel de músico</p>
        <h1 className={styles.title}>Mi perfil</h1>
      </div>
      {/* key: re-monta el formulario cuando llega el perfil */}
      {profile ? <PerfilForm key={profile.id} profile={profile} /> : <p className={styles.muted}>Cargando…</p>}
    </PanelLayout>
  )
}

function PerfilForm({ profile }: { profile: Profile }) {
  const { refreshProfile } = useAuth()
  const queryClient = useQueryClient()

  const [nombre, setNombre] = useState(profile.nombre ?? '')
  const [slug, setSlug] = useState(profile.slug ?? '')
  const [slugTocado, setSlugTocado] = useState(!!profile.slug)
  const [instrumentos, setInstrumentos] = useState<string[]>(profile.instrumentos ?? [])
  const [otroInstrumento, setOtroInstrumento] = useState('')
  const [ciudad, setCiudad] = useState(profile.ciudad ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [whatsapp, setWhatsapp] = useState(profile.whatsapp ?? '')
  const [instagram, setInstagram] = useState(profile.instagram ?? '')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const slugValido = SLUG_REGEX.test(slug) && slug.length >= 3

  function toggleInstrumento(nombreInstr: string) {
    setInstrumentos((prev) =>
      prev.includes(nombreInstr) ? prev.filter((i) => i !== nombreInstr) : [...prev, nombreInstr],
    )
  }

  function agregarOtro() {
    const valor = otroInstrumento.trim()
    if (!valor || instrumentos.some((i) => i.toLowerCase() === valor.toLowerCase())) return
    setInstrumentos((prev) => [...prev, valor].slice(0, 12))
    setOtroInstrumento('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !slugValido) return
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: err } = await supabase
      .from('profiles')
      .update({
        nombre: nombre.trim(),
        slug,
        instrumentos,
        ciudad: ciudad.trim() || null,
        bio: bio.trim() || null,
        whatsapp: whatsapp.trim() || null,
        instagram: instagram.trim() || null,
      })
      .eq('id', profile.id)

    setSaving(false)
    if (err) {
      setError(
        err.code === '23505'
          ? 'Ese link ya lo usa otro músico. Probá con otro.'
          : 'No se pudo guardar. Intentá de nuevo.',
      )
      return
    }
    setSaved(true)
    await refreshProfile()
    void queryClient.invalidateQueries({ queryKey: ['perfil'] })
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="perfil-nombre">
          Nombre artístico
        </label>
        <input
          id="perfil-nombre"
          className="input-field"
          value={nombre}
          maxLength={80}
          required
          onChange={(e) => {
            setNombre(e.target.value)
            if (!slugTocado) setSlug(slugify(e.target.value))
          }}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="perfil-slug">
          Tu link
        </label>
        <input
          id="perfil-slug"
          className="input-field"
          value={slug}
          maxLength={40}
          required
          onChange={(e) => {
            setSlugTocado(true)
            setSlug(slugify(e.target.value))
          }}
        />
        <span className={styles.hint}>
          {slugValido ? perfilUrl(slug) : 'Mínimo 3 caracteres: letras, números y guiones.'}
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Instrumentos</span>
        <div className={styles.chips}>
          {[...INSTRUMENTOS_SUGERIDOS, ...instrumentos.filter((i) => !(INSTRUMENTOS_SUGERIDOS as readonly string[]).includes(i))].map(
            (instr) => {
              const activo = instrumentos.includes(instr)
              return (
                <button
                  key={instr}
                  type="button"
                  className={styles.chip}
                  aria-pressed={activo}
                  style={
                    activo
                      ? { background: 'var(--color-red)', color: 'var(--color-white)' }
                      : undefined
                  }
                  onClick={() => toggleInstrumento(instr)}
                >
                  {instr}
                </button>
              )
            },
          )}
        </div>
        <div className={styles.row}>
          <input
            className="input-field"
            placeholder="Otro (ej: Ukelele)"
            value={otroInstrumento}
            maxLength={30}
            onChange={(e) => setOtroInstrumento(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                agregarOtro()
              }
            }}
          />
          <button
            type="button"
            className={styles.btnSecondary}
            style={{ flex: '0 0 auto' }}
            onClick={agregarOtro}
          >
            Sumar
          </button>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="perfil-ciudad">
          Ciudad
        </label>
        <input
          id="perfil-ciudad"
          className="input-field"
          placeholder="Montevideo"
          value={ciudad}
          maxLength={80}
          onChange={(e) => setCiudad(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="perfil-bio">
          Sobre vos
        </label>
        <textarea
          id="perfil-bio"
          className={styles.textarea}
          placeholder="Con quién tocás, estilos, experiencia…"
          value={bio}
          maxLength={600}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="perfil-wa">
            WhatsApp
          </label>
          <input
            id="perfil-wa"
            className="input-field"
            type="tel"
            placeholder="+598 99 123 456"
            value={whatsapp}
            maxLength={30}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="perfil-ig">
            Instagram
          </label>
          <input
            id="perfil-ig"
            className="input-field"
            placeholder="@usuario"
            value={instagram}
            maxLength={60}
            onChange={(e) => setInstagram(e.target.value)}
          />
        </div>
      </div>
      <span className={styles.hint}>
        Todo lo que cargues acá se ve en tu perfil público, incluido el WhatsApp.
      </span>

      {error && <p className={styles.error}>{error}</p>}
      {saved && (
        <p className={styles.success}>
          ¡Guardado! <Link to={`/m/${slug}`}>Ver mi perfil público →</Link>
        </p>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={saving || !nombre.trim() || !slugValido}
      >
        {saving ? 'Guardando…' : 'Guardar perfil'}
      </button>
    </form>
  )
}
