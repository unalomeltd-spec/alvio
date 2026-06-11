'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp, FileText, Activity,
  Settings, CheckSquare, LogOut, ChevronLeft,
} from 'lucide-react'
import { useActiveCompany } from '@/hooks/useActiveCompany'

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
    <div style={{
      display: 'flex', alignItems: 'center',
      gap: collapsed ? 0 : 10,
      padding: collapsed ? '16px 0' : '16px 16px 14px',
      borderBottom: '1px solid var(--border-soft)',
      justifyContent: collapsed ? 'center' : 'flex-start',
      flexShrink: 0,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: 'var(--alvio-champagne-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 24 24" width={13} height={13} fill="var(--alvio-champagne-dark)" aria-hidden="true">
          <polygon points="12,2 15.5,8.5 22,6.5 17,13.5 19.5,21 12,17 4.5,21 7,13.5 2,6.5 8.5,8.5" />
        </svg>
      </div>
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
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted || !session?.user?.email) return
        setUserEmail(session.user.email)
      } catch { /* silent */ }
    })()
    return () => { mounted = false }
  }, [])

  const handleLogout = async () => {
    try {
      const { createBrowserClient } = await import('@supabase/ssr')
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      )
      await supabase.auth.signOut()
    } catch { /* silent */ }
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
        position: 'relative',
        flexShrink: 0,
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
