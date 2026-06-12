'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp, FileText, Activity,
  Settings, CheckSquare, LogOut, ChevronLeft,
} from 'lucide-react'
import { useActiveCompany } from '@/hooks/useActiveCompany'
import { createClient } from '@/lib/supabase/client'

interface NavItemDef {
  href: string
  label: string
  icon: React.ElementType
}

const MAIN_NAV: NavItemDef[] = [
  { href: '/dashboard',        label: 'Synthèse',           icon: LayoutDashboard },
  { href: '/profitability',    label: 'Rentabilité',         icon: TrendingUp },
  { href: '/income-statement', label: 'Compte de résultat', icon: FileText },
  { href: '/sante-financiere', label: 'Santé financière',   icon: Activity },
]

const SECONDARY_NAV: NavItemDef[] = [
  { href: '/entreprise', label: 'Paramétrages',   icon: Settings },
  { href: '/suivi',      label: 'Suivi demandes', icon: CheckSquare },
]

/* ─── Logo ───────────────────────────────────────────── */

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/dashboard" style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : 10,
        padding: collapsed ? '16px 0' : '16px 16px 14px',
        borderBottom: '1px solid var(--border-soft)',
        justifyContent: collapsed ? 'center' : 'flex-start',
        flexShrink: 0,
        cursor: 'pointer',
      }}>
        <svg viewBox="80 34 340 315" width={30} height={30} style={{ flexShrink: 0, display: 'block' }} aria-hidden="true">
          <path fill="var(--alvio-champagne)" d="M247.73,149.32c-2.59,6.14-5,11.83-7.39,17.53c-6.89,16.45-13.73,32.91-20.71,49.32c-0.48,1.14-1.79,2.14-2.95,2.74c-11.04,5.76-22.82,9.46-34.94,12.07c-6.36,1.37-12.82,2.3-19.23,3.41c-0.7,0.12-1.42,0.11-2.47,0.18c29.27-66.95,58.4-133.57,87.75-200.71c29.3,67.03,58.43,133.68,87.71,200.69c-1.62-0.15-2.96-0.21-4.29-0.41c-18.25-2.72-36.04-7.01-52.67-15.28c-0.98-0.49-2.09-1.34-2.5-2.29c-7.21-16.95-14.33-33.95-21.46-50.94C252.35,160.35,250.13,155.05,247.73,149.32z"/>
          <path fill="var(--alvio-champagne)" d="M385.17,348.23c-6.27-4.19-12.55-8.37-18.82-12.57c-22.52-15.1-45.04-30.19-67.51-45.35c-0.75-0.51-1.44-1.71-1.47-2.6c-0.14-5.04-0.11-10.08,0-15.11c0.02-0.78,0.55-1.95,1.19-2.26c14.39-7.07,28.83-14.05,43.55-21.18c14.63,33.23,29.04,65.95,43.45,98.67C385.43,347.97,385.3,348.1,385.17,348.23z"/>
          <path fill="var(--alvio-champagne)" d="M109.7,348.63c14.61-33.3,28.96-66,43.42-98.96c1.92,0.78,3.85,1.45,5.68,2.32c12.68,6.04,25.36,12.1,37.99,18.24c0.66,0.32,1.33,1.39,1.35,2.13c0.1,5.19,0.1,10.38-0.04,15.56c-0.02,0.83-0.73,1.93-1.45,2.41c-14.41,9.76-28.87,19.46-43.33,29.15c-13.72,9.2-27.46,18.36-41.19,27.54C111.52,347.45,110.9,347.85,109.7,348.63z"/>
          <path fill="var(--alvio-champagne)" d="M247.84,298.64c-2.69-5.84-5.39-11.34-7.78-16.97c-4.01-9.44-10.74-16.15-19.82-20.67c-3.97-1.98-7.94-3.95-11.91-5.93c-0.65-0.32-1.29-0.65-1.95-0.98c4.52-2.14,8.92-4.19,13.3-6.3c9.92-4.79,16.68-12.53,21.08-22.51c2.28-5.17,4.65-10.3,7-15.49c2.28,5.06,4.43,10.13,6.84,15.09c1.58,3.25,3.45,6.37,5.31,9.47c4.49,7.48,11.95,11.29,19.28,15.17c3.06,1.62,6.29,2.93,9.69,4.5c-1.41,0.69-2.67,1.26-3.89,1.92c-4.75,2.55-9.49,5.13-14.24,7.71c-6.45,3.5-10.76,8.97-13.92,15.39c-2.8,5.7-5.35,11.52-8,17.29C248.52,296.98,248.26,297.66,247.84,298.64z"/>
        </svg>
        {!collapsed && (
          <div style={{ overflow: 'hidden', lineHeight: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.07em', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              ALVIO
            </div>
            <div style={{ fontSize: 9, color: 'var(--alvio-champagne)', fontWeight: 500, letterSpacing: '0.07em', marginTop: 2, whiteSpace: 'nowrap' }}>
              CFO DIGITAL
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}

/* ─── NavLink ────────────────────────────────────────── */

function NavLink({ href, label, icon: Icon, active, collapsed }: NavItemDef & { active: boolean; collapsed: boolean }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        title={collapsed ? label : undefined}
        className={`alvio-nav-item${active ? ' alvio-nav-active' : ''}`}
        style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 9,
          padding: collapsed ? '8px 0' : '8px 10px',
          borderRadius: 8, marginBottom: 2,
          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontWeight: active ? 500 : 400,
          fontSize: 12.5, cursor: 'pointer',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}
      >
        <Icon size={15} strokeWidth={active ? 2 : 1.6} color={active ? 'var(--alvio-champagne)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
        {!collapsed && label}
      </div>
    </Link>
  )
}

/* ─── Sidebar ────────────────────────────────────────── */

export default function Sidebar({ activePage: _a }: { activePage?: string } = {}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted || !session?.user?.email) return
        setUserEmail(session.user.email)
      } catch { /* silent */ }
    })()
    return () => { mounted = false }
  }, [])

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch { /* silent */ }
    // Purge le dossier actif pour ne pas polluer la prochaine session
    try { localStorage.removeItem('alvio-active-company') } catch {}
    window.location.href = '/login'
  }

  const secondaryNav = SECONDARY_NAV.filter(
    item => !(item.href === '/suivi' && userEmail === 'hello@alvio.finance'),
  )

  const WIDTH = collapsed ? 60 : 220

  return (
    /*
     * position: relative + overflow: visible → permet au bouton collapse
     * de dépasser légèrement sur le bord droit.
     * Le contenu interne est clippé par son propre wrapper overflow: hidden.
     */
    <aside
      aria-label="Navigation principale"
      style={{
        width: WIDTH, minWidth: WIDTH,
        position: 'sticky',
        top: 0,
        flexShrink: 0,
        alignSelf: 'flex-start',
        transition: 'width 0.2s ease, min-width 0.2s ease',
      }}
    >
      {/* Contenu clippé pendant l'animation */}
      <div style={{
        width: '100%', height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex', flexDirection: 'column',
      }}>
        <Logo collapsed={collapsed} />

        <nav style={{ flex: 1, padding: collapsed ? '10px 6px' : '10px 8px', overflowY: 'auto' }}>
          {MAIN_NAV.map(item => (
            <NavLink key={item.href} {...item}
              active={pathname === item.href || pathname.startsWith(item.href + '/')}
              collapsed={collapsed}
            />
          ))}
          <div style={{ height: 1, background: 'var(--border-soft)', margin: '10px 4px' }} />
          {secondaryNav.map(item => (
            <NavLink key={item.href} {...item}
              active={pathname === item.href || pathname.startsWith(item.href + '/')}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Bas — déconnexion uniquement */}
        <div style={{ borderTop: '1px solid var(--border-soft)', padding: collapsed ? '12px 6px' : '12px 8px', flexShrink: 0 }}>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Se déconnecter' : undefined}
            className="alvio-nav-item"
            style={{
              display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 9,
              padding: collapsed ? '8px 0' : '8px 10px',
              width: '100%', borderRadius: 8,
              border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--text-secondary)',
              fontSize: 12.5, justifyContent: collapsed ? 'center' : 'flex-start',
              fontFamily: 'inherit',
            }}
          >
            <LogOut size={15} strokeWidth={1.6} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            {!collapsed && 'Se déconnecter'}
          </button>
        </div>
      </div>

      {/* ── Bouton collapse — bord droit, centre vertical ── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Développer' : 'Réduire'}
        style={{
          position: 'absolute',
          right: -10,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 20, height: 20,
          borderRadius: '50%',
          border: '1px solid var(--border-light)',
          background: 'var(--bg-card)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 20,
          transition: 'background 0.12s, box-shadow 0.12s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--alvio-champagne-light)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'
        }}
      >
        <ChevronLeft
          size={10} strokeWidth={2.2} color="var(--text-muted)"
          style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
        />
      </button>
    </aside>
  )
}
