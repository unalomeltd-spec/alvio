import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Types ──────────────────────────────────────────────────────────────────
export interface AnalyzePayload {
  page: 'profitability' | 'income-statement' | 'sante-financiere' | 'dashboard'
  indicateurs: Record<string, number>
  periode?: string
  annee?: number
}

// ── Analyse par template (V1 — sans LLM) ──────────────────────────────────
// V2 : remplacer cette fonction par un appel au LLM interne Alvio.
function analyseLocale(payload: AnalyzePayload): string {
  const { page, indicateurs: i, periode, annee } = payload
  const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
  const ctx = periode ? `Sur la période ${periode}` : annee ? `Exercice ${annee}` : 'Sur la période analysée'

  if (page === 'profitability') {
    const pts: string[] = []
    if (i.tauxMb > 50) pts.push(`marge brute solide à ${fmtP(i.tauxMb)}`)
    else if (i.tauxMb < 25) pts.push(`marge brute faible à ${fmtP(i.tauxMb)} — les achats et charges externes méritent une revue`)
    else pts.push(`marge brute de ${fmtP(i.tauxMb)}`)
    if (i.tauxEbe >= 15) pts.push(`excellent EBITDA à ${fmtP(i.tauxEbe)} du CA`)
    else if (i.tauxEbe < 5) pts.push(`EBITDA sous 5 % (${fmtP(i.tauxEbe)}) — la structure de coûts est à optimiser`)
    else pts.push(`EBITDA de ${fmtP(i.tauxEbe)} du CA`)
    if (i.tauxPers > 55) pts.push(`attention : masse salariale élevée à ${fmtP(i.tauxPers)} du CA`)
    else pts.push(`masse salariale maîtrisée à ${fmtP(i.tauxPers)} du CA`)
    if (i.rnet < 0) pts.push(`résultat net déficitaire de ${fmt(i.rnet)} — une action corrective est recommandée`)
    else if (i.tauxRnet > 8) pts.push(`bonne rentabilité nette à ${fmtP(i.tauxRnet)} du CA`)
    return `${ctx}, ${pts.join('. ')}.`
  }

  if (page === 'income-statement') {
    const pts: string[] = []
    pts.push(`CA de ${fmt(i.ca)}`)
    if (i.tauxMb > 40) pts.push(`marge brute de ${fmtP(i.tauxMb)} — position commerciale saine`)
    else pts.push(`marge brute de ${fmtP(i.tauxMb)} — compression des marges à surveiller`)
    if (i.rfin < -i.ca * 0.02) pts.push(`charges financières significatives (${fmt(Math.abs(i.rfin))}) — la structure de dette pèse sur le résultat`)
    if (i.rnet >= 0) pts.push(`résultat net positif de ${fmt(i.rnet)}`)
    else pts.push(`résultat net déficitaire de ${fmt(i.rnet)}`)
    return `${ctx}, ${pts.join('. ')}.`
  }

  if (page === 'balance-sheet') {
    const pts: string[] = []
    if (i.treso > 0) pts.push(`trésorerie positive de ${fmt(i.treso)}`)
    else pts.push(`trésorerie négative de ${fmt(i.treso)} — tension de liquidité`)
    if (i.bfr > i.treso * 1.5) pts.push(`BFR élevé (${fmt(i.bfr)}) par rapport à la trésorerie`)
    else if (i.bfr < 0) pts.push(`BFR négatif (${fmt(i.bfr)}) — vos fournisseurs vous financent`)
    else pts.push(`BFR de ${fmt(i.bfr)}`)
    return `${ctx}, ${pts.join('. ')}.`
  }

  if (page === 'cash-flow') {
    const pts: string[] = []
    if (i.treso < 0) pts.push(`trésorerie négative de ${fmt(i.treso)} — situation critique`)
    else if (i.treso > i.ca * 0.2) pts.push(`trésorerie confortable à ${fmt(i.treso)}, soit ${fmtP(i.treso / i.ca * 100)} du CA`)
    else pts.push(`trésorerie de ${fmt(i.treso)}`)
    const jours = i.ebe > 0 ? Math.round(i.treso / (i.ebe / 365)) : 0
    if (jours > 90) pts.push(`${jours} jours de trésorerie — excellente visibilité`)
    else if (jours < 30) pts.push(`seulement ${jours} jours de trésorerie — renforcer la position de cash`)
    else pts.push(`${jours} jours de trésorerie`)
    if (i.bfr > 0) pts.push(`BFR positif de ${fmt(i.bfr)} à financer`)
    return `${ctx}, ${pts.join('. ')}.`
  }

  return `${ctx}, analyse disponible.`
}

// ── Handler ────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Authentification requise (la route ne lit pas la base mais ne doit pas être ouverte).
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    const payload: AnalyzePayload = await request.json()
    return NextResponse.json({ analyse: analyseLocale(payload), source: 'local' })
  } catch {
    return NextResponse.json({ analyse: 'Analyse indisponible momentanément.', source: 'error' }, { status: 500 })
  }
}
