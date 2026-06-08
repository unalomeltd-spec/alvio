'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// Données fictives pour le mockup — jamais de données réelles
const MOCK_SIG = [
  { label: "Chiffre d'affaires", n: "1 240 000 €", pct: "100.0%", n1: "1 108 000 €", pct1: "100.0%", color: "#B8A98A" },
  { label: "Valeur ajoutée",      n: "   820 000 €", pct: "66.1%",  n1: "   718 000 €", pct1: "64.8%", color: "#B8A98A" },
  { label: "EBE",                  n: "   148 000 €", pct: "11.9%",  n1: "   112 000 €", pct1: "10.1%", color: "#1D9E75", highlight: true },
  { label: "Résultat d'exploitation", n: "    92 000 €", pct: "7.4%", n1: "    64 000 €", pct1: "5.8%", color: "#1D9E75" },
  { label: "Résultat net",         n: "    74 000 €", pct: "6.0%",  n1: "    48 000 €", pct1: "4.3%", color: "#1D9E75" },
]

const MOCK_BILAN = {
  actif: [
    { label: "Immobilisations nettes", v: "380 000 €" },
    { label: "Créances clients",       v: "210 000 €" },
    { label: "Disponibilités",         v: "142 000 €", color: "#1D9E75" },
  ],
  passif: [
    { label: "Capitaux propres",       v: "320 000 €", color: "#1D9E75" },
    { label: "Emprunts & dettes LT",   v: "280 000 €" },
    { label: "Dettes CT",              v: "132 000 €" },
  ]
}

const MOCK_MONTHS = [42, 58, 51, 67, 73, 88, 82, 95, 79, 104, 98, 112]
const MAX_VAL = Math.max(...MOCK_MONTHS)

function MockupSIG({ visible }: { visible: boolean }) {
  return (
    <div style={{
      background: '#F2F3F5', borderRadius: 12, padding: '14px 16px',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Soldes intermédiaires de gestion</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 0, marginBottom: 6 }}>
        <div style={{ fontSize: 8, color: '#8C9BAB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Indicateur</div>
        <div style={{ fontSize: 8, color: '#1A1A1A', fontWeight: 600, textAlign: 'right' }}>N</div>
        <div style={{ fontSize: 8, color: '#8C9BAB', fontWeight: 600, textAlign: 'right' }}>N-1</div>
      </div>
      {MOCK_SIG.map((row, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 80px',
          alignItems: 'center',
          background: row.highlight ? '#1A1A1A' : '#fff',
          borderLeft: `2px solid ${row.color}`,
          borderRadius: '0 6px 6px 0',
          padding: '5px 8px',
          marginBottom: 2,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(-8px)',
          transition: `opacity 0.4s ease ${0.4 + i * 0.07}s, transform 0.4s ease ${0.4 + i * 0.07}s`,
        }}>
          <div style={{ fontSize: 9, fontWeight: 500, color: row.highlight ? 'rgba(255,255,255,0.85)' : '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{row.label}</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: row.highlight ? (row.color || '#B8A98A') : row.color }}>{row.n.trim()}</div>
            <div style={{ fontSize: 8, color: row.highlight ? 'rgba(255,255,255,0.4)' : '#8C9BAB' }}>{row.pct}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB' }}>{row.n1.trim()}</div>
            <div style={{ fontSize: 8, color: '#8C9BAB' }}>{row.pct1}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MockupBilan({ visible }: { visible: boolean }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity 0.5s ease 0.5s, transform 0.5s ease 0.5s',
    }}>
      {(['actif', 'passif'] as const).map(side => (
        <div key={side} style={{ background: '#F2F3F5', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: '#1A1A1A', padding: '6px 10px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: '#F2F3F5', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{side}</span>
            <span style={{ fontSize: 8, fontWeight: 600, color: '#B8A98A' }}>732 000 €</span>
          </div>
          {MOCK_BILAN[side].map((row, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 10px', borderBottom: '0.5px solid rgba(0,0,0,0.05)',
              background: '#fff',
              opacity: visible ? 1 : 0,
              transition: `opacity 0.3s ease ${0.6 + i * 0.06}s`,
            }}>
              <span style={{ fontSize: 8, color: '#1A1A1A' }}>{row.label}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: row.color || '#1A1A1A' }}>{row.v}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function MockupCashflow({ visible }: { visible: boolean }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '12px 14px',
      border: '0.5px solid rgba(0,0,0,0.06)',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'opacity 0.5s ease 0.7s, transform 0.5s ease 0.7s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trésorerie — 12 mois</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: '#1D9E75' }}>+18.4%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
        {MOCK_MONTHS.map((v, i) => (
          <div key={i} style={{
            flex: 1,
            height: `${(v / MAX_VAL) * 100}%`,
            background: i === MOCK_MONTHS.length - 1 ? '#1A1A1A' : i === 8 ? '#B8A98A' : 'rgba(184,169,138,0.25)',
            borderRadius: '2px 2px 0 0',
            opacity: visible ? 1 : 0,
            transition: `opacity 0.3s ease ${0.8 + i * 0.04}s`,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {['01','03','06','09','12'].map(m => (
          <span key={m} style={{ fontSize: 7, color: '#8C9BAB' }}>{m}</span>
        ))}
      </div>
    </div>
  )
}

function MockupInsight({ visible }: { visible: boolean }) {
  const [dots, setDots] = useState('')
  useEffect(() => {
    if (!visible) return
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500)
    return () => clearInterval(id)
  }, [visible])

  return (
    <div style={{
      background: '#1A1A1A', borderRadius: 10, padding: '10px 14px',
      display: 'flex', gap: 10, alignItems: 'flex-start',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.5s ease 0.9s, transform 0.5s ease 0.9s',
    }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(184,169,138,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 11 }}>◈</span>
      </div>
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#B8A98A', marginBottom: 3 }}>Agent Alvio</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
          EBE en hausse de +3.1 pts — marge d'exploitation solide. Trésorerie à surveiller{dots}
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: '◈',
    title: 'Moteur comptable PCG 2025',
    desc: '655 règles de classification, CR + Bilan + SIG calculés en une passe. Validé sur dossiers réels, zéro écart.',
  },
  {
    icon: '⊞',
    title: 'Comparaison N / N-1',
    desc: 'Sélectez T1, S1, ou toute période personnalisée. La période N-1 correspondante se calcule automatiquement.',
  },
  {
    icon: '↳',
    title: 'Drill down jusqu\'à l\'écriture',
    desc: 'Cliquez sur n\'importe quelle ligne pour voir les comptes sous-jacents, puis chaque écriture du FEC.',
  },
  {
    icon: '⬡',
    title: 'Agent financier IA',
    desc: 'Analyse contextuelle générée à partir de vos chiffres réels. Pas de template, pas de générique.',
  },
]

export default function LandingPage() {
  const [visible, setVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<'sig' | 'bilan' | 'cashflow'>('sig')

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  // Auto-rotate tabs
  useEffect(() => {
    const tabs: ('sig' | 'bilan' | 'cashflow')[] = ['sig', 'bilan', 'cashflow']
    let i = 0
    const id = setInterval(() => {
      i = (i + 1) % tabs.length
      setActiveTab(tabs[i])
    }, 3500)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif", overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .nav-link { font-size: 13px; color: #1A1A1A; text-decoration: none; opacity: 0.6; transition: opacity 0.2s; }
        .nav-link:hover { opacity: 1; }
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: #1A1A1A; color: #fff; border-radius: 10px; padding: 12px 24px; font-size: 13px; font-weight: 600; text-decoration: none; font-family: inherit; transition: transform 0.15s, box-shadow 0.15s; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        .btn-secondary { display: inline-flex; align-items: center; background: #fff; color: #1A1A1A; border: 0.5px solid rgba(0,0,0,0.15); border-radius: 10px; padding: 12px 24px; font-size: 13px; font-weight: 500; text-decoration: none; font-family: inherit; transition: border-color 0.2s, transform 0.15s; }
        .btn-secondary:hover { border-color: #1A1A1A; transform: translateY(-1px); }
        .tab-btn { background: none; border: none; padding: '5px 10px'; font-size: 11px; font-weight: 500; cursor: pointer; font-family: inherit; transition: color 0.2s; }
        .feature-card { background: #fff; border-radius: 14px; border: 0.5px solid rgba(0,0,0,0.06); padding: 24px; transition: transform 0.2s, box-shadow 0.2s; }
        .feature-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.06); }
      `}</style>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(242,243,245,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
        padding: '0 32px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        animation: 'fadeIn 0.5s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#B8A98A', fontSize: 14, fontWeight: 700 }}>A</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-0.02em' }}>Alvio</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="#features" className="nav-link">Fonctionnalités</a>
          <a href="#apercu" className="nav-link">Aperçu</a>
          <Link href="/dashboard" className="btn-primary" style={{ padding: '8px 18px', fontSize: 12 }}>
            Accéder →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 32px 60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        {/* Left */}
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(184,169,138,0.12)', border: '0.5px solid rgba(184,169,138,0.3)',
            borderRadius: 20, padding: '4px 12px', marginBottom: 24,
            animation: visible ? 'fadeUp 0.6s ease forwards' : 'none', opacity: 0,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#B8A98A', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#B8A98A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>CFO Digital · Accès bêta</span>
          </div>

          <h1 style={{
            fontSize: 48, fontWeight: 800, color: '#1A1A1A', lineHeight: 1.1,
            letterSpacing: '-0.03em', marginBottom: 20,
            animation: visible ? 'fadeUp 0.6s ease 0.1s forwards' : 'none', opacity: 0,
          }}>
            L'intelligence<br />
            financière{' '}
            <span style={{ color: '#B8A98A' }}>en temps réel</span>
          </h1>

          <p style={{
            fontSize: 15, color: '#8C9BAB', lineHeight: 1.7, marginBottom: 32, maxWidth: 400,
            animation: visible ? 'fadeUp 0.6s ease 0.2s forwards' : 'none', opacity: 0,
          }}>
            Alvio transforme votre FEC en analyse financière complète — CR, Bilan, SIG, trésorerie — avec comparaison N/N-1 et agent IA contextuel.
          </p>

          <div style={{
            display: 'flex', gap: 12,
            animation: visible ? 'fadeUp 0.6s ease 0.3s forwards' : 'none', opacity: 0,
          }}>
            <Link href="/dashboard" className="btn-primary">
              Démarrer maintenant →
            </Link>
            <a href="#apercu" className="btn-secondary">Voir l'aperçu</a>
          </div>

          <div style={{
            display: 'flex', gap: 24, marginTop: 40,
            animation: visible ? 'fadeUp 0.6s ease 0.4s forwards' : 'none', opacity: 0,
          }}>
            {[
              { v: '655', l: 'règles PCG 2025' },
              { v: 'N/N-1', l: 'par période' },
              { v: '100%', l: 'données réelles' },
            ].map(s => (
              <div key={s.v}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.02em' }}>{s.v}</div>
                <div style={{ fontSize: 11, color: '#8C9BAB', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — mockup */}
        <div id="apercu" style={{
          background: '#fff', borderRadius: 16, border: '0.5px solid rgba(0,0,0,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          animation: visible ? 'fadeUp 0.7s ease 0.2s forwards' : 'none', opacity: 0,
        }}>
          {/* Fausse topbar */}
          <div style={{ background: '#1A1A1A', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#FF5F57','#FFBD2E','#28CA41'].map(c => (
                <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>beta.alvio.finance</span>
            <div style={{ width: 50 }} />
          </div>

          {/* Topbar simulée */}
          <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A' }}>
              {activeTab === 'sig' ? 'Rentabilité' : activeTab === 'bilan' ? 'Bilan' : 'Trésorerie'}
            </span>
            <div style={{ background: '#F2F3F5', borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 500, color: '#1A1A1A' }}>Exercice 2025 ▾</div>
            {activeTab !== 'cashflow' && (
              <>
                <span style={{ fontSize: 10, color: '#8C9BAB' }}>·</span>
                <span style={{ fontSize: 10, color: '#8C9BAB' }}>vs Exercice 2024 ▾</span>
              </>
            )}
            <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 500, color: '#8C9BAB' }}>ENTREPRISE DEMO</div>
          </div>

          {/* Tabs */}
          <div style={{ padding: '10px 16px 0', display: 'flex', gap: 4, borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
            {([['sig', 'SIG'], ['bilan', 'Bilan'], ['cashflow', 'Trésorerie']] as const).map(([tab, label]) => (
              <button key={tab} className="tab-btn"
                onClick={() => setActiveTab(tab)}
                style={{
                  color: activeTab === tab ? '#1A1A1A' : '#8C9BAB',
                  borderBottom: activeTab === tab ? '2px solid #B8A98A' : '2px solid transparent',
                  padding: '4px 10px 8px',
                }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 340 }}>
            {activeTab === 'sig' && <MockupSIG visible={true} />}
            {activeTab === 'bilan' && (
              <>
                <MockupBilan visible={true} />
                <MockupInsight visible={true} />
              </>
            )}
            {activeTab === 'cashflow' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { l: 'Trésorerie nette', v: '142 000 €', s: '18 jours de CA', c: '#1D9E75' },
                    { l: 'Créances clients', v: '210 000 €', s: '61 jours de CA', c: '#8C9BAB' },
                    { l: 'BFR', v: '68 000 €', s: 'À financer', c: '#D85A30' },
                  ].map((k, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.06)', padding: '10px 12px', borderTop: `2px solid ${k.c}` }}>
                      <div style={{ fontSize: 8, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{k.l}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{k.v}</div>
                      <div style={{ fontSize: 9, color: k.c, marginTop: 2 }}>{k.s}</div>
                    </div>
                  ))}
                </div>
                <MockupCashflow visible={true} />
                <MockupInsight visible={true} />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 32px 100px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#B8A98A', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Fonctionnalités</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
            Tout ce dont un dirigeant a besoin
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="feature-card">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(184,169,138,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 16, color: '#B8A98A' }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', marginBottom: 8, lineHeight: 1.3 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: '#8C9BAB', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section style={{ background: '#1A1A1A', padding: '60px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#B8A98A', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>Accès bêta gratuit</div>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 12 }}>
          Prêt à voir vos vrais chiffres ?
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Importez votre FEC et obtenez votre analyse en 30 secondes.</p>
        <Link href="/dashboard" className="btn-primary" style={{ background: '#B8A98A', color: '#1A1A1A' }}>
          Démarrer maintenant →
        </Link>
      </section>
    </div>
  )
}
