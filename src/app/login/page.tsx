'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erreur, setErreur] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(''); setSuccess(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) { setErreur('Email ou mot de passe incorrect.'); return }
        router.push('/dashboard')
      } else {
        const { error } = await sb.auth.signUp({ email, password })
        if (error) { setErreur(error.message); return }
        setSuccess('Compte créé ! Vérifiez votre email pour confirmer votre inscription.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F8F8F6',
      fontFamily: "'Inter', sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        .login-input {
          width:100%; border:1px solid #ECECEC; border-radius:8px;
          padding:10px 12px; font-size:13px; color:#242628;
          background:#fff; outline:none; font-family:inherit;
          transition:border-color .18s, box-shadow .18s;
        }
        .login-input:focus { border-color:#C6A275; box-shadow:0 0 0 3px rgba(198,162,117,0.12); }
        .btn-submit {
          width:100%; background:#C6A275; color:#1A1A1A;
          border:none; border-radius:10px; padding:12px;
          font-size:13px; font-weight:700; cursor:pointer;
          font-family:inherit; margin-top:4px;
          transition:background .18s, transform .15s, box-shadow .15s;
        }
        .btn-submit:hover:not(:disabled) { background:#B08D5E; transform:translateY(-1px); box-shadow:0 6px 20px rgba(198,162,117,0.3); }
        .btn-submit:disabled { opacity:0.65; cursor:not-allowed; }
        .back-link { font-size:12px; color:#6E7378; text-decoration:none; transition:color .18s; }
        .back-link:hover { color:#C6A275; }
        .switch-btn { background:none; border:none; font-size:12px; font-weight:600; color:#C6A275; cursor:pointer; font-family:inherit; text-decoration:underline; transition:color .18s; }
        .switch-btn:hover { color:#B08D5E; }
        .password-wrapper { position:relative; width:100%; }
        .password-wrapper .login-input { padding-right:40px; }
        .eye-btn { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; padding:2px; color:#9CA3AF; display:flex; align-items:center; transition:color .18s; }
        .eye-btn:hover { color:#C6A275; }
      `}</style>

      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
        <svg viewBox="80 34 340 315" width="32" height="32" style={{ display: 'block' }}>
          <path fill="#C6A275" d="M247.73,149.32c-2.59,6.14-5,11.83-7.39,17.53c-6.89,16.45-13.73,32.91-20.71,49.32c-0.48,1.14-1.79,2.14-2.95,2.74c-11.04,5.76-22.82,9.46-34.94,12.07c-6.36,1.37-12.82,2.3-19.23,3.41c-0.7,0.12-1.42,0.11-2.47,0.18c29.27-66.95,58.4-133.57,87.75-200.71c29.3,67.03,58.43,133.68,87.71,200.69c-1.62-0.15-2.96-0.21-4.29-0.41c-18.25-2.72-36.04-7.01-52.67-15.28c-0.98-0.49-2.09-1.34-2.5-2.29c-7.21-16.95-14.33-33.95-21.46-50.94C252.35,160.35,250.13,155.05,247.73,149.32z"/>
          <path fill="#C6A275" d="M385.17,348.23c-6.27-4.19-12.55-8.37-18.82-12.57c-22.52-15.1-45.04-30.19-67.51-45.35c-0.75-0.51-1.44-1.71-1.47-2.6c-0.14-5.04-0.11-10.08,0-15.11c0.02-0.78,0.55-1.95,1.19-2.26c14.39-7.07,28.83-14.05,43.55-21.18c14.63,33.23,29.04,65.95,43.45,98.67C385.43,347.97,385.3,348.1,385.17,348.23z"/>
          <path fill="#C6A275" d="M109.7,348.63c14.61-33.3,28.96-66,43.42-98.96c1.92,0.78,3.85,1.45,5.68,2.32c12.68,6.04,25.36,12.1,37.99,18.24c0.66,0.32,1.33,1.39,1.35,2.13c0.1,5.19,0.1,10.38-0.04,15.56c-0.02,0.83-0.73,1.93-1.45,2.41c-14.41,9.76-28.87,19.46-43.33,29.15c-13.72,9.2-27.46,18.36-41.19,27.54C111.52,347.45,110.9,347.85,109.7,348.63z"/>
          <path fill="#C6A275" d="M247.84,298.64c-2.69-5.84-5.39-11.34-7.78-16.97c-4.01-9.44-10.74-16.15-19.82-20.67c-3.97-1.98-7.94-3.95-11.91-5.93c-0.65-0.32-1.29-0.65-1.95-0.98c4.52-2.14,8.92-4.19,13.3-6.3c9.92-4.79,16.68-12.53,21.08-22.51c2.28-5.17,4.65-10.3,7-15.49c2.28,5.06,4.43,10.13,6.84,15.09c1.58,3.25,3.45,6.37,5.31,9.47c4.49,7.48,11.95,11.29,19.28,15.17c3.06,1.62,6.29,2.93,9.69,4.5c-1.41,0.69-2.67,1.26-3.89,1.92c-4.75,2.55-9.49,5.13-14.24,7.71c-6.45,3.5-10.76,8.97-13.92,15.39c-2.8,5.7-5.35,11.52-8,17.29C248.52,296.98,248.26,297.66,247.84,298.64z"/>
        </svg>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#242628', letterSpacing: '-0.02em' }}>Alvio</span>
      </Link>

      {/* Card */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1px solid #ECECEC',
        padding: '36px 40px', width: '100%', maxWidth: 400,
        boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#242628', letterSpacing: '-0.02em', marginBottom: 4 }}>
          {mode === 'login' ? 'Se connecter' : 'Créer un compte'}
        </h1>
        <p style={{ fontSize: 13, color: '#6E7378', marginBottom: 28 }}>
          {mode === 'login' ? 'Accédez à votre espace financier.' : 'Commencez gratuitement, importez votre FEC.'}
        </p>

        {success && (
          <div style={{ background: 'rgba(29,158,117,0.06)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#1D9E75' }}>
            {success}
          </div>
        )}
        {erreur && (
          <div style={{ background: 'rgba(180,35,24,0.06)', border: '1px solid rgba(180,35,24,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#B42318' }}>
            {erreur}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6E7378', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" required className="login-input" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6E7378', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Mot de passe</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="login-input"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? (
                  // Oeil barré
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  // Oeil ouvert
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter →' : 'Créer mon compte →'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#6E7378' }}>
            {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
          </span>
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErreur(''); setSuccess('') }} className="switch-btn">
            {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </div>
      </div>

      <Link href="/" className="back-link" style={{ marginTop: 20 }}>
        ← Retour à l'accueil
      </Link>
    </div>
  )
}
