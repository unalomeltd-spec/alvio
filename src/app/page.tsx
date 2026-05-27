'use client'

import { useState, useEffect, useRef } from 'react'
import AuthModal from '@/components/AuthModal'

/* ─── Ripple ─────────────────────────────────────────────────────────────── */
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

/* ─── useInView ──────────────────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

/* ─── Counter ────────────────────────────────────────────────────────────── */
function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const { ref, visible } = useInView()
  useEffect(() => {
    if (!visible) return
    const dur = 1400, start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [visible, to])
  return <span ref={ref}>{val}{suffix}</span>
}

/* ─── Nav ────────────────────────────────────────────────────────────────── */
function Nav({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const items = ['Produit', 'Fonctionnalités', 'Tarifs', 'À propos']

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const scale = (i: number) => hovered === null ? 1 : Math.abs(i - hovered) === 0 ? 1.22 : Math.abs(i - hovered) === 1 ? 1.08 : 1
  const ty    = (i: number) => hovered === null ? 0 : Math.abs(i - hovered) === 0 ? -4 : Math.abs(i - hovered) === 1 ? -2 : 0

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: 64, padding: '0 48px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: scrolled ? 'rgba(242,243,245,.88)' : 'transparent',
      backdropFilter: scrolled ? 'blur(18px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(18px)' : 'none',
      borderBottom: scrolled ? '.5px solid rgba(140,155,171,.2)' : 'none',
      transition: 'background .4s ease, border-bottom .4s ease',
    }}>
      <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-.01em' }}>
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
          <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
          <path d="M14 24C14 24 7 20 4 14C7 8 14 2 14 2" stroke="#1A1A1A" strokeWidth="1.5" fill="none"/>
          <circle cx="14" cy="14" r="2.5" fill="#1A1A1A"/>
        </svg>
        Alvio
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onMouseLeave={() => setHovered(null)}>
        {items.map((it, i) => (
          <a key={it} href={`#${it.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '-')}`}
            onMouseEnter={() => setHovered(i)}
            style={{
              fontSize: 14, color: '#1A1A1A', padding: '6px 14px', borderRadius: 10,
              display: 'inline-block', cursor: 'pointer',
              background: hovered === i ? 'rgba(26,26,26,.07)' : 'transparent',
              transform: `scale(${scale(i)}) translateY(${ty(i)}px)`,
              transition: 'transform .25s cubic-bezier(.34,1.56,.64,1), background .15s ease',
            }}>{it}</a>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onLogin} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#1A1A1A', padding: '6px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'color .15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#B8A98A')} onMouseLeave={e => (e.currentTarget.style.color = '#1A1A1A')}>
          Connexion
        </button>
        <button className="btn btn-primary btn-sm" onClick={(e) => { ripple(e); onRegister() }}>Commencer</button>
      </div>
    </nav>
  )
}

/* ─── Feature card ───────────────────────────────────────────────────────── */
function FeatCard({ icon, title, desc, delay = 0 }: { icon: string; title: string; desc: string; delay?: number }) {
  const { ref, visible } = useInView()
  const [hov, setHov] = useState(false)
  return (
    <div ref={ref} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? '#1A1A1A' : '#fff',
        border: '.5px solid rgba(140,155,171,.2)', borderRadius: 16, padding: 28,
        opacity: visible ? 1 : 0,
        transform: visible ? (hov ? 'translateY(-6px) scale(1.02)' : 'translateY(0)') : 'translateY(24px)',
        transition: `opacity .6s ease ${delay}ms, transform .35s cubic-bezier(.34,1.2,.64,1)`,
        boxShadow: hov ? '0 16px 40px rgba(26,26,26,.14)' : '0 2px 8px rgba(26,26,26,.05)',
        cursor: 'default',
      }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: hov ? 'rgba(184,169,138,.15)' : 'rgba(26,26,26,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, fontSize: 22, transition: 'background .3s ease' }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 500, color: hov ? '#F2F3F5' : '#1A1A1A', marginBottom: 8, transition: 'color .3s ease' }}>{title}</h3>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#8C9BAB', margin: 0 }}>{desc}</p>
    </div>
  )
}

/* ─── Agent FAB ──────────────────────────────────────────────────────────── */
function AgentFab() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div style={{
        position: 'fixed', bottom: 88, right: 24, zIndex: 200,
        width: 300, background: '#fff',
        border: '.5px solid rgba(140,155,171,.25)', borderRadius: 18,
        boxShadow: '0 24px 60px rgba(26,26,26,.14)', overflow: 'hidden',
        transform: open ? 'scale(1) translateY(0)' : 'scale(.9) translateY(16px)',
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition: 'all .3s cubic-bezier(.34,1.4,.64,1)', transformOrigin: 'bottom right',
      }}>
        <div style={{ background: '#1A1A1A', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#B8A98A' }}/>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#F2F3F5' }}>Agent Alvio</span>
          <span style={{ fontSize: 11, color: '#8C9BAB', marginLeft: 'auto' }}>En ligne</span>
        </div>
        <div style={{ padding: '16px 18px 12px' }}>
          <div style={{ background: '#F2F3F5', borderRadius: '12px 12px 12px 2px', padding: '12px 14px', fontSize: 13, lineHeight: 1.5, color: '#1A1A1A' }}>
            Bonjour 👋 Je suis Alvio, votre CFO digital. Quelle question financière puis-je analyser pour vous ?
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#8C9BAB', marginTop: 6 }}>À l'instant</div>
        </div>
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8 }}>
          <input placeholder="Posez une question…" style={{ flex: 1, background: '#F2F3F5', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#8C9BAB', border: 'none', fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none' }}/>
          <button style={{ width: 36, height: 36, borderRadius: 10, background: '#1A1A1A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform .2s cubic-bezier(.34,1.56,.64,1)' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7H13M8 2L13 7L8 12" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 200,
        width: 52, height: 52, borderRadius: 16, background: '#1A1A1A', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(26,26,26,.22)',
        animation: open ? 'none' : 'agent-pulse 3s ease-in-out infinite',
        transform: open ? 'rotate(45deg)' : 'scale(1)',
        transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)',
      }}>
        {open
          ? <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4L14 14M14 4L4 14" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round"/></svg>
          : <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 7H19M3 11H15M3 15H11" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round"/></svg>
        }
        {!open && <span style={{ position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%', background: '#B8A98A', border: '2px solid #F2F3F5' }}/>}
      </button>
    </>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: '📊', title: 'Tableaux de bord KPIs', desc: 'SIG complets, ratios clés et comparaison N/N-1/N-2 mis à jour en continu.', delay: 0 },
  { icon: '💬', title: 'Agent CFO en temps réel', desc: 'Posez vos questions en langage naturel. Alvio répond, anticipe et simule.', delay: 80 },
  { icon: '🔮', title: 'Prévisionnel & budget', desc: "Construisez votre budget N+1 avec l'agent et suivez les écarts en live.", delay: 160 },
  { icon: '📈', title: 'Plan de trésorerie', desc: 'Vision 12 mois glissants, flux éditables, projection cumulée automatique.', delay: 240 },
  { icon: '⚡', title: 'Simulations financières', desc: "Recrutement, investissement, perte de client — l'impact chiffré en secondes.", delay: 320 },
  { icon: '🔗', title: 'Connexion Pennylane', desc: 'Synchronisation directe avec votre cabinet comptable. Zéro saisie manuelle.', delay: 400 },
]

const TICKS = ['Soldes Intermédiaires de Gestion','Prévisionnel N+1','Budget vs Réalisé','Simulation de recrutement','Plan de trésorerie 12 mois','Connexion Pennylane','Export Excel & PDF','Analyse des marges','Point mort','BFR & liquidité']
const BAR_H = [58,74,52,88,68,84,62,96,78,70,86,75]

export default function HomePage() {
  const [authOpen, setAuthOpen]     = useState(false)
  const [authMode, setAuthMode]     = useState<'login' | 'register'>('login')
  const [heroReady, setHeroReady]   = useState(false)
  const featRef = useInView()
  const statsRef = useInView()

  useEffect(() => { const t = setTimeout(() => setHeroReady(true), 80); return () => clearTimeout(t) }, [])

  const openLogin    = () => { setAuthMode('login');    setAuthOpen(true) }
  const openRegister = () => { setAuthMode('register'); setAuthOpen(true) }

  return (
    <>
      <Nav onLogin={openLogin} onRegister={openRegister} />

      {/* ── HERO ── */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 40px 80px', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(184,169,138,.13) 0%, transparent 70%)', top: '5%', left: '-12%', animation: 'float-a 9s ease-in-out infinite', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,26,26,.06) 0%, transparent 70%)', bottom: '12%', right: '-4%', animation: 'float-b 11s ease-in-out infinite 1.5s', pointerEvents: 'none' }}/>

        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '.5px solid rgba(184,169,138,.45)', borderRadius: 100, padding: '6px 16px 6px 8px', marginBottom: 32, cursor: 'pointer', opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s var(--ease-out) .1s, transform .6s var(--ease-out) .1s' }}>
          <span style={{ background: '#B8A98A', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 100, letterSpacing: '.06em', textTransform: 'uppercase' }}>Nouveau</span>
          <span style={{ fontSize: 13, color: '#1A1A1A' }}>Connexion Pennylane disponible en V2</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7H11M8 4L11 7L8 10" stroke="#B8A98A" strokeWidth="1.2" strokeLinecap="round"/></svg>
        </div>

        <h1 style={{ fontSize: 'clamp(40px,6vw,72px)', fontWeight: 600, color: '#1A1A1A', lineHeight: 1.1, letterSpacing: '-.03em', maxWidth: 820, opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(28px)', transition: 'opacity .7s var(--ease-out) .22s, transform .7s var(--ease-out) .22s' }}>
          L'intelligence financière <em style={{ fontStyle: 'normal', color: '#B8A98A' }}>en temps réel</em>
        </h1>
        <p style={{ fontSize: 'clamp(16px,2vw,19px)', fontWeight: 300, color: '#8C9BAB', lineHeight: 1.6, maxWidth: 560, marginTop: 22, opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity .7s var(--ease-out) .36s, transform .7s var(--ease-out) .36s' }}>
          Le CFO digital des dirigeants de TPE/PME. Analyse, anticipe et simule — sans jargon, sans délai.
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 40, alignItems: 'center', opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .7s var(--ease-out) .5s, transform .7s var(--ease-out) .5s' }}>
          <button className="btn btn-primary btn-lg" onClick={(e) => { ripple(e); openRegister() }}>
            <svg width="16" height="16" viewBox="0 0 28 28" fill="none"><path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="currentColor" opacity=".7"/><circle cx="14" cy="14" r="2.5" fill="currentColor"/></svg>
            Démarrer gratuitement
          </button>
          <button className="btn btn-secondary btn-lg" onClick={(e) => { ripple(e); document.getElementById('fonctionnalites')?.scrollIntoView({ behavior: 'smooth' }) }}>
            Voir la démo
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 32, opacity: heroReady ? 1 : 0, transition: 'opacity .7s ease .64s' }}>
          <div style={{ display: 'flex' }}>
            {['#B8A98A','#8C9BAB','#1A1A1A','rgba(184,169,138,.7)'].map((c, i) => (
              <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: '2px solid #F2F3F5', marginLeft: i === 0 ? 0 : -8 }}/>
            ))}
          </div>
          <span style={{ fontSize: 13, color: '#8C9BAB' }}>+120 dirigeants déjà inscrits</span>
        </div>

        {/* Dashboard preview */}
        <div style={{ marginTop: 60, width: '100%', maxWidth: 900, background: '#fff', borderRadius: 20, border: '.5px solid rgba(140,155,171,.2)', boxShadow: '0 32px 80px rgba(26,26,26,.1)', overflow: 'hidden', opacity: heroReady ? 1 : 0, transform: heroReady ? 'translateY(0) scale(1)' : 'translateY(40px) scale(.97)', transition: 'opacity .9s var(--ease-out) .4s, transform .9s var(--ease-out) .4s' }}>
          <div style={{ background: '#1A1A1A', padding: '13px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {['#ff5f57','#febc2e','#28c840'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }}/>)}
            <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#8C9BAB' }}>app.alvio.finance — Dashboard</div>
          </div>
          <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[
              { label: "Chiffre d'affaires", value: '487 300 €', delta: '+12.4%', up: true },
              { label: 'EBE', value: '68 900 €', delta: '+3.1%', up: true },
              { label: 'Trésorerie nette', value: '142 100 €', delta: '−4.2%', up: false },
            ].map((k, i) => (
              <div key={i} style={{ background: '#F2F3F5', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-.02em' }}>{k.value}</div>
                <div style={{ fontSize: 12, color: k.up ? '#2a9d5c' : '#e25c5c', marginTop: 4 }}>{k.delta} vs N-1</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '4px 24px 24px', display: 'flex', gap: 6, alignItems: 'flex-end', height: 96 }}>
            {BAR_H.map((h, i) => (
              <div key={i} style={{ flex: 1, borderRadius: '4px 4px 0 0', height: `${h}%`, background: i === 7 ? '#B8A98A' : 'rgba(26,26,26,.09)', animation: `bar-grow .6s cubic-bezier(.34,1.2,.64,1) ${i * 50}ms backwards` }}/>
            ))}
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div style={{ overflow: 'hidden', borderTop: '.5px solid rgba(140,155,171,.15)', borderBottom: '.5px solid rgba(140,155,171,.15)', padding: '11px 0' }}>
        <div style={{ display: 'flex', width: 'max-content', animation: 'ticker-scroll 28s linear infinite' }}>
          {[...TICKS, ...TICKS].map((t, i) => (
            <span key={i} style={{ fontSize: 13, color: '#8C9BAB', padding: '0 28px', whiteSpace: 'nowrap' }}>
              {t}<span style={{ color: '#B8A98A', marginLeft: 28 }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── STATS ── */}
      <section style={{ padding: '84px 40px', background: '#fff' }}>
        <div ref={statsRef.ref} style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 48, textAlign: 'center' }}>
          {[{ v: 120, s: '+', l: 'Dirigeants actifs', d: 0 }, { v: 48, s: 'h', l: 'Données disponibles', d: 120 }, { v: 5, s: ' min', l: 'Pour le premier insight', d: 240 }].map((st, i) => (
            <div key={i} className="reveal" style={{ transitionDelay: `${st.d}ms` }}>
              <div style={{ fontSize: 52, fontWeight: 600, color: '#1A1A1A', letterSpacing: '-.03em', lineHeight: 1 }}>
                <Counter to={st.v} suffix={st.s}/>
              </div>
              <div style={{ fontSize: 14, color: '#8C9BAB', marginTop: 8 }}>{st.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="fonctionnalites" style={{ padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div ref={featRef.ref} className="reveal" style={{ textAlign: 'center', marginBottom: 52 }}>
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, color: '#B8A98A', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 16 }}>Fonctionnalités</span>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 600, color: '#1A1A1A', letterSpacing: '-.025em', lineHeight: 1.15 }}>
              Tout ce qu'un CFO ferait.<br/>En quelques secondes.
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
            {FEATURES.map(f => <FeatCard key={f.title} {...f}/>)}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '96px 40px', background: '#1A1A1A', textAlign: 'center' }}>
        <div className="reveal" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 600, color: '#F2F3F5', letterSpacing: '-.025em', lineHeight: 1.15, marginBottom: 18 }}>Votre CFO digital vous attend.</h2>
          <p style={{ fontSize: 16, fontWeight: 300, color: '#8C9BAB', lineHeight: 1.6, marginBottom: 40 }}>Créez votre compte en 2 minutes. Aucune carte bancaire requise.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-lg" onClick={(e) => { ripple(e); openRegister() }}>Commencer gratuitement</button>
            <button className="btn btn-dark-ghost btn-lg" onClick={(e) => ripple(e)}>Parler à l'équipe</button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '36px 48px', borderTop: '.5px solid rgba(140,155,171,.2)', background: '#F2F3F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none"><path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/><circle cx="14" cy="14" r="2.5" fill="#1A1A1A"/></svg>
          Alvio
        </div>
        <span style={{ fontSize: 13, color: '#8C9BAB' }}>© 2026 Alvio — L'intelligence financière en temps réel</span>
      </footer>

      {/* ── REVEAL OBSERVER ── */}
      <RevealObserver/>

      {/* ── AGENT ── */}
      <AgentFab/>

      {/* ── AUTH MODAL ── */}
      <AuthModal open={authOpen} defaultMode={authMode} onClose={() => setAuthOpen(false)}/>
    </>
  )
}

function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target) } })
    }, { threshold: 0.15 })
    document.querySelectorAll('.reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
  return null
}
