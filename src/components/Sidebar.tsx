'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type PageId = 'dashboard' | 'profitability' | 'income-statement' | 'balance-sheet' | 'cash-flow' | 'company'

export default function Sidebar({ activePage }: { activePage: PageId }) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [companyName, setCompanyName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? '')
        setCompanyName(user.user_metadata?.entreprise?.nom ?? '')
      }
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const main = [
    { id: 'dashboard',        href: '/dashboard',        label: 'Synthèse',           d: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
    { id: 'profitability',    href: '/profitability',    label: 'Rentabilité',         d: 'M3 3v18h18M7 16l4-4 4 4 5-5' },
    { id: 'income-statement', href: '/income-statement', label: 'Compte de résultat',  d: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 12h6m-6 4h4' },
    { id: 'balance-sheet',    href: '/balance-sheet',    label: 'Bilan',               d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
    { id: 'cash-flow',        href: '/cash-flow',        label: 'Trésorerie',          d: 'M3 3v18h18M7 12l4-4 4 4 4-4' },
  ]

  const space = [
    { id: 'company', href: '/company', label: 'Fiche société', d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  ]

  const s = (id: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px',
    borderLeft: activePage === id ? '2px solid #B8A98A' : '2px solid transparent',
    background: activePage === id ? 'rgba(184,169,138,0.1)' : 'transparent',
    color: activePage === id ? '#B8A98A' : '#8C9BAB',
    fontSize: 12, cursor: 'pointer', textDecoration: 'none', transition: 'all 0.15s',
  })

  return (
    <div style={{ width: 220, minWidth: 220, background: '#1A1A1A', display: 'flex', flexDirection: 'column', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid rgba(184,169,138,0.18)' }}>
        <a href="/dashboard" style={{ color: '#B8A98A', fontSize: 15, fontWeight: 500, letterSpacing: '0.05em', textDecoration: 'none' }}>Alvio</a>
        <div style={{ color: '#8C9BAB', fontSize: 9, marginTop: 3 }}>Intelligence financière</div>
      </div>
      <div style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        <div style={{ padding: '10px 20px 4px', color: 'rgba(140,155,171,0.5)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Analyse</div>
        {main.map(item => (
          <a key={item.id} href={item.href} style={s(item.id)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.d}/></svg>
            {item.label}
          </a>
        ))}
        <div style={{ padding: '10px 20px 4px', color: 'rgba(140,155,171,0.5)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>Mon espace</div>
        {space.map(item => (
          <a key={item.id} href={item.href} style={s(item.id)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.d}/></svg>
            {item.label}
          </a>
        ))}
      </div>
      <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(184,169,138,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8A98A', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
            {userEmail.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#F2F3F5', fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
            <div style={{ color: '#8C9BAB', fontSize: 9 }}>{companyName || 'Beta'}</div>
          </div>
          <button onClick={handleLogout} title="Déconnexion" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C9BAB', padding: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
