'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email?: string; user_metadata?: { full_name?: string } } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/'); return }
      setUser(data.user)
    })
  }, [router])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F3F5' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 32, height: 32, border: '2px solid rgba(26,26,26,.1)', borderTopColor: '#B8A98A', borderRadius: '50%', animation: 'spin .7s linear infinite' }}/>
    </div>
  )

  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur'

  return (
    <div style={{ minHeight: '100vh', background: '#F2F3F5', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: 220, background: '#1A1A1A', padding: '24px 16px', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', marginBottom: 32 }}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
            <circle cx="14" cy="14" r="2.5" fill="#F2F3F5"/>
          </svg>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#F2F3F5', letterSpacing: '-.01em' }}>Alvio</span>
        </div>
        {[
          { label: 'Dashboard', active: true },
          { label: 'Trésorerie', active: false },
          { label: 'Budget', active: false },
          { label: 'Simulateur', active: false },
          { label: 'Agent Alvio', active: false },
        ].map(item => (
          <div key={item.label} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 2, background: item.active ? 'rgba(184,169,138,.12)' : 'transparent', color: item.active ? '#B8A98A' : '#8C9BAB', fontSize: 14, cursor: 'pointer', transition: 'all .2s ease' }}>
            {item.label}
          </div>
        ))}
        <div style={{ marginTop: 'auto', borderTop: '.5px solid rgba(140,155,171,.15)', paddingTop: 16 }}>
          <div style={{ padding: '8px 12px', fontSize: 12, color: '#8C9BAB' }}>{user.email}</div>
          <button onClick={logout} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'transparent', border: 'none', color: '#8C9BAB', fontSize: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'color .2s ease' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e25c5c')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8C9BAB')}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ marginLeft: 220, padding: '40px 48px' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-.02em' }}>Bonjour, {name} 👋</h1>
          <p style={{ fontSize: 14, color: '#8C9BAB', marginTop: 6 }}>Votre tableau de bord est prêt. Connectez votre comptabilité pour commencer.</p>
        </div>
        <div style={{ background: '#1A1A1A', borderRadius: 16, padding: '28px 32px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>Prochaine étape</div>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: '#F2F3F5', marginBottom: 6 }}>Connectez votre comptabilité</h2>
            <p style={{ fontSize: 14, color: '#8C9BAB', maxWidth: 480 }}>Importez un fichier FEC ou connectez Pennylane pour accéder à l'analyse complète.</p>
          </div>
          <button style={{ background: '#B8A98A', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 500, color: '#1A1A1A', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'transform .25s cubic-bezier(.34,1.56,.64,1)' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
            Importer un fichier
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: "Chiffre d'affaires", value: '— €', note: 'Données à importer' },
            { label: 'EBE', value: '— €', note: 'Données à importer' },
            { label: 'Trésorerie nette', value: '— €', note: 'Données à importer' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#fff', border: '.5px solid rgba(140,155,171,.2)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 11, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>{k.label}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-.02em', marginBottom: 4 }}>{k.value}</div>
              <div style={{ fontSize: 12, color: '#8C9BAB' }}>{k.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
