'use client'
import { useState, useEffect, useRef } from 'react'
import AuthModal from '@/components/AuthModal'

/* ── Ripple ── */
function ripple(e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height)
  const s = document.createElement('span')
  s.className = 'ripple-span'
  s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`
  el.appendChild(s)
  setTimeout(() => s.remove(), 600)
}

/* ── useInView ── */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ── Nav ── */
function Nav({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const items = ['Produit', 'Fonctionnalités', 'Tarifs', 'À propos']

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const navStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    height: 64, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 16,
    background: scrolled || menuOpen ? 'rgba(250,250,248,.97)' : 'transparent',
    backdropFilter: scrolled || menuOpen ? 'blur(20px)' : 'none',
    WebkitBackdropFilter: scrolled || menuOpen ? 'blur(20px)' : 'none',
    borderBottom: scrolled ? '1px solid rgba(26,26,26,.07)' : 'none',
    transition: 'background .3s ease, border-bottom .3s ease',
  }

  return (
    <>
      {/* Desktop nav */}
      <nav className="nav-desktop" style={navStyle}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 17, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-.02em', flexShrink: 0 }}>
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
            <path d="M14 24C14 24 7 20 4 14C7 8 14 2 14 2" stroke="#1A1A1A" strokeWidth="1.5" fill="none"/>
            <circle cx="14" cy="14" r="2.5" fill="#1A1A1A"/>
          </svg>
          Alvio
        </a>

        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          {items.map(it => (
            <a key={it}
              href={`#${it.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '-')}`}
              style={{
                fontSize: 14, fontWeight: 500, color: '#5C6670', padding: '6px 13px',
                borderRadius: 7, whiteSpace: 'nowrap', cursor: 'pointer',
                position: 'relative', transition: 'color .2s ease', textDecoration: 'none',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#1A1A1A'
                const u = e.currentTarget.querySelector('.nav-underline') as HTMLElement
                if (u) u.style.transform = 'scaleX(1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#5C6670'
                const u = e.currentTarget.querySelector('.nav-underline') as HTMLElement
                if (u) u.style.transform = 'scaleX(0)'
              }}
            >
              {it}
              <span className="nav-underline" style={{
                position: 'absolute', bottom: 0, left: 13, right: 13, height: 1.5,
                background: '#B8A98A', borderRadius: 2,
                transform: 'scaleX(0)', transition: 'transform .2s ease', transformOrigin: 'left',
                display: 'block',
              }}/>
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={onLogin} className="btn btn-outline btn-sm">Se connecter</button>
          <button onClick={e => { ripple(e); onRegister() }} className="btn btn-primary btn-sm">Démarrer maintenant</button>
        </div>
      </nav>

      {/* Mobile nav */}
      <nav className="nav-burger" style={{
        ...navStyle,
        display: 'none',
        justifyContent: 'space-between',
      }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: '#1A1A1A' }}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
            <circle cx="14" cy="14" r="2.5" fill="#1A1A1A"/>
          </svg>
          Alvio
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={e => { ripple(e); onRegister() }} className="btn btn-primary btn-sm" style={{ fontSize: 12, padding: '7px 14px' }}>Démarrer</button>
          <button onClick={() => setMenuOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ display: 'block', width: 22, height: 1.5, background: '#1A1A1A', transition: 'all .3s', transform: menuOpen ? 'rotate(45deg) translate(4.5px,4.5px)' : 'none' }}/>
            <span style={{ display: 'block', width: 22, height: 1.5, background: '#1A1A1A', transition: 'all .3s', opacity: menuOpen ? 0 : 1 }}/>
            <span style={{ display: 'block', width: 22, height: 1.5, background: '#1A1A1A', transition: 'all .3s', transform: menuOpen ? 'rotate(-45deg) translate(4.5px,-4.5px)' : 'none' }}/>
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className="nav-drawer" style={{
        position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99,
        background: 'rgba(250,250,248,.97)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '8px 24px 28px',
        transform: menuOpen ? 'translateY(0)' : 'translateY(-110%)',
        transition: 'transform .35s cubic-bezier(.34,1.2,.64,1)',
        borderBottom: '1px solid rgba(26,26,26,.07)',
      }}>
        {items.map(it => (
          <a key={it}
            href={`#${it.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '-')}`}
            onClick={() => setMenuOpen(false)}
            style={{ display: 'block', fontSize: 17, fontWeight: 500, color: '#1A1A1A', padding: '14px 0', borderBottom: '1px solid rgba(26,26,26,.06)', textDecoration: 'none' }}>
            {it}
          </a>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
          <button onClick={e => { ripple(e); onRegister(); setMenuOpen(false) }} className="btn btn-primary btn-lg" style={{ justifyContent: 'center' }}>Démarrer maintenant</button>
          <button onClick={() => { onLogin(); setMenuOpen(false) }} style={{ background: 'none', border: '1px solid rgba(26,26,26,.2)', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: '#1A1A1A', padding: '12px', fontFamily: 'Plus Jakarta Sans, sans-serif', width: '100%' }}>
            Se connecter
          </button>
        </div>
      </div>
    </>
  )
}

/* ── Dashboard Mock ── */
const BAR_H = [48, 62, 44, 78, 58, 74, 52, 90, 68, 80, 72, 65]

function DashboardMock() {
  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1px solid rgba(26,26,26,.08)', boxShadow: '0 24px 64px rgba(26,26,26,.1)', overflow: 'hidden', width: '100%', maxWidth: 460 }}>
      <div style={{ background: '#1A1A1A', padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 7 }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }}/>)}
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#8C9BAB', letterSpacing: '.03em' }}>beta.alvio.finance — Dashboard</span>
      </div>
      <div style={{ padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 12 }}>
          {[
            { l: "Chiffre d'affaires", v: '487 300 €', d: '+12.4%', up: true },
            { l: 'EBE', v: '68 900 €', d: '+3.1%', up: true },
            { l: 'Trésorerie nette', v: '142 100 €', d: '−4.2%', up: false },
          ].map((k, i) => (
            <div key={i} style={{ background: '#F5F2EC', borderRadius: 11, padding: '11px 12px' }}>
              <div style={{ fontSize: 9, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 5 }}>{k.l}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-.02em' }}>{k.v}</div>
              <div style={{ fontSize: 10, color: k.up ? '#2a9d5c' : '#e25c5c', marginTop: 3, fontWeight: 700 }}>{k.d} vs N-1</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#F5F2EC', borderRadius: 11, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1A' }}>Trésorerie — 12 mois</span>
            <span style={{ fontSize: 11, color: '#2a9d5c', fontWeight: 700 }}>+8.2%</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 64 }}>
            {BAR_H.map((h, i) => (
              <div key={i} style={{ flex: 1, borderRadius: '3px 3px 0 0', height: `${h}%`, background: i === 7 ? '#B8A98A' : i === 11 ? '#1A1A1A' : 'rgba(26,26,26,.1)', animation: `bar-grow .5s ease ${i * 40}ms backwards` }}/>
            ))}
          </div>
        </div>
        <div style={{ background: '#1A1A1A', borderRadius: 11, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(184,169,138,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15 }}>💬</div>
          <div>
            <div style={{ fontSize: 10, color: '#8C9BAB', marginBottom: 2 }}>Agent Alvio</div>
            <div style={{ fontSize: 12, color: '#F2F3F5', fontWeight: 500, lineHeight: 1.45 }}>Votre trésorerie est saine. Marge EBE en hausse de 3.1%.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Feature Card ── */
function FeatCard({ icon, title, desc, delay = 0 }: { icon: string; title: string; desc: string; delay?: number }) {
  const { ref, visible } = useInView()
  const [hov, setHov] = useState(false)
  return (
    <div ref={ref} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? '#1A1A1A' : '#fff',
        border: '1px solid rgba(26,26,26,.08)', borderRadius: 16, padding: 26,
        opacity: 1,
        transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        transition: `opacity .5s ease ${delay}ms, transform .4s var(--ease-out), background .25s ease`,
        boxShadow: hov ? '0 16px 40px rgba(26,26,26,.12)' : '0 2px 8px rgba(26,26,26,.04)',
      }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: hov ? 'rgba(184,169,138,.15)' : '#F5F2EC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 20, transition: 'background .25s' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: hov ? '#F2F3F5' : '#1A1A1A', marginBottom: 8, transition: 'color .25s' }}>{title}</h3>
      <p style={{ fontSize: 13, lineHeight: 1.65, color: '#8C9BAB', margin: 0 }}>{desc}</p>
    </div>
  )
}

/* ── Agent FAB ── */
function AgentFab() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div style={{
        position: 'fixed', bottom: 88, right: 24, zIndex: 200, width: 320,
        background: '#fff', border: '1px solid rgba(26,26,26,.1)', borderRadius: 20,
        boxShadow: '0 20px 60px rgba(26,26,26,.15)', overflow: 'hidden',
        transform: open ? 'scale(1) translateY(0)' : 'scale(.92) translateY(16px)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'all .3s cubic-bezier(.34,1.4,.64,1)', transformOrigin: 'bottom right',
      }}>
        <div style={{ background: '#1A1A1A', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#B8A98A' }}/>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Agent Alvio</span>
          <span style={{ fontSize: 11, color: '#8C9BAB', marginLeft: 'auto' }}>En ligne</span>
        </div>
        <div style={{ padding: '16px 18px 12px' }}>
          <div style={{ background: '#F5F2EC', borderRadius: '12px 12px 12px 2px', padding: '11px 14px', fontSize: 13, lineHeight: 1.55, color: '#1A1A1A' }}>
            Bonjour 👋 Je suis Alvio, votre CFO digital. Quelle question financière puis-je analyser pour vous ?
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#8C9BAB', marginTop: 5 }}>À l&apos;instant</div>
        </div>
        <div style={{ padding: '0 12px 14px', display: 'flex', gap: 8 }}>
          <input placeholder="Posez une question…" style={{ flex: 1, background: '#F5F2EC', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#8C9BAB', border: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none' }}/>
          <button
            style={{ width: 38, height: 38, borderRadius: 10, background: '#1A1A1A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#B8A98A')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1A1A1A')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7H13M8 2L13 7L8 12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 200,
        width: 54, height: 54, borderRadius: 16, background: '#1A1A1A', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(26,26,26,.22)',
        animation: open ? 'none' : 'agent-pulse 3s ease-in-out infinite',
        transform: open ? 'rotate(45deg)' : 'scale(1)',
        transition: 'transform .3s var(--spring)',
      }}>
        {open
          ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4L14 14M14 4L4 14" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round"/></svg>
          : <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 7H19M3 11H15M3 15H11" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round"/></svg>
        }
        {!open && <span style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: '#B8A98A', border: '2px solid #FAFAF8' }}/>}
      </button>
    </>
  )
}

/* ── Features data ── */
const FEATURES = [
  { icon: '💬', title: 'Agent CFO en temps réel', desc: 'Posez vos questions en langage naturel. Alvio répond, anticipe les risques et simule vos décisions.', delay: 0 },
  { icon: '📊', title: 'Tableaux de bord KPIs', desc: 'SIG complets, ratios clés, comparaison N/N-1/N-2. Toute votre santé financière en un coup d\'œil.', delay: 60 },
  { icon: '🔮', title: 'Prévisionnel & budget', desc: 'Budget N+1 construit avec l\'agent. Suivi des écarts en live, hypothèses modifiables à tout moment.', delay: 120 },
  { icon: '📈', title: 'Plan de trésorerie', desc: 'Vision 12 mois glissants, flux éditables, projection cumulée automatique. Anticipez les tensions.', delay: 180 },
  { icon: '⚡', title: 'Simulations financières', desc: 'Recrutement, investissement, perte client — l\'impact chiffré en quelques secondes.', delay: 240 },
  { icon: '🔗', title: 'Connexion Pennylane', desc: 'Synchronisation directe avec votre cabinet comptable. Zéro saisie manuelle, données toujours à jour.', delay: 300 },
]

const FEAT_BAR = [
  { icon: '📊', label: 'Tableaux KPIs' }, { icon: '💬', label: 'Agent CFO' },
  { icon: '📈', label: 'Trésorerie' }, { icon: '🔮', label: 'Prévisionnel' },
  { icon: '⚡', label: 'Simulations' }, { icon: '🔗', label: 'Pennylane' },
]

/* ── Page ── */
export default function HomePage() {
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const featRef = useInView()
  const ctaRef = useInView()

  const openLogin = () => { setAuthMode('login'); setAuthOpen(true) }
  const openRegister = () => { setAuthMode('register'); setAuthOpen(true) }

  return (
    <>
      <Nav onLogin={openLogin} onRegister={openRegister}/>

      {/* HERO */}
      <section className="hero-section" style={{
        minHeight: '100vh', background: 'linear-gradient(155deg,#F5F2EC 0%,#FAFAF8 50%,#EDF3EF 100%)',
        display: 'flex', alignItems: 'center', padding: '100px 48px 64px', gap: 56, overflow: 'hidden',
      }}>
        <div className="hero-left" style={{ flex: '0 0 480px', minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(184,169,138,.15)', border: '1px solid rgba(184,169,138,.3)', borderRadius: 100, padding: '5px 13px', fontSize: 11, fontWeight: 800, color: '#9A8B72', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 24, animation: 'fade-up .6s var(--ease-out) .1s backwards' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B8A98A', display: 'inline-block' }}/>
            CFO Digital — Toutes structures
          </div>
          <h1 className="hero-h1" style={{ fontSize: 'clamp(36px,4vw,60px)', fontWeight: 800, color: '#1A1A1A', lineHeight: 1.07, letterSpacing: '-.03em', marginBottom: 22, animation: 'fade-up .7s var(--ease-out) .18s backwards' }}>
            L&apos;intelligence<br/>financière{' '}
            <em style={{ fontStyle: 'normal', color: '#B8A98A' }}>en temps réel</em>
          </h1>
          <p className="hero-sub" style={{ fontSize: 17, color: '#5C6670', lineHeight: 1.65, maxWidth: 440, marginBottom: 34, animation: 'fade-up .7s var(--ease-out) .26s backwards' }}>
            Le CFO digital pour toutes les structures qui ont des comptes à tenir — PME, associations, SCI, fondations et bien d&apos;autres.
          </p>
          <div className="hero-ctas" style={{ display: 'flex', gap: 12, marginBottom: 36, flexWrap: 'wrap', animation: 'fade-up .7s var(--ease-out) .34s backwards' }}>
            <button className="btn btn-primary btn-lg" onClick={e => { ripple(e); openRegister() }}>
              Démarrer maintenant
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="btn btn-outline btn-lg" onClick={e => { ripple(e); openLogin() }}>Se connecter</button>
          </div>
          <div className="hero-social" style={{ display: 'flex', alignItems: 'center', gap: 14, animation: 'fade-in .7s ease .5s backwards' }}>
            <div style={{ display: 'flex' }}>
              {['#B8A98A', '#8C9BAB', '#1A1A1A', '#D4C5A9'].map((c, i) => (
                <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: '2.5px solid #FAFAF8', marginLeft: i === 0 ? 0 : -10 }}/>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>Accès bêta gratuit</div>
              <div style={{ fontSize: 12, color: '#8C9BAB' }}>Rejoignez les premiers utilisateurs</div>
            </div>
          </div>
        </div>
        <div className="hero-right" style={{ flex: 1, display: 'flex', justifyContent: 'center', animation: 'fade-up .9s var(--ease-out) .22s backwards' }}>
          <DashboardMock/>
        </div>
      </section>

      {/* FEAT BAR */}
      <div style={{ background: '#1A1A1A', padding: '18px 48px' }}>
        <div className="feat-bar-inner" style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {FEAT_BAR.map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17 }}>{f.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#F2F3F5', whiteSpace: 'nowrap' }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="fonctionnalites" className="features-section" style={{ padding: '96px 48px', background: '#FAFAF8' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div ref={featRef.ref} style={{ textAlign: 'center', marginBottom: 56 }}>
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 800, color: '#B8A98A', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 14 }}>Fonctionnalités</span>
            <h2 style={{ fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 800, color: '#1A1A1A', letterSpacing: '-.025em', lineHeight: 1.12, marginBottom: 16 }}>
              Tout ce qu&apos;un CFO ferait.<br/>
              <em style={{ fontStyle: 'normal', color: '#B8A98A' }}>En quelques secondes.</em>
            </h2>
            <p style={{ fontSize: 16, color: '#5C6670', maxWidth: 480, margin: '0 auto', lineHeight: 1.65 }}>
              Alvio centralise l&apos;analyse financière pour que vous puissiez prendre de meilleures décisions, plus vite.
            </p>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {FEATURES.map(f => <FeatCard key={f.title} {...f}/>)}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section" style={{ padding: '96px 48px', background: '#1A1A1A' }}>
        <div ref={ctaRef.ref} style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 800, color: '#F2F3F5', letterSpacing: '-.025em', lineHeight: 1.12, marginBottom: 18 }}>
            Votre CFO digital<br/>
            <em style={{ fontStyle: 'normal', color: '#B8A98A' }}>vous attend.</em>
          </h2>
          <p style={{ fontSize: 16, color: '#8C9BAB', lineHeight: 1.65, marginBottom: 36 }}>Créez votre compte en 2 minutes. Accès bêta gratuit.</p>
          <div className="cta-btns" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-champagne btn-lg" onClick={e => { ripple(e); openRegister() }}>
              Commencer gratuitement
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <a href="mailto:hello@alvio.finance" className="btn btn-ghost-white btn-lg" style={{ textDecoration: 'none' }}>
              Parler à l&apos;équipe
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#111', padding: '28px 48px' }}>
        <div className="footer-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#fff' }}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none"><path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/><circle cx="14" cy="14" r="2.5" fill="#fff"/></svg>
            Alvio
          </div>
          <span style={{ fontSize: 12, color: '#5C6670' }}>© 2026 Alvio — L&apos;intelligence financière en temps réel</span>
        </div>
      </footer>

      <RevealObserver/>
      <AgentFab/>
      <AuthModal open={authOpen} defaultMode={authMode} onClose={() => setAuthOpen(false)}/>
    </>
  )
}

function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target) } })
    }, { threshold: 0.12 })
    document.querySelectorAll('.reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
  return null
}
