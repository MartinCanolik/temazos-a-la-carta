import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/authContext'
import { PanelLayout } from './panel/PanelLayout'
import styles from './panel/panel.module.css'

/** Ingreso de músicos con link mágico por mail (sin contraseña). */
export function Login() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/panel'

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  if (!loading && session) return <Navigate to={from} replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${from}` },
    })
    setStatus(error ? 'error' : 'sent')
  }

  return (
    <PanelLayout backTo="/" showSignOut={false}>
      <div>
        <p className={styles.kicker}>Área de músicos</p>
        <h1 className={styles.title}>Entrá a tu panel</h1>
      </div>
      <p className={styles.subtitle}>
        Cargá tu perfil, las canciones que tocás y registrá tus toques. Compartí tu perfil con
        otros músicos y mirá qué temas tienen en común.
      </p>

      <div className={styles.card}>
        {status === 'sent' ? (
          <>
            <p className={styles.cardTitle}>📬 Revisá tu mail</p>
            <p className={styles.cardMuted}>
              Te mandamos un link a <strong>{email.trim()}</strong>. Abrilo desde este mismo
              dispositivo para entrar. Si no llega, fijate en spam.
            </p>
            <button type="button" className={styles.btnSecondary} onClick={() => setStatus('idle')}>
              Usar otro mail
            </button>
          </>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="login-email">
                Tu mail
              </label>
              <input
                id="login-email"
                type="email"
                className="input-field"
                placeholder="vos@mail.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'sending'}
              />
              <span className={styles.hint}>
                Sin contraseña: te llega un link para entrar. Si es tu primera vez, se crea tu
                cuenta de músico.
              </span>
            </div>

            {status === 'error' && (
              <p className={styles.error}>No pudimos mandar el mail. Probá de nuevo en un rato.</p>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={status === 'sending' || !email.trim()}
            >
              {status === 'sending' ? 'Enviando…' : 'Mandame el link'}
            </button>
          </form>
        )}
      </div>
    </PanelLayout>
  )
}
