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
      minHeight: '100vh', background: '#F2F3F5',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#B8A98A', fontSize: 16, fontWeight: 700 }}>A</span>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.02em' }}>Alvio</span>
      </Link>

      {/* Card */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.08)',
        padding: '36px 40px', width: '100%', maxWidth: 400,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.02em', marginBottom: 4 }}>
          {mode === 'login' ? 'Se connecter' : 'Créer un compte'}
        </h1>
        <p style={{ fontSize: 13, color: '#8C9BAB', marginBottom: 28 }}>
          {mode === 'login' ? 'Accédez à votre espace financier.' : 'Commencez gratuitement, importez votre FEC.'}
        </p>

        {success && (
          <div style={{ background: 'rgba(29,158,117,0.08)', border: '0.5px solid rgba(29,158,117,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#1D9E75' }}>
            {success}
          </div>
        )}

        {erreur && (
          <div style={{ background: 'rgba(216,90,48,0.08)', border: '0.5px solid rgba(216,90,48,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#D85A30' }}>
            {erreur}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#1A1A1A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com" required
              style={{ width: '100%', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#1A1A1A', background: '#fff', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
              onFocus={e => (e.target as HTMLElement).style.borderColor = '#B8A98A'}
              onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,0,0,0.15)'}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#1A1A1A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mot de passe</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{ width: '100%', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#1A1A1A', background: '#fff', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
              onFocus={e => (e.target as HTMLElement).style.borderColor = '#B8A98A'}
              onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,0,0,0.15)'}
            />
          </div>
          <button type="submit" disabled={loading}
            style={{ background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4, opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter →' : 'Créer mon compte →'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#8C9BAB' }}>
            {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
          </span>
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErreur(''); setSuccess('') }}
            style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: '#B8A98A', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </div>
      </div>

      <Link href="/" style={{ marginTop: 20, fontSize: 12, color: '#8C9BAB', textDecoration: 'none' }}>
        ← Retour à l'accueil
      </Link>
    </div>
  )
}
