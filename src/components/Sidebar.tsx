'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp, FileText, Activity,
  Settings, CheckSquare, Building2,
  ChevronDown, ChevronLeft, LogOut,
} from 'lucide-react'
import { useActiveCompany } from '@/hooks/useActiveCompany'

/* ─── types ──────────────────────────────────────────── */

interface NavItemDef {
  href: string
  label: string
  icon: React.ElementType
}

/* ─── navigation ─────────────────────────────────────── */

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
          <div style={{
            fontWeight: 700, fontSize: 13, letterSpacing: '0.07em',
            color: 'var(--text-primary)', whiteSpace: 'nowrap',
          }}>ALVIO</div>
          <div style={{
            fontSize: 9, color: 'var(--alvio-champagne)', fontWeight: 500,
            letterSpacing: '0.07em', marginTop: 2, whiteSpace: 'nowrap',
          }}>CFO DIGITAL</div>
        </div>
      )}
    </div>
  )
}

/* ─── NavLink ────────────────────────────────────────── */

function NavLink({
  href, label, icon: Icon, active, collapsed,
}: NavItemDef & { active: boolean; collapsed: boolean }) {
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
        <Icon
          size={15} strokeWidth={active ? 2 : 1.6}
          color={active ? 'var(--alvio-champagne)' : 'var(--text-muted)'}
          style={{ flexShrink: 0 }}
        />
        {!collapsed && label}
      </div>
    </Link>
  )
}

/* ─── Sidebar ────────────────────────────────────────── */

export default function Sidebar({ activePage: _a }: { activePage?: string } = {}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [userEmail, setUserEmail]     = useState<string | null>(null)
  const [userDisplay, setUserDisplay] = useState<string | null>(null)
  const [userInitials, setUserInitials] = useState('AL')
  const { activeCompany, companies } = useActiveCompany()

  /* ── Session utilisateur ── */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { createBrowserClient } = await import('@supabase/ssr')
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        /* getSession lit depuis les cookies sans appel réseau */
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted || !session?.user) return

        const user = session.user
        setUserEmail(user.email ?? null)

        type Meta = { full_name?: string; name?: string }
        const meta = (user.user_metadata ?? {}) as Meta
        const fullName = meta.full_name ?? meta.name

        if (fullName) {
          const parts = fullName.trim().split(/\s+/)
          const initials = (
            parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')
          ).toUpperCase()
          const display = parts.length > 1
            ? `${parts[0][0]}. ${parts[parts.length - 1]}`
            : parts[0]
          setUserInitials(initials)
          setUserDisplay(display)
        } else if (user.email) {
          const local = user.email.split('@')[0]
          setUserInitials(local.slice(0, 2).toUpperCase())
          setUserDisplay(local)
        }
      } catch { /* silent */ }
    })()
    return () => { mounted = false }
  }, [])

  /* ── Déconnexion ── */
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

  /* ── Masquage Suivi demandes pour le compte admin ── */
  const secondaryNav = SECONDARY_NAV.filter(
    item => !(item.href === '/suivi' && userEmail === 'hello@alvio.finance'),
  )

  const WIDTH = collapsed ? 60 : 220

  return (
    <aside
      aria-label="Navigation principale"
      style={{
        width: WIDTH, minWidth: WIDTH,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border-light)',
        display: 'flex', flexDirection: 'column',
        height: '100vh',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <Logo collapsed={collapsed} />

      {/* Navigation */}
      <nav style={{ flex: 1, padding: collapsed ? '10px 6px' : '10px 8px', overflowY: 'auto' }}>
        {MAIN_NAV.map(item => (
          <NavLink
            key={item.href} {...item}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            collapsed={collapsed}
          />
        ))}

        <div style={{ height: 1, background: 'var(--border-soft)', margin: '10px 4px' }} />

        {secondaryNav.map(item => (
          <NavLink
            key={item.href} {...item}
            active={pathname === item.href || pathname.startsWith(item.href + '/')}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Bas */}
      <div style={{
        borderTop: '1px solid var(--border-soft)',
        padding: collapsed ? '10px 6px' : '10px 8px',
        flexShrink: 0,
      }}>

        {/* Dossier actif — affichage seul, sans lien */}
        <div
          title={collapsed ? (activeCompany?.nom ?? 'Dossier') : undefined}
          style={{
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 9,
            padding: collapsed ? '8px 0' : '8px 10px',
            borderRadius: 8, marginBottom: 2,
            color: 'var(--text-secondary)', fontSize: 12.5,
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <Building2 size={15} strokeWidth={1.6} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          {!collapsed && (
            <>
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', fontSize: 12.5,
              }}>
                {activeCompany?.nom ?? '—'}
              </span>
              {(companies?.length ?? 0) > 1 && (
                <ChevronDown size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              )}
            </>
          )}
        </div>

        {/* Utilisateur + bouton logout */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 9,
          padding: collapsed ? '8px 0' : '8px 10px',
          borderRadius: 8, marginBottom: 2,
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          {/* Avatar */}
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--alvio-champagne-light)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 600, color: 'var(--alvio-champagne-dark)',
            letterSpacing: '0.04em',
          }}>
            {userInitials}
          </div>
          {!collapsed && (
            <>
              <span style={{
                flex: 1, color: 'var(--text-secondary)', fontSize: 12.5,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {userDisplay ?? '…'}
              </span>
              {/* Logout */}
              <button
                onClick={handleLogout}
                title="Déconnexion"
                className="alvio-nav-item"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: 6,
                  border: 'none', background: 'transparent',
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                <LogOut size={13} strokeWidth={1.6} color="var(--text-muted)" />
              </button>
            </>
          )}
        </div>

        {/* Collapse — chevron seul */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Développer' : 'Réduire'}
          className="alvio-nav-item"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 7,
            border: '1px solid var(--border-light)',
            background: 'transparent', cursor: 'pointer',
            margin: '6px auto 0',
          }}
        >
          <ChevronLeft
            size={13} strokeWidth={1.8} color="var(--text-muted)"
            style={{
              transform: collapsed ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </button>
      </div>
    </aside>
  )
}
