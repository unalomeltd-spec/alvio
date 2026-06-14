'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import AppSidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { usePeriod } from '@/hooks/usePeriod'
import { useActiveCompany } from '@/hooks/useActiveCompany'
import AlvioInsight from '@/components/AlvioInsight'
import { BarChart, Bar, XAxis, ResponsiveContainer, LineChart, Line } from 'recharts'
import type { HealthMetrics, AgingResult, TiersOutstanding, AgeBucket } from '@/lib/health-metrics'

/* ════════════════════════════════════════════════════════════════════════
   ALVIO — Page « Santé financière »
   Cohérente avec /performances : AlvioInsight en tête, cartes blanches,
   side panels (par tiers pour l'aging, par compte pour les financements via
   /api/etats/detail). Aucune notion de bilan actif/passif exposée à l'écran.

   ┌─ RÈGLES PROVISOIRES — À VALIDER AVEC VALENTIN ─────────────────────────┐
   │ • Score global /100 : moyenne pondérée de 5 dimensions (poids ci-bas). │
   │ • Seuils de chaque dimension (ok / vigilance / alerte).                │
   │ • Cash runway : trésorerie ÷ charges fixes mensuelles, où « charges    │
   │   fixes » ≈ (personnel + impôts & taxes + dotations) / 12.             │
   │ • Classement des comptes-courants d'associés (455) en financement LT.  │
   │ Tous ces points sont isolés dans SCORE_RULES / computeDimensions /     │
   │ chargesFixesMensuelles pour révision facile.                          │
   └────────────────────────────────────────────────────────────────────────┘
   ════════════════════════════════════════════════════════════════════════ */

const sb = createClient()

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtK = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return (Math.round(n / 10_000) / 100).toLocaleString('fr-FR') + ' M€'
  if (abs >= 10_000) return Math.round(n / 1000).toLocaleString('fr-FR') + ' k€'
  return fmt(n)
}
const fmtV = (n: number | null) => (n == null ? '—' : (n >= 0 ? '+' : '') + Math.round(n) + ' %')
const fmtVj = (n: number | null) => (n == null ? '—' : (n >= 0 ? '+' : '') + Math.round(n) + ' j')
const num5 = (n: string | undefined | null) => { const s = (n || '').trim(); return s.length >= 5 ? s.slice(0, 5) : s.padEnd(5, '0') }
const sentenceCase = (s: string | undefined | null) => { if (!s) return ''; const t = s.trim().toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1) }
const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const MOIS_COURT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const PLAFOND_DELAI = 90

function toIso(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d.slice(0, 10)
  if (d.length === 8) return d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8)
  return d
}
function fmtDate(d: string): string { const iso = toIso(d); return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : d }
function monthIdx(d: string): number { const iso = toIso(d); return iso.length >= 7 ? parseInt(iso.slice(5, 7)) - 1 : -1 }

const C = {
  carbone: 'var(--text-primary)', champagne: 'var(--alvio-champagne)', champagneD: '#B08D5E', argent: 'var(--text-muted)',
  sec: 'var(--text-secondary)', vert: 'var(--success)', orange: 'var(--warning)', rouge: 'var(--danger)',
  fond: 'var(--bg-main)', bordure: 'var(--border-light)', carte: 'var(--bg-card)',
}
const CH = '#C6A275', OK = '#0F8A5F', WARN = '#D97706', DANGER = '#B42318', GREY = '#D9DCE0'

const BUCKET_LABEL: Record<AgeBucket, string> = { '0-30': '0 – 30 j', '31-60': '31 – 60 j', '61-90': '61 – 90 j', '90+': '> 90 j' }
const BUCKET_COLOR: Record<AgeBucket, string> = { '0-30': OK, '31-60': WARN, '61-90': '#E24B4A', '90+': DANGER }

// ─── Types réponse moteur (sous-ensemble utilisé) ───────────────────────
interface SigLike {
  resultatNet: number; is: number; ca: number; rcai: number; rex: number
  ebe: number; tauxEbe: number; margeCommerciale: number; tauxMb: number
  chargesPersonnel: number; impotsTaxes: number; dotations: number
}
interface BilanLike {
  actif: { tresorerie: number; totalActif: number; creancesClients: number; stocksNets: number; creancesEtat: number; autresCreances: number; chargesConstatees: number }
  passif: { capitauxPropres: number; dettesLT: number; dettesCT: number; dettesFournisseurs: number; dettesSociales: number; dettesFiscales: number; autresDettes: number; totalPassif: number }
}
interface ControlesLike { comptesNonReconnus: string[]; comptesNonReconnusTotal: number }
interface Etats { annee: number; sig: SigLike; bilan: BilanLike; controles: ControlesLike; sante: HealthMetrics }

// Compte renvoyé par /api/etats/detail
interface CompteDetail {
  num: string; lib: string; solde: number; debit: number; credit: number; nbEcritures: number
  ecritures: { date: string; lib: string; piece: string; debit: number; credit: number; journal: string }[]
}
// Poste de financement pour le side panel (réutilise l'habillage de Performances)
interface FinancePoste {
  label: string; total: number; varPct: number | null; loading: boolean
  monthly: { m: string; n: number; n1: number }[]
  comptes: { num: string; lib: string; val: number; varPct: number | null }[]
  comptesEcritures: Record<string, { date: string; lib: string; montant: number }[]>
  ecritures: { date: string; lib: string; montant: number }[]
  annual: { y: string; v: number }[]
}

interface Derived {
  bfr: number; runway: number | null; dso: number | null; dpo: number | null
  cashVar: number | null; dsoVar: number | null; dpoVar: number | null
  empruntsTotal: number; ccaTotal: number; dettesFin: number; endettementNet: number
  capaciteRemb: number | null; independance: number | null; margeNette: number | null
  over60Clients: number; totalCreances: number; over60Share: number | null
  fpPart: number; extPart: number; score: number; dims: Dimension[]
}

// ════════════════════════════════════════════════════════════════════════
//  RÈGLES PROVISOIRES (à valider Valentin)
// ════════════════════════════════════════════════════════════════════════

// BFR = (stocks + créances d'exploitation) − dettes d'exploitation. Tout est
// exposé par le moteur ; calcul exact (pas une approximation).
function computeBFR(b: BilanLike): number {
  const emplois = b.actif.stocksNets + b.actif.creancesClients + b.actif.creancesEtat + b.actif.autresCreances + b.actif.chargesConstatees
  const ressources = b.passif.dettesFournisseurs + b.passif.dettesSociales + b.passif.dettesFiscales + b.passif.autresDettes
  return Math.round(emplois - ressources)
}

// PROVISOIRE — « charges fixes » mensuelles pour le cash runway.
function chargesFixesMensuelles(sig: SigLike): number {
  return Math.max(1, (sig.chargesPersonnel + sig.impotsTaxes + sig.dotations) / 12)
}

type DimState = 'ok' | 'warn' | 'danger'
interface Dimension { key: string; label: string; icon: string; state: DimState; score: number }

// PROVISOIRE — pondération du score global (somme = 100).
const SCORE_RULES = { tresorerie: 25, encaissements: 20, fournisseurs: 15, endettement: 20, rentabilite: 20 }

function stateColor(s: DimState) { return s === 'ok' ? OK : s === 'warn' ? WARN : DANGER }
function stateIcon(s: DimState) { return s === 'ok' ? 'ti-check' : s === 'warn' ? 'ti-alert-triangle' : 'ti-x' }
function band(score: number) {
  if (score >= 70) return { label: 'Bonne', color: OK }
  if (score >= 50) return { label: 'Correcte', color: WARN }
  return { label: 'Fragile', color: DANGER }
}

// PROVISOIRE — seuils de chaque dimension + score global pondéré.
function computeDimensions(args: {
  runwayMonths: number | null; over60Share: number | null; dso: number | null
  dpo: number | null; independance: number | null; margeNette: number | null
}): { dims: Dimension[]; score: number } {
  const { runwayMonths, over60Share, dpo, independance, margeNette } = args
  const dims: Dimension[] = []

  // 1. Trésorerie (cash runway)
  let s1: DimState = 'warn', n1 = 55
  if (runwayMonths != null) {
    if (runwayMonths >= 3) { s1 = 'ok'; n1 = 90 }
    else if (runwayMonths >= 1) { s1 = 'warn'; n1 = 60 }
    else { s1 = 'danger'; n1 = 25 }
  }
  dims.push({ key: 'tresorerie', label: 'Trésorerie', icon: 'ti-wallet', state: s1, score: n1 })

  // 2. Encaissements clients (part > 60 j)
  let s2: DimState = 'ok', n2 = 85
  if (over60Share != null) {
    if (over60Share <= 0.05) { s2 = 'ok'; n2 = 88 }
    else if (over60Share <= 0.15) { s2 = 'warn'; n2 = 58 }
    else { s2 = 'danger'; n2 = 30 }
  }
  dims.push({ key: 'encaissements', label: 'Encaissements clients', icon: 'ti-receipt', state: s2, score: n2 })

  // 3. Délais fournisseurs (DPO) — payer ni trop vite ni en retard structurel
  let s3: DimState = 'ok', n3 = 85
  if (dpo != null) {
    if (dpo >= 20 && dpo <= 60) { s3 = 'ok'; n3 = 85 }
    else if (dpo < 20) { s3 = 'warn'; n3 = 60 }
    else { s3 = 'warn'; n3 = 55 }
  }
  dims.push({ key: 'fournisseurs', label: 'Délais fournisseurs', icon: 'ti-building-bank', state: s3, score: n3 })

  // 4. Endettement (indépendance financière)
  let s4: DimState = 'warn', n4 = 55
  if (independance != null) {
    if (independance >= 0.5) { s4 = 'ok'; n4 = 88 }
    else if (independance >= 0.3) { s4 = 'warn'; n4 = 55 }
    else { s4 = 'danger'; n4 = 28 }
  }
  dims.push({ key: 'endettement', label: 'Endettement', icon: 'ti-scale', state: s4, score: n4 })

  // 5. Rentabilité (marge nette)
  let s5: DimState = 'ok', n5 = 80
  if (margeNette != null) {
    if (margeNette > 0.03) { s5 = 'ok'; n5 = 88 }
    else if (margeNette >= 0) { s5 = 'warn'; n5 = 55 }
    else { s5 = 'danger'; n5 = 22 }
  }
  dims.push({ key: 'rentabilite', label: 'Rentabilité', icon: 'ti-trending-down', state: s5, score: n5 })

  const w = SCORE_RULES
  const score = Math.round(
    (n1 * w.tresorerie + n2 * w.encaissements + n3 * w.fournisseurs + n4 * w.endettement + n5 * w.rentabilite) / 100
  )
  return { dims, score }
}

// ════════════════════════════════════════════════════════════════════════
//  PAGE
// ════════════════════════════════════════════════════════════════════════

export default function SanteFinancierePage() {
  const [etats, setEtats] = useState<Etats | null>(null)
  const [etatsN1, setEtatsN1] = useState<Etats | null>(null)
  const [loading, setLoading] = useState(true)
  const [annees, setAnnees] = useState<number[]>([])
  const [panel, setPanel] = useState<{ type: 'clients' | 'fournisseurs'; bucket: AgeBucket | 'all' } | null>(null)
  const [finance, setFinance] = useState<FinancePoste | null>(null)
  const [endette, setEndette] = useState<{ emprunts: number; cca: number } | null>(null)

  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const { activeId } = useActiveCompany()

  const [switching, setSwitching] = useState(false)
  const firstLoadRef = useRef(true)
  useEffect(() => { if (firstLoadRef.current) { firstLoadRef.current = false; return } setSwitching(true) }, [activeId, anneeActive, periodeTab, dateDebut, dateFin])
  useEffect(() => { setSwitching(false) }, [etats])

  const periodeParams = periodeTab === 'perso' && dateDebut && dateFin ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''

  const fetchEtats = async (annee: number) => {
    const res = await fetch(`/api/etats?annee=${annee}&company_id=${activeId}${periodeParams}`)
    setEtats(res.ok ? await res.json() : null)
    // N-1 (best effort, sans période perso)
    try {
      const r1 = await fetch(`/api/etats?annee=${annee - 1}&company_id=${activeId}`)
      setEtatsN1(r1.ok ? await r1.json() : null)
    } catch { setEtatsN1(null) }
    // Encours financements (emprunts 16x + comptes-courants 455)
    try {
      const rd = await fetch(`/api/etats/detail?annee=${annee}&company_id=${activeId}&prefixes=16,455`)
      if (rd.ok) {
        const j = await rd.json()
        let emprunts = 0, cca = 0
        for (const c of (j.comptes || []) as CompteDetail[]) {
          const v = Math.abs(c.solde)
          if (c.num.startsWith('455')) cca += v
          else if (c.num.startsWith('16')) emprunts += v
        }
        setEndette({ emprunts: Math.round(emprunts), cca: Math.round(cca) })
      } else setEndette(null)
    } catch { setEndette(null) }
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

  useEffect(() => { if (!activeId || !annees.length) return; fetchEtats(anneeActive) }, [periodeTab, dateDebut, dateFin])

  const changerAnnee = async (annee: number) => { setAnneeActive(annee); setPanel(null); setFinance(null); await fetchEtats(annee) }

  // ─── Détail financement (side panel par compte, via /api/etats/detail) ──
  const fetchDetail = async (annee: number, prefixes: string[]): Promise<CompteDetail[]> => {
    const r = await fetch(`/api/etats/detail?annee=${annee}&company_id=${activeId}&prefixes=${prefixes.join(',')}`)
    if (!r.ok) return []
    const j = await r.json()
    return (j.comptes || []) as CompteDetail[]
  }

  const handleDrillFinance = useCallback(async (label: string, prefixes: string[]) => {
    setFinance({ label, total: 0, varPct: null, loading: true, monthly: [], comptes: [], comptesEcritures: {}, ecritures: [], annual: [] })
    const comptesN = await fetchDetail(anneeActive, prefixes)
    const comptesN1 = annees.includes(anneeActive - 1) ? await fetchDetail(anneeActive - 1, prefixes) : []
    const n1ByNum: Record<string, number> = {}
    comptesN1.forEach((c) => { n1ByNum[c.num] = Math.abs(c.solde) })

    const comptes = comptesN.map((c) => {
      const v = Math.abs(c.solde)
      const prev = n1ByNum[c.num]
      const varPct = prev != null && prev > 0.5 ? ((v - prev) / prev) * 100 : null
      return { num: c.num, lib: c.lib, val: v, varPct }
    }).sort((a, b) => a.num.localeCompare(b.num))

    const total = comptes.reduce((s, c) => s + c.val, 0)
    const totalN1 = Object.values(n1ByNum).reduce((s, v) => s + v, 0)
    const varPct = totalN1 > 0.5 ? ((total - totalN1) / totalN1) * 100 : null

    // Écritures (toutes + par compte) et mouvement net mensuel
    const comptesEcritures: Record<string, { date: string; lib: string; montant: number }[]> = {}
    const allEcr: { date: string; lib: string; montant: number }[] = []
    const moisN = new Array(12).fill(0)
    for (const c of comptesN) {
      const list = c.ecritures.map((e) => ({ date: e.date, lib: e.lib, montant: (e.credit - e.debit) }))
      comptesEcritures[c.num] = list
      for (const e of c.ecritures) {
        allEcr.push({ date: e.date, lib: e.lib, montant: e.credit - e.debit })
        const mi = monthIdx(e.date)
        if (mi >= 0) moisN[mi] += Math.abs(e.credit - e.debit)
      }
    }
    allEcr.sort((a, b) => toIso(a.date).localeCompare(toIso(b.date)))
    const monthly = MOIS.map((m, i) => ({ m, n: Math.round(moisN[i]), n1: 0 }))

    // Évolution annuelle (capital restant dû par exercice dispo)
    const annual: { y: string; v: number }[] = []
    const yearsAsc = [...annees].sort((a, b) => a - b)
    for (const y of yearsAsc) {
      let cs: CompteDetail[]
      if (y === anneeActive) cs = comptesN
      else if (y === anneeActive - 1) cs = comptesN1
      else cs = await fetchDetail(y, prefixes)
      annual.push({ y: String(y), v: Math.round(cs.reduce((s, c) => s + Math.abs(c.solde), 0)) })
    }

    setFinance({ label, total: Math.round(total), varPct, loading: false, monthly, comptes, comptesEcritures, ecritures: allEcr, annual })
  }, [anneeActive, annees, activeId])

  const sante = etats?.sante
  const sig = etats?.sig
  const bilan = etats?.bilan

  if (loading) return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <AppSidebar activePage="sante-financiere" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, border: '2px solid var(--bg-main)', borderTop: '2px solid var(--alvio-champagne)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  // ─── Indicateurs dérivés (si données présentes) ────────────────────────
  let derived: Derived | null = null

  if (sante && sig && bilan) {
    const cash = sante.cash.ok ? sante.cash.value : 0
    const bfr = computeBFR(bilan)
    const runway = cash > 0 ? Math.round((cash / chargesFixesMensuelles(sig)) * 10) / 10 : null
    const dso = sante.delaiClients.ok ? sante.delaiClients.value.jours : null
    const dpo = sante.delaiFournisseurs.ok ? sante.delaiFournisseurs.value.jours : null

    const sN1 = etatsN1?.sante
    const cashN1 = sN1 && sN1.cash.ok ? sN1.cash.value : null
    const dsoN1 = sN1 && sN1.delaiClients.ok ? sN1.delaiClients.value.jours : null
    const dpoN1 = sN1 && sN1.delaiFournisseurs.ok ? sN1.delaiFournisseurs.value.jours : null
    const cashVar = cashN1 && cashN1 !== 0 ? ((cash - cashN1) / Math.abs(cashN1)) * 100 : null
    const dsoVar = dso != null && dsoN1 != null ? dso - dsoN1 : null
    const dpoVar = dpo != null && dpoN1 != null ? dpo - dpoN1 : null

    const empruntsTotal = endette?.emprunts ?? 0
    const ccaTotal = endette?.cca ?? 0
    const dettesFin = empruntsTotal + ccaTotal
    const endettementNet = dettesFin - cash
    const capaciteRemb = sig.ebe > 0 ? Math.round((endettementNet / sig.ebe) * 10) / 10 : null
    const independance = (bilan.passif.capitauxPropres + dettesFin) > 0 ? bilan.passif.capitauxPropres / (bilan.passif.capitauxPropres + dettesFin) : null
    const margeNette = sig.ca > 0 ? sig.resultatNet / sig.ca : null

    const totalCreances = sante.agingClients.ok ? sante.agingClients.value.total : 0
    const over60Clients = sante.agingClients.ok ? sante.agingClients.value.over60 : 0
    const over60Share = totalCreances > 0 ? over60Clients / totalCreances : null

    const fpPart = (bilan.passif.capitauxPropres + dettesFin) > 0 ? Math.round((bilan.passif.capitauxPropres / (bilan.passif.capitauxPropres + dettesFin)) * 100) : 0
    const { dims, score } = computeDimensions({ runwayMonths: runway, over60Share, dso, dpo, independance, margeNette })

    derived = { bfr, runway, dso, dpo, cashVar, dsoVar, dpoVar, empruntsTotal, ccaTotal, dettesFin, endettementNet, capaciteRemb, independance, margeNette, over60Clients, totalCreances, over60Share, fpPart, extPart: 100 - fpPart, score, dims }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', position: 'relative' }}>
      <AppSidebar activePage="sante-financiere" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar title="Santé financière" annees={annees} anneeActive={anneeActive} onChangerAnnee={changerAnnee} loading={switching}
          periodeTab={periodeTab} setPeriodeTab={setPeriodeTab}
          dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin}
          anneeN1={anneeN1} setAnneeN1={setAnneeN1}
          dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1} dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} showN1={false} />

        <div style={{ flex: 1, padding: 24, overflowY: 'auto', opacity: switching ? 0.45 : 1, transition: 'opacity .18s ease', pointerEvents: switching ? 'none' : undefined }}>
          {!sante || !sig || !bilan || !derived ? (
            <EmptyState />
          ) : (
            <div style={{ maxWidth: 1100 }}>

              {/* À rattacher */}
              {etats!.controles.comptesNonReconnusTotal > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: '#FEF3E2', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 8, marginBottom: 12, fontSize: 11, color: '#633806' }}>
                  <span style={{ fontWeight: 500 }}>À rattacher : {etats!.controles.comptesNonReconnusTotal} compte(s) sans poste cible</span>
                  <span style={{ color: C.argent }}>— {etats!.controles.comptesNonReconnus.slice(0, 3).join(' · ')}</span>
                </div>
              )}

              {/* AlvioInsight — identique à Performances */}
              <AlvioInsight payload={{ page: 'sante' as any, annee: anneeActive, indicateurs: {
                cash: sante.cash.ok ? sante.cash.value : 0, bfr: derived.bfr, dso: derived.dso ?? 0, dpo: derived.dpo ?? 0,
                rnet: sig.resultatNet, ebe: sig.ebe, endettementNet: derived.endettementNet,
                capaciteRemb: derived.capaciteRemb ?? 0, independance: Math.round((derived.independance ?? 0) * 100),
                over60Clients: derived.over60Clients,
              } }} />

              {/* KPI */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 12 }}>
                <KpiCard label="Cash disponible" value={sante.cash.ok ? fmtK(sante.cash.value) : '—'} sub="Trésorerie nette · 50/51/53" subColor={derived.cashVar != null ? (derived.cashVar >= 0 ? OK : DANGER) : undefined} subText={derived.cashVar != null ? `${fmtV(derived.cashVar)} vs N-1` : undefined} />
                <KpiCard label="Besoin en fonds de roulement" value={fmtK(derived.bfr)} sub="stocks + créances − dettes CT" />
                <DelaiCard label="Délai clients" data={sante.delaiClients} sens="bas" deltaJ={derived.dsoVar} />
                <DelaiCard label="Délai fournisseurs" data={sante.delaiFournisseurs} sens="haut" deltaJ={derived.dpoVar} />
              </div>

              {/* Santé globale + Cash runway */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <ScoreCard score={derived.score} dims={derived.dims} />
                <RunwayCard runway={derived.runway} cash={sante.cash.ok ? sante.cash.value : 0} />
              </div>

              {/* Comment circule votre argent */}
              <Circulation dso={derived.dso} dpo={derived.dpo} cash={sante.cash.ok ? sante.cash.value : 0}
                cashVar={derived.cashVar} dsoVar={derived.dsoVar} dpoVar={derived.dpoVar} />

              {/* Aging créances / dettes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12, marginBottom: 12 }}>
                <AgingCard titre="Créances clients" compte="411" metric={sante.agingClients} urgentLabel="à relancer" urgentColor={DANGER} onOpen={(b) => setPanel({ type: 'clients', bucket: b })} />
                <AgingCard titre="Dettes fournisseurs" compte="401" metric={sante.agingFournisseurs} urgentLabel="en retard" urgentColor={WARN} onOpen={(b) => setPanel({ type: 'fournisseurs', bucket: b })} />
              </div>

              {/* Endettement & financement */}
              <Endettement d={derived} cp={bilan.passif.capitauxPropres} onDrill={handleDrillFinance} />

              {/* Trésorerie par mois (courbe) */}
              <div style={{ background: C.carte, border: `1px solid ${C.bordure}`, borderRadius: 14, padding: '16px 18px', marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.carbone }}>Trésorerie — par mois</span>
                  <span style={{ fontSize: 10, color: C.argent }}>solde de clôture</span>
                </div>
                {sante.cashMonthly.ok
                  ? <TresorerieCourbe points={sante.cashMonthly.value} />
                  : <div style={{ fontSize: 11, color: C.argent, padding: '20px 0', textAlign: 'center' }}>{sante.cashMonthly.reason}</div>}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Side panels */}
      {panel && sante && (
        <TiersPanel type={panel.type} bucket={panel.bucket}
          aging={panel.type === 'clients' ? sante.agingClients : sante.agingFournisseurs}
          onBucket={(b) => setPanel({ ...panel, bucket: b })} onClose={() => setPanel(null)} />
      )}
      {finance && <FinancePanel poste={finance} onClose={() => setFinance(null)} />}

      <style>{'@keyframes spin{to{transform:rotate(360deg)}} @keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}} @keyframes slideInTiers{from{transform:translateX(100%)}to{transform:translateX(0)}}'}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
//  SOUS-COMPOSANTS
// ════════════════════════════════════════════════════════════════════════

function EmptyState() {
  return (
    <div style={{ maxWidth: 420, margin: '80px auto', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(198,162,117,0.08)', border: '1px solid rgba(198,162,117,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <i className="ti ti-chart-area-line" style={{ fontSize: 30, color: CH }} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#242628', marginBottom: 8, letterSpacing: '-0.02em' }}>Aucune donnée disponible</div>
      <div style={{ fontSize: 13, color: '#6E7378', marginBottom: 28, lineHeight: 1.7 }}>Importez un FEC ou connectez Pennylane pour accéder à l'analyse de santé financière.</div>
      <a href="/entreprise" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#C6A275', color: '#fff', borderRadius: 10, padding: '11px 24px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Accéder aux paramétrages</a>
    </div>
  )
}

function KpiCard({ label, value, sub, subText, subColor }: { label: string; value: string; sub: string; subText?: string; subColor?: string }) {
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: C.carte, border: `1px solid ${h ? CH : C.bordure}`, borderRadius: 14, padding: '14px 16px', transition: 'border-color .18s' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.sec, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 23, fontWeight: 700, color: C.carbone, marginTop: 8, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 10, color: subColor || C.argent, marginTop: 2 }}>{subText || sub}</div>
    </div>
  )
}

function DelaiCard({ label, data, sens, deltaJ }: { label: string; sens: 'bas' | 'haut'; data: HealthMetrics['delaiClients']; deltaJ: number | null }) {
  const [h, setH] = useState(false)
  if (!data.ok) return <KpiCard label={label} value="—" sub={data.reason} />
  const { jours, representatif, raisonNonRepresentatif } = data.value
  const plafonne = jours > PLAFOND_DELAI
  const affichage = plafonne ? '> 90 j' : `${jours} j`
  const couleur = !representatif ? C.argent : C.carbone
  // pour clients (sens bas) hausse = défavorable ; fournisseurs (sens haut) hausse = favorable
  const deltaColor = deltaJ == null ? C.argent : sens === 'bas' ? (deltaJ <= 0 ? OK : WARN) : (deltaJ >= 0 ? OK : WARN)
  const base = sens === 'bas' ? 'DSO' : 'DPO'
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ background: C.carte, border: `1px solid ${h ? CH : C.bordure}`, borderRadius: 14, padding: '14px 16px', transition: 'border-color .18s' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.sec, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 23, fontWeight: 700, color: couleur, marginTop: 8 }}>{affichage}</div>
      <div style={{ fontSize: 10, color: deltaJ != null && representatif ? deltaColor : C.argent, marginTop: 2 }}>
        {representatif ? (deltaJ != null ? `${fmtVj(deltaJ)} vs N-1 · ${base}` : base) : (raisonNonRepresentatif || 'non représentatif')}
      </div>
    </div>
  )
}

function HelpDot({ text }: { text: string }) {
  const [h, setH] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 6 }} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}>
      <i className="ti ti-help-circle" style={{ fontSize: 14, color: C.argent, cursor: 'help' }} />
      {h && <span style={{ position: 'absolute', top: 20, left: 0, width: 228, background: '#1A1A1A', color: '#fff', fontSize: 11, lineHeight: 1.5, padding: '9px 11px', borderRadius: 8, zIndex: 30 }}>{text}</span>}
    </span>
  )
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: bg, color, marginLeft: 'auto' }}>{label}</span>
}

function ScoreCard({ score, dims }: { score: number; dims: Dimension[] }) {
  const b = band(score)
  const dash = Math.round((score / 100) * 264)
  return (
    <div style={{ background: C.carte, border: `1px solid ${C.bordure}`, borderRadius: 14, padding: '16px 18px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.carbone }}>Votre santé financière</span>
        <HelpDot text="Score = moyenne pondérée de 5 dimensions (trésorerie, encaissements, délais fournisseurs, endettement, rentabilité), chacune notée selon des seuils. Pondération provisoire, à valider." />
        <Badge label={b.label} color={b.color} bg={b.color === OK ? '#E1F5EE' : b.color === WARN ? '#FAEEDA' : '#FCEBEB'} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
          <svg viewBox="0 0 100 100" style={{ width: 92, height: 92, transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="#EFEFED" strokeWidth="9" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={b.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${dash} 264`} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 23, fontWeight: 700 }}>{score}</span>
            <span style={{ fontSize: 9, color: C.argent }}>/ 100</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {dims.map((d) => (
            <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0' }}>
              <i className={`ti ${d.icon}`} style={{ fontSize: 15, color: C.sec }} />
              <span style={{ fontSize: 12, flex: 1, color: C.carbone }}>{d.label}</span>
              <i className={`ti ${stateIcon(d.state)}`} style={{ color: stateColor(d.state) }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RunwayCard({ runway, cash }: { runway: number | null; cash: number }) {
  const months = runway ?? 0
  const filled = Math.max(0, Math.min(6, months))
  const st = months >= 3 ? { l: 'Excellent', c: OK, bg: '#E1F5EE' } : months >= 1 ? { l: 'Correct', c: WARN, bg: '#FAEEDA' } : { l: 'Attention', c: DANGER, bg: '#FCEBEB' }
  const blocks = []
  for (let i = 0; i < 6; i++) blocks.push(i < Math.floor(filled) ? st.c : (i < filled ? st.c : '#EFEFED'))
  return (
    <div style={{ background: C.carte, border: `1px solid ${C.bordure}`, borderRadius: 14, padding: '16px 18px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.carbone }}>Combien de temps pouvez-vous tenir ?</span>
        <HelpDot text="Trésorerie disponible ÷ charges fixes mensuelles moyennes (personnel + impôts & taxes + dotations, sur 12 mois). Formule provisoire, à valider." />
        <Badge label={st.l} color={st.c} bg={st.bg} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 23, fontWeight: 700 }}>{runway != null ? runway.toLocaleString('fr-FR') : '—'}</span>
        <span style={{ fontSize: 13, color: C.sec }}>mois de charges fixes</span>
      </div>
      <div style={{ fontSize: 10, color: C.argent, marginTop: 2, marginBottom: 12 }}>avec la trésorerie disponible · {fmt(cash)}</div>
      <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
        {blocks.map((c, i) => <span key={i} style={{ flex: 1, height: 14, borderRadius: 3, background: c }} />)}
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: C.sec }}>
        <span><span style={{ color: OK, fontWeight: 600 }}>●</span> Excellent &gt; 3 mois</span>
        <span><span style={{ color: WARN, fontWeight: 600 }}>●</span> Correct 1–3</span>
        <span><span style={{ color: DANGER, fontWeight: 600 }}>●</span> Attention &lt; 1</span>
      </div>
    </div>
  )
}

function Circulation({ dso, dpo, cash, cashVar, dsoVar, dpoVar }: { dso: number | null; dpo: number | null; cash: number; cashVar: number | null; dsoVar: number | null; dpoVar: number | null }) {
  const cycle = dso != null && dpo != null ? dso - dpo : null
  const favorable = cycle != null && cycle <= 0
  return (
    <div style={{ background: C.carte, border: `1px solid ${C.bordure}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.carbone }}>Comment circule votre argent ?</span>
        {cycle != null && <Badge label={favorable ? 'Favorable' : 'À surveiller'} color={favorable ? OK : WARN} bg={favorable ? '#E1F5EE' : '#FAEEDA'} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FluxBox icon="ti-users" label="Vos clients paient en" value={dso != null ? `${dso} j` : '—'} sub={dsoVar != null ? `${fmtVj(dsoVar)} vs N-1` : ''} subColor={dsoVar != null ? (dsoVar <= 0 ? OK : WARN) : C.argent} />
        <i className="ti ti-arrow-right" style={{ color: C.argent }} />
        <FluxBox accent icon="ti-building-bank" label="Compte bancaire" value={fmt(cash)} sub={cashVar != null ? `${fmtV(cashVar)} vs N-1` : ''} subColor={cashVar != null ? (cashVar >= 0 ? OK : DANGER) : C.argent} />
        <i className="ti ti-arrow-right" style={{ color: C.argent }} />
        <FluxBox icon="ti-truck-delivery" label="Vous réglez en" value={dpo != null ? `${dpo} j` : '—'} sub={dpoVar != null ? `${fmtVj(dpoVar)} vs N-1` : ''} subColor={dpoVar != null ? (dpoVar >= 0 ? OK : WARN) : C.argent} />
      </div>
      {cycle != null && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '9px 12px', background: favorable ? '#E1F5EE' : '#FAEEDA', borderRadius: 8 }}>
          <i className={`ti ${favorable ? 'ti-circle-check' : 'ti-alert-triangle'}`} style={{ color: favorable ? OK : WARN, fontSize: 15 }} />
          <span style={{ fontSize: 12, color: favorable ? '#0F6E56' : '#7a5a14' }}>
            {favorable
              ? <>Vous êtes payé <strong style={{ fontWeight: 600 }}>{Math.abs(cycle)} jours avant</strong> de régler vos fournisseurs — votre cycle soutient la trésorerie.</>
              : <>Vous réglez vos fournisseurs <strong style={{ fontWeight: 600 }}>{cycle} jours avant</strong> d'être payé — votre cycle pèse sur la trésorerie.</>}
          </span>
        </div>
      )}
    </div>
  )
}

function FluxBox({ icon, label, value, sub, subColor, accent }: { icon: string; label: string; value: string; sub: string; subColor: string; accent?: boolean }) {
  return (
    <div style={{ flex: accent ? 1.1 : 1, border: `1px solid ${accent ? '#EADCC4' : C.bordure}`, background: accent ? '#FAF3E8' : 'transparent', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
        <i className={`ti ${icon}`} style={{ fontSize: 16, color: accent ? C.champagneD : C.sec }} />
        <span style={{ fontSize: 11, color: accent ? C.champagneD : C.sec }}>{label}</span>
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, color: accent ? C.champagneD : C.carbone }}>{value}</div>
      <div style={{ fontSize: 10, color: subColor, marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function AgingCard({ titre, compte, metric, urgentLabel, urgentColor, onOpen }: {
  titre: string; compte: string; metric: HealthMetrics['agingClients']; urgentLabel: string; urgentColor: string; onOpen: (b: AgeBucket | 'all') => void
}) {
  if (!metric.ok) return (
    <div style={{ background: C.carte, border: `1px solid ${C.bordure}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.carbone, marginBottom: 8 }}>{titre} <span style={{ fontSize: 10, color: C.argent }}>({compte})</span></div>
      <div style={{ fontSize: 11, color: C.argent, fontStyle: 'italic', padding: '12px 0' }}>{metric.reason}</div>
    </div>
  )
  const a: AgingResult = metric.value
  const buckets: AgeBucket[] = ['0-30', '31-60', '61-90', '90+']
  const maxVal = Math.max(...buckets.map((b) => a.byBucket[b]), 1)
  return (
    <div style={{ background: C.carte, border: `1px solid ${C.bordure}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.carbone }}>{titre} <span style={{ fontSize: 10, color: C.argent }}>({compte})</span></div>
        <div style={{ fontSize: 11, color: C.sec }}>{fmt(a.total)}</div>
      </div>
      <div style={{ fontSize: 10, color: C.argent, marginBottom: 10 }}>Cliquez une ligne pour le détail par tiers →</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {buckets.map((b) => {
          const danger = b === '61-90' || b === '90+'
          return (
            <div key={b} onClick={() => onOpen(b)} className="aging-row"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', transition: 'background .12s', background: danger && a.byBucket[b] > 0 ? 'rgba(180,35,24,0.04)' : 'transparent' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FAF3E8' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = danger && a.byBucket[b] > 0 ? 'rgba(180,35,24,0.04)' : 'transparent' }}>
              <span style={{ fontSize: 11, color: danger && a.byBucket[b] > 0 ? DANGER : C.sec, width: 54, fontWeight: danger && a.byBucket[b] > 0 ? 500 : 400 }}>{BUCKET_LABEL[b]}</span>
              <span style={{ flex: 1, height: 3, background: C.bordure, borderRadius: 2 }}>
                <span style={{ display: 'block', width: `${Math.round((a.byBucket[b] / maxVal) * 100)}%`, height: 3, background: BUCKET_COLOR[b], borderRadius: 2 }} />
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: BUCKET_COLOR[b], width: 62, textAlign: 'right' }}>{a.byBucket[b] > 0 ? fmt(a.byBucket[b]) : '—'}</span>
              <Pastille n={a.countByBucket[b]} bucket={b} />
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid #f2f2f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: urgentColor }}>{a.over60 > 0 ? `${fmt(a.over60)} ${urgentLabel}` : 'Rien en retard'}</span>
        <span onClick={() => onOpen('all')} style={{ fontSize: 10, color: CH, cursor: 'pointer' }}>Tous les tiers →</span>
      </div>
    </div>
  )
}

function Pastille({ n, bucket }: { n: number; bucket: AgeBucket }) {
  if (n === 0) return <span style={{ minWidth: 24, textAlign: 'right', fontSize: 10, color: '#D3D1C7' }}>—</span>
  const danger = bucket === '61-90' || bucket === '90+'
  const bg = danger ? '#FCEBEB' : bucket === '31-60' ? '#FAEEDA' : '#E1F5EE'
  const col = danger ? DANGER : bucket === '31-60' ? WARN : OK
  return (
    <span style={{ minWidth: 24, textAlign: 'right' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, borderRadius: 8, fontSize: 9, fontWeight: 600, padding: '0 4px', background: bg, color: col }}>{n}</span>
    </span>
  )
}

function Endettement({ d, cp, onDrill }: { d: Derived; cp: number; onDrill: (label: string, prefixes: string[]) => void }) {
  const capaciteOk = d.capaciteRemb != null && d.capaciteRemb <= 4 && d.capaciteRemb >= 0
  const indepPct = Math.round((d.independance ?? 0) * 100)
  return (
    <div style={{ background: C.carte, border: `1px solid ${C.bordure}`, borderRadius: 14, padding: '16px 18px', marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.carbone }}>Endettement &amp; financement</span>
        <Badge label={capaciteOk && indepPct >= 30 ? 'Maîtrisé' : 'À surveiller'} color={capaciteOk && indepPct >= 30 ? OK : WARN} bg={capaciteOk && indepPct >= 30 ? '#E1F5EE' : '#FAEEDA'} />
      </div>
      <div style={{ fontSize: 11, color: C.argent, marginBottom: 14 }}>Ce que l'entreprise doit et sa capacité à le porter</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        <Metric label="Capital restant dû" value={fmtK(d.empruntsTotal)} sub="emprunts bancaires" />
        <Metric label="Endettement net" value={fmtK(d.endettementNet)} sub="dettes fin. − trésorerie" />
        <Metric label="Capacité de remb." value={d.capaciteRemb != null ? `${d.capaciteRemb.toLocaleString('fr-FR')} an${Math.abs(d.capaciteRemb) >= 2 ? 's' : ''}` : '—'} sub="dette nette / EBE" color={capaciteOk ? OK : WARN} help="Dette nette ÷ EBE : nombre d'années de résultat d'exploitation pour rembourser. Sous 3-4 ans = sain." />
        <Metric label="Indépendance fin." value={`${indepPct} %`} sub="part de fonds propres" color={indepPct >= 50 ? OK : indepPct >= 30 ? WARN : DANGER} />
      </div>

      <div style={{ fontSize: 11, color: C.sec, marginBottom: 7 }}>Comment l'entreprise est financée</div>
      <div style={{ display: 'flex', height: 26, borderRadius: 7, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ width: `${d.fpPart}%`, background: CH, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600 }}>{d.fpPart > 8 ? `${d.fpPart} %` : ''}</div>
        <div style={{ width: `${d.extPart}%`, background: '#8C9BAB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 600 }}>{d.extPart > 8 ? `${d.extPart} %` : ''}</div>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 10, color: C.sec, marginBottom: 16 }}>
        <span><span style={{ color: CH }}>■</span> Fonds propres {fmtK(cp)}</span>
        <span><span style={{ color: '#8C9BAB' }}>■</span> Financements extérieurs {fmtK(d.dettesFin)}</span>
      </div>

      <div style={{ borderTop: '1px solid #f2f2f0', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.sec }}>Financements long terme</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: C.argent }}>Cliquez pour le détail →</span>
        </div>
        <FinanceLine icon="ti-building-bank" label="Emprunts bancaires" sub="établissements de crédit · 16x" value={d.empruntsTotal} onClick={() => onDrill('Emprunts bancaires', ['16'])} />
        <FinanceLine icon="ti-users-group" label="Comptes-courants d'associés" sub="associés · 455" value={d.ccaTotal} onClick={() => onDrill("Comptes-courants d'associés", ['455'])} />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, padding: '8px 11px', background: '#FEF8EE', border: '1px solid #F1E2C9', borderRadius: 8 }}>
          <i className="ti ti-info-circle" style={{ color: WARN, fontSize: 14 }} />
          <span style={{ fontSize: 11, color: '#7a5a14', lineHeight: 1.5 }}>Montants = capital restant dû à la clôture. L'échéancier par contrat et le classement LT/CT des comptes-courants restent à confirmer (règle à valider).</span>
        </div>
      </div>
    </div>
  )
}

// astuce typage : recalcule le type de `derived` pour la prop d'Endettement
function Metric({ label, value, sub, color, help }: { label: string; value: string; sub: string; color?: string; help?: string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.sec, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        {help && <HelpDot text={help} />}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 5, color: color || C.carbone }}>{value}</div>
      <div style={{ fontSize: 10, color: C.argent, marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function FinanceLine({ icon, label, sub, value, onClick }: { icon: string; label: string; sub: string; value: number; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background .12s' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#FAF3E8' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, background: '#F2E8D9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`ti ${icon}`} style={{ color: C.champagneD, fontSize: 15 }} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.carbone }}>{label}</div>
        <div style={{ fontSize: 10, color: C.argent }}>{sub}</div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.carbone }}>{fmt(value)}</span>
      <i className="ti ti-chevron-right" style={{ color: C.argent, fontSize: 15 }} />
    </div>
  )
}

function TresorerieCourbe({ points }: { points: { month: string; closing: number }[] }) {
  if (points.length === 0) return null
  const vals = points.map((p) => p.closing)
  const min = Math.min(...vals, 0), max = Math.max(...vals, 1), span = max - min || 1
  const W = 590, H = 86, pad = 8
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * W
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad)
  const pts = points.map((p, i) => `${Math.round(x(i))},${Math.round(y(p.closing))}`).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 6}`} style={{ width: '100%', height: 96, overflow: 'visible' }}>
        <line x1="0" y1={H} x2={W} y2={H} stroke="#EFEFED" strokeWidth="1" />
        <polyline fill="none" stroke={CH} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={pts} />
        {points.map((p, i) => i === points.length - 1
          ? <circle key={i} cx={Math.round(x(i))} cy={Math.round(y(p.closing))} r="3.5" fill={CH} />
          : (i % 2 === 0 ? <circle key={i} cx={Math.round(x(i))} cy={Math.round(y(p.closing))} r="2.5" fill="#fff" stroke={CH} strokeWidth="1.5" /> : null))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#B4B2A9', marginTop: 4 }}>
        {points.map((p, i) => <span key={i}>{MOIS_COURT[(parseInt(p.month.slice(5, 7)) - 1) % 12]}</span>)}
      </div>
    </div>
  )
}

// ─── Side panel : drill par tiers (aging) ───────────────────────────────
function TiersPanel({ type, bucket, aging, onBucket, onClose }: {
  type: 'clients' | 'fournisseurs'; bucket: AgeBucket | 'all'; aging: HealthMetrics['agingClients']
  onBucket: (b: AgeBucket | 'all') => void; onClose: () => void
}) {
  const titre = type === 'clients' ? 'Créances clients (411)' : 'Dettes fournisseurs (401)'
  const tabs: (AgeBucket | 'all')[] = ['all', '0-30', '31-60', '61-90', '90+']
  const tabLabel = (t: AgeBucket | 'all') => t === 'all' ? 'Tous' : BUCKET_LABEL[t]
  const tiers: TiersOutstanding[] = aging.ok ? (bucket === 'all' ? aging.value.tiers : aging.value.tiers.filter((t) => t.bucket === bucket)) : []
  const total = aging.ok ? aging.value.total : 0
  const over60 = aging.ok ? aging.value.over60 : 0
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 8, background: 'transparent' }} />
      <div style={{ position: 'fixed', top: 12, right: 12, bottom: 12, width: 390, zIndex: 200, background: '#fff', borderRadius: 16, border: `1px solid ${C.bordure}`, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 30px rgba(0,0,0,0.10)', overflow: 'hidden', animation: 'slideIn 0.24s cubic-bezier(0.22,1,0.36,1)' }}>
        <div style={{ padding: '18px 20px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, color: C.argent, marginBottom: 4 }}>Détail par tiers</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.carbone }}>{titre}</div>
            </div>
            <button onClick={onClose} style={{ background: C.fond, border: `1px solid ${C.bordure}`, borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: C.argent, fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 }}>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: CH }}>{fmt(total)}</div><div style={{ fontSize: 11, color: C.argent, marginTop: 1 }}>Total en cours</div></div>
            {over60 > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: DANGER, textAlign: 'right' }}>{fmt(over60)}<span style={{ fontSize: 10, color: C.argent, fontWeight: 400, display: 'block' }}>&gt; 60 j</span></span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '0 20px 12px', flexWrap: 'wrap', flexShrink: 0 }}>
          {tabs.map((t) => {
            const cnt = aging.ok && t !== 'all' ? aging.value.countByBucket[t] : null
            const on = bucket === t
            return <button key={t} onClick={() => onBucket(t)} style={{ fontSize: 11, padding: '5px 11px', borderRadius: 6, border: `1px solid ${C.bordure}`, cursor: 'pointer', background: on ? C.carbone : C.fond, color: on ? '#fff' : C.argent }}>{tabLabel(t)}{cnt ? ` ${cnt}` : ''}</button>
          })}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 16px' }}>
          {tiers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', fontSize: 12, color: '#B4B2A9' }}>Aucun tiers dans cette tranche</div>
          ) : tiers.map((t) => {
            const ageCol = t.bucket === '90+' || t.bucket === '61-90' ? DANGER : t.bucket === '31-60' ? WARN : OK
            const ageBg = t.bucket === '90+' || t.bucket === '61-90' ? '#FCEBEB' : t.bucket === '31-60' ? '#FAEEDA' : '#E1F5EE'
            return (
              <div key={t.tiersId} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid #f2f2f0' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--alvio-champagne-subtle, #F2E8D9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: C.argent, flexShrink: 0 }}>{initiales(t.tiersLabel)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.carbone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sentenceCase(t.tiersLabel)}</div>
                  <div style={{ fontSize: 10, color: C.argent }}>{t.tiersId} · {t.oldestDays} j</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.carbone }}>{fmt(t.total)}</div>
                  <div style={{ marginTop: 2 }}><span style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: ageBg, color: ageCol }}>{BUCKET_LABEL[t.bucket]}</span></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── Side panel : drill par compte (financements) — habillage Performances ─
function FinancePanel({ poste, onClose }: { poste: FinancePoste; onClose: () => void }) {
  const [tab, setTab] = useState<'apercu' | 'ecritures'>('apercu')
  const [selectedCompte, setSelectedCompte] = useState<{ num: string; lib: string; val: number; varPct: number | null } | null>(null)
  const accent = CH
  const hasN1 = poste.monthly.some((m) => m.n1 > 0)
  const ecrToShow = selectedCompte ? (poste.comptesEcritures[selectedCompte.num] ?? []) : poste.ecritures
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 8, background: 'transparent' }} />
      <div style={{ position: 'fixed', top: 12, right: 12, bottom: 12, width: 390, zIndex: 200, background: '#fff', borderRadius: 16, border: `1px solid ${C.bordure}`, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 30px rgba(0,0,0,0.10)', overflow: 'hidden', animation: 'slideIn 0.24s cubic-bezier(0.22,1,0.36,1)' }}>
        <div style={{ padding: '18px 20px 14px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {selectedCompte ? (
                <button onClick={() => { setSelectedCompte(null); setTab('apercu') }} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: accent }}>←</span>
                  <span style={{ fontSize: 11, color: accent, fontWeight: 600 }}>{poste.label}</span>
                </button>
              ) : <div style={{ fontSize: 12, color: C.argent, marginBottom: 4 }}>Détail du financement</div>}
              <div style={{ fontSize: selectedCompte ? 13 : 16, fontWeight: 700, color: C.carbone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedCompte ? <><span title={selectedCompte.num} style={{ fontSize: 11, fontFamily: 'monospace', color: accent, marginRight: 6 }}>{num5(selectedCompte.num)}</span>{sentenceCase(selectedCompte.lib)}</> : poste.label}
              </div>
            </div>
            <button onClick={onClose} style={{ background: C.fond, border: `1px solid ${C.bordure}`, borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: C.argent, fontSize: 16, lineHeight: 1, flexShrink: 0, marginLeft: 10 }}>×</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12 }}>
            <div><div style={{ fontSize: 26, fontWeight: 700, color: accent }}>{fmt(selectedCompte ? selectedCompte.val : poste.total)}</div><div style={{ fontSize: 11, color: C.argent, marginTop: 1 }}>Capital restant dû</div></div>
            {(selectedCompte ? selectedCompte.varPct : poste.varPct) != null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: ((selectedCompte ? selectedCompte.varPct : poste.varPct) ?? 0) <= 0 ? OK : DANGER, textAlign: 'right' }}>
                {fmtV(selectedCompte ? selectedCompte.varPct : poste.varPct)}<span style={{ fontSize: 10, color: C.argent, fontWeight: 400, display: 'block' }}>vs N-1</span>
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, padding: '0 20px', borderBottom: `1px solid ${C.bordure}`, flexShrink: 0 }}>
          {([['apercu', "Vue d'ensemble"], ['ecritures', 'Écritures associées']] as const).map(([id, lbl]) => {
            if (id === 'apercu' && selectedCompte) return null
            return <button key={id} onClick={() => setTab(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0', fontSize: 12, fontWeight: tab === id ? 600 : 500, color: tab === id ? C.carbone : C.argent, borderBottom: `2px solid ${tab === id ? accent : 'transparent'}` }}>{lbl}</button>
          })}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {poste.loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><div style={{ width: 28, height: 28, border: '2px solid var(--bg-main)', borderTop: `2px solid ${accent}`, borderRadius: '50%', animation: 'spin .8s linear infinite' }} /></div>
          ) : tab === 'apercu' && !selectedCompte ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.carbone, marginBottom: 8 }}>Mouvements mensuels</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={poste.monthly} margin={{ top: 4, right: 0, left: -28, bottom: 0 }} barCategoryGap="18%">
                  <XAxis dataKey="m" tick={{ fontSize: 8, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={0} />
                  <Bar dataKey="n" fill={accent} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.carbone, marginBottom: 6, marginTop: 12 }}>
                Répartition par compte<span style={{ fontSize: 9, fontWeight: 400, color: C.argent, marginLeft: 8 }}>Cliquez un compte pour ses écritures →</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 80px 10px', fontSize: 8, fontWeight: 600, color: C.argent, textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: 6 }}>
                <span>N°</span><span>Libellé</span><span style={{ textAlign: 'right' }}>Montant</span><span />
              </div>
              {poste.comptes.map((c, i) => (
                <div key={i} onClick={() => { setSelectedCompte(c); setTab('ecritures') }}
                  style={{ display: 'grid', gridTemplateColumns: '44px 1fr 80px 10px', alignItems: 'center', padding: '8px 6px', borderTop: `1px solid ${C.bordure}`, cursor: 'pointer', borderRadius: 6, transition: 'background .1s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(198,162,117,0.07)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <span title={c.num} style={{ fontSize: 9, fontFamily: 'monospace', color: '#fff', background: accent, padding: '2px 4px', borderRadius: 4, fontWeight: 700, boxShadow: `0 1px 3px ${accent}55` }}>{num5(c.num)}</span>
                  <span title={sentenceCase(c.lib)} style={{ fontSize: 11, color: C.carbone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 4 }}>{sentenceCase(c.lib)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.carbone, textAlign: 'right' }}>{fmt(c.val)}</span>
                  <span style={{ fontSize: 10, color: accent, textAlign: 'right' }}>›</span>
                </div>
              ))}
              {poste.annual.length > 1 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.carbone, margin: '20px 0 8px' }}>Capital restant dû par exercice</div>
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
            <>
              {selectedCompte && <div style={{ fontSize: 11, color: C.argent, marginBottom: 10 }}>{ecrToShow.length} écriture{ecrToShow.length > 1 ? 's' : ''} · compte {selectedCompte.num}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 74px', fontSize: 8, fontWeight: 600, color: C.argent, textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: 6 }}>
                <span>Date</span><span>Libellé</span><span style={{ textAlign: 'right' }}>Mouvement</span>
              </div>
              {ecrToShow.map((e, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 74px', alignItems: 'center', padding: '9px 6px', borderTop: `1px solid ${C.bordure}`, borderRadius: 6, transition: 'background .1s' }}
                  onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = C.fond }}
                  onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <span style={{ fontSize: 10, color: C.argent, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(e.date)}</span>
                  <span title={sentenceCase(e.lib)} style={{ fontSize: 11, color: C.carbone, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sentenceCase(e.lib) || '—'}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: e.montant >= 0 ? C.carbone : DANGER, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(e.montant)}</span>
                </div>
              ))}
              {ecrToShow.length === 0 && <div style={{ fontSize: 12, color: C.argent, textAlign: 'center', padding: '40px 0' }}>Aucune écriture sur la période.</div>}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function initiales(nom: string): string {
  return nom.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}
