import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/authContext'
import { useGoogleHabilitado } from '@/hooks/useAuthSettings'
import { PanelLayout } from './panel/PanelLayout'
import styles from './panel/panel.module.css'

/** Ingreso de músicos con link mágico por mail (sin contraseña). */
export function Login() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/panel'

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'redirecting' | 'error'>('idle')
  const googleHabilitado = useGoogleHabilitado()

  if (!loading && session) return <Navigate to={from} replace />

  async function handleGoogle() {
    setGoogleStatus('redirecting')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${from}` },
    })
    if (error) setGoogleStatus('error')
  }

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
        Cargá tu perfil, las canciones que tocás y registrá tus shows. Compartí tu perfil con
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
          <>
            {googleHabilitado && (
              <>
                <button
                  type="button"
                  className={styles.btnGoogle}
                  onClick={handleGoogle}
                  disabled={googleStatus === 'redirecting'}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
                    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.800l7.900-6.1z" />
                    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.900-5.800l-7.600-5.9c-2.1 1.400-4.8 2.300-8.3 2.300-6.3 0-11.600-4.100-13.500-9.800l-7.9 6.100C6.5 42.6 14.6 48 24 48z" />
                  </svg>
                  {googleStatus === 'redirecting' ? 'Redirigiendo…' : 'Entrar con Google'}
                </button>
                {googleStatus === 'error' && (
                  <p className={styles.error}>
                    No pudimos entrar con Google. Probá de nuevo o usá tu mail.
                  </p>
                )}
                <p className={styles.divider}>o con tu mail</p>
              </>
            )}
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
          </>
        )}
      </div>
    </PanelLayout>
  )
}
