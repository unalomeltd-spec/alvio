'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Données fictives mockup — jamais de données réelles ──────────────────
const MOCK_SIG = [
  { label: "Chiffre d'affaires",      n: "1 240 000 €", pct: "100.0%", n1: "1 108 000 €", pct1: "100.0%", color: "#B8A98A", highlight: false },
  { label: "Valeur ajoutée",          n: "820 000 €",   pct: "66.1%",  n1: "718 000 €",   pct1: "64.8%",  color: "#B8A98A", highlight: false },
  { label: "EBE",                     n: "148 000 €",   pct: "11.9%",  n1: "112 000 €",   pct1: "10.1%",  color: "#1D9E75", highlight: true  },
  { label: "Résultat d'exploitation", n: "92 000 €",    pct: "7.4%",   n1: "64 000 €",    pct1: "5.8%",   color: "#1D9E75", highlight: false },
  { label: "Résultat net",            n: "74 000 €",    pct: "6.0%",   n1: "48 000 €",    pct1: "4.3%",   color: "#1D9E75", highlight: false },
]
const MOCK_BILAN = {
  actif:  [
    { label: "Immobilisations nettes", v: "380 000 €" },
    { label: "Créances clients",       v: "210 000 €" },
    { label: "Disponibilités",         v: "142 000 €", color: "#1D9E75" },
  ],
  passif: [
    { label: "Capitaux propres",       v: "320 000 €", color: "#1D9E75" },
    { label: "Emprunts & dettes LT",   v: "280 000 €" },
    { label: "Dettes CT",              v: "132 000 €" },
  ],
}
const MOCK_MONTHS = [42, 58, 51, 67, 73, 88, 82, 95, 79, 104, 98, 112]
const MAX_VAL = Math.max(...MOCK_MONTHS)
const MOIS_COURT = ['J','F','M','A','M','J','J','A','S','O','N','D']

const FEATURES = [
  {
    svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>,
    title: 'Import FEC universel',
    desc: 'Glissez votre fichier FEC — CR, Bilan, SIG et trésorerie calculés en une passe. 673 règles PCG 2025, validé sur dossiers réels.',
  },
  {
    svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
    title: 'Connexion Pennylane',
    desc: 'Synchronisez vos exercices en un clic depuis Pennylane. Exercices décalés supportés, token chiffré, zéro export manuel.',
  },
  {
    svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    title: 'Comparaison N / N-1',
    desc: 'Exercice, trimestre ou période personnalisée. La période N-1 correspondante se calcule automatiquement.',
  },
  {
    svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
    title: "Drill down jusqu'à l'écriture",
    desc: "Cliquez sur n'importe quelle ligne pour voir les comptes sous-jacents, puis chaque écriture du FEC.",
  },
]

// ── Composants mockup ─────────────────────────────────────────────────────

function MockupSIG() {
  return (
    <div style={{ background: '#F8F8F6', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: '#8C9BAB', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 8 }}>Soldes intermédiaires de gestion</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 72px', marginBottom: 4 }}>
        <div style={{ fontSize: 7, color: '#8C9BAB', fontWeight: 600, textTransform: 'uppercase' as const }}>Indicateur</div>
        <div style={{ fontSize: 7, color: '#242628', fontWeight: 600, textAlign: 'right' as const }}>N</div>
        <div style={{ fontSize: 7, color: '#8C9BAB', fontWeight: 600, textAlign: 'right' as const }}>N-1</div>
      </div>
      {MOCK_SIG.map((row, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr 72px 72px', alignItems: 'center',
          background: row.highlight ? '#1A1A1A' : '#fff',
          borderLeft: `2px solid ${row.color}`,
          borderRadius: '0 6px 6px 0',
          padding: '4px 8px', marginBottom: 2,
        }}>
          <div style={{ fontSize: 8, fontWeight: 500, color: row.highlight ? 'rgba(255,255,255,0.85)' : '#242628', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{row.label}</div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: row.color }}>{row.n}</div>
            <div style={{ fontSize: 7, color: row.highlight ? 'rgba(255,255,255,0.4)' : '#8C9BAB' }}>{row.pct}</div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 9, fontWeight: 500, color: '#8C9BAB' }}>{row.n1}</div>
            <div style={{ fontSize: 7, color: '#8C9BAB' }}>{row.pct1}</div>
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
        <div key={side} style={{ background: '#F8F8F6', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#1A1A1A', padding: '5px 10px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 7, fontWeight: 700, color: '#F8F8F6', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>{side}</span>
            <span style={{ fontSize: 7, fontWeight: 600, color: '#B8A98A' }}>732 000 €</span>
          </div>
          {MOCK_BILAN[side].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', borderBottom: '0.5px solid rgba(0,0,0,0.05)', background: '#fff' }}>
              <span style={{ fontSize: 8, color: '#242628' }}>{row.label}</span>
              <span style={{ fontSize: 8, fontWeight: 600, color: row.color || '#242628' }}>{row.v}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function MockupCashflow() {
  return (
    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #ECECEC' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: '#242628', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Trésorerie — 12 mois</span>
        <span style={{ fontSize: 8, fontWeight: 600, color: '#1D9E75' }}>+18.4 %</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 36 }}>
        {MOCK_MONTHS.map((v, i) => (
          <div key={i} style={{
            flex: 1, height: `${(v / MAX_VAL) * 100}%`,
            background: i === MOCK_MONTHS.length - 1 ? '#B8A98A' : 'rgba(184,169,138,0.2)',
            borderRadius: '2px 2px 0 0',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 3 }}>
        {MOIS_COURT.map(m => <span key={m} style={{ fontSize: 6, color: '#8C9BAB', flex: 1, textAlign: 'center' as const }}>{m}</span>)}
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
    <div style={{ background: '#fff', border: '0.5px solid rgba(184,169,138,0.3)', borderLeft: '3px solid #B8A98A', borderRadius: '0 8px 8px 0', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(184,169,138,0.12)', border: '0.5px solid rgba(184,169,138,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 28 28" fill="none">
            <path d="M14 2C14 2 8 8 8 14C8 18.4 10.6 22.2 14 24C17.4 22.2 20 18.4 20 14C20 8 14 2 14 2Z" fill="#B8A98A"/>
            <circle cx="14" cy="14" r="2.5" fill="#fff"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 8, fontWeight: 600, color: '#242628' }}>Alvio</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1D9E75' }} />
            <span style={{ fontSize: 7, color: '#8C9BAB' }}>CFO Digital</span>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 9, color: '#242628', lineHeight: 1.6 }}>
        {displayed}
        {displayed.length < text.length && (
          <span style={{ display: 'inline-block', width: 1, height: 10, background: '#B8A98A', marginLeft: 1, verticalAlign: 'middle', animation: 'blink .7s step-end infinite' }} />
        )}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────

export default function LandingPage() {
  const [visible, setVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<'sig' | 'bilan' | 'cashflow'>('sig')

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const tabs: ('sig' | 'bilan' | 'cashflow')[] = ['sig', 'bilan', 'cashflow']
    let i = 0
    const id = setInterval(() => { i = (i + 1) % tabs.length; setActiveTab(tabs[i]) }, 3500)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F8F8F6', fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }

        .nav-link { font-size:13px; color:#242628; text-decoration:none; opacity:0.55; transition:opacity .18s; }
        .nav-link:hover { opacity:1; }

        .btn-primary {
          display:inline-flex; align-items:center; gap:8px;
          background:#1A1A1A; color:#fff; border-radius:10px;
          padding:11px 22px; font-size:13px; font-weight:600;
          text-decoration:none; font-family:inherit; border:none; cursor:pointer;
          transition:transform .15s, box-shadow .15s, background .15s;
        }
        .btn-primary:hover { background:#2A2A2A; transform:translateY(-1px); box-shadow:0 8px 24px rgba(0,0,0,0.18); }

        .btn-secondary {
          display:inline-flex; align-items:center;
          background:#fff; color:#242628;
          border:1px solid #ECECEC; border-radius:10px;
          padding:11px 22px; font-size:13px; font-weight:500;
          text-decoration:none; font-family:inherit;
          transition:border-color .18s, transform .15s, box-shadow .15s;
        }
        .btn-secondary:hover { border-color:#B8A98A; transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,0,0,0.07); }

        .btn-champagne {
          display:inline-flex; align-items:center; gap:8px;
          background:#B8A98A; color:#1A1A1A; border-radius:10px;
          padding:13px 32px; font-size:14px; font-weight:700;
          text-decoration:none; font-family:inherit;
          transition:transform .15s, box-shadow .15s, background .15s;
        }
        .btn-champagne:hover { background:#A99672; transform:translateY(-1px); box-shadow:0 8px 28px rgba(184,169,138,0.35); }

        .tab-btn {
          background:none; border:none; font-size:11px; font-weight:500;
          cursor:pointer; font-family:inherit; transition:color .18s;
          padding:3px 10px 7px; border-bottom:2px solid transparent;
        }
        .tab-btn:hover { color:#242628 !important; }

        .feature-card {
          background:#fff; border-radius:14px; border:1px solid #ECECEC;
          padding:24px; transition:transform .2s, box-shadow .2s, border-color .2s;
        }
        .feature-card:hover { transform:translateY(-3px); box-shadow:0 12px 40px rgba(0,0,0,0.07); border-color:rgba(184,169,138,0.4); }

        .stat-item { transition:transform .2s; }
        .stat-item:hover { transform:translateY(-2px); }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(248,248,246,0.9)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid #ECECEC',
        padding: '0 32px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        animation: 'fadeIn 0.4s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#B8A98A', fontSize: 14, fontWeight: 700 }}>A</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#242628', letterSpacing: '-0.02em' }}>Alvio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="#features" className="nav-link">Fonctionnalités</a>
          <a href="#apercu"   className="nav-link">Aperçu</a>
          <Link href="/login" className="nav-link" style={{ fontWeight: 500, opacity: 0.65 }}>Se connecter</Link>
          <Link href="/login" className="btn-primary" style={{ padding: '8px 18px', fontSize: 12 }}>Créer un compte →</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 32px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>

        {/* Left */}
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(184,169,138,0.1)', border: '1px solid rgba(184,169,138,0.3)',
            borderRadius: 20, padding: '4px 14px', marginBottom: 24,
            animation: visible ? 'fadeUp 0.6s ease forwards' : 'none', opacity: 0,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B8A98A', animation: 'pulse 2s infinite', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#B8A98A', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>CFO Digital · Accès bêta</span>
          </div>

          <h1 style={{
            fontSize: 48, fontWeight: 800, color: '#242628', lineHeight: 1.1,
            letterSpacing: '-0.03em', marginBottom: 20,
            animation: visible ? 'fadeUp 0.6s ease 0.1s forwards' : 'none', opacity: 0,
          }}>
            L'intelligence<br />
            financière{' '}
            <span style={{ color: '#B8A98A' }}>en temps réel</span>
          </h1>

          <p style={{
            fontSize: 15, color: '#6E7378', lineHeight: 1.75, marginBottom: 32, maxWidth: 420,
            animation: visible ? 'fadeUp 0.6s ease 0.2s forwards' : 'none', opacity: 0,
          }}>
            Importez votre FEC ou connectez Pennylane — Alvio produit instantanément votre CR, Bilan, SIG et trésorerie avec comparaison N/N-1 et agent CFO contextuel.
          </p>

          <div style={{ display: 'flex', gap: 12, animation: visible ? 'fadeUp 0.6s ease 0.3s forwards' : 'none', opacity: 0 }}>
            <Link href="/login" className="btn-primary">Démarrer maintenant →</Link>
            <a href="#apercu" className="btn-secondary">Voir l'aperçu</a>
          </div>

          <div style={{ display: 'flex', gap: 32, marginTop: 44, animation: visible ? 'fadeUp 0.6s ease 0.4s forwards' : 'none', opacity: 0 }}>
            {[
              { v: '673',   l: 'règles PCG 2025' },
              { v: 'N/N-1', l: 'par période' },
              { v: '100%',  l: 'données réelles' },
            ].map(s => (
              <div key={s.v} className="stat-item">
                <div style={{ fontSize: 22, fontWeight: 800, color: '#242628', letterSpacing: '-0.02em' }}>{s.v}</div>
                <div style={{ fontSize: 11, color: '#6E7378', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — mockup ── */}
        <div id="apercu" style={{
          background: '#fff', borderRadius: 14, border: '1px solid #ECECEC',
          boxShadow: '0 20px 70px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          animation: visible ? 'fadeUp 0.7s ease 0.2s forwards' : 'none', opacity: 0,
        }}>
          {/* Barre URL neutre */}
          <div style={{ background: '#F8F8F6', borderBottom: '1px solid #ECECEC', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, background: '#fff', border: '1px solid #ECECEC', borderRadius: 6, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, color: '#9CA3AF' }}>beta.alvio.finance</span>
            </div>
          </div>

          {/* Topbar simulée */}
          <div style={{ background: '#fff', borderBottom: '1px solid #ECECEC', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#242628' }}>
              {activeTab === 'sig' ? 'Rentabilité' : activeTab === 'bilan' ? 'Bilan' : 'Trésorerie'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #ECECEC', borderRadius: 7, padding: '3px 9px' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              <span style={{ fontSize: 9, fontWeight: 500, color: '#242628' }}>Votre entreprise</span>
            </div>
            <div style={{ background: '#F8F8F6', border: '1px solid #ECECEC', borderRadius: 6, padding: '3px 9px', fontSize: 9, fontWeight: 500, color: '#242628' }}>Exercice 2025 ▾</div>
            {activeTab !== 'cashflow' && <span style={{ fontSize: 9, color: '#6E7378' }}>· vs Exercice 2024 ▾</span>}
          </div>

          {/* Tabs */}
          <div style={{ padding: '8px 14px 0', display: 'flex', gap: 2, borderBottom: '1px solid #ECECEC' }}>
            {([['sig','SIG'], ['bilan','Bilan'], ['cashflow','Trésorerie']] as const).map(([tab, label]) => (
              <button key={tab} className="tab-btn" onClick={() => setActiveTab(tab)} style={{
                color: activeTab === tab ? '#242628' : '#6E7378',
                borderBottom: activeTab === tab ? '2px solid #B8A98A' : '2px solid transparent',
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Contenu */}
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 340 }}>
            <MockupAlvioBlock />
            {activeTab === 'sig' && <MockupSIG />}
            {activeTab === 'bilan' && <MockupBilan />}
            {activeTab === 'cashflow' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { l: 'Trésorerie nette', v: '142 000 €', s: '18 j de CA', c: '#1D9E75' },
                    { l: 'Créances clients', v: '210 000 €', s: '61 j de CA', c: '#6E7378' },
                    { l: 'BFR',              v: '68 000 €',  s: 'À financer', c: '#D85A30' },
                  ].map((k, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 8, border: '1px solid #ECECEC', padding: '9px 10px', borderTop: `2px solid ${k.c}` }}>
                      <div style={{ fontSize: 7, fontWeight: 600, color: '#6E7378', textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 3 }}>{k.l}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#242628' }}>{k.v}</div>
                      <div style={{ fontSize: 8, color: k.c, marginTop: 1 }}>{k.s}</div>
                    </div>
                  ))}
                </div>
                <MockupCashflow />
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ background: '#fff', borderTop: '1px solid #ECECEC', borderBottom: '1px solid #ECECEC' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#B8A98A', textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 12 }}>Fonctionnalités</div>
            <h2 style={{ fontSize: 34, fontWeight: 800, color: '#242628', letterSpacing: '-0.02em' }}>
              Tout ce dont un dirigeant a besoin
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="feature-card">
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(184,169,138,0.1)', border: '1px solid rgba(184,169,138,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  {f.svg}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#242628', marginBottom: 10, lineHeight: 1.35 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: '#6E7378', lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ background: '#1A1A1A', padding: '72px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#B8A98A', textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 18 }}>Accès bêta gratuit</div>
        <h2 style={{ fontSize: 34, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 14 }}>
          Prêt à voir vos vrais chiffres ?
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 36, maxWidth: 420, margin: '0 auto 36px' }}>
          Connectez Pennylane ou importez votre FEC — votre analyse complète est prête en 30 secondes.
        </p>
        <Link href="/login" className="btn-champagne">
          Démarrer maintenant →
        </Link>
      </section>
    </div>
  )
}
