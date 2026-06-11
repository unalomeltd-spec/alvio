'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import AppSidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { usePeriod } from '@/hooks/usePeriod'
import { useActiveCompany } from '@/hooks/useActiveCompany'
import SanteBriefing from '@/components/SanteBriefing'
import type { HealthMetrics, AgingResult, TiersOutstanding, AgeBucket } from '@/lib/health-metrics'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtK = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return (Math.round(n / 10_000) / 100).toLocaleString('fr-FR') + ' M€'
  if (abs >= 10_000) return Math.round(n / 1000).toLocaleString('fr-FR') + ' k€'
  return fmt(n)
}

const MOIS_COURT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const PLAFOND_DELAI = 90 // au-delà : affichage « > 90 j » (choix produit, calcul intact)

// ─── Types de la réponse moteur (sous-ensemble utilisé) ─────────────
interface SigLike {
  resultatNet: number; is: number; ca: number; rcai: number
  ebe: number; tauxEbe: number
}
interface BilanLike {
  actif: { tresorerie: number; totalActif: number; creancesClients: number }
  passif: {
    capitauxPropres: number; dettesLT: number; dettesCT: number
    dettesFournisseurs: number; totalPassif: number
  }
}
interface ControlesLike {
  comptesNonReconnus: string[]; comptesNonReconnusTotal: number
}
interface Etats {
  annee: number
  sig: SigLike
  bilan: BilanLike
  controles: ControlesLike
  sante: HealthMetrics
}

// ─── Couleurs charte ────────────────────────────────────────────────
const C = {
  carbone: 'var(--text-primary)', champagne: 'var(--alvio-champagne)', argent: 'var(--text-muted)',
  vert: 'var(--success)', orange: 'var(--warning)', rouge: 'var(--danger)', rougeFonce: '#791F1F',
  fond: 'var(--bg-main)', bordure: 'var(--border-light)',
}

const BUCKET_LABEL: Record<AgeBucket, string> = {
  '0-30': '0 – 30 j', '31-60': '31 – 60 j', '61-90': '61 – 90 j', '90+': '> 90 j',
}
const BUCKET_COLOR: Record<AgeBucket, string> = {
  '0-30': C.vert, '31-60': C.orange, '61-90': '#E24B4A', '90+': C.rouge,
}

export default function SanteFinancierePage() {
  const [etats, setEtats] = useState<Etats | null>(null)
  const [loading, setLoading] = useState(true)
  const [annees, setAnnees] = useState<number[]>([])
  const [panel, setPanel] = useState<{ type: 'clients' | 'fournisseurs'; bucket: AgeBucket | 'all' } | null>(null)

  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const { activeId } = useActiveCompany()

  const periodeParams = periodeTab === 'perso' && dateDebut && dateFin ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''

  const fetchEtats = async (annee: number) => {
    const params = periodeTab === 'perso' && dateDebut && dateFin ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    const res = await fetch(`/api/etats?annee=${annee}&company_id=${activeId}${params}`)
    if (res.ok) setEtats(await res.json())
    else setEtats(null)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      if (!activeId) return
      const { data } = await sb.from('fec_exercices').select('annee').eq('company_id', activeId).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const dispo = data.map((r: any) => r.annee as number)
        setAnnees(dispo)
        const annee = dispo.includes(anneeActive) ? anneeActive : dispo[0]
        if (annee !== anneeActive) setAnneeActive(annee)
        await fetchEtats(annee)
      }
      setLoading(false)
    }
    load()
  }, [activeId])

  useEffect(() => {
    if (!activeId || !annees.length) return
    fetchEtats(anneeActive)
  }, [periodeTab, dateDebut, dateFin])

  const changerAnnee = async (annee: number) => { setAnneeActive(annee); await fetchEtats(annee) }

  const sante = etats?.sante
  const sig = etats?.sig
  const bilan = etats?.bilan

  // Exercice clos ? (aging mécaniquement « tout vieux » → on prévient)
  const exerciceClos = sante?.freshness.ok ? sante.freshness.value.coverageRatio >= 0.99 : false

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <AppSidebar activePage="sante-financiere" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid var(--bg-main)', borderTop: '2px solid var(--alvio-champagne)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', position: 'relative' }}>
      <AppSidebar activePage="sante-financiere" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="Santé financière" annees={annees} anneeActive={anneeActive} onChangerAnnee={changerAnnee}
          periodeTab={periodeTab} setPeriodeTab={setPeriodeTab}
          dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin}
          anneeN1={anneeN1} setAnneeN1={setAnneeN1}
          dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1} dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} showN1={false} />

        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {!sante || !sig || !bilan ? (
            <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center', color: C.argent, fontSize: 13 }}>
              Aucune donnée disponible pour cette période. Importez un FEC ou sélectionnez un autre exercice.
            </div>
          ) : (
            <div style={{ maxWidth: 1100 }}>

              {/* Indice de fraîcheur */}
              {sante.freshness.ok && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', border: '1px solid var(--border-light)', borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: sante.freshness.value.coverageRatio >= 0.8 ? C.vert : C.orange, flexShrink: 0 }} />
                  <div style={{ fontSize: 11, color: C.argent }}>
                    Dernière écriture : <strong style={{ color: C.carbone, fontWeight: 500 }}>{formatDateFR(sante.freshness.value.lastEntryDate)}</strong>
                    {' · '}{sante.freshness.value.monthsCovered}/{sante.freshness.value.monthsElapsed} mois couverts
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, height: 3, background: 'var(--border-light)', borderRadius: 2 }}>
                      <div style={{ width: `${Math.round(sante.freshness.value.coverageRatio * 100)}%`, height: 3, background: C.vert, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 10, color: C.argent }}>{Math.round(sante.freshness.value.coverageRatio * 100)} %</span>
                  </div>
                </div>
              )}

              {/* À rattacher */}
              {etats.controles.comptesNonReconnusTotal > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#FEF3E2', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, marginBottom: 12, fontSize: 11, color: '#633806' }}>
                  <span style={{ fontWeight: 500 }}>À rattacher : {etats.controles.comptesNonReconnusTotal} compte(s) sans poste cible</span>
                  <span style={{ color: C.argent }}>— {etats.controles.comptesNonReconnus.slice(0, 3).join(' · ')}</span>
                </div>
              )}

              {/* Couche 1 — Brief Alvio */}
              <SanteBriefing sante={sante} sig={sig} />

              {/* Couche 2 — KPI */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 12 }}>
                <KpiCard label="Cash disponible" value={sante.cash.ok ? fmtK(sante.cash.value) : '—'}
                  sub="Trésorerie nette · 50/51/53" valueColor={C.carbone}
                  fallback={!sante.cash.ok ? sante.cash.reason : undefined} />
                <KpiCard label="Résultat net" value={fmtK(sig.resultatNet)}
                  sub={`IS : ${fmt(sig.is)}`} valueColor={sig.resultatNet >= 0 ? C.vert : C.rouge} />
                <DelaiCard label="Délai clients" sens="bas" data={sante.delaiClients} />
                <DelaiCard label="Délai fournisseurs" sens="haut" data={sante.delaiFournisseurs} />
              </div>

              {/* Mention exercice clos (aging mécaniquement ancien) */}
              {exerciceClos && (
                <div style={{ fontSize: 11, color: C.argent, marginBottom: 8, fontStyle: 'italic' }}>
                  Exercice clos : l'ancienneté est calculée au 31/12, les soldes apparaissent donc « anciens ». L'aging prend tout son sens en cours d'exercice.
                </div>
              )}

              {/* Créances & dettes par ancienneté */}
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Créances & dettes — par ancienneté
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <AgingCard titre="Créances clients" compte="411" metric={sante.agingClients}
                  urgentLabel="à relancer" urgentColor={C.rouge}
                  onOpen={(b) => setPanel({ type: 'clients', bucket: b })} />
                <AgingCard titre="Dettes fournisseurs" compte="401" metric={sante.agingFournisseurs}
                  urgentLabel="en retard" urgentColor={C.orange}
                  onOpen={(b) => setPanel({ type: 'fournisseurs', bucket: b })} />
              </div>

              {/* Bas de page : structure + courbe cash */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.carbone, marginBottom: 8 }}>Structure financière</div>
                  <Ratio label="Autonomie financière" value={fmtPct(bilan.passif.capitauxPropres, bilan.passif.totalPassif)}
                    color={ratioColor(bilan.passif.capitauxPropres / (bilan.passif.totalPassif || 1), 0.5, 0.3)} />
                  <Ratio label="Capitaux propres" value={fmtK(bilan.passif.capitauxPropres)} />
                  <Ratio label="Dettes long terme" value={fmtK(bilan.passif.dettesLT)} />
                  <Ratio label="Dettes court terme" value={fmtK(bilan.passif.dettesCT)} />
                </div>
                <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: C.carbone }}>Trésorerie — par mois</span>
                  </div>
                  {sante.cashMonthly.ok
                    ? <CashChart points={sante.cashMonthly.value} />
                    : <div style={{ fontSize: 11, color: C.argent, padding: '20px 0', textAlign: 'center' }}>{sante.cashMonthly.reason}</div>}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Side panel drill-down par tiers */}
      {panel && sante && (
        <SidePanel
          type={panel.type}
          bucket={panel.bucket}
          aging={panel.type === 'clients' ? sante.agingClients : sante.agingFournisseurs}
          onBucket={(b) => setPanel({ ...panel, bucket: b })}
          onClose={() => setPanel(null)}
        />
      )}

      <style>{'@keyframes spin{to{transform:rotate(360deg)}} @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}'}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// Sous-composants
// ════════════════════════════════════════════════════════════════════

const MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
function formatDateFR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${parseInt(m[3])} ${MOIS_FR[parseInt(m[2]) - 1]} ${m[1]}`
}
function fmtPct(num: number, den: number): string {
  if (!den) return '—'
  return Math.round((num / den) * 100) + ' %'
}
function ratioColor(v: number, bon: number, moyen: number): string {
  if (v >= bon) return C.vert
  if (v >= moyen) return C.orange
  return C.rouge
}

function KpiCard({ label, value, sub, valueColor, fallback }: { label: string; value: string; sub: string; valueColor: string; fallback?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: C.argent, marginBottom: 6 }}>{label}</div>
      {fallback ? (
        <div style={{ fontSize: 12, color: C.argent, fontStyle: 'italic', lineHeight: 1.4 }}>{fallback}</div>
      ) : (
        <>
          <div style={{ fontSize: 19, fontWeight: 500, color: valueColor }}>{value}</div>
          <div style={{ fontSize: 10, color: '#B4B2A9', marginTop: 2 }}>{sub}</div>
        </>
      )}
    </div>
  )
}

function DelaiCard({ label, data, sens }: { label: string; sens: 'bas' | 'haut'; data: HealthMetrics['delaiClients'] }) {
  if (!data.ok) {
    return <KpiCard label={label} value="—" sub="" valueColor={C.argent} fallback={data.reason} />
  }
  const { jours, representatif, raisonNonRepresentatif } = data.value
  const plafonne = jours > PLAFOND_DELAI
  const affichage = plafonne ? '> 90 j' : `${jours} j`
  const couleur = !representatif ? C.argent : plafonne ? C.orange : C.carbone
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: C.argent, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 500, color: couleur }}>{affichage}</div>
      <div style={{ fontSize: 10, color: '#B4B2A9', marginTop: 2 }}>
        {representatif ? (sens === 'bas' ? '411 / CA' : '401 / achats') : (raisonNonRepresentatif || 'ratio non représentatif')}
      </div>
    </div>
  )
}

function Ratio({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '5px 0', borderBottom: '1px solid var(--border-soft)' }}>
      <span style={{ color: C.argent }}>{label}</span>
      <span style={{ fontWeight: 500, color: color || C.carbone }}>{value}</span>
    </div>
  )
}

function AgingCard({ titre, compte, metric, urgentLabel, urgentColor, onOpen }: {
  titre: string; compte: string
  metric: HealthMetrics['agingClients']
  urgentLabel: string; urgentColor: string
  onOpen: (b: AgeBucket | 'all') => void
}) {
  if (!metric.ok) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.carbone, marginBottom: 8 }}>{titre} <span style={{ fontSize: 10, color: C.argent }}>({compte})</span></div>
        <div style={{ fontSize: 11, color: C.argent, fontStyle: 'italic', padding: '12px 0' }}>{metric.reason}</div>
      </div>
    )
  }
  const a: AgingResult = metric.value
  const buckets: AgeBucket[] = ['0-30', '31-60', '61-90', '90+']
  const maxVal = Math.max(...buckets.map(b => a.byBucket[b]), 1)
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.carbone }}>{titre} <span style={{ fontSize: 10, color: C.argent }}>({compte})</span></div>
        <div style={{ fontSize: 10, color: C.argent }}>{fmt(a.total)}</div>
      </div>
      {buckets.map(b => {
        const danger = b === '61-90' || b === '90+'
        return (
          <div key={b} onClick={() => onOpen(b)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: danger && a.byBucket[b] > 0 ? 'rgba(180,35,24,0.04)' : 'transparent' }}>
            <div style={{ fontSize: 11, color: danger && a.byBucket[b] > 0 ? C.rouge : '#5F5E5A', flex: 1, fontWeight: danger && a.byBucket[b] > 0 ? 500 : 400 }}>{BUCKET_LABEL[b]}</div>
            <div style={{ width: 60, height: 3, background: 'var(--border-light)', borderRadius: 2, flexShrink: 0 }}>
              <div style={{ width: `${Math.round((a.byBucket[b] / maxVal) * 100)}%`, height: 3, background: BUCKET_COLOR[b], borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: BUCKET_COLOR[b], minWidth: 60, textAlign: 'right' }}>{a.byBucket[b] > 0 ? fmt(a.byBucket[b]) : '—'}</div>
            <Pastille n={a.countByBucket[b]} bucket={b} />
          </div>
        )
      })}
      <div style={{ marginTop: 8, paddingTop: 7, borderTop: '0.5px solid rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: urgentColor }}>
          {a.over60 > 0 ? `${fmt(a.over60)} ${urgentLabel}` : 'Rien en retard'}
        </span>
        <span onClick={() => onOpen('all')} style={{ fontSize: 10, color: C.champagne, cursor: 'pointer' }}>Tous les tiers →</span>
      </div>
    </div>
  )
}

function Pastille({ n, bucket }: { n: number; bucket: AgeBucket }) {
  if (n === 0) return <span style={{ minWidth: 24, textAlign: 'right', fontSize: 10, color: '#D3D1C7' }}>—</span>
  const danger = bucket === '61-90' || bucket === '90+'
  const bg = danger ? 'rgba(162,45,45,0.08)' : bucket === '31-60' ? 'rgba(186,117,23,0.08)' : 'rgba(29,158,117,0.08)'
  const col = danger ? C.rouge : bucket === '31-60' ? C.orange : C.vert
  return (
    <span style={{ minWidth: 24, textAlign: 'right' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, borderRadius: 8, fontSize: 9, fontWeight: 500, padding: '0 4px', background: bg, color: col }}>{n}</span>
    </span>
  )
}

function CashChart({ points }: { points: { month: string; closing: number }[] }) {
  if (points.length === 0) return null
  const vals = points.map(p => p.closing)
  const min = Math.min(...vals, 0)
  const max = Math.max(...vals, 1)
  const span = max - min || 1
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
      {points.map((p, i) => {
        const h = Math.max(2, Math.round(((p.closing - min) / span) * 58))
        const last = i === points.length - 1
        const mm = parseInt(p.month.slice(5, 7)) - 1
        return (
          <div key={p.month} title={`${p.month} : ${fmt(p.closing)}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{ height: h, width: '100%', background: last ? 'var(--alvio-champagne)' : 'var(--alvio-champagne)', opacity: last ? 1 : 0.12, borderRadius: '2px 2px 0 0' }} />
            <div style={{ fontSize: 8, color: '#B4B2A9', marginTop: 3 }}>{MOIS_COURT[mm]}</div>
          </div>
        )
      })}
    </div>
  )
}

function SidePanel({ type, bucket, aging, onBucket, onClose }: {
  type: 'clients' | 'fournisseurs'
  bucket: AgeBucket | 'all'
  aging: HealthMetrics['agingClients']
  onBucket: (b: AgeBucket | 'all') => void
  onClose: () => void
}) {
  const titre = type === 'clients' ? 'Créances clients (411)' : 'Dettes fournisseurs (401)'
  const tabs: (AgeBucket | 'all')[] = ['all', '0-30', '31-60', '61-90', '90+']
  const tabLabel = (t: AgeBucket | 'all') => t === 'all' ? 'Tous' : BUCKET_LABEL[t]

  const tiers: TiersOutstanding[] = aging.ok
    ? (bucket === 'all' ? aging.value.tiers : aging.value.tiers.filter(t => t.bucket === bucket))
    : []

  const total = aging.ok ? aging.value.total : 0
  const over60 = aging.ok ? aging.value.over60 : 0

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 360, background: 'var(--bg-card)', borderLeft: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', zIndex: 50, animation: 'slideIn 0.25s ease', boxShadow: '-8px 0 24px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.carbone, flex: 1 }}>{titre}</div>
        <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: `0.5px solid rgba(0,0,0,0.1)`, background: 'var(--bg-main)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
          {tabs.map(t => {
            const cnt = aging.ok && t !== 'all' ? aging.value.countByBucket[t] : null
            const on = bucket === t
            return (
              <button key={t} onClick={() => onBucket(t)}
                style={{ fontSize: 11, padding: '5px 11px', borderRadius: 6, border: `0.5px solid rgba(0,0,0,0.1)`, cursor: 'pointer', background: on ? C.carbone : '#F8F8F6', color: on ? '#fff' : C.argent }}>
                {tabLabel(t)}{cnt ? ` ${cnt}` : ''}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <Stat label="Total en cours" value={fmt(total)} />
          <Stat label="Dont > 60 j" value={fmt(over60)} color={over60 > 0 ? C.rouge : C.carbone} />
          <Stat label="Tiers" value={String(aging.ok ? aging.value.tiers.length : 0)} />
        </div>

        <div style={{ fontSize: 10, fontWeight: 500, color: C.argent, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '12px 0 6px' }}>Détail par tiers</div>

        {tiers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', fontSize: 12, color: '#B4B2A9' }}>Aucun tiers dans cette tranche</div>
        ) : (
          tiers.map(t => {
            const ageCol = t.bucket === '90+' || t.bucket === '61-90' ? C.rouge : t.bucket === '31-60' ? C.orange : C.vert
            const ageBg = t.bucket === '90+' || t.bucket === '61-90' ? 'rgba(162,45,45,0.08)' : t.bucket === '31-60' ? 'rgba(186,117,23,0.08)' : 'rgba(29,158,117,0.08)'
            return (
              <div key={t.tiersId} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--alvio-champagne-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: C.argent, flexShrink: 0 }}>
                  {initiales(t.tiersLabel)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.carbone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.tiersLabel}</div>
                  <div style={{ fontSize: 10, color: C.argent }}>{t.tiersId} · {t.oldestDays} j</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.carbone }}>{fmt(t.total)}</div>
                  <div style={{ marginTop: 2 }}>
                    <span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 500, background: ageBg, color: ageCol }}>{BUCKET_LABEL[t.bucket]}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, background: 'var(--bg-main)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: C.argent, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: color || C.carbone }}>{value}</div>
    </div>
  )
}

function initiales(nom: string): string {
  return nom.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}
