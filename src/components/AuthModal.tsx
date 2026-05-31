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

interface EntrepriseInfo {
  siren: string
  nom: string
  forme_juridique: string
  adresse: string
  date_creation: string
  code_naf: string
  libelle_naf: string
  capital: number | null
  dirigeants: { nom: string; fonction: string }[]
}

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

  const [form, setForm] = useState({ prenom: '', nom: '', email: '', password: '', password2: '', siren: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')

  const [sirenLoading, setSirenLoading] = useState(false)
  const [entreprise, setEntreprise] = useState<EntrepriseInfo | null>(null)
  const [sirenError, setSirenError] = useState('')

  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setForm({ prenom: '', nom: '', email: '', password: '', password2: '', siren: '' })
      setErrors({})
      setGlobalError('')
      setSuccess(false)
      setLoading(false)
      setEntreprise(null)
      setSirenError('')
      setTimeout(() => firstInputRef.current?.focus(), 200)
    }
  }, [open, mode])

  useEffect(() => { setMode(defaultMode) }, [defaultMode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    setErrors(e => ({ ...e, [k]: '' }))
    setGlobalError('')
  }

  const handleSirenChange = async (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 9)
    set('siren', clean)
    setSirenError('')
    setEntreprise(null)
    if (clean.length !== 9) return
    setSirenLoading(true)
    try {
      const res = await fetch(`/api/siren?siren=${clean}`)
      const data = await res.json()
      if (!res.ok) setSirenError(data.error || 'Entreprise non trouvee')
      else setEntreprise(data)
    } catch {
      setSirenError('Erreur reseau')
    } finally {
      setSirenLoading(false)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (mode === 'register') {
      if (!form.prenom.trim()) e.prenom = 'Prenom requis'
      if (!form.nom.trim()) e.nom = 'Nom requis'
      if (form.siren && !/^\d{9}$/.test(form.siren)) e.siren = 'SIREN invalide (9 chiffres)'
    }
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = 'Email invalide'
    if (form.password.length < 8) e.password = 'Minimum 8 caracteres'
    if (mode === 'register' && form.password !== form.password2) e.password2 = 'Les mots de passe ne correspondent pas'
    setErrors(e)
    if (Object.keys(e).length) { setShake(true); setTimeout(() => setShake(false), 500) }
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
          options: {
            data: {
              prenom: form.prenom,
              nom: form.nom,
              full_name: `${form.prenom} ${form.nom}`.trim(),
              siren: form.siren || null,
              entreprise: entreprise ?? null,
            }
          },
        })
        if (error) throw error
        if (data.user && !data.session) setSuccess(true)
        else router.push('/dashboard')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      const fr: Record<string, string> = {
        'Invalid login credentials': 'Email ou mot de passe incorrect',
        'Email not confirmed': 'Verifiez votre email pour confirmer votre compte',
        'User already registered': 'Un compte existe deja avec cet email',
      }
      setGlobalError(fr[msg] || msg)
      setShake(true); setTimeout(() => setShake(false), 500)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const inputSt = (err?: string): React.CSSProperties => ({
    width: '100%', border: `1px solid ${err ? 'rgba(226,92,92,.5)' : 'rgba(26,26,26,.12)'}`,
    borderRadius: 10, padding: '10px 12px 10px 36px', fontSize: 13,
    color: '#1A1A1A', fontFamily: 'Plus Jakarta Sans, sans-serif',
    outline: 'none', background: '#fff', boxSizing: 'border-box',
  })

  const lbl: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#5C6670',
    letterSpacing: '.04em', textTransform: 'uppercase',
    marginBottom: 5, display: 'block',
  }

  const iconWrap: React.CSSProperties = { position: 'relative' }

  const iconPos: React.CSSProperties = {
    position: 'absolute', left: 11, top: '50%',
    transform: 'translateY(-50%)', color: '#8C9BAB', pointerEvents: 'none',
  }

  const errTxt = (msg?: string) => msg ? (
    <span style={{ fontSize: 11, color: '#e25c5c', marginTop: 4, display: 'block' }}>{msg}</span>
  ) : null

  const EyeOpen = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/></svg>
  const EyeClosed = () => <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.3"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>

  const UserIcon = () => <svg style={iconPos} width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  const MailIcon = () => <svg style={iconPos} width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 5.5L8 9.5L14.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  const LockIcon = () => <svg style={iconPos} width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  const SirenIcon = () => <svg style={iconPos} width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.3"/></svg>

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,26,26,.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%',
        maxWidth: mode === 'register' ? 480 : 420,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 32px 80px rgba(26,26,26,.22)',
        animation: shake ? 'shake .4s ease' : 'modal-in .3s cubic-bezier(.34,1.2,.64,1) forwards',
      }}>

        {/* Header */}
        <div style={{ padding: '28px 28px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
                <path d="M14 24C14 24 7 20 4 14C7 8 14 2 14 2" stroke="#1A1A1A" strokeWidth="1.5" fill="none"/>
                <circle cx="14" cy="14" r="2.5" fill="#1A1A1A"/>
              </svg>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>Alvio</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-.02em', lineHeight: 1.2 }}>
              {success ? 'Verifiez votre email' : mode === 'login' ? 'Bon retour' : 'Creer un compte'}
            </h2>
            <p style={{ fontSize: 14, color: '#8C9BAB', marginTop: 6 }}>
              {success ? 'Un lien de confirmation vous a ete envoye.' : mode === 'login' ? 'Connectez-vous a votre espace Alvio' : 'Acces a votre CFO digital en 2 minutes'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#F2F3F5', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2L12 12M12 2L2 12" stroke="#8C9BAB" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px 28px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(42,157,92,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12L9 17L20 7" stroke="#2a9d5c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <p style={{ fontSize: 14, color: '#8C9BAB', lineHeight: 1.6, marginBottom: 24 }}>Votre compte est créé ✓ — vérifiez votre boîte mail et cliquez sur le lien pour accéder à votre espace Alvio.</p>
              <button className="btn btn-primary btn-full" onClick={onClose} style={{ justifyContent: 'center' }}>Fermer</button>
            </div>
          ) : (
            <>
              {/* Tab switcher */}
              <div style={{ display: 'flex', background: '#F2F3F5', borderRadius: 10, padding: 3, marginBottom: 24 }}>
                {(['login', 'register'] as Mode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: 8, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Plus Jakarta Sans, sans-serif', background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#1A1A1A' : '#8C9BAB', boxShadow: mode === m ? '0 1px 4px rgba(26,26,26,.1)' : 'none', transition: 'all .2s' }}>
                    {m === 'login' ? 'Connexion' : 'Inscription'}
                  </button>
                ))}
              </div>

              {globalError && (
                <div style={{ background: 'rgba(226,92,92,.08)', border: '.5px solid rgba(226,92,92,.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#e25c5c' }}>
                  {globalError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Prenom + Nom */}
                {mode === 'register' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={lbl}>Prenom</label>
                      <div style={iconWrap}>
                        <UserIcon />
                        <input ref={firstInputRef} style={inputSt(errors.prenom)} type="text" placeholder="Jean" value={form.prenom} onChange={e => set('prenom', e.target.value)} />
                      </div>
                      {errTxt(errors.prenom)}
                    </div>
                    <div>
                      <label style={lbl}>Nom</label>
                      <div style={iconWrap}>
                        <UserIcon />
                        <input style={inputSt(errors.nom)} type="text" placeholder="Dupont" value={form.nom} onChange={e => set('nom', e.target.value)} />
                      </div>
                      {errTxt(errors.nom)}
                    </div>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label style={lbl}>Email</label>
                  <div style={iconWrap}>
                    <MailIcon />
                    <input ref={mode === 'login' ? firstInputRef : undefined} style={inputSt(errors.email)} type="email" placeholder="jean@entreprise.fr" value={form.email} onChange={e => set('email', e.target.value)} />
                  </div>
                  {errTxt(errors.email)}
                </div>

                {/* Password */}
                <div>
                  <label style={lbl}>Mot de passe</label>
                  <div style={iconWrap}>
                    <LockIcon />
                    <input style={{ ...inputSt(errors.password), paddingRight: 40 }} type={showPwd ? 'text' : 'password'} placeholder={mode === 'register' ? 'Minimum 8 caracteres' : '••••••••'} value={form.password} onChange={e => set('password', e.target.value)} />
                    <button onClick={() => setShowPwd(p => !p)} type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8C9BAB', padding: 2 }}>
                      {showPwd ? <EyeClosed /> : <EyeOpen />}
                    </button>
                  </div>
                  {errTxt(errors.password)}
                </div>

                {/* Confirm password */}
                {mode === 'register' && (
                  <div>
                    <label style={lbl}>Confirmer le mot de passe</label>
                    <div style={iconWrap}>
                      <LockIcon />
                      <input style={{ ...inputSt(errors.password2), paddingRight: 40 }} type={showPwd2 ? 'text' : 'password'} placeholder="Meme mot de passe" value={form.password2} onChange={e => set('password2', e.target.value)} />
                      <button onClick={() => setShowPwd2(p => !p)} type="button" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8C9BAB', padding: 2 }}>
                        {showPwd2 ? <EyeClosed /> : <EyeOpen />}
                      </button>
                    </div>
                    {errTxt(errors.password2)}
                  </div>
                )}

                {/* SIREN */}
                {mode === 'register' && (
                  <div>
                    <label style={lbl}>
                      SIREN
                      <span style={{ fontSize: 10, fontWeight: 400, color: '#8C9BAB', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>optionnel</span>
                    </label>
                    <div style={iconWrap}>
                      <SirenIcon />
                      <input
                        style={{ ...inputSt(errors.siren || sirenError ? 'err' : undefined), paddingRight: 36 }}
                        type="text" placeholder="9 chiffres"
                        value={form.siren}
                        onChange={e => handleSirenChange(e.target.value)}
                        maxLength={9}
                      />
                      {sirenLoading && (
                        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin .7s linear infinite' }}><circle cx="7" cy="7" r="5" stroke="rgba(184,169,138,.3)" strokeWidth="1.5"/><path d="M7 2a5 5 0 015 5" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </div>
                      )}
                      {entreprise && !sirenLoading && (
                        <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8L6.5 11.5L13 5" stroke="#2a9d5c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </div>
                    {errTxt(errors.siren || sirenError)}

                    {/* Apercu entreprise */}
                    {entreprise && !sirenLoading && (
                      <div style={{ marginTop: 10, padding: '12px 14px', background: 'rgba(184,169,138,0.08)', borderRadius: 10, border: '0.5px solid rgba(184,169,138,0.3)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>{entreprise.nom}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' }}>
                          {[
                            ['Forme', entreprise.forme_juridique],
                            ['Creation', entreprise.date_creation],
                            ['NAF', `${entreprise.code_naf}`],
                            ['Activite', entreprise.libelle_naf],
                            ['Siege', entreprise.adresse],
                          ].filter(([, v]) => v).map(([k, v]) => (
                            <div key={k} style={{ gridColumn: k === 'Siege' || k === 'Activite' ? '1 / -1' : undefined }}>
                              <span style={{ fontSize: 10, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k} </span>
                              <span style={{ fontSize: 11, color: '#1A1A1A' }}>{v}</span>
                            </div>
                          ))}
                        </div>
                        {entreprise.dirigeants.length > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <span style={{ fontSize: 10, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dirigeants </span>
                            <span style={{ fontSize: 11, color: '#1A1A1A' }}>{entreprise.dirigeants.map(d => `${d.nom}${d.fonction ? ` (${d.fonction})` : ''}`).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Forgot password */}
                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: -8 }}>
                    <button onClick={async () => {
                      if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) { setErrors({ email: 'Entrez votre email d abord' }); return }
                      await supabase.auth.resetPasswordForEmail(form.email)
                      alert('Email de reinitialisation envoye.')
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#8C9BAB', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      Mot de passe oublie ?
                    </button>
                  </div>
                )}

                {/* Submit */}
                <button className="btn btn-primary btn-full btn-lg" onClick={handleSubmit} disabled={loading} style={{ marginTop: 4, justifyContent: 'center' }}>
                  {loading
                    ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ animation: 'spin .7s linear infinite' }}><circle cx="9" cy="9" r="7" stroke="rgba(184,169,138,.3)" strokeWidth="2"/><path d="M9 2a7 7 0 017 7" stroke="#B8A98A" strokeWidth="2" strokeLinecap="round"/></svg>
                    : mode === 'login' ? 'Se connecter' : 'Creer mon compte'
                  }
                </button>

                {mode === 'register' && (
                  <p style={{ fontSize: 11, color: '#8C9BAB', textAlign: 'center', lineHeight: 1.5 }}>
                    En creant un compte, vous acceptez nos <span style={{ color: '#B8A98A', cursor: 'pointer' }}>Conditions d utilisation</span> et notre <span style={{ color: '#B8A98A', cursor: 'pointer' }}>Politique de confidentialite</span>.
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
