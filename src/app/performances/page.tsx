'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { usePeriod } from '@/hooks/usePeriod'
import { useActiveCompany } from '@/hooks/useActiveCompany'
import AlvioInsight from '@/components/AlvioInsight'
import {
  BarChart, Bar, Cell, XAxis, ResponsiveContainer, PieChart, Pie, LineChart, Line,
} from 'recharts'

/* ════════════════════════════════════════════════════════════════════════
   ALVIO — Page « Performances »
   Fusion de /profitability + /income-statement.
   Navigation du détail : bloc « Explorer le détail » (toggle Charges/Produits,
   donut + liste de postes cliquables) → side panel à graphiques.
   Aucune dépendance à un nouvel endpoint moteur (tout vient de /api/etats[/detail]).
   ════════════════════════════════════════════════════════════════════════ */

const sb = createClient()

// Couleurs Recharts (les layouts utilisent les tokens CSS de globals.css)
const CH = '#C6A275', OK = '#0F8A5F', DANGER = '#B42318', GREY = '#D9DCE0'
const CHARGE_COLORS = ['#C6A275', '#B08D5E', '#D8C5A4', '#C9B89A', '#8C9BAB', '#BFC6CC', '#E0D3BC', '#A89270']
const PRODUIT_COLORS = ['#0F8A5F', '#3DA77E', '#7FC4A8', '#5FB893', '#A9D8C4', '#2E9B72', '#C7E6D7']

// Sparklines KPI : trend mensuel reconstruit côté client (indicatif). false = on coupe.
const SHOW_SPARKLINES = false

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'
const fmtV = (n: number | null) => (n == null ? '—' : (n >= 0 ? '+' : '') + Math.round(n) + ' %')
// Normalise un numéro de compte à 5 caractères (padding 0 si court, coupe si long)
const num5 = (n: string | undefined | null) => {
  const s = (n || '').trim()
  return s.length >= 5 ? s.slice(0, 5) : s.padEnd(5, '0')
}
// Normalise les libellés FEC/Pennylane : 1re lettre majuscule, reste minuscule
const sentenceCase = (s: string | undefined | null) => {
  if (!s) return ''
  const t = s.trim().toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

function toIso(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d.slice(0, 10)
  if (d.length === 8) return d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8)
  return d
}
function fmtDate(d: string): string {
  const iso = toIso(d)
  if (!iso) return d
  return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4)
}
function monthIdx(d: string): number {
  const iso = toIso(d)
  if (!iso || iso.length < 7) return -1
  return parseInt(iso.slice(5, 7), 10) - 1
}

// Mapping label → préfixes PCG (repris de l'ancienne income-statement)
const PREFIXES: Record<string, string[]> = {
  ventesMarchandises: ['707', '709'],
  productionVendue: ['706', '701', '702', '703', '704', '705', '708', '73'],
  productionStockee: ['71'],
  productionImmobilisee: ['72'],
  subventions: ['74'],
  autresProduits: ['75'],
  reprises: ['78'],
  achatsMarchandises: ['607', '608', '609'],
  variationStocks: ['603'],
  autresAchats: ['604', '605', '606', '601', '602'],
  servicesExt: ['61', '62'],
  impotsTaxes: ['63'],
  chargesPersonnel: ['64'],
  dotations: ['681', '682', '683', '684', '685'],
  autresCharges: ['65'],
  produitsFinanciers: ['76', '786'],
  chargesFinancieres: ['66', '686'],
  produitsExcep: ['77', '787'],
  chargesExcep: ['67', '687'],
  participation: ['691'],
  is: ['695', '696', '697', '699'],
}

interface Ecriture { date: string; lib: string; piece: string; debit: number; credit: number }
interface Compte { num: string; lib: string; solde: number; ecritures: Ecriture[] }
interface Poste { lib: string; val: number; varPct: number | null; prefixKey: string }
interface PosteDetail {
  label: string
  prefixes: string[]
  orientation: 'produit' | 'charge'
  total: number
  varPct: number | null
  comptes: { num: string; lib: string; val: number; varPct: number | null }[]
  monthly: { m: string; n: number; n1: number }[]
  annual: { y: string; v: number }[]
  ecritures: { date: string; lib: string; montant: number }[]
  // Écritures par numéro de compte (pour le drill compte → écritures)
  comptesEcritures: Record<string, { date: string; lib: string; montant: number }[]>
  loading: boolean
}

/* ── Sparkline ───────────────────────────────────────────────────────── */
function Spark({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return <div style={{ width: 120, height: 34 }} />
  const w = 120, h = 34, min = Math.min(...data), max = Math.max(...data), rng = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * (h - 6) - 3}`)
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── Carte KPI ───────────────────────────────────────────────────────── */
function KpiCard({ label, pct, val, pctN1, spark }: { label: string; pct: number | null; val: number; pctN1: number | null; spark: number[] }) {
  const up = pctN1 == null || pct == null ? true : pct >= pctN1
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: 'var(--bg-card)', border: `1px solid ${hovered ? CH : 'var(--border-light)'}`, borderRadius: 14, padding: '16px 18px', transition: 'border-color .18s', cursor: 'default' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: up ? OK : 'var(--text-primary)', marginTop: 8, letterSpacing: '-0.02em' }}>{pct != null ? fmtP(pct) : fmt(val)}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, fontWeight: 500 }}>{fmt(val)}</div>
      {pct != null && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>du chiffre d'affaires</div>}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, minHeight: 34 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pctN1 != null ? `vs ${fmtP(pctN1)} N-1` : '—'}</div>
        {SHOW_SPARKLINES && <Spark data={spark} color={up ? OK : DANGER} />}
      </div>
    </div>
  )
}

/* ── Indicateur : type + glyphe ──────────────────────────────────────── */
interface KpiItem { key: string; label: string; sublabel: string; pct: number | null; val: number; pctN1: number | null; varPct: number | null; spark: number[] }

function KpiGlyph({ k, color }: { k: string; color: string }) {
  const paths: Record<string, React.ReactNode> = {
    ca: <path d="M3 17l5-5 4 4 6-7" />,
    mb: <><circle cx="7" cy="7" r="2.4" /><circle cx="17" cy="17" r="2.4" /><path d="M6.5 17.5L17.5 6.5" /></>,
    ebe: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></>,
    rex: <><path d="M3 13a9 9 0 0 1 18 0" /><path d="M12 13l4-3" /></>,
    net: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M16 12h.5" /></>,
  }
  return (
    <span style={{ width: 30, height: 30, borderRadius: 9, background: `${color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[k]}</svg>
    </span>
  )
}

/* ── ★ Liste « Indicateurs clés » (remplace la cascade) ──────────────── */
function IndicateursCles({ kpis, onOpen }: { kpis: KpiItem[]; onOpen: (k: KpiItem) => void }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Indicateurs clés</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Cliquez un indicateur pour son évolution et son analyse →</div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>Évolution 12 mois</span>
      </div>
      {kpis.map((k) => {
        const pos = (k.varPct ?? 0) >= 0
        const col = pos ? OK : DANGER
        return (
          <div key={k.key} onClick={() => onOpen(k)}
            style={{ display: 'grid', gridTemplateColumns: '30px 1fr 104px 80px', alignItems: 'center', gap: 12, padding: '11px 8px', borderTop: '1px solid var(--border-light)', cursor: 'pointer', borderRadius: 8, transition: 'background .12s' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-page)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
            <KpiGlyph k={k.key} color={col} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.sublabel}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(k.val)}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: col }}>{fmtV(k.varPct)}<span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400 }}> vs N-1</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Spark data={k.spark} color={col} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── ★ Side panel d'un indicateur (évolution + analyse) ──────────────── */
function IndicatorPanel({ indic, monthly, onClose }: {
  indic: { key: string; label: string; sublabel: string; val: number; varPct: number | null; pct: number | null }
  monthly: { n: number[]; n1: number[] | null } | undefined
  onClose: () => void
}) {
  const [tab, setTab] = useState<'evol' | 'analyse'>('evol')
  const pos = (indic.varPct ?? 0) >= 0
  const varCol = pos ? OK : DANGER
  const data = MOIS.map((m, i) => ({ m, n: monthly?.n?.[i] ?? 0, n1: monthly?.n1 ? monthly.n1[i] : null }))
  const hasN1 = !!monthly?.n1
  const loading = !monthly

  // À retenir — généré depuis les valeurs certifiées
  const bullets: string[] = []
  if (indic.varPct != null) bullets.push(`${indic.label} ${pos ? 'en hausse' : 'en baisse'} de ${Math.abs(Math.round(indic.varPct))} % sur l'exercice.`)
  if (indic.pct != null) bullets.push(`Représente ${fmtP(indic.pct)} du chiffre d'affaires.`)
  bullets.push(pos ? "Tendance favorable sur la période." : 'Poste à surveiller — la dynamique se dégrade.')

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 8, background: 'transparent' }} />
      <div style={{
        position: 'fixed', top: 12, right: 12, bottom: 12, width: 390, zIndex: 200, background: '#fff',
        borderRadius: 16, border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 30px rgba(0,0,0,0.10)', overflow: 'hidden', animation: 'slideIn 0.24s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <style>{'@keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}'}</style>

        <div style={{ padding: '18px 20px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{indic.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{indic.sublabel}</div>
            </div>
            <button onClick={onClose} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(indic.val)}</div>
              {indic.pct != null && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{fmtP(indic.pct)} du CA</div>}
            </div>
            {indic.varPct != null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: varCol, textAlign: 'right' }}>
                {fmtV(indic.varPct)}<span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, display: 'block' }}>vs N-1</span>
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 18, padding: '0 20px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          {([['evol', 'Évolution'], ['analyse', 'Analyse']] as const).map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontSize: 12,
              fontWeight: tab === id ? 600 : 500, color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${tab === id ? CH : 'transparent'}`,
            }}>{lbl}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--bg-main)', borderTop: `2px solid ${CH}`, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            </div>
          ) : tab === 'evol' ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Évolution sur 12 mois</div>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={data} margin={{ top: 6, right: 8, left: -26, bottom: 0 }}>
                  <XAxis dataKey="m" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={1} />
                  {hasN1 && <Line type="monotone" dataKey="n1" stroke={GREY} strokeWidth={1.8} strokeDasharray="4 3" dot={false} />}
                  <Line type="monotone" dataKey="n" stroke={CH} strokeWidth={2.2} dot={{ r: 2.5, fill: CH }} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                {hasN1 && <span><span style={{ display: 'inline-block', width: 10, height: 2, background: GREY, marginRight: 4, verticalAlign: 'middle' }} />N-1</span>}
                <span><span style={{ display: 'inline-block', width: 10, height: 2, background: CH, marginRight: 4, verticalAlign: 'middle' }} />N</span>
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.5, fontStyle: 'italic' }}>
                Courbe mensuelle indicative reconstruite depuis les écritures. Le total et la variation affichés en tête sont les valeurs certifiées de l'exercice.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>À retenir</div>
              {bullets.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 9, marginBottom: 11 }}>
                  <span style={{ color: i === bullets.length - 1 && !pos ? DANGER : OK, flexShrink: 0, fontSize: 13 }}>{i === bullets.length - 1 && !pos ? '!' : '✓'}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{b}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}

/* ── ★ Bulle « Où va le chiffre d'affaires ? » ───────────────────────── */
interface EuroSlice { key: string; label: string; sublabel: string; val: number; varPct: number | null; color: string }

function EuroRepartition({ slices, ca, onOpen }: {
  slices: EuroSlice[]; ca: number
  onOpen: (s: EuroSlice) => void
}) {
  // Barre : on n'empile que les parts positives, normalisées entre elles
  // (les charges peuvent dépasser le CA → un résultat net négatif n'a pas de tranche)
  const barSlices = slices.filter((s) => s.val > 0)
  const barTotal = barSlices.reduce((a, s) => a + s.val, 0) || 1
  const netSlice = slices.find((s) => s.key === 'net')
  const deficit = netSlice && netSlice.val < 0 ? Math.abs(netSlice.val) : null

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Où va le chiffre d'affaires ?</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Répartition du CA — cliquez un poste pour son évolution →</div>
      </div>

      {/* Barre empilée (parts positives uniquement) */}
      <div style={{ height: 20, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: deficit != null ? 8 : 16, background: 'var(--bg-main)' }}>
        {barSlices.map((s, i) => (
          <div key={i} onClick={() => onOpen(s)} title={s.label}
            style={{ width: `${(s.val / barTotal) * 100}%`, background: s.color, cursor: 'pointer', transition: 'opacity .15s' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.8')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')} />
        ))}
      </div>

      {/* Note déficit */}
      {deficit != null && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'rgba(203,107,94,0.07)', border: '1px solid rgba(203,107,94,0.18)', borderRadius: 8, padding: '8px 11px', marginBottom: 16 }}>
          <span style={{ color: DANGER, fontSize: 12, flexShrink: 0, marginTop: 1 }}>!</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Les charges absorbent la totalité du CA — résultat net déficitaire de <strong style={{ color: DANGER }}>{fmt(deficit)}</strong>.
          </span>
        </div>
      )}

      {/* Lignes */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {slices.map((s, i) => {
          const pct = ca > 0 ? (s.val / ca) * 100 : 0
          const pos = (s.varPct ?? 0) >= 0
          const neg = s.val < 0
          return (
            <div key={i} onClick={() => onOpen(s)}
              style={{ display: 'grid', gridTemplateColumns: '10px 1fr 90px 42px', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 7, cursor: 'pointer', transition: 'background .1s' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-page)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0, boxShadow: `0 1px 4px ${s.color}88` }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{s.sublabel}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: neg ? DANGER : 'var(--text-primary)' }}>{fmt(s.val)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{neg ? '—' : fmtP(pct)}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.varPct != null ? (pos ? OK : DANGER) : 'var(--text-muted)', textAlign: 'right' }}>
                {s.varPct != null ? fmtV(s.varPct) : '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── ★ Bloc « Explorer le détail » (navigation charges/produits) ─────── */
function ExploreBlock({ chargesPostes, produitsPostes, onOpen }: {
  chargesPostes: Poste[]; produitsPostes: Poste[]
  onOpen: (label: string, prefixes: string[]) => void
}) {
  const [side, setSide] = useState<'charges' | 'produits'>('charges')
  const isCharges = side === 'charges'
  const postes = isCharges ? chargesPostes : produitsPostes
  const colors = isCharges ? CHARGE_COLORS : PRODUIT_COLORS
  const accent = isCharges ? CH : OK
  const total = postes.reduce((s, p) => s + p.val, 0)
  const maxV = Math.max(...postes.map((p) => p.val), 1)

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Explorer le détail</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Cliquez un poste pour ouvrir son analyse complète →</div>
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-main)', borderRadius: 9, padding: 3, gap: 2 }}>
          {([['charges', 'Charges'], ['produits', 'Produits']] as const).map(([id, lbl]) => (
            <button key={id} onClick={() => setSide(id)} style={{
              border: 'none', cursor: 'pointer', padding: '6px 16px', borderRadius: 7, fontSize: 12,
              fontWeight: side === id ? 600 : 500,
              background: side === id ? 'var(--bg-card)' : 'transparent',
              color: side === id ? (id === 'charges' ? 'var(--alvio-champagne-dark)' : OK) : 'var(--text-secondary)',
              boxShadow: side === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all .15s',
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {postes.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '30px 0', textAlign: 'center' }}>Aucun poste sur cette catégorie.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 180, height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={postes} dataKey="val" nameKey="lib" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none"
                  onClick={(e: any) => e && onOpen(e.lib, PREFIXES[e.prefixKey] || [])}>
                  {postes.map((p, i) => <Cell key={i} fill={colors[i % colors.length]} style={{ cursor: 'pointer' }} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(total)}</div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>Total {isCharges ? 'charges' : 'produits'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {postes.map((p, i) => (
              <div key={i} onClick={() => onOpen(p.lib, PREFIXES[p.prefixKey] || [])}
                style={{ display: 'grid', gridTemplateColumns: '10px 1fr 96px 56px 14px', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background .12s' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-page)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
                <span style={{ width: 10, height: 10, borderRadius: 4, background: colors[i % colors.length], flexShrink: 0, boxShadow: `0 1px 4px ${colors[i % colors.length]}88` }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.lib}</div>
                  <div style={{ height: 4, background: 'var(--bg-main)', borderRadius: 3, marginTop: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${(p.val / maxV) * 100}%`, height: '100%', background: colors[i % colors.length], borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(p.val)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{total > 0 ? fmtP((p.val / total) * 100) : '—'}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: (p.varPct ?? 0) >= 0 ? OK : DANGER, textAlign: 'right' }}>{fmtV(p.varPct)}</span>
                <span style={{ fontSize: 12, color: accent }}>›</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Side panel (graphiques) ─────────────────────────────────────────── */
function SidePanel({ poste, onClose }: { poste: PosteDetail; onClose: () => void }) {
  const [tab, setTab] = useState<'apercu' | 'ecritures'>('apercu')
  // Drill compte → écritures filtrées
  const [selectedCompte, setSelectedCompte] = useState<{ num: string; lib: string; val: number; varPct: number | null } | null>(null)
  const isCharges = poste.orientation === 'charge'
  const accent = isCharges ? CH : OK
  const hasN1 = poste.monthly.some((m) => m.n1 > 0)

  // Reset compte sélectionné si le poste change
  const ecrToShow = selectedCompte
    ? (poste.comptesEcritures[selectedCompte.num] ?? [])
    : poste.ecritures

  const handleSelectCompte = (c: { num: string; lib: string; val: number; varPct: number | null }) => {
    setSelectedCompte(c)
    setTab('ecritures')
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 8, background: 'transparent' }} />
      <div style={{
        position: 'fixed', top: 12, right: 12, bottom: 12, width: 390, zIndex: 200, background: '#fff',
        borderRadius: 16, border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 30px rgba(0,0,0,0.10)', overflow: 'hidden', animation: 'slideIn 0.24s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <style>{'@keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}'}</style>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Breadcrumb quand un compte est sélectionné */}
              {selectedCompte ? (
                <button onClick={() => { setSelectedCompte(null); setTab('apercu') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: accent }}>←</span>
                  <span style={{ fontSize: 11, color: accent, fontWeight: 600 }}>{poste.label}</span>
                </button>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Détail {isCharges ? 'des charges' : 'des produits'}</div>
              )}
              <div style={{ fontSize: selectedCompte ? 13 : 16, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedCompte ? (
                  <>
                    <span title={selectedCompte.num} style={{ fontSize: 11, fontFamily: 'monospace', color: accent, marginRight: 6 }}>{num5(selectedCompte.num)}</span>
                    {sentenceCase(selectedCompte.lib)}
                  </>
                ) : poste.label}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, flexShrink: 0, marginLeft: 10 }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: accent }}>
                {fmt(selectedCompte ? selectedCompte.val : poste.total)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Exercice en cours</div>
            </div>
            {(selectedCompte ? selectedCompte.varPct : poste.varPct) != null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: ((selectedCompte ? selectedCompte.varPct : poste.varPct) ?? 0) >= 0 ? OK : DANGER, textAlign: 'right' }}>
                {fmtV(selectedCompte ? selectedCompte.varPct : poste.varPct)}
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, display: 'block' }}>vs N-1</span>
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 18, padding: '0 20px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
          {([['apercu', "Vue d'ensemble"], ['ecritures', 'Écritures associées']] as const).map(([id, lbl]) => {
            // Masquer "Vue d'ensemble" quand on est sur un compte (pas de graphes par compte)
            if (id === 'apercu' && selectedCompte) return null
            return (
              <button key={id} onClick={() => setTab(id)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontSize: 12,
                fontWeight: tab === id ? 600 : 500, color: tab === id ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${tab === id ? accent : 'transparent'}`,
              }}>{lbl}</button>
            )
          })}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {poste.loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div style={{ width: 28, height: 28, border: '2px solid var(--bg-main)', borderTop: `2px solid ${accent}`, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            </div>
          ) : tab === 'apercu' && !selectedCompte ? (
            <>
              {/* Évolution mensuelle */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Évolution mensuelle</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={poste.monthly} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barCategoryGap="18%">
                  <XAxis dataKey="m" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={0} />
                  {hasN1 && <Bar dataKey="n1" fill={GREY} radius={[2, 2, 0, 0]} />}
                  <Bar dataKey="n" fill={accent} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {hasN1 && (
                <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', fontSize: 9, color: 'var(--text-muted)', marginBottom: 18 }}>
                  <span><span style={{ display: 'inline-block', width: 7, height: 7, background: GREY, borderRadius: 2, marginRight: 4 }} />N-1</span>
                  <span><span style={{ display: 'inline-block', width: 7, height: 7, background: accent, borderRadius: 2, marginRight: 4 }} />N</span>
                </div>
              )}

              {/* Répartition par compte — cliquable */}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, marginTop: hasN1 ? 0 : 12 }}>
                Répartition par compte
                <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>Cliquez un compte pour ses écritures →</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 70px 40px 10px', fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: 6 }}>
                <span>N°</span><span>Libellé</span><span style={{ textAlign: 'right' }}>Montant</span><span style={{ textAlign: 'right' }}>Var.</span><span />
              </div>
              {poste.comptes.map((c, i) => (
                <div key={i} onClick={() => handleSelectCompte(c)}
                  style={{ display: 'grid', gridTemplateColumns: '44px 1fr 70px 40px 10px', alignItems: 'center', padding: '8px 6px', borderTop: '1px solid var(--border-light)', cursor: 'pointer', borderRadius: 6, transition: 'background .1s' }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = isCharges ? 'rgba(198,162,117,0.07)' : 'rgba(15,138,95,0.06)'
                  }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <span title={c.num} style={{
                    fontSize: 9, fontFamily: 'monospace', color: '#fff', background: accent,
                    padding: '2px 4px', borderRadius: 4, fontWeight: 700, letterSpacing: 0,
                    boxShadow: `0 1px 3px ${accent}55`,
                  }}>{num5(c.num)}</span>
                  <span title={sentenceCase(c.lib)} style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 4 }}>{sentenceCase(c.lib)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>{fmt(c.val)}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: (c.varPct ?? 0) >= 0 ? OK : DANGER, textAlign: 'right' }}>{fmtV(c.varPct)}</span>
                  <span style={{ fontSize: 10, color: accent, textAlign: 'right' }}>›</span>
                </div>
              ))}

              {/* Évolution annuelle */}
              {poste.annual.length > 1 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', margin: '20px 0 8px' }}>Évolution annuelle</div>
                  <ResponsiveContainer width="100%" height={110}>
                    <LineChart data={poste.annual} margin={{ top: 6, right: 6, left: -28, bottom: 0 }}>
                      <XAxis dataKey="y" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <Line type="monotone" dataKey="v" stroke={accent} strokeWidth={2} dot={{ r: 2.5, fill: accent }} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </>
          ) : (
            /* Onglet écritures — toutes ou filtrées sur un compte */
            <>
              {selectedCompte && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                  {ecrToShow.length} écriture{ecrToShow.length > 1 ? 's' : ''} · compte {selectedCompte.num}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 74px', fontSize: 8, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: 6 }}>
                <span>Date</span><span>Libellé</span><span style={{ textAlign: 'right' }}>Montant</span>
              </div>
              {ecrToShow.map((e, i) => (
                <div key={i}
                  style={{ display: 'grid', gridTemplateColumns: '64px 1fr 74px', alignItems: 'center', padding: '9px 6px', borderTop: '1px solid var(--border-light)', borderRadius: 6, transition: 'background .1s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-main)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(e.date)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sentenceCase(e.lib)}>{sentenceCase(e.lib) || '—'}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isCharges ? DANGER : OK, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{isCharges ? '+' : ''}{fmt(Math.abs(e.montant))}</span>
                </div>
              ))}
              {ecrToShow.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Aucune écriture sur la période.</div>}
            </>
          )}
        </div>
      </div>
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════ */
export default function PerformancesPage() {
  const [etats, setEtats] = useState<any>(null)
  const [etatsN1, setEtatsN1] = useState<any>(null)
  const [annees, setAnnees] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [, setUserId] = useState<string>('')
  const [kpiPanel, setKpiPanel] = useState<{ key: string; label: string; sublabel: string; val: number; varPct: number | null; pct: number | null } | null>(null)
  const [kpiMonthly, setKpiMonthly] = useState<Record<string, { n: number[]; n1: number[] | null }>>({})
  // euroPanel : side panel de la bulle "Où va le CA ?"
  const [euroPanel, setEuroPanel] = useState<{ label: string; sublabel: string; val: number; varPct: number | null; pct: number | null; key: string } | null>(null)
  const [panel, setPanel] = useState<PosteDetail | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [sparks, setSparks] = useState<Record<string, number[]>>({})

  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const { activeId } = useActiveCompany()

  // Retour visuel immédiat (changement de société / année / période) :
  // on grise le contenu dès qu'un input change, on dégrise quand les données arrivent.
  const [switching, setSwitching] = useState(false)
  const firstLoadRef = useRef(true)
  useEffect(() => {
    if (firstLoadRef.current) { firstLoadRef.current = false; return }
    setSwitching(true)
  }, [activeId, anneeActive, periodeTab, dateDebut, dateFin])
  useEffect(() => { setSwitching(false) }, [etats])

  const periodeParams = periodeTab === 'perso' && dateDebut && dateFin ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
  const periodeParamsN1 = periodeTab === 'perso' && dateDebutN1 && dateFinN1 ? `&dateDebut=${dateDebutN1}&dateFin=${dateFinN1}` : ''

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      if (!activeId) return
      const { data } = await sb.from('fec_exercices').select('annee').eq('company_id', activeId).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const dispos = data.map((r: any) => r.annee as number)
        setAnnees(dispos)
        const annee = dispos.includes(anneeActive) ? anneeActive : dispos[0]
        if (annee !== anneeActive) setAnneeActive(annee)
        const fetches: Promise<void>[] = [
          fetch(`/api/etats?annee=${annee}&company_id=${activeId}${periodeParams}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setEtats(d)),
        ]
        if (dispos.includes(annee - 1)) {
          fetches.push(fetch(`/api/etats?annee=${annee - 1}&company_id=${activeId}${periodeParamsN1}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setEtatsN1(d)))
        }
        await Promise.all(fetches)
      }
      setLoading(false)
    }
    load()
  }, [activeId])

  useEffect(() => {
    if (!activeId || !annees.length) return
    const p = periodeTab === 'perso' && dateDebut && dateFin ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    const pN1 = periodeTab === 'perso' && dateDebutN1 && dateFinN1 ? `&dateDebut=${dateDebutN1}&dateFin=${dateFinN1}` : ''
    fetch(`/api/etats?annee=${anneeActive}&company_id=${activeId}${p}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setEtats(d))
    if (annees.includes(anneeActive - 1)) {
      fetch(`/api/etats?annee=${anneeActive - 1}&company_id=${activeId}${pN1}`).then((r) => (r.ok ? r.json() : null)).then((d) => d && setEtatsN1(d))
    } else setEtatsN1(null)
  }, [periodeTab, dateDebut, dateFin, dateDebutN1, dateFinN1])

  // Séries mensuelles par indicateur (N et N-1) reconstruites depuis les écritures (classes 6 & 7).
  // Indicatif : les totaux/variations affichés restent ceux, certifiés, de /api/etats.
  useEffect(() => {
    if (!activeId || !anneeActive) return
    let cancel = false

    const buildYear = async (annee: number) => {
      const res = await fetch(`/api/etats/detail?annee=${annee}&company_id=${activeId}&prefixes=6,7`)
      if (!res.ok) return null
      const d = await res.json()
      const B: Record<string, number[]> = {}
      const add = (k: string, mi: number, v: number) => { (B[k] ??= Array(12).fill(0))[mi] += v }
      ;(d.comptes as Compte[]).forEach((c) => {
        const p2 = c.num.slice(0, 2)
        c.ecritures.forEach((e) => {
          const mi = monthIdx(e.date); if (mi < 0) return
          if (c.num[0] === '7') add('p' + p2, mi, e.credit - e.debit)
          else add('p' + p2, mi, e.debit - e.credit)
        })
      })
      const g = (k: string) => B[k] ?? Array(12).fill(0)
      const months = Array.from({ length: 12 }, (_, i) => i)
      // Cascade SIG mensuelle
      const ca = months.map((i) => g('p70')[i] + g('p71')[i] + g('p72')[i] + g('p73')[i])
      const mb = months.map((i) => ca[i] - (g('p60')[i] + g('p61')[i] + g('p62')[i]))
      const ebe = months.map((i) => mb[i] + g('p74')[i] - g('p63')[i] - g('p64')[i])
      const rex = months.map((i) => ebe[i] + g('p75')[i] + g('p78')[i] - g('p65')[i] - g('p68')[i])
      const net = months.map((i) => rex[i] + g('p76')[i] + g('p77')[i] - g('p66')[i] - g('p67')[i] - g('p69')[i])
      // Séries pour la bulle « Où va le CA » (montants de charges, positifs)
      const pers = months.map((i) => g('p64')[i])
      const ext = months.map((i) => g('p60')[i] + g('p61')[i] + g('p62')[i])
      const fisc = months.map((i) => g('p63')[i])
      const dot = months.map((i) => g('p68')[i] + g('p65')[i])
      return { ca, mb, ebe, rex, net, pers, ext, fisc, dot }
    }

    const run = async () => {
      const n = await buildYear(anneeActive)
      const n1 = annees.includes(anneeActive - 1) ? await buildYear(anneeActive - 1) : null
      if (cancel || !n) return
      const keys: (keyof typeof n)[] = ['ca', 'mb', 'ebe', 'rex', 'net', 'pers', 'ext', 'fisc', 'dot']
      const monthly: Record<string, { n: number[]; n1: number[] | null }> = {}
      keys.forEach((k) => { monthly[k] = { n: n[k], n1: n1 ? n1[k] : null } })
      setKpiMonthly(monthly)
      if (SHOW_SPARKLINES) setSparks({ ca: n.ca, mb: n.mb, ebe: n.ebe, rex: n.rex, net: n.net })
    }
    run()
    return () => { cancel = true }
  }, [activeId, anneeActive, annees])

  const changerAnnee = async (annee: number) => {
    setAnneeActive(annee); setPanel(null); setKpiPanel(null)
    const p = periodeTab === 'perso' && dateDebut && dateFin ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    const pN1 = periodeTab === 'perso' && dateDebutN1 && dateFinN1 ? `&dateDebut=${dateDebutN1}&dateFin=${dateFinN1}` : ''
    const res = await fetch(`/api/etats?annee=${annee}&company_id=${activeId}${p}`)
    if (res.ok) setEtats(await res.json())
    if (annees.includes(annee - 1)) {
      const r1 = await fetch(`/api/etats?annee=${annee - 1}&company_id=${activeId}${pN1}`)
      setEtatsN1(r1.ok ? await r1.json() : null)
    } else setEtatsN1(null)
  }

  const fetchDetail = async (annee: number, prefixes: string[]): Promise<Compte[]> => {
    const r = await fetch(`/api/etats/detail?annee=${annee}&company_id=${activeId}&prefixes=${prefixes.join(',')}`)
    if (!r.ok) return []
    const d = await r.json()
    return (d.comptes || []) as Compte[]
  }

  // Drill → détail du poste (mensuel N/N-1, annuel pluriannuel, écritures)
  const handleDrill = useCallback(async (label: string, prefixes: string[]) => {
    if (!prefixes.length) return
    const orientation: 'produit' | 'charge' = prefixes[0][0] === '7' ? 'produit' : 'charge'
    const sign = (e: Ecriture) => (orientation === 'produit' ? e.credit - e.debit : e.debit - e.credit)
    setDrillLoading(true)
    setPanel({ label, prefixes, orientation, total: 0, varPct: null, comptes: [], monthly: MOIS.map((m) => ({ m, n: 0, n1: 0 })), annual: [], ecritures: [], comptesEcritures: {}, loading: true })

    const comptesN = await fetchDetail(anneeActive, prefixes)
    const comptesN1 = annees.includes(anneeActive - 1) ? await fetchDetail(anneeActive - 1, prefixes) : []

    const totalN = comptesN.reduce((s, c) => s + Math.abs(c.solde), 0)
    const totalN1 = comptesN1.reduce((s, c) => s + Math.abs(c.solde), 0)

    const monthly = MOIS.map((m, i) => {
      let n = 0, n1 = 0
      comptesN.forEach((c) => c.ecritures.forEach((e) => { if (monthIdx(e.date) === i) n += sign(e) }))
      comptesN1.forEach((c) => c.ecritures.forEach((e) => { if (monthIdx(e.date) === i) n1 += sign(e) }))
      return { m, n: Math.max(0, n), n1: Math.max(0, n1) }
    })

    const n1ByNum: Record<string, number> = {}
    comptesN1.forEach((c) => { n1ByNum[c.num] = Math.abs(c.solde) })
    const comptes = comptesN
      .map((c) => {
        const v = Math.abs(c.solde)
        const prev = n1ByNum[c.num]
        const varPct = prev != null && prev > 0.5 ? ((v - prev) / prev) * 100 : null
        return { num: c.num, lib: c.lib, val: v, varPct }
      })
      .sort((a, b) => a.num.localeCompare(b.num))

    const annual: { y: string; v: number }[] = []
    const yearsAsc = [...annees].sort((a, b) => a - b)
    for (const y of yearsAsc) {
      let cs: Compte[]
      if (y === anneeActive) cs = comptesN
      else if (y === anneeActive - 1) cs = comptesN1
      else cs = await fetchDetail(y, prefixes)
      annual.push({ y: String(y), v: cs.reduce((s, c) => s + Math.abs(c.solde), 0) })
    }

    const ecritures = comptesN
      .flatMap((c) => c.ecritures.map((e) => ({ date: e.date, lib: e.lib, montant: sign(e) })))
      .sort((a, b) => toIso(b.date).localeCompare(toIso(a.date)))
      .slice(0, 60)

    // Écritures par numéro de compte (pour le drill compte → écritures)
    const comptesEcritures: Record<string, { date: string; lib: string; montant: number }[]> = {}
    comptesN.forEach((c) => {
      comptesEcritures[c.num] = c.ecritures
        .map((e) => ({ date: e.date, lib: e.lib, montant: sign(e) }))
        .sort((a, b) => toIso(b.date).localeCompare(toIso(a.date)))
    })

    setPanel({
      label, prefixes, orientation, total: totalN,
      varPct: totalN1 > 0.5 ? ((totalN - totalN1) / totalN1) * 100 : null,
      comptes, monthly, annual, ecritures, comptesEcritures, loading: false,
    })
    setDrillLoading(false)
  }, [anneeActive, activeId, annees])

  const sig = etats?.sig
  const sigN1 = etatsN1?.sig
  const cr = etats?.cr
  const crN1 = etatsN1?.cr
  const hasN1 = !!sigN1

  const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 14, padding: 20 }
  const cardTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }
  const cardSub: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', marginTop: 1, marginBottom: 16 }

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar activePage="performances" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid var(--bg-main)', borderTop: `2px solid ${CH}`, borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  const kpis = sig ? [
    { key: 'ca',  label: "Chiffre d'affaires",        sublabel: 'Volume de ventes',          pct: null,         val: sig.ca,           pctN1: null,                          varPct: sigN1 && sigN1.ca ? ((sig.ca - sigN1.ca) / Math.abs(sigN1.ca)) * 100 : null,                                     spark: sparks.ca || [] },
    { key: 'mb',  label: 'Marge brute',                sublabel: 'Efficacité commerciale',    pct: sig.tauxMb,   val: sig.valeurAjoutee, pctN1: sigN1 ? sigN1.tauxMb : null,    varPct: sigN1 && sigN1.valeurAjoutee ? ((sig.valeurAjoutee - sigN1.valeurAjoutee) / Math.abs(sigN1.valeurAjoutee)) * 100 : null, spark: sparks.mb || [] },
    { key: 'ebe', label: 'EBE',                        sublabel: 'Capacité à générer du cash', pct: sig.tauxEbe, val: sig.ebe,          pctN1: sigN1 ? sigN1.tauxEbe : null,   varPct: sigN1 && sigN1.ebe ? ((sig.ebe - sigN1.ebe) / Math.abs(sigN1.ebe)) * 100 : null,                                  spark: sparks.ebe || [] },
    { key: 'rex', label: "Résultat d'exploitation",    sublabel: 'Performance opérationnelle', pct: sig.tauxRex, val: sig.rex,          pctN1: sigN1 ? sigN1.tauxRex : null,   varPct: sigN1 && sigN1.rex ? ((sig.rex - sigN1.rex) / Math.abs(sigN1.rex)) * 100 : null,                                  spark: sparks.rex || [] },
    { key: 'net', label: 'Résultat net',               sublabel: 'Ce qui reste après tout',   pct: sig.tauxRnet, val: sig.resultatNet, pctN1: sigN1 ? sigN1.tauxRnet : null,  varPct: sigN1 && sigN1.resultatNet ? ((sig.resultatNet - sigN1.resultatNet) / Math.abs(sigN1.resultatNet)) * 100 : null,   spark: sparks.net || [] },
  ] : []

  const euroSlices: EuroSlice[] = sig && cr ? (() => {
    const ca = sig.ca || 1
    const pers = cr.chargesExploitation.chargesPersonnel
    const ext = cr.chargesExploitation.servicesExt + cr.chargesExploitation.autresAchats + cr.chargesExploitation.achatsMarchandises
    const fisc = cr.chargesExploitation.impotsTaxes
    const dot = cr.chargesExploitation.dotations + (cr.chargesExploitation.autresCharges || 0)
    const rnet = sig.resultatNet
    const persN1 = crN1 ? crN1.chargesExploitation.chargesPersonnel : null
    const extN1 = crN1 ? crN1.chargesExploitation.servicesExt + crN1.chargesExploitation.autresAchats + crN1.chargesExploitation.achatsMarchandises : null
    const fiscN1 = crN1 ? crN1.chargesExploitation.impotsTaxes : null
    const dotN1 = crN1 ? crN1.chargesExploitation.dotations + (crN1.chargesExploitation.autresCharges || 0) : null
    const rnetN1 = sigN1 ? sigN1.resultatNet : null
    const vp = (v: number, p: number | null) => p != null && Math.abs(p) > 0.5 ? ((v - p) / Math.abs(p)) * 100 : null
    return [
      { key: 'pers', label: 'Salaires & charges sociales', sublabel: 'Masse salariale', val: pers, varPct: vp(pers, persN1), color: CH },
      { key: 'ext',  label: 'Charges externes',            sublabel: 'Achats & services', val: ext,  varPct: vp(ext, extN1),   color: '#B08D5E' },
      { key: 'fisc', label: 'Fiscalité & taxes',           sublabel: 'Impôts hors IS',    val: fisc, varPct: vp(fisc, fiscN1), color: '#8C9BAB' },
      { key: 'dot',  label: 'Dotations & autres',          sublabel: 'Amortissements',    val: dot,  varPct: vp(dot, dotN1),   color: '#BFC6CC' },
      { key: 'net',  label: 'Résultat net',                sublabel: rnet >= 0 ? 'Ce qui reste' : 'Déficit', val: rnet, varPct: vp(rnet, rnetN1), color: rnet >= 0 ? OK : DANGER },
    ].filter((s) => Math.abs(s.val) > 0.5)
  })() : []

  // Postes pour le bloc Explorer (val = magnitude, varPct vs N-1)
  const mkPostes = (defs: { lib: string; val: number; n1: number | undefined; prefixKey: string }[]): Poste[] =>
    defs
      .filter((d) => Math.abs(d.val) > 0.5)
      .map((d) => {
        const val = Math.abs(d.val)
        const prev = d.n1 != null ? Math.abs(d.n1) : null
        return { lib: d.lib, val, prefixKey: d.prefixKey, varPct: prev != null && prev > 0.5 ? ((val - prev) / prev) * 100 : null }
      })
    // ordre PCG préservé — pas de sort()

  const chargesPostes: Poste[] = cr ? mkPostes([
    { lib: 'Achats de marchandises (60)',     val: cr.chargesExploitation.achatsMarchandises,   n1: crN1?.chargesExploitation.achatsMarchandises,   prefixKey: 'achatsMarchandises' },
    { lib: 'Autres achats & variation stocks (60)', val: cr.chargesExploitation.autresAchats + cr.chargesExploitation.variationStocksMarch, n1: crN1 ? (crN1.chargesExploitation.autresAchats + crN1.chargesExploitation.variationStocksMarch) : undefined, prefixKey: 'autresAchats' },
    { lib: 'Services extérieurs (61/62)',     val: cr.chargesExploitation.servicesExt,          n1: crN1?.chargesExploitation.servicesExt,          prefixKey: 'servicesExt' },
    { lib: 'Impôts & taxes (63)',             val: cr.chargesExploitation.impotsTaxes,          n1: crN1?.chargesExploitation.impotsTaxes,          prefixKey: 'impotsTaxes' },
    { lib: 'Charges de personnel (64)',       val: cr.chargesExploitation.chargesPersonnel,     n1: crN1?.chargesExploitation.chargesPersonnel,     prefixKey: 'chargesPersonnel' },
    { lib: 'Autres charges de gestion (65)',  val: cr.chargesExploitation.autresCharges,        n1: crN1?.chargesExploitation.autresCharges,        prefixKey: 'autresCharges' },
    { lib: 'Dotations aux amortissements (68)', val: cr.chargesExploitation.dotations,          n1: crN1?.chargesExploitation.dotations,            prefixKey: 'dotations' },
  ]) : []

  const produitsPostes: Poste[] = cr ? mkPostes([
    { lib: 'Ventes de marchandises (70)',          val: cr.produitsExploitation.ventesMarchandises,    n1: crN1?.produitsExploitation.ventesMarchandises,    prefixKey: 'ventesMarchandises' },
    { lib: 'Production vendue — biens & services (70)', val: cr.produitsExploitation.productionVendue, n1: crN1?.produitsExploitation.productionVendue,      prefixKey: 'productionVendue' },
    { lib: 'Production stockée (71)',              val: cr.produitsExploitation.productionStockee,     n1: crN1?.produitsExploitation.productionStockee,     prefixKey: 'productionStockee' },
    { lib: 'Production immobilisée (72)',          val: cr.produitsExploitation.productionImmobilisee, n1: crN1?.produitsExploitation.productionImmobilisee, prefixKey: 'productionImmobilisee' },
    { lib: "Subventions d'exploitation (74)",      val: cr.produitsExploitation.subventions,           n1: crN1?.produitsExploitation.subventions,           prefixKey: 'subventions' },
    { lib: 'Autres produits de gestion (75)',      val: cr.produitsExploitation.autresProduits,        n1: crN1?.produitsExploitation.autresProduits,        prefixKey: 'autresProduits' },
    { lib: 'Reprises sur provisions (78)',         val: cr.produitsExploitation.reprises,              n1: crN1?.produitsExploitation.reprises,              prefixKey: 'reprises' },
  ]) : []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar activePage="performances" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="Performances" annees={annees} anneeActive={anneeActive} onChangerAnnee={changerAnnee} loading={switching || drillLoading}
          periodeTab={periodeTab} setPeriodeTab={setPeriodeTab}
          dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin}
          anneeN1={anneeN1} setAnneeN1={setAnneeN1} dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1}
          dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />

        <div style={{ flex: 1, padding: 24, overflowY: 'auto', opacity: switching ? 0.45 : 1, transition: 'opacity .18s ease', pointerEvents: switching ? 'none' : undefined }}>
          {!sig ? (
            <div style={{ maxWidth: 420, margin: '80px auto', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(198,162,117,0.08)', border: '1px solid rgba(198,162,117,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg viewBox="80 34 340 315" width="32" height="32"><path fill={CH} d="M247.73,149.32c-2.59,6.14-5,11.83-7.39,17.53c-6.89,16.45-13.73,32.91-20.71,49.32c-0.48,1.14-1.79,2.14-2.95,2.74c-11.04,5.76-22.82,9.46-34.94,12.07c-6.36,1.37-12.82,2.3-19.23,3.41c-0.7,0.12-1.42,0.11-2.47,0.18c29.27-66.95,58.4-133.57,87.75-200.71c29.3,67.03,58.43,133.68,87.71,200.69c-1.62-0.15-2.96-0.21-4.29-0.41c-18.25-2.72-36.04-7.01-52.67-15.28c-0.98-0.49-2.09-1.34-2.5-2.29c-7.21-16.95-14.33-33.95-21.46-50.94C252.35,160.35,250.13,155.05,247.73,149.32z" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>Aucune donnée disponible</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28, lineHeight: 1.7 }}>Importez un FEC ou connectez Pennylane pour accéder à vos performances.</div>
              <a href="/entreprise" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: CH, color: '#fff', borderRadius: 10, padding: '11px 24px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Accéder aux paramétrages</a>
            </div>
          ) : (
            <>
              <AlvioInsight payload={{ page: 'profitability', annee: anneeActive, indicateurs: { ca: sig.ca, mb: sig.margeCommerciale, ebe: sig.ebe, rex: sig.rex, rnet: sig.resultatNet, tauxMb: sig.tauxMb, tauxEbe: sig.tauxEbe, tauxRex: sig.tauxRex, tauxRnet: sig.tauxRnet, tauxPers: sig.tauxPers, pers64: sig.chargesPersonnel } }} />

              {/* KPIs ratio (haut) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '6px 0 18px' }}>
                {kpis.filter((k) => k.key !== 'ca').map((k) => <KpiCard key={k.key} label={k.label} pct={k.pct} val={k.val} pctN1={k.pctN1} spark={k.spark} />)}
              </div>

              {/* Indicateurs clés (gauche) + Où va le CA (droite) — 50/50 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                <IndicateursCles kpis={kpis} onOpen={(k) => setKpiPanel({ key: k.key, label: k.label, sublabel: k.sublabel, val: k.val, varPct: k.varPct, pct: k.pct })} />
                <EuroRepartition slices={euroSlices} ca={sig.ca} onOpen={(s) => setEuroPanel({ key: s.key, label: s.label, sublabel: s.sublabel, val: s.val, varPct: s.varPct, pct: sig.ca > 0 ? (s.val / sig.ca) * 100 : null })} />
              </div>

              {/* ★ Bloc Explorer le détail (charges / produits) */}
              <div style={{ marginBottom: 18 }}>
                <ExploreBlock chargesPostes={chargesPostes} produitsPostes={produitsPostes} onOpen={handleDrill} />
              </div>
            </>
          )}
        </div>
      </div>

      {panel && <SidePanel poste={panel} onClose={() => setPanel(null)} />}
      {kpiPanel && <IndicatorPanel indic={kpiPanel} monthly={kpiMonthly[kpiPanel.key]} onClose={() => setKpiPanel(null)} />}
      {euroPanel && <IndicatorPanel indic={euroPanel} monthly={kpiMonthly[euroPanel.key]} onClose={() => setEuroPanel(null)} />}
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
