'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Données fictives mockup — jamais de données réelles ──────────────────
const MOCK_SIG = [
  { label: "Chiffre d'affaires",      n: "1 240 000 €", pct: "100.0%", n1: "1 108 000 €", pct1: "100.0%", color: "#B8A98A", highlight: false },
  { label: "Valeur ajoutée",          n: "820 000 €",   pct: "66.1%",  n1: "718 000 €",   pct1: "64.8%",  color: "#B8A98A", highlight: false },
  { label: "EBE",                     n: "148 000 €",   pct: "11.9%",  n1: "112 000 €",   pct1: "10.1%",  color: "#0F8A5F", highlight: true  },
  { label: "Résultat d'exploitation", n: "92 000 €",    pct: "7.4%",   n1: "64 000 €",    pct1: "5.8%",   color: "#0F8A5F", highlight: false },
  { label: "Résultat net",            n: "74 000 €",    pct: "6.0%",   n1: "48 000 €",    pct1: "4.3%",   color: "#0F8A5F", highlight: false },
]
const MOCK_BILAN = {
  actif:  [
    { label: "Immobilisations nettes", v: "380 000 €" },
    { label: "Créances clients",       v: "210 000 €" },
    { label: "Disponibilités",         v: "142 000 €", color: "#0F8A5F" },
  ],
  passif: [
    { label: "Capitaux propres",       v: "320 000 €", color: "#0F8A5F" },
    { label: "Emprunts & dettes LT",   v: "280 000 €" },
    { label: "Dettes CT",              v: "132 000 €" },
  ],
}
const MOCK_MONTHS = [42, 58, 51, 67, 73, 88, 82, 95, 79, 104, 98, 112]
const MAX_VAL = Math.max(...MOCK_MONTHS)
const MOIS_COURT = ['J','F','M','A','M','J','J','A','S','O','N','D']

const FEATURES = [
  {
    svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--alvio-champagne)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
    title: 'Import FEC universel',
    desc: 'Glissez votre fichier FEC — CR, Bilan, SIG et trésorerie calculés en une passe. 673 règles PCG 2025, validé sur dossiers réels.',
  },
  {
    svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--alvio-champagne)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
    title: 'Connexion Pennylane',
    desc: 'Synchronisez vos exercices en un clic depuis Pennylane. Exercices décalés supportés, token chiffré, zéro export manuel.',
  },
  {
    svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--alvio-champagne)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    title: 'Comparaison N / N-1',
    desc: 'Exercice, trimestre ou période personnalisée. La période N-1 correspondante se calcule automatiquement.',
  },
  {
    svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--alvio-champagne)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
    title: "Drill down jusqu'à l'écriture",
    desc: "Cliquez sur n'importe quelle ligne pour voir les comptes sous-jacents, puis chaque écriture du FEC.",
  },
]

// ── Composants mockup ─────────────────────────────────────────────────────

function MockupSIG() {
  return (
    <div style={{ background: 'var(--bg-main)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8 }}>Soldes intermédiaires de gestion</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px', marginBottom: 4 }}>
        <div style={{ fontSize: 7, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' as const }}>Indicateur</div>
        <div style={{ fontSize: 7, color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' as const }}>N</div>
        <div style={{ fontSize: 7, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' as const }}>N-1</div>
      </div>
      {MOCK_SIG.map((row, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr 72px 72px', alignItems: 'center',
          background: row.highlight ? 'var(--alvio-champagne-subtle)' : 'var(--bg-card)',
          borderLeft: `2px solid ${row.highlight ? 'var(--alvio-champagne)' : row.color}`,
          borderRadius: '0 6px 6px 0',
          padding: '4px 8px', marginBottom: 2,
        }}>
          <div style={{ fontSize: 8, fontWeight: row.highlight ? 600 : 400, color: 'var(--text-primary)', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{row.label}</div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: row.highlight ? 'var(--alvio-champagne-dark)' : row.color }}>{row.n}</div>
            <div style={{ fontSize: 7, color: 'var(--text-muted)' }}>{row.pct}</div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>{row.n1}</div>
            <div style={{ fontSize: 7, color: 'var(--text-muted)' }}>{row.pct1}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MockupBilan() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {(['actif', 'passif'] as const).map(side => (
        <div key={side} style={{ background: 'var(--bg-main)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-light)' }}>
          <div style={{ background: 'var(--alvio-champagne-subtle)', borderBottom: '1px solid var(--alvio-champagne-light)', padding: '5px 10px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 7, fontWeight: 700, color: 'var(--alvio-champagne-dark)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>{side}</span>
            <span style={{ fontSize: 7, fontWeight: 600, color: 'var(--alvio-champagne)' }}>732 000 €</span>
          </div>
          {MOCK_BILAN[side].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', borderBottom: '0.5px solid var(--border-soft)', background: 'var(--bg-card)' }}>
              <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ fontSize: 8, fontWeight: 600, color: row.color || 'var(--text-primary)' }}>{row.v}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function MockupCashflow() {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Trésorerie — 12 mois</span>
        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--success)' }}>+18.4 %</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
        {MOCK_MONTHS.map((v, i) => (
          <div key={i} style={{
            flex: 1, height: `${(v / MAX_VAL) * 100}%`,
            background: i === MOCK_MONTHS.length - 1 ? 'var(--alvio-champagne)' : 'var(--alvio-champagne-light)',
            borderRadius: '2px 2px 0 0',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 3 }}>
        {MOIS_COURT.map(m => <span key={m} style={{ fontSize: 6, color: 'var(--text-muted)', flex: 1, textAlign: 'center' as const }}>{m}</span>)}
      </div>
    </div>
  )
}

function MockupAlvioBlock() {
  const [displayed, setDisplayed] = useState('')
  const text = "EBE en hausse de +3.1 pts — marge d'exploitation solide. Trésorerie à surveiller en Q4."
  useEffect(() => {
    let i = 0
    const id = setInterval(() => {
      if (i <= text.length) { setDisplayed(text.slice(0, i)); i++ }
      else clearInterval(id)
    }, 22)
    return () => clearInterval(id)
  }, [])
  return (
    <div style={{ background: 'var(--bg-card)', border: '0.5px solid rgba(184,169,138,0.3)', borderLeft: '3px solid var(--alvio-champagne)', borderRadius: '0 8px 8px 0', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--alvio-champagne-subtle)', border: '0.5px solid var(--alvio-champagne-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
            <circle cx="14" cy="14" r="2.5" fill="#fff"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-primary)' }}>Alvio</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--success)' }} />
            <span style={{ fontSize: 7, color: 'var(--text-muted)' }}>CFO Digital</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-primary)', lineHeight: 1.6 }}>
        {displayed}
        {displayed.length < text.length && (
          <span style={{ display: 'inline-block', width: 1, height: 10, background: 'var(--alvio-champagne)', marginLeft: 1, verticalAlign: 'middle', animation: 'twBlink .9s step-end infinite' }} />
        )}
      </div>
    </div>
  )
}


function MockupCR() {
  const rows = [
    { label: 'Production vendue',         v: '1 240 000 €', v1: '1 108 000 €', pct: '+12%', pos: true },
    { label: 'Services extérieurs',       v: '   188 000 €', v1: '   162 000 €', pct: '+16%', pos: false },
    { label: 'Charges de personnel',      v: '   310 000 €', v1: '   278 000 €', pct: '+12%', pos: false },
    { label: 'Dotations amortissements',  v: '    62 000 €', v1: '    48 000 €', pct: '+29%', pos: false },
  ]
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-light)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 44px', background: 'var(--alvio-champagne-subtle)', padding: '6px 12px', gap: 0 }}>
        {['Libellé', 'Exercice', 'N-1', 'Var.'].map(h => (
          <div key={h} style={{ fontSize: 7, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', textAlign: h !== 'Libellé' ? 'right' as const : 'left' as const }}>{h}</div>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 44px', padding: '6px 12px', borderBottom: '0.5px solid var(--border-soft)', alignItems: 'center' }}>
          <div style={{ fontSize: 9, color: 'var(--text-primary)' }}>{r.label}</div>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' as const }}>{r.v.trim()}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right' as const }}>{r.v1.trim()}</div>
          <div style={{ fontSize: 9, fontWeight: 600, color: r.pos ? 'var(--success)' : 'var(--danger)', textAlign: 'right' as const }}>{r.pct}</div>
        </div>
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 44px', padding: '7px 12px', background: 'var(--brand-dark)', alignItems: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#F8F8F6' }}>Résultat net</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', textAlign: 'right' as const }}>74 000 €</div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right' as const }}>48 000 €</div>
        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--success)', textAlign: 'right' as const }}>+54%</div>
      </div>
    </div>
  )
}

function MockupSante() {
  const buckets = [
    { label: '0 – 30 j',  v: '42 000 €', pct: 30, color: 'var(--success)' },
    { label: '31 – 60 j', v: '18 000 €', pct: 13, color: 'var(--warning)' },
    { label: '> 60 j',    v: '8 000 €',  pct: 6,  color: 'var(--danger)'  },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { l: 'Trésorerie', v: '142 000 €', s: 'Situation saine', c: 'var(--success)' },
          { l: 'Délai clients', v: '28 j', s: 'Comptes 411', c: 'var(--text-secondary)' },
          { l: 'Délai fournisseurs', v: '45 j', s: 'Comptes 401', c: 'var(--warning)' },
        ].map((k, i) => (
          <div key={i} className="alvio-card" style={{ padding: '9px 10px' }}>
            <div style={{ fontSize: 7, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 3 }}>{k.l}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{k.v}</div>
            <div style={{ fontSize: 8, color: k.c, marginTop: 1 }}>{k.s}</div>
          </div>
        ))}
      </div>
      <div className="alvio-card" style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 8 }}>Créances clients — par ancienneté</div>
        {buckets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <div style={{ fontSize: 8, color: 'var(--text-secondary)', width: 44, flexShrink: 0 }}>{b.label}</div>
            <div style={{ flex: 1, height: 4, background: 'var(--border-light)', borderRadius: 2 }}>
              <div style={{ width: `${b.pct * 2}%`, height: 4, background: b.color, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 8, fontWeight: 600, color: b.color, width: 54, textAlign: 'right' as const }}>{b.v}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────

export default function LandingPage() {
  const [visible, setVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<'rentabilite' | 'cr' | 'sante'>('rentabilite')

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const tabs: ('rentabilite' | 'cr' | 'sante')[] = ['rentabilite', 'cr', 'sante']
    let i = 0
    const id = setInterval(() => { i = (i + 1) % tabs.length; setActiveTab(tabs[i]) }, 3500)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        .land-nav-link { font-size:13px; color:var(--text-primary); text-decoration:none; opacity:0.55; transition:opacity .18s; }
        .land-nav-link:hover { opacity:1; }
        .land-tab-btn { background:none; border:none; font-size:11px; font-weight:500; cursor:pointer; font-family:inherit; transition:color .18s; padding:3px 10px 7px; border-bottom:2px solid transparent; }
        .land-tab-btn:hover { color:var(--text-primary) !important; }
        .land-feature-card { background:var(--bg-card); border-radius:14px; border:1px solid var(--border-light); padding:24px; transition:transform .2s,box-shadow .2s,border-color .2s; }
        .land-feature-card:hover { transform:translateY(-3px); box-shadow:0 12px 40px rgba(0,0,0,0.07); border-color:var(--alvio-champagne-light); }
        .land-stat { transition:transform .2s; }
        .land-stat:hover { transform:translateY(-2px); }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(248,248,246,0.92)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border-light)',
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        overflow: 'visible',
      }}>
        {/* Logo seal — déborde vers le bas sur le hero */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, position: 'relative', height: 64 }}>
          <div style={{
            position: 'absolute', bottom: -32, left: 0, zIndex: 60,
            width: 96, height: 96, borderRadius: '50%',
            background: '#fff',
            border: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg viewBox="80 34 340 315" width="62" height="62" style={{ display: 'block' }}>
              <path fill="#C6A275" d="M247.73,149.32c-2.59,6.14-5,11.83-7.39,17.53c-6.89,16.45-13.73,32.91-20.71,49.32c-0.48,1.14-1.79,2.14-2.95,2.74c-11.04,5.76-22.82,9.46-34.94,12.07c-6.36,1.37-12.82,2.3-19.23,3.41c-0.7,0.12-1.42,0.11-2.47,0.18c29.27-66.95,58.4-133.57,87.75-200.71c29.3,67.03,58.43,133.68,87.71,200.69c-1.62-0.15-2.96-0.21-4.29-0.41c-18.25-2.72-36.04-7.01-52.67-15.28c-0.98-0.49-2.09-1.34-2.5-2.29c-7.21-16.95-14.33-33.95-21.46-50.94C252.35,160.35,250.13,155.05,247.73,149.32z"/>
              <path fill="#C6A275" d="M385.17,348.23c-6.27-4.19-12.55-8.37-18.82-12.57c-22.52-15.1-45.04-30.19-67.51-45.35c-0.75-0.51-1.44-1.71-1.47-2.6c-0.14-5.04-0.11-10.08,0-15.11c0.02-0.78,0.55-1.95,1.19-2.26c14.39-7.07,28.83-14.05,43.55-21.18c14.63,33.23,29.04,65.95,43.45,98.67C385.43,347.97,385.3,348.1,385.17,348.23z"/>
              <path fill="#C6A275" d="M109.7,348.63c14.61-33.3,28.96-66,43.42-98.96c1.92,0.78,3.85,1.45,5.68,2.32c12.68,6.04,25.36,12.1,37.99,18.24c0.66,0.32,1.33,1.39,1.35,2.13c0.1,5.19,0.1,10.38-0.04,15.56c-0.02,0.83-0.73,1.93-1.45,2.41c-14.41,9.76-28.87,19.46-43.33,29.15c-13.72,9.2-27.46,18.36-41.19,27.54C111.52,347.45,110.9,347.85,109.7,348.63z"/>
              <path fill="#C6A275" d="M247.84,298.64c-2.69-5.84-5.39-11.34-7.78-16.97c-4.01-9.44-10.74-16.15-19.82-20.67c-3.97-1.98-7.94-3.95-11.91-5.93c-0.65-0.32-1.29-0.65-1.95-0.98c4.52-2.14,8.92-4.19,13.3-6.3c9.92-4.79,16.68-12.53,21.08-22.51c2.28-5.17,4.65-10.3,7-15.49c2.28,5.06,4.43,10.13,6.84,15.09c1.58,3.25,3.45,6.37,5.31,9.47c4.49,7.48,11.95,11.29,19.28,15.17c3.06,1.62,6.29,2.93,9.69,4.5c-1.41,0.69-2.67,1.26-3.89,1.92c-4.75,2.55-9.49,5.13-14.24,7.71c-6.45,3.5-10.76,8.97-13.92,15.39c-2.8,5.7-5.35,11.52-8,17.29C248.52,296.98,248.26,297.66,247.84,298.64z"/>
            </svg>
          </div>
          <div style={{ marginLeft: 110, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', lineHeight: 1.1 }}>Alvio</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--alvio-champagne)', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>CFO Digital</span>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="#features" className="land-nav-link">Fonctionnalités</a>
          <a href="#apercu"   className="land-nav-link">Aperçu</a>
          <Link href="/login" className="land-nav-link" style={{ fontWeight: 500 }}>Se connecter</Link>
          <Link href="/login" className="btn btn-champagne btn-sm">Créer un compte →</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero-section" style={{ maxWidth: 1100, margin: '0 auto', padding: '96px 32px 60px', display: 'flex', gap: 64, alignItems: 'center' }}>

        {/* Left */}
        <div className="hero-left" style={{ flex: 1 }}>
          <div className="reveal" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--alvio-champagne-subtle)', border: '1px solid var(--alvio-champagne-light)', borderRadius: 20, padding: '4px 14px', marginBottom: 24, animation: visible ? 'fade-up 0.6s var(--ease-out) forwards' : 'none', opacity: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--alvio-champagne)', animation: 'pulse 2s infinite', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--alvio-champagne)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>CFO Digital · Accès bêta</span>
          </div>

          <h1 className="hero-h1" style={{ fontSize: 48, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 20, animation: visible ? 'fade-up 0.6s var(--ease-out) 0.1s forwards' : 'none', opacity: 0 }}>
            L'intelligence<br />
            financière{' '}
            <span style={{ color: 'var(--alvio-champagne)' }}>en temps réel</span>
          </h1>

          <p className="hero-sub" style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 32, maxWidth: 420, animation: visible ? 'fade-up 0.6s var(--ease-out) 0.2s forwards' : 'none', opacity: 0 }}>
            Importez votre FEC ou connectez Pennylane — Alvio produit instantanément votre CR, Bilan, SIG et trésorerie avec comparaison N/N-1 et agent CFO contextuel.
          </p>

          <div className="hero-ctas" style={{ display: 'flex', gap: 12, animation: visible ? 'fade-up 0.6s var(--ease-out) 0.3s forwards' : 'none', opacity: 0 }}>
            <Link href="/login" className="btn btn-champagne">Démarrer maintenant →</Link>
            <a href="#apercu" className="btn btn-outline">Voir l'aperçu</a>
          </div>

          <div className="hero-social" style={{ display: 'flex', gap: 32, marginTop: 44, animation: visible ? 'fade-up 0.6s var(--ease-out) 0.4s forwards' : 'none', opacity: 0 }}>
            {[
              { v: '673',   l: 'règles PCG 2025' },
              { v: 'N/N-1', l: 'par période' },
              { v: '100%',  l: 'données réelles' },
            ].map(s => (
              <div key={s.v} className="land-stat">
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — mockup ── */}
        <div id="apercu" className="hero-right" style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-light)', boxShadow: '0 20px 70px rgba(0,0,0,0.06)', overflow: 'hidden', animation: visible ? 'fade-up 0.7s var(--ease-out) 0.2s forwards' : 'none', opacity: 0 }}>
          {/* Barre URL */}
          <div style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)', padding: '7px 14px' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 6, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>beta.alvio.finance</span>
            </div>
          </div>

          {/* Topbar simulée */}
          <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
              {activeTab === 'rentabilite' ? 'Rentabilité' : activeTab === 'cr' ? 'Compte de résultat' : 'Santé financière'}
            </span>
            <div className="alvio-pill alvio-pill--active" style={{ fontSize: 9, padding: '2px 8px' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--alvio-champagne)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              Votre entreprise
            </div>
            <div className="alvio-pill" style={{ fontSize: 9, padding: '2px 8px' }}>Exercice 2025 ▾</div>
            {activeTab !== 'sante' && <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>· vs Exercice 2024 ▾</span>}
          </div>

          {/* Tabs */}
          <div style={{ padding: '8px 14px 0', display: 'flex', gap: 2, borderBottom: '1px solid var(--border-light)' }}>
            {([['rentabilite','Rentabilité'], ['cr','Compte de résultat'], ['sante','Santé financière']] as const).map(([tab, label]) => (
              <button key={tab} className="land-tab-btn" onClick={() => setActiveTab(tab)} style={{
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === tab ? '2px solid var(--alvio-champagne)' : '2px solid transparent',
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Contenu */}
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 340, background: 'var(--bg-page)' }}>
            <MockupAlvioBlock />
            {activeTab === 'rentabilite' && <MockupSIG />}
            {activeTab === 'cr'          && <MockupCR />}
            {activeTab === 'sante'       && <MockupSante />}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="features-section" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', padding: '72px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--alvio-champagne)', textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 12 }}>Fonctionnalités</div>
            <h2 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Tout ce dont un dirigeant a besoin
            </h2>
          </div>
          <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="land-feature-card">
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--alvio-champagne-subtle)', border: '1px solid var(--alvio-champagne-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  {f.svg}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, lineHeight: 1.35 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="cta-section" style={{ background: 'var(--alvio-champagne-subtle)', borderTop: '1px solid var(--alvio-champagne-light)', padding: '72px 32px', textAlign: 'center' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--alvio-champagne)', textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 18 }}>Accès bêta gratuit</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 14 }}>
            Prêt à voir vos vrais chiffres ?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 36, lineHeight: 1.7 }}>
            Connectez Pennylane ou importez votre FEC — votre analyse complète est prête en 30 secondes.
          </p>
          <div className="cta-btns" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Link href="/login" className="btn btn-champagne btn-lg">Démarrer maintenant →</Link>
            <Link href="/login" className="btn btn-outline btn-lg">Se connecter</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
        <div className="footer-inner" style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg viewBox="80 34 340 315" width="22" height="22" style={{ display: 'block' }}>
              <path fill="#C6A275" d="M247.73,149.32c-2.59,6.14-5,11.83-7.39,17.53c-6.89,16.45-13.73,32.91-20.71,49.32c-0.48,1.14-1.79,2.14-2.95,2.74c-11.04,5.76-22.82,9.46-34.94,12.07c-6.36,1.37-12.82,2.3-19.23,3.41c-0.7,0.12-1.42,0.11-2.47,0.18c29.27-66.95,58.4-133.57,87.75-200.71c29.3,67.03,58.43,133.68,87.71,200.69c-1.62-0.15-2.96-0.21-4.29-0.41c-18.25-2.72-36.04-7.01-52.67-15.28c-0.98-0.49-2.09-1.34-2.5-2.29c-7.21-16.95-14.33-33.95-21.46-50.94C252.35,160.35,250.13,155.05,247.73,149.32z"/>
              <path fill="#C6A275" d="M385.17,348.23c-6.27-4.19-12.55-8.37-18.82-12.57c-22.52-15.1-45.04-30.19-67.51-45.35c-0.75-0.51-1.44-1.71-1.47-2.6c-0.14-5.04-0.11-10.08,0-15.11c0.02-0.78,0.55-1.95,1.19-2.26c14.39-7.07,28.83-14.05,43.55-21.18c14.63,33.23,29.04,65.95,43.45,98.67C385.43,347.97,385.3,348.1,385.17,348.23z"/>
              <path fill="#C6A275" d="M109.7,348.63c14.61-33.3,28.96-66,43.42-98.96c1.92,0.78,3.85,1.45,5.68,2.32c12.68,6.04,25.36,12.1,37.99,18.24c0.66,0.32,1.33,1.39,1.35,2.13c0.1,5.19,0.1,10.38-0.04,15.56c-0.02,0.83-0.73,1.93-1.45,2.41c-14.41,9.76-28.87,19.46-43.33,29.15c-13.72,9.2-27.46,18.36-41.19,27.54C111.52,347.45,110.9,347.85,109.7,348.63z"/>
              <path fill="#C6A275" d="M247.84,298.64c-2.69-5.84-5.39-11.34-7.78-16.97c-4.01-9.44-10.74-16.15-19.82-20.67c-3.97-1.98-7.94-3.95-11.91-5.93c-0.65-0.32-1.29-0.65-1.95-0.98c4.52-2.14,8.92-4.19,13.3-6.3c9.92-4.79,16.68-12.53,21.08-22.51c2.28-5.17,4.65-10.3,7-15.49c2.28,5.06,4.43,10.13,6.84,15.09c1.58,3.25,3.45,6.37,5.31,9.47c4.49,7.48,11.95,11.29,19.28,15.17c3.06,1.62,6.29,2.93,9.69,4.5c-1.41,0.69-2.67,1.26-3.89,1.92c-4.75,2.55-9.49,5.13-14.24,7.71c-6.45,3.5-10.76,8.97-13.92,15.39c-2.8,5.7-5.35,11.52-8,17.29C248.52,296.98,248.26,297.66,247.84,298.64z"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Alvio</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>© 2026 Alvio · hello@alvio.finance</span>
        </div>
      </footer>
    </div>
  )
}
