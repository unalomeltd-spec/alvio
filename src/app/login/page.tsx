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
        .login-input:focus { border-color:#B8A98A; box-shadow:0 0 0 3px rgba(184,169,138,0.12); }
        .btn-submit {
          width:100%; background:#B8A98A; color:#1A1A1A;
          border:none; border-radius:10px; padding:12px;
          font-size:13px; font-weight:700; cursor:pointer;
          font-family:inherit; margin-top:4px;
          transition:background .18s, transform .15s, box-shadow .15s;
        }
        .btn-submit:hover:not(:disabled) { background:#A99672; transform:translateY(-1px); box-shadow:0 6px 20px rgba(184,169,138,0.3); }
        .btn-submit:disabled { opacity:0.65; cursor:not-allowed; }
        .back-link { font-size:12px; color:#6E7378; text-decoration:none; transition:color .18s; }
        .back-link:hover { color:#B8A98A; }
        .switch-btn { background:none; border:none; font-size:12px; font-weight:600; color:#B8A98A; cursor:pointer; font-family:inherit; text-decoration:underline; transition:color .18s; }
        .switch-btn:hover { color:#A99672; }
      `}</style>

      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#B8A98A', fontSize: 16, fontWeight: 700 }}>A</span>
        </div>
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
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="login-input" />
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
