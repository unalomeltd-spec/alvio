'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type PageId = 'dashboard' | 'profitability' | 'income-statement' | 'balance-sheet' | 'cash-flow' | 'company' | 'suivi'

export default function Sidebar({ activePage }: { activePage: PageId }) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? '')
        setCompanyName(user.user_metadata?.entreprise?.nom ?? '')
      }
    })
    const stored = localStorage.getItem('alvio-sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('alvio-sidebar-collapsed', String(next))
  }

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
    { id: 'company', href: '/company', label: 'Fiche société',  d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
    { id: 'suivi',   href: '/suivi',   label: 'Suivi demandes', d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
  ]

  const w = collapsed ? 56 : 220

  const navItem = (item: typeof main[0]) => {
    const active = activePage === item.id
    return (
      <a key={item.id} href={item.href}
        title={collapsed ? item.label : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '9px 0' : '8px 20px',
          borderLeft: active ? '2px solid #B8A98A' : '2px solid transparent',
          background: active ? 'rgba(184,169,138,0.1)' : 'transparent',
          color: active ? '#B8A98A' : '#8C9BAB',
          fontSize: 12, cursor: 'pointer', textDecoration: 'none',
          transition: 'all 0.15s', borderRadius: collapsed ? 0 : undefined,
        }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d={item.d}/>
        </svg>
        {!collapsed && item.label}
      </a>
    )
  }

  return (
    <div style={{
      width: w, minWidth: w, background: '#1A1A1A', display: 'flex', flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'width 0.2s ease, min-width 0.2s ease',
      position: 'relative', overflow: 'visible',
    }}>

      {/* Logo */}
      <div style={{ padding: collapsed ? '18px 0 14px' : '18px 20px 14px', borderBottom: '0.5px solid rgba(184,169,138,0.18)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <a href="/dashboard" style={{ textDecoration: 'none' }}>
            <div style={{ color: '#B8A98A', fontSize: 15, fontWeight: 500, letterSpacing: '0.05em' }}>Alvio</div>
            <div style={{ color: '#8C9BAB', fontSize: 9, marginTop: 3 }}>Intelligence financière</div>
          </a>
        )}
        {collapsed && (
          <a href="/dashboard" style={{ textDecoration: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </a>
        )}
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '10px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {!collapsed && <div style={{ padding: '10px 20px 4px', color: 'rgba(140,155,171,0.5)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Analyse</div>}
        {collapsed && <div style={{ height: 14 }} />}
        {main.map(navItem)}

        {!collapsed && <div style={{ padding: '10px 20px 4px', color: 'rgba(140,155,171,0.5)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>Mon espace</div>}
        {collapsed && <div style={{ height: 14 }} />}
        {space.map(navItem)}
      </div>

      {/* User */}
      {!collapsed && (
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(184,169,138,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8A98A', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
              {userEmail.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#F2F3F5', fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
              <div style={{ color: '#8C9BAB', fontSize: 9 }}>{companyName || 'Beta'}</div>
            </div>
            <button onClick={handleLogout} title="Déconnexion"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C9BAB', padding: 0, display: 'flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      )}
      {collapsed && (
        <div style={{ padding: '12px 0', borderTop: '0.5px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center' }}>
          <div title={userEmail} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(184,169,138,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8A98A', fontSize: 10, fontWeight: 500, cursor: 'default' }}>
            {userEmail.slice(0, 2).toUpperCase()}
          </div>
        </div>
      )}

      {/* Bouton toggle — flèche sur le bord droit */}
      <button onClick={toggle}
        style={{
          position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)',
          width: 24, height: 24, borderRadius: '50%',
          background: '#1A1A1A', border: '1px solid rgba(184,169,138,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 10, transition: 'all 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#2A2A2A'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#1A1A1A'}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round">
          {collapsed
            ? <path d="M3 2l4 3-4 3"/>
            : <path d="M7 2L3 5l4 3"/>
          }
        </svg>
      </button>

    </div>
  )
}
