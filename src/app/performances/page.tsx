'use client'
import { useState, useEffect, useCallback } from 'react'
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
const SHOW_SPARKLINES = true

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'
const fmtV = (n: number | null) => (n == null ? '—' : (n >= 0 ? '+' : '') + Math.round(n) + ' %')
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
function KpiCard({ label, pct, val, pctN1, spark }: { label: string; pct: number; val: number; pctN1: number | null; spark: number[] }) {
  const up = pctN1 == null ? true : pct >= pctN1
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: up ? OK : 'var(--text-primary)', marginTop: 8, letterSpacing: '-0.02em' }}>{fmtP(pct)}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, fontWeight: 500 }}>{fmt(val)}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, minHeight: 34 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pctN1 != null ? `vs ${fmtP(pctN1)} N-1` : '—'}</div>
        {SHOW_SPARKLINES && <Spark data={spark} color={up ? OK : DANGER} />}
      </div>
    </div>
  )
}

/* ── Cascade (waterfall) ─────────────────────────────────────────────── */
function buildWaterfall(sig: any) {
  const raw = [
    { name: 'CA', type: 'anchor', value: sig.ca },
    { name: 'Consommations ext.', type: 'down', value: -(sig.consommationsInt ?? 0) },
    { name: 'Valeur ajoutée', type: 'anchor', value: sig.valeurAjoutee },
    { name: 'Impôts & taxes', type: 'down', value: -(sig.impotsTaxes ?? 0) },
    { name: 'Charges de personnel', type: 'down', value: -(sig.chargesPersonnel ?? 0) },
    { name: 'EBE', type: 'anchor', value: sig.ebe },
    { name: 'Dotations & autres', type: 'down', value: -(sig.ebe - sig.rex) },
    { name: "Résultat d'exploit.", type: 'anchor', value: sig.rex },
    { name: 'Financier & IS', type: 'down', value: -(sig.rex - sig.resultatNet) },
    { name: 'Résultat net', type: 'anchor', value: sig.resultatNet },
  ]
  let cursor = 0
  return raw.map((d) => {
    if (d.type === 'anchor') { cursor = d.value; return { ...d, base: 0, bar: d.value } }
    const start = cursor + d.value
    const r = { ...d, base: start, bar: -d.value }
    cursor = start
    return r
  })
}
function Waterfall({ sig, highlight }: { sig: any; highlight: string | null }) {
  const data = buildWaterfall(sig)
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 24, right: 4, left: 4, bottom: 4 }} barCategoryGap="22%">
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} interval={0} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} height={40} />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="bar" stackId="a" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => {
            const isAnchor = d.type === 'anchor'
            const hot = highlight === d.name
            return <Cell key={i} fill={hot ? '#242628' : (isAnchor ? CH : '#CB6B5E')} opacity={hot ? 1 : (isAnchor ? 1 : 0.85)} />
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Comparatif N/N-1 ────────────────────────────────────────────────── */
function CompareList({ rows, mode }: { rows: { label: string; val: number; varPct: number | null }[]; mode: 'val' | 'pct' }) {
  const maxV = Math.max(...rows.map((r) => Math.abs(r.val)), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rows.map((c, i) => {
        const pos = (c.varPct ?? 0) >= 0
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{c.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{mode === 'val' ? fmt(c.val) : fmtV(c.varPct)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 6, background: 'var(--bg-main)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(Math.abs(c.val) / maxV) * 100}%`, height: '100%', background: CH, borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: pos ? OK : DANGER, width: 44, textAlign: 'right' }}>{fmtV(c.varPct)}</span>
            </div>
          </div>
        )
      })}
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
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: accent, marginRight: 6 }}>{selectedCompte.num}</span>
                    {selectedCompte.lib}
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
                  <span style={{
                    fontSize: 9, fontFamily: 'monospace', color: '#fff', background: accent,
                    padding: '2px 4px', borderRadius: 4, fontWeight: 700, letterSpacing: 0,
                    boxShadow: `0 1px 3px ${accent}55`,
                  }}>{c.num.slice(0, 5)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 4 }}>{c.lib}</span>
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
                  <span style={{ fontSize: 11, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.lib}>{e.lib || '—'}</span>
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
  const [highlight, setHighlight] = useState<string | null>(null)
  const [wfMode, setWfMode] = useState<'val' | 'pct'>('val')
  const [cmpMode, setCmpMode] = useState<'val' | 'pct'>('val')
  const [panel, setPanel] = useState<PosteDetail | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [sparks, setSparks] = useState<Record<string, number[]>>({})

  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const { activeId } = useActiveCompany()

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

  // Sparklines KPI : trend mensuel reconstruit depuis les écritures (classes 6 & 7), indicatif.
  useEffect(() => {
    if (!SHOW_SPARKLINES || !activeId || !anneeActive) return
    let cancel = false
    const run = async () => {
      const res = await fetch(`/api/etats/detail?annee=${anneeActive}&company_id=${activeId}&prefixes=6,7`)
      if (!res.ok) return
      const d = await res.json()
      const prod: number[] = Array(12).fill(0), conso: number[] = Array(12).fill(0)
      const perso: number[] = Array(12).fill(0), impots: number[] = Array(12).fill(0), dotAutres: number[] = Array(12).fill(0)
        ; (d.comptes as Compte[]).forEach((c) => {
          const cls = c.num[0]
          c.ecritures.forEach((e) => {
            const mi = monthIdx(e.date); if (mi < 0) return
            if (cls === '7') prod[mi] += e.credit - e.debit
            else {
              const v = e.debit - e.credit
              const p2 = c.num.slice(0, 2)
              if (p2 === '60' || p2 === '61' || p2 === '62') conso[mi] += v
              else if (p2 === '63') impots[mi] += v
              else if (p2 === '64') perso[mi] += v
              else dotAutres[mi] += v
            }
          })
        })
      if (cancel) return
      const va = prod.map((v, i) => v - conso[i])
      const ebe = va.map((v, i) => v - impots[i] - perso[i])
      const net = ebe.map((v, i) => v - dotAutres[i])
      setSparks({ mb: va, ebe, rex: net, net })
    }
    run()
    return () => { cancel = true }
  }, [activeId, anneeActive])

  const changerAnnee = async (annee: number) => {
    setAnneeActive(annee); setPanel(null); setHighlight(null)
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
      .sort((a, b) => b.val - a.val)

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

  const STEPS = [
    { n: 1, label: 'CA', bar: 'CA' }, { n: 2, label: 'VA', bar: 'Valeur ajoutée' },
    { n: 3, label: 'EBE', bar: 'EBE' }, { n: 4, label: "Résultat d'exploitation", bar: "Résultat d'exploit." },
    { n: 5, label: 'Résultat net', bar: 'Résultat net' },
  ]

  const kpis = sig ? [
    { key: 'mb', label: 'Marge brute', pct: sig.tauxMb, val: sig.valeurAjoutee, pctN1: sigN1 ? sigN1.tauxMb : null, spark: sparks.mb || [] },
    { key: 'ebe', label: 'EBE', pct: sig.tauxEbe, val: sig.ebe, pctN1: sigN1 ? sigN1.tauxEbe : null, spark: sparks.ebe || [] },
    { key: 'rex', label: "Résultat d'exploitation", pct: sig.tauxRex, val: sig.rex, pctN1: sigN1 ? sigN1.tauxRex : null, spark: sparks.rex || [] },
    { key: 'net', label: 'Résultat net', pct: sig.tauxRnet, val: sig.resultatNet, pctN1: sigN1 ? sigN1.tauxRnet : null, spark: sparks.net || [] },
  ] : []

  const compareRows = sig ? [
    { label: "Chiffre d'affaires", val: sig.ca, varPct: sigN1 && sigN1.ca ? ((sig.ca - sigN1.ca) / Math.abs(sigN1.ca)) * 100 : null },
    { label: 'Marge brute', val: sig.valeurAjoutee, varPct: sigN1 && sigN1.valeurAjoutee ? ((sig.valeurAjoutee - sigN1.valeurAjoutee) / Math.abs(sigN1.valeurAjoutee)) * 100 : null },
    { label: 'EBE', val: sig.ebe, varPct: sigN1 && sigN1.ebe ? ((sig.ebe - sigN1.ebe) / Math.abs(sigN1.ebe)) * 100 : null },
    { label: "Résultat d'exploitation", val: sig.rex, varPct: sigN1 && sigN1.rex ? ((sig.rex - sigN1.rex) / Math.abs(sigN1.rex)) * 100 : null },
    { label: 'Résultat net', val: sig.resultatNet, varPct: sigN1 && sigN1.resultatNet ? ((sig.resultatNet - sigN1.resultatNet) / Math.abs(sigN1.resultatNet)) * 100 : null },
  ] : []

  // Postes pour le bloc Explorer (val = magnitude, varPct vs N-1)
  const mkPostes = (defs: { lib: string; val: number; n1: number | undefined; prefixKey: string }[]): Poste[] =>
    defs
      .filter((d) => Math.abs(d.val) > 0.5)
      .map((d) => {
        const val = Math.abs(d.val)
        const prev = d.n1 != null ? Math.abs(d.n1) : null
        return { lib: d.lib, val, prefixKey: d.prefixKey, varPct: prev != null && prev > 0.5 ? ((val - prev) / prev) * 100 : null }
      })
      .sort((a, b) => b.val - a.val)

  const chargesPostes: Poste[] = cr ? mkPostes([
    { lib: 'Charges de personnel (64)', val: cr.chargesExploitation.chargesPersonnel, n1: crN1?.chargesExploitation.chargesPersonnel, prefixKey: 'chargesPersonnel' },
    { lib: 'Services extérieurs (61/62)', val: cr.chargesExploitation.servicesExt, n1: crN1?.chargesExploitation.servicesExt, prefixKey: 'servicesExt' },
    { lib: 'Autres achats (60)', val: cr.chargesExploitation.autresAchats, n1: crN1?.chargesExploitation.autresAchats, prefixKey: 'autresAchats' },
    { lib: 'Achats de marchandises', val: cr.chargesExploitation.achatsMarchandises, n1: crN1?.chargesExploitation.achatsMarchandises, prefixKey: 'achatsMarchandises' },
    { lib: 'Variation de stocks', val: cr.chargesExploitation.variationStocksMarch, n1: crN1?.chargesExploitation.variationStocksMarch, prefixKey: 'variationStocks' },
    { lib: 'Dotations & provisions (68)', val: cr.chargesExploitation.dotations, n1: crN1?.chargesExploitation.dotations, prefixKey: 'dotations' },
    { lib: 'Impôts & taxes (63)', val: cr.chargesExploitation.impotsTaxes, n1: crN1?.chargesExploitation.impotsTaxes, prefixKey: 'impotsTaxes' },
    { lib: 'Autres charges (65)', val: cr.chargesExploitation.autresCharges, n1: crN1?.chargesExploitation.autresCharges, prefixKey: 'autresCharges' },
  ]) : []

  const produitsPostes: Poste[] = cr ? mkPostes([
    { lib: 'Production vendue (biens & services)', val: cr.produitsExploitation.productionVendue, n1: crN1?.produitsExploitation.productionVendue, prefixKey: 'productionVendue' },
    { lib: 'Ventes de marchandises', val: cr.produitsExploitation.ventesMarchandises, n1: crN1?.produitsExploitation.ventesMarchandises, prefixKey: 'ventesMarchandises' },
    { lib: 'Production stockée', val: cr.produitsExploitation.productionStockee, n1: crN1?.produitsExploitation.productionStockee, prefixKey: 'productionStockee' },
    { lib: 'Production immobilisée', val: cr.produitsExploitation.productionImmobilisee, n1: crN1?.produitsExploitation.productionImmobilisee, prefixKey: 'productionImmobilisee' },
    { lib: "Subventions d'exploitation (74)", val: cr.produitsExploitation.subventions, n1: crN1?.produitsExploitation.subventions, prefixKey: 'subventions' },
    { lib: 'Autres produits de gestion (75)', val: cr.produitsExploitation.autresProduits, n1: crN1?.produitsExploitation.autresProduits, prefixKey: 'autresProduits' },
    { lib: 'Reprises sur provisions (78)', val: cr.produitsExploitation.reprises, n1: crN1?.produitsExploitation.reprises, prefixKey: 'reprises' },
  ]) : []

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <Sidebar activePage="performances" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="Performances" annees={annees} anneeActive={anneeActive} onChangerAnnee={changerAnnee} loading={drillLoading}
          periodeTab={periodeTab} setPeriodeTab={setPeriodeTab}
          dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin}
          anneeN1={anneeN1} setAnneeN1={setAnneeN1} dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1}
          dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />

        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
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

              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '6px 0 18px' }}>
                {kpis.map((k) => <KpiCard key={k.key} label={k.label} pct={k.pct} val={k.val} pctN1={k.pctN1} spark={k.spark} />)}
              </div>

              {/* Cascade + comparatif */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16, marginBottom: 18 }}>
                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div><div style={cardTitle}>Comprendre votre performance</div><div style={cardSub}>Du chiffre d'affaires au résultat net</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                      Vue cascade
                      <div onClick={() => setWfMode((m) => (m === 'val' ? 'pct' : 'val'))} style={{ width: 34, height: 19, borderRadius: 10, background: wfMode === 'val' ? CH : GREY, position: 'relative', cursor: 'pointer', transition: 'background .2s' }}>
                        <div style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: wfMode === 'val' ? 17 : 2, transition: 'left .2s' }} />
                      </div>
                    </div>
                  </div>
                  <Waterfall sig={sig} highlight={highlight} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 4 }}>Cliquez sur une étape pour la mettre en avant</span>
                    {STEPS.map((s) => {
                      const on = highlight === s.bar
                      return (
                        <button key={s.n} onClick={() => setHighlight(on ? null : s.bar)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, border: `1px solid ${on ? CH : 'var(--border-light)'}`, background: on ? 'var(--alvio-champagne-subtle)' : 'var(--bg-card)', cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)', fontWeight: on ? 600 : 500 }}>
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: on ? CH : 'var(--bg-main)', color: on ? '#fff' : 'var(--text-muted)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.n}</span>
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div><div style={cardTitle}>Comparer avec N-1</div><div style={cardSub}>Évolution des indicateurs clés</div></div>
                    <div onClick={() => setCmpMode((m) => (m === 'val' ? 'pct' : 'val'))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 11, color: 'var(--text-primary)', cursor: 'pointer' }}>
                      {cmpMode === 'val' ? 'Valeur' : 'Variation'}<span style={{ color: 'var(--text-muted)', fontSize: 9 }}>▾</span>
                    </div>
                  </div>
                  {hasN1 ? <CompareList rows={compareRows} mode={cmpMode} /> : <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '20px 0' }}>Aucun exercice N-1 disponible pour la comparaison.</div>}
                </div>
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
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
