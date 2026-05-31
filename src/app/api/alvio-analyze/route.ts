import { NextRequest, NextResponse } from 'next/server'

// ── Types ──────────────────────────────────────────────────────────────────
export interface AnalyzePayload {
  page: 'profitability' | 'income-statement' | 'balance-sheet' | 'cash-flow' | 'dashboard'
  indicateurs: Record<string, number>
  periode?: string
  annee?: number
}

// ── Analyse locale (fallback sans API) ─────────────────────────────────────
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
    if (i.tauxPers > 55) pts.push(`attention : masse salariale élevée à ${fmtP(i.tauxPers)} du CA (seuil critique 55 %)`)
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
    if (i.bfr > i.treso * 1.5) pts.push(`BFR élevé (${fmt(i.bfr)}) par rapport à la trésorerie — le cycle d'exploitation consomme des ressources`)
    else if (i.bfr < 0) pts.push(`BFR négatif (${fmt(i.bfr)}) — vos fournisseurs vous financent, situation favorable`)
    else pts.push(`BFR de ${fmt(i.bfr)}`)
    return `${ctx}, ${pts.join('. ')}.`
  }

  if (page === 'cash-flow') {
    const pts: string[] = []
    if (i.treso < 0) pts.push(`trésorerie négative de ${fmt(i.treso)} — situation critique à traiter en priorité`)
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

// ── Handler principal ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const payload: AnalyzePayload = await request.json()
    const apiKey = process.env.ANTHROPIC_API_KEY

    // ── Mode Anthropic (si clé disponible) ──────────────────────────────
    if (apiKey) {
      const systemPrompt = `Tu es Alvio, un CFO digital expert en analyse financière pour TPE/PME françaises.
Tu analyses des indicateurs financiers et fournis une synthèse concise, professionnelle et actionnables en 2-3 phrases maximum.
Tu parles directement au dirigeant, sans jargon excessif. Tu identifies les points forts et les alertes. Tu es factuel et précis.
Réponds uniquement avec le texte de l'analyse, sans introduction ni conclusion.`

      const { page, indicateurs: i, periode, annee } = payload
      const ctx = periode ? `Période : ${periode}` : annee ? `Exercice ${annee}` : 'Période analysée'

      const userPrompt = `Page : ${page}
${ctx}
Indicateurs :
${Object.entries(i).map(([k, v]) => `- ${k}: ${typeof v === 'number' ? (Math.abs(v) > 1000 ? new Intl.NumberFormat('fr-FR').format(Math.round(v)) + ' €' : v.toFixed(1) + (k.startsWith('taux') ? ' %' : '')) : v}`).join('\n')}

Fournis une analyse synthétique en 2-3 phrases pour cette page.`

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.content?.[0]?.text || analyseLocale(payload)
        return NextResponse.json({ analyse: text, source: 'anthropic' })
      }
    }

    // ── Fallback local ───────────────────────────────────────────────────
    return NextResponse.json({ analyse: analyseLocale(payload), source: 'local' })

  } catch {
    return NextResponse.json({ analyse: 'Analyse indisponible momentanément.', source: 'error' }, { status: 500 })
  }
}
