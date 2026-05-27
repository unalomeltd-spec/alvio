'use client'

import { useState, useEffect, useRef, MouseEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function ripple(e: MouseEvent<HTMLButtonElement>) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const s = document.createElement('span')
  s.className = 'ripple-span'
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`
  el.appendChild(s)
  setTimeout(() => s.remove(), 600)
}

type Mode = 'login' | 'register'

interface AuthModalProps {
  open: boolean
  defaultMode?: Mode
  onClose: () => void
}

export default function AuthModal({ open, defaultMode = 'login', onClose }: AuthModalProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showPwd2, setShowPwd2] = useState(false)
  const [shake, setShake] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({ name: '', email: '', password: '', password2: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')

  const firstInputRef = useRef<HTMLInputElement>(null)

  // Reset on open / mode change
  useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', password: '', password2: '' })
      setErrors({})
      setGlobalError('')
      setSuccess(false)
      setLoading(false)
      setTimeout(() => firstInputRef.current?.focus(), 200)
    }
  }, [open, mode])

  useEffect(() => { setMode(defaultMode) }, [defaultMode])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
    setGlobalError('')
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (mode === 'register' && !form.name.trim()) e.name = 'Votre nom est requis'
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Email invalide'
    if (form.password.length < 8) e.password = 'Minimum 8 caractères'
    if (mode === 'register' && form.password !== form.password2) e.password2 = 'Les mots de passe ne correspondent pas'
    setErrors(e)
    if (Object.keys(e).length) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: MouseEvent<HTMLButtonElement>) => {
    ripple(e)
    if (!validate()) return
    setLoading(true)
    setGlobalError('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (error) throw error
        router.push('/dashboard')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { full_name: form.name } },
        })
        if (error) throw error
        // If email confirmation required
        if (data.user && !data.session) {
          setSuccess(true)
        } else {
          router.push('/dashboard')
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      const fr: Record<string, string> = {
        'Invalid login credentials': 'Email ou mot de passe incorrect',
        'Email not confirmed': 'Vérifiez votre email pour confirmer votre compte',
        'User already registered': 'Un compte existe déjà avec cet email',
        'Password should be at least 6 characters': 'Le mot de passe doit faire au moins 8 caractères',
      }
      setGlobalError(fr[msg] || msg)
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(26,26,26,.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        animation: 'overlay-in .2s ease forwards',
      }}
    >
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 32px 80px rgba(26,26,26,.22)',
        overflow: 'hidden',
        animation: 'modal-in .3s cubic-bezier(.34,1.2,.64,1) forwards',
        animationName: shake ? 'shake' : 'modal-in',
      }}>

        {/* Header */}
        <div style={{ padding: '28px 28px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
                <path d="M14 24C14 24 7 20 4 14C7 8 14 2 14 2" stroke="#1A1A1A" strokeWidth="1.5" fill="none"/>
                <circle cx="14" cy="14" r="2.5" fill="#1A1A1A"/>
              </svg>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#1A1A1A', letterSpacing: '-.01em' }}>Alvio</span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#1A1A1A', letterSpacing: '-.02em', lineHeight: 1.2 }}>
              {success ? 'Vérifiez votre email' : mode === 'login' ? 'Bon retour' : 'Créer un compte'}
            </h2>
            <p style={{ fontSize: '14px', color: '#8C9BAB', marginTop: '6px' }}>
              {success
                ? 'Un lien de confirmation vous a été envoyé.'
                : mode === 'login'
                  ? 'Connectez-vous à votre espace Alvio'
                  : 'Accédez à votre CFO digital en 2 minutes'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#F2F3F5', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s ease' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e8e9eb')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F2F3F5')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="#8C9BAB" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px 28px' }}>

          {success ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(42,157,92,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12L9 17L20 7" stroke="#2a9d5c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p style={{ fontSize: '14px', color: '#8C9BAB', lineHeight: 1.6, marginBottom: '24px' }}>
                Vérifiez votre boîte mail et cliquez sur le lien pour activer votre compte.
              </p>
              <button className="btn btn-primary btn-full" onClick={onClose} style={{ justifyContent: 'center' }}>
                Fermer
              </button>
            </div>
          ) : (
            <>
              {/* Tab switcher */}
              <div style={{ display: 'flex', background: '#F2F3F5', borderRadius: '10px', padding: '3px', marginBottom: '24px' }}>
                {(['login', 'register'] as Mode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      flex: 1, padding: '8px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 500, fontFamily: 'Plus Jakarta Sans, sans-serif',
                      background: mode === m ? '#fff' : 'transparent',
                      color: mode === m ? '#1A1A1A' : '#8C9BAB',
                      boxShadow: mode === m ? '0 1px 4px rgba(26,26,26,.1)' : 'none',
                      transition: 'all .2s cubic-bezier(.34,1.2,.64,1)',
                    }}
                  >
                    {m === 'login' ? 'Connexion' : 'Inscription'}
                  </button>
                ))}
              </div>

              {/* Global error */}
              {globalError && (
                <div style={{ background: 'rgba(226,92,92,.08)', border: '.5px solid rgba(226,92,92,.3)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#e25c5c' }}>
                  {globalError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Name — register only */}
                {mode === 'register' && (
                  <div className="input-wrap" style={{ opacity: 0, animation: 'fade-up .3s var(--ease-out) .05s forwards' }}>
                    <label className="input-label">Nom complet</label>
                    <div className="input-icon-wrap">
                      <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                      <input
                        ref={mode === 'register' ? firstInputRef : undefined}
                        className={`input-field${errors.name ? ' error' : ''}`}
                        type="text" placeholder="Jean Dupont"
                        value={form.name} onChange={e => set('name', e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit(e as unknown as MouseEvent<HTMLButtonElement>)}
                      />
                    </div>
                    {errors.name && <span className="input-error">{errors.name}</span>}
                  </div>
                )}

                {/* Email */}
                <div className="input-wrap" style={{ opacity: 0, animation: `fade-up .3s var(--ease-out) ${mode === 'register' ? '.1s' : '.05s'} forwards` }}>
                  <label className="input-label">Email</label>
                  <div className="input-icon-wrap">
                    <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M1.5 5.5L8 9.5L14.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    <input
                      ref={mode === 'login' ? firstInputRef : undefined}
                      className={`input-field${errors.email ? ' error' : ''}`}
                      type="email" placeholder="jean@entreprise.fr"
                      value={form.email} onChange={e => set('email', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit(e as unknown as MouseEvent<HTMLButtonElement>)}
                    />
                  </div>
                  {errors.email && <span className="input-error">{errors.email}</span>}
                </div>

                {/* Password */}
                <div className="input-wrap" style={{ opacity: 0, animation: `fade-up .3s var(--ease-out) ${mode === 'register' ? '.15s' : '.1s'} forwards` }}>
                  <label className="input-label">Mot de passe</label>
                  <div className="input-icon-wrap">
                    <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <circle cx="8" cy="10.5" r="1" fill="currentColor"/>
                    </svg>
                    <input
                      className={`input-field${errors.password ? ' error' : ''}`}
                      type={showPwd ? 'text' : 'password'}
                      placeholder={mode === 'register' ? 'Minimum 8 caractères' : '••••••••'}
                      value={form.password} onChange={e => set('password', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSubmit(e as unknown as MouseEvent<HTMLButtonElement>)}
                      style={{ paddingRight: '40px' }}
                    />
                    <button className="input-eye" onClick={() => setShowPwd(p => !p)} type="button">
                      {showPwd
                        ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/></svg>
                      }
                    </button>
                  </div>
                  {errors.password && <span className="input-error">{errors.password}</span>}
                </div>

                {/* Confirm password — register only */}
                {mode === 'register' && (
                  <div className="input-wrap" style={{ opacity: 0, animation: 'fade-up .3s var(--ease-out) .2s forwards' }}>
                    <label className="input-label">Confirmer le mot de passe</label>
                    <div className="input-icon-wrap">
                      <svg className="input-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        <circle cx="8" cy="10.5" r="1" fill="currentColor"/>
                      </svg>
                      <input
                        className={`input-field${errors.password2 ? ' error' : ''}`}
                        type={showPwd2 ? 'text' : 'password'}
                        placeholder="Même mot de passe"
                        value={form.password2} onChange={e => set('password2', e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit(e as unknown as MouseEvent<HTMLButtonElement>)}
                        style={{ paddingRight: '40px' }}
                      />
                      <button className="input-eye" onClick={() => setShowPwd2(p => !p)} type="button">
                        {showPwd2
                          ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/></svg>
                        }
                      </button>
                    </div>
                    {errors.password2 && <span className="input-error">{errors.password2}</span>}
                  </div>
                )}

                {/* Forgot password */}
                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: '-8px' }}>
                    <button
                      onClick={async () => {
                        if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { setErrors({ email: 'Entrez votre email d\'abord' }); return }
                        await supabase.auth.resetPasswordForEmail(form.email)
                        setGlobalError('')
                        alert('Email de réinitialisation envoyé.')
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#8C9BAB', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'color .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#B8A98A')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#8C9BAB')}
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                )}

                {/* Submit */}
                <button
                  className="btn btn-primary btn-full btn-lg"
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{
                    marginTop: '4px', justifyContent: 'center',
                    opacity: 0, animation: `fade-up .3s var(--ease-out) ${mode === 'register' ? '.25s' : '.15s'} forwards`,
                  }}
                >
                  {loading ? (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation: 'spin .7s linear infinite' }}>
                      <circle cx="9" cy="9" r="7" stroke="rgba(184,169,138,.3)" strokeWidth="2"/>
                      <path d="M9 2a7 7 0 017 7" stroke="#B8A98A" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                </button>

                {/* Terms — register only */}
                {mode === 'register' && (
                  <p style={{ fontSize: '11px', color: '#8C9BAB', textAlign: 'center', lineHeight: 1.5, opacity: 0, animation: 'fade-in .3s ease .3s forwards' }}>
                    En créant un compte, vous acceptez nos{' '}
                    <span style={{ color: '#B8A98A', cursor: 'pointer' }}>Conditions d'utilisation</span>
                    {' '}et notre{' '}
                    <span style={{ color: '#B8A98A', cursor: 'pointer' }}>Politique de confidentialité</span>.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
