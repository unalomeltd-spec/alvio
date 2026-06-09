import { NextRequest, NextResponse } from 'next/server'
import { classifyCompte, getDestinationEffective, type Destination } from '@/lib/pcg-reference'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// ALVIO — Moteur comptable v5
// Classification PCG 2025 (ANC 2022-06) + rétrocompatibilité
// Source : Valentin Dutote, expert-comptable — juin 2026
// 615 règles PCG 2025 — importées depuis @/lib/pcg-reference
//
// Architecture : FEC → Balance → Classification → États → SIG
// ============================================================

// ─── Types ───────────────────────────────────────────────────

interface LigneFEC {
  CompteNum: string
  CompteLib?: string
  Debit: number | string
  Credit: number | string
  JournalCode?: string
  EcritureDate?: string
  EcritureLib?: string
  PieceRef?: string
}

interface SoldeCompte {
  compteNum: string
  compteLib: string
  debit: number
  credit: number
  solde: number
}

type Balance = Map<string, SoldeCompte>


  destination: Destination
}

// ─── Normalisation ───────────────────────────────────────────

function parseLigne(l: LigneFEC): { compteNum: string; compteLib: string; debit: number; credit: number; journal: string } | null {
  const compteNum = (l.CompteNum || '').trim()
  if (!compteNum) return null
  const debit  = typeof l.Debit  === 'string' ? parseFloat(l.Debit.replace(',', '.'))  || 0 : (l.Debit  || 0)
  const credit = typeof l.Credit === 'string' ? parseFloat(l.Credit.replace(',', '.')) || 0 : (l.Credit || 0)
  return {
    compteNum,
    compteLib: (l.CompteLib || '').trim(),
    debit:  Math.round(debit  * 100) / 100,
    credit: Math.round(credit * 100) / 100,
    journal: (l.JournalCode || '').trim().toUpperCase(),
  }
}

// ─── Balance ─────────────────────────────────────────────────
// Règles d'exclusion (L3 — Valentin Dutote) :
// - Journal AN exclu des classes 6 et 7 (à-nouveaux charges/produits N-1)
// - Classes 8 et 9 ignorées totalement
// - Comptes à zéro ignorés

function buildBalance(lignes: LigneFEC[]): {
  balance: Balance
  totalDebit: number
  totalCredit: number
  nbLignes: number
  nbLignesAN67: number
  nbLignes89: number
} {
  const balance: Balance = new Map()
  let totalDebit = 0, totalCredit = 0, nbLignesAN67 = 0, nbLignes89 = 0

  for (const raw of lignes) {
    const l = parseLigne(raw)
    if (!l) continue

    const classe = l.compteNum[0]

    // Ignorer classes 8 et 9
    if (classe === '8' || classe === '9') { nbLignes89++; continue }

    // Exclure AN des classes 6 et 7 AVANT d'incrémenter les totaux
    // Les lignes exclues ne doivent pas polluer le contrôle equilibreFEC
    if (l.journal === 'AN' && (classe === '6' || classe === '7')) { nbLignesAN67++; continue }

    totalDebit  += l.debit
    totalCredit += l.credit

    const existing = balance.get(l.compteNum)
    if (existing) {
      existing.debit  += l.debit
      existing.credit += l.credit
      existing.solde   = existing.debit - existing.credit
      if (!existing.compteLib && l.compteLib) existing.compteLib = l.compteLib
    } else {
      balance.set(l.compteNum, {
        compteNum: l.compteNum,
        compteLib: l.compteLib,
        debit:  l.debit,
        credit: l.credit,
        solde:  l.debit - l.credit,
      })
    }
  }

  for (const s of balance.values()) {
    s.debit  = Math.round(s.debit  * 100) / 100
    s.credit = Math.round(s.credit * 100) / 100
    s.solde  = Math.round(s.solde  * 100) / 100
  }

  return { balance, totalDebit: Math.round(totalDebit*100)/100, totalCredit: Math.round(totalCredit*100)/100, nbLignes: lignes.length, nbLignesAN67, nbLignes89 }
}

// ─── Classification PCG 2025 ────────────────────────────────
// 598 comptes — préfixe le plus long en premier (priorité maximale)


// ─── Agrégation depuis la balance ────────────────────────────
// classifyCompte() et getDestinationEffective() importées depuis @/lib/pcg-reference
// Source de vérité : PCG2025_Classification_Alvio.xlsx — Valentin Dutote

type Aggregats = Record<Destination, number>

const DESTINATIONS: Destination[] = [
  'ventesMarchandises','productionVendue','productionStockee','productionImmobilisee',
  'subventionsExploit','autresProduits','reprises',
  'achatsMarchandises','variationStocksMarch','achatsMatieres','variationStocksMat',
  'autresAchats','servicesExt','impotsTaxes','chargesPersonnel','remboursementsPers',
  'dotationsExploit','autresChargesExploit',
  'produitsFinanciers','reprisesFin','chargesFinancieres','dotationsFin',
  'produitsExcep','reprisesExcep','prixCession','chargesExcep','dotationsExcep','vncActifsCedes',
  'participation','is',
  'immoIncorpBrut','immoCorpBrut','immoFinBrut','amortIncorp','amortCorp','deprecImmoFin',
  'stocksMarchandises','stocksMatieres','stocksEncours','stocksProduits','deprecStocks',
  'creancesClients','deprecCreances','creancesEtat','autresCreances','chargesConstatees',
  'tresorerieActif','deprecTreso','capitalNonAppele',
  'capital','primes','ecarts','reserves','reportNouveau','resultatExercice','subventionsInvest',
  'provisionsReglementees','provisionsRisques',
  'empruntsOblig','empruntsEtablissement','autresEmpruntsLT',
  'dettesFournisseurs','dettesSociales','dettesFiscales','autresDettes','produitsConstates','tresoreriePassif',
]

function buildStatements(balance: Balance): { aggregats: Aggregats; comptesNonReconnus: string[] } {
  const agg = {} as Aggregats
  for (const d of DESTINATIONS) agg[d] = 0

  const comptesNonReconnus: string[] = []

  for (const compte of balance.values()) {
    if (Math.abs(compte.solde) < 0.01) continue

    const rule = classifyCompte(compte.compteNum)
    if (!rule) {
      comptesNonReconnus.push(`${compte.compteNum} (${compte.compteLib || '?'}) solde=${compte.solde}`)
      continue
    }

    const destEffective = getDestinationEffective(compte.compteNum, compte.solde, rule)

    // getDestinationEffective retourne la destination après basculement L2.
    // Le sens de contribution est déterminé par rule.sens_normal :
    //   crediteur → le solde créditeur (négatif) contribue positivement → multiplier par -1
    //   debiteur  → le solde débiteur (positif) contribue positivement  → multiplier par +1
    // Pour les basculements L2 (ex. client créditeur → autresDettes), le solde est déjà
    // signé correctement : on prend la valeur absolue et on l'affecte positivement.
    const sensAnormal =
      (rule.sens_normal === 'crediteur' && compte.solde > 0) ||
      (rule.sens_normal === 'debiteur'  && compte.solde < 0)

    let valeur: number
    if (sensAnormal) {
      // Basculement L2 : la valeur contribue positivement à la destination cible
      valeur = Math.abs(compte.solde)
    } else {
      // Sens normal : contribution = solde × signe selon sens_normal
      valeur = rule.sens_normal === 'crediteur' ? -compte.solde : compte.solde
    }

    if (DESTINATIONS.includes(destEffective as Destination)) {
      agg[destEffective as Destination] += valeur
    }
  }

  for (const d of DESTINATIONS) agg[d] = Math.round(agg[d] * 100) / 100

  // Remboursements de charges personnel (649 — rétrocompat 791) déduits des charges personnel
  agg['chargesPersonnel'] = Math.round((agg['chargesPersonnel'] - agg['remboursementsPers']) * 100) / 100

  // Détection écart résultatExercice vs résultat SIG (règle L3-4b)
  // Stocké dans l'agrégat resultatExercice — comparaison faite dans buildControles
  // NB : buildBilan utilise sig.resultatNet (cascade CR), pas cet agrégat

  return { aggregats: agg, comptesNonReconnus }
}

function r(n: number): number { return Math.round(n * 100) / 100 }

// ─── SIG PCG 2025 ────────────────────────────────────────────
// Formules selon préconisations CNOEC (L4 — Valentin Dutote)
// Note : article 842-1 SIG supprimé du PCG 2025 — cascade maintenue à titre d'usage

function buildSIG(a: Aggregats) {
  const coutMarchandises   = r(a.achatsMarchandises + a.variationStocksMarch)
  const margeCommerciale   = r(a.ventesMarchandises - coutMarchandises)
  const prodExercice       = r(a.productionVendue + a.productionStockee + a.productionImmobilisee)
  // VA : subventions exploitation incluses (74x + 747 PCG 2025)
  const cosoIntermediaires = r(a.achatsMatieres + a.variationStocksMat + a.autresAchats + a.servicesExt)
  const valeurAjoutee      = r(margeCommerciale + prodExercice + a.subventionsExploit - cosoIntermediaires)
  const ebe                = r(valeurAjoutee - a.impotsTaxes - a.chargesPersonnel)
  // RE : 657 (cessions immos PCG 2025) inclus dans autresChargesExploit, 757 dans autresProduits
  const rex                = r(ebe - a.dotationsExploit + a.reprises + a.autresProduits - a.autresChargesExploit)
  const rfin               = r(a.produitsFinanciers + a.reprisesFin - a.chargesFinancieres - a.dotationsFin)
  const rexcep             = r(a.produitsExcep + a.reprisesExcep + a.prixCession - a.chargesExcep - a.dotationsExcep - a.vncActifsCedes)
  const rnetCR             = r(rex + rfin + rexcep - a.participation - a.is)
  const ca                 = r(a.ventesMarchandises + a.productionVendue)

  return {
    ca, ventesMarchandises: r(a.ventesMarchandises), coutMarchandises, margeCommerciale,
    productionVendue: r(a.productionVendue), productionStockee: r(a.productionStockee),
    productionImmobilisee: r(a.productionImmobilisee), productionExercice: prodExercice,
    consommationsInt: cosoIntermediaires, subventions: r(a.subventionsExploit),
    valeurAjoutee, impotsTaxes: r(a.impotsTaxes), chargesPersonnel: r(a.chargesPersonnel),
    ebe, dotations: r(a.dotationsExploit), reprises: r(a.reprises),
    autresProduits: r(a.autresProduits), autresCharges: r(a.autresChargesExploit),
    rex, produitsFinanciers: r(a.produitsFinanciers), chargesFinancieres: r(a.chargesFinancieres),
    rfin, produitsExcep: r(a.produitsExcep), chargesExcep: r(a.chargesExcep), rexcep,
    participation: r(a.participation), is: r(a.is), resultatNet: rnetCR,
    tauxMb:   ca > 0 ? r(margeCommerciale   / ca * 100) : 0,
    tauxEbe:  ca > 0 ? r(ebe                / ca * 100) : 0,
    tauxRex:  ca > 0 ? r(rex                / ca * 100) : 0,
    tauxRnet: ca > 0 ? r(rnetCR             / ca * 100) : 0,
    tauxPers: ca > 0 ? r(a.chargesPersonnel / ca * 100) : 0,
  }
}

function buildCR(a: Aggregats, sig: ReturnType<typeof buildSIG>) {
  return {
    produitsExploitation: {
      ventesMarchandises: r(a.ventesMarchandises), productionVendue: r(a.productionVendue),
      productionStockee: r(a.productionStockee), productionImmobilisee: r(a.productionImmobilisee),
      subventions: r(a.subventionsExploit), autresProduits: r(a.autresProduits),
      reprises: r(a.reprises),
      total: r(a.ventesMarchandises + a.productionVendue + a.productionStockee + a.productionImmobilisee + a.subventionsExploit + a.autresProduits + a.reprises),
    },
    chargesExploitation: {
      achatsMarchandises: r(a.achatsMarchandises), variationStocksMarch: r(a.variationStocksMarch),
      achatsMatieres: r(a.achatsMatieres), variationStocksMat: r(a.variationStocksMat),
      autresAchats: r(a.autresAchats), servicesExt: r(a.servicesExt),
      impotsTaxes: r(a.impotsTaxes), chargesPersonnel: r(a.chargesPersonnel),
      dotations: r(a.dotationsExploit), autresCharges: r(a.autresChargesExploit),
      total: r(sig.coutMarchandises + a.achatsMatieres + a.variationStocksMat + a.autresAchats + a.servicesExt + a.impotsTaxes + a.chargesPersonnel + a.dotationsExploit + a.autresChargesExploit),
    },
    resultatExploitation: sig.rex,
    produitsFinanciers: r(a.produitsFinanciers), chargesFinancieres: r(a.chargesFinancieres),
    resultatFinancier: sig.rfin,
    produitsExcep: r(a.produitsExcep), chargesExcep: r(a.chargesExcep),
    resultatExceptionnel: sig.rexcep,
    participation: r(a.participation), is: r(a.is), resultatNet: sig.resultatNet,
  }
}

function buildBilan(a: Aggregats, resultatNet: number) {
  const actifImmoNet  = r((a.immoIncorpBrut + a.immoCorpBrut + a.immoFinBrut) - (a.amortIncorp + a.amortCorp + a.deprecImmoFin))
  const stocksNets    = r(a.stocksMarchandises + a.stocksMatieres + a.stocksEncours + a.stocksProduits - a.deprecStocks)
  const creancesNettes= r(a.creancesClients - a.deprecCreances)
  const tresoActifNet = r(a.tresorerieActif - a.deprecTreso)
  const totalActif    = r(a.capitalNonAppele + actifImmoNet + stocksNets + creancesNettes + a.creancesEtat + a.autresCreances + a.chargesConstatees + tresoActifNet)
  const capPropres    = r(a.capital + a.primes + a.ecarts + a.reserves + a.reportNouveau + resultatNet + a.subventionsInvest + a.provisionsReglementees)
  const dettesLT      = r(a.provisionsRisques + a.empruntsOblig + a.empruntsEtablissement + a.autresEmpruntsLT)
  const dettesCT      = r(a.dettesFournisseurs + a.dettesSociales + a.dettesFiscales + a.autresDettes + a.produitsConstates + a.tresoreriePassif)
  const totalPassif   = r(capPropres + dettesLT + dettesCT)
  return {
    actif: {
      immoIncorpBrut: r(a.immoIncorpBrut), immoCorpBrut: r(a.immoCorpBrut), immoFinBrut: r(a.immoFinBrut),
      amortIncorp: r(a.amortIncorp), amortCorp: r(a.amortCorp), deprecImmoFin: r(a.deprecImmoFin), actifImmoNet,
      stocksMarchandises: r(a.stocksMarchandises), stocksMatieres: r(a.stocksMatieres),
      stocksEncours: r(a.stocksEncours), stocksProduits: r(a.stocksProduits), deprecStocks: r(a.deprecStocks), stocksNets,
      creancesClients: creancesNettes, creancesEtat: r(a.creancesEtat), autresCreances: r(a.autresCreances),
      chargesConstatees: r(a.chargesConstatees), tresorerie: tresoActifNet, totalActif,
    },
    passif: {
      capital: r(a.capital), primes: r(a.primes), ecarts: r(a.ecarts), reserves: r(a.reserves),
      reportNouveau: r(a.reportNouveau), resultatNet, subventionsInvest: r(a.subventionsInvest),
      provisionsReglementees: r(a.provisionsReglementees), capitauxPropres: capPropres,
      provisionsRisques: r(a.provisionsRisques), empruntsOblig: r(a.empruntsOblig),
      empruntsEtablissement: r(a.empruntsEtablissement), autresEmpruntsLT: r(a.autresEmpruntsLT), dettesLT,
      dettesFournisseurs: r(a.dettesFournisseurs), dettesSociales: r(a.dettesSociales),
      dettesFiscales: r(a.dettesFiscales), autresDettes: r(a.autresDettes),
      produitsConstates: r(a.produitsConstates), tresoreriePassif: r(a.tresoreriePassif), dettesCT, totalPassif,
    }
  }
}

// ─── Contrôles ───────────────────────────────────────────────

function buildControles(
  totalDebit: number, totalCredit: number,
  bilan: ReturnType<typeof buildBilan>,
  sig: ReturnType<typeof buildSIG>,
  nbLignes: number, nbLignesAN67: number, nbLignes89: number,
  comptesNonReconnus: string[],
  resultatExerciceFEC: number
) {
  const ecartFEC   = Math.abs(totalDebit - totalCredit)
  const ecartBilan = Math.abs(bilan.actif.totalActif - bilan.passif.totalPassif)
  return {
    nbLignes, nbLignesAN67, nbLignes89,
    debitTotal: totalDebit, creditTotal: totalCredit,
    equilibreFEC: ecartFEC < 1, ecartFEC: r(ecartFEC),
    totalActif: bilan.actif.totalActif, totalPassif: bilan.passif.totalPassif,
    equilibreBilan: ecartBilan < 1, ecartBilan: r(ecartBilan),
    resultatCR: sig.resultatNet, resultatBilan: bilan.passif.resultatNet,
    coherenceResultat: Math.abs(sig.resultatNet - bilan.passif.resultatNet) < 1,
    ecartResultatFEC: r(Math.abs(sig.resultatNet - resultatExerciceFEC)),
    comptesNonReconnus: comptesNonReconnus.slice(0, 30),
    comptesNonReconnusTotal: comptesNonReconnus.length,
  }
}

// ─── Filtre de période ───────────────────────────────────────
// Si dateDebut et dateFin sont fournis, ne conserve que les écritures
// dont EcritureDate est dans l'intervalle [dateDebut, dateFin].
// Format attendu : YYYYMMDD (format FEC standard) ou YYYY-MM-DD.
// Les écritures sans date ou avec date invalide sont toujours incluses
// (comportement conservateur — ne pas perdre de données silencieusement).

function normaliserDate(d: string): string {
  // Accepte YYYYMMDD ou YYYY-MM-DD → retourne YYYYMMDD
  return d.replace(/-/g, '')
}

function filtrerParPeriode(lignes: LigneFEC[], dateDebut: string, dateFin: string): LigneFEC[] {
  const debut = normaliserDate(dateDebut)
  const fin   = normaliserDate(dateFin)
  return lignes.filter(l => {
    if (!l.EcritureDate) return true // pas de date → inclus
    const d = normaliserDate(String(l.EcritureDate))
    if (d.length !== 8) return true  // date illisible → inclus
    return d >= debut && d <= fin
  })
}

// ─── Pipeline ────────────────────────────────────────────────

function calculer(lignes: LigneFEC[], annee: number, dateDebut?: string, dateFin?: string) {
  // Filtrage de période si les deux bornes sont présentes
  const lignesFiltrees = (dateDebut && dateFin)
    ? filtrerParPeriode(lignes, dateDebut, dateFin)
    : lignes

  const { balance, totalDebit, totalCredit, nbLignes, nbLignesAN67, nbLignes89 } = buildBalance(lignesFiltrees)
  const { aggregats, comptesNonReconnus } = buildStatements(balance)
  const sig   = buildSIG(aggregats)
  const cr    = buildCR(aggregats, sig)
  const bilan = buildBilan(aggregats, sig.resultatNet)
  const controles = buildControles(totalDebit, totalCredit, bilan, sig, nbLignes, nbLignesAN67, nbLignes89, comptesNonReconnus, aggregats.resultatExercice ?? 0)

  // On expose la période effective dans la réponse
  const periode = (dateDebut && dateFin)
    ? { type: 'perso' as const, dateDebut, dateFin }
    : { type: 'exercice' as const, dateDebut: `${annee}-01-01`, dateFin: `${annee}-12-31` }

  return { annee, periode, controles, sig, cr, bilan }
}

// ─── Route Next.js ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const annee      = parseInt(searchParams.get('annee')      || '0')
  const userId     = searchParams.get('user_id')             || ''
  const dateDebut  = searchParams.get('dateDebut')           || ''
  const dateFin    = searchParams.get('dateFin')             || ''

  if (!annee || !userId) return NextResponse.json({ erreur: 'annee et user_id requis' }, { status: 400 })
  if (annee < 2000 || annee > 2030) return NextResponse.json({ erreur: 'annee invalide (2000–2030)' }, { status: 400 })

  // Validation des dates si fournies (format YYYY-MM-DD ou YYYYMMDD)
  if ((dateDebut && !dateFin) || (!dateDebut && dateFin)) {
    return NextResponse.json({ erreur: 'dateDebut et dateFin doivent être fournis ensemble' }, { status: 400 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await admin.from('fec_exercices').select('ecritures').eq('user_id', userId).eq('annee', annee).single()
  if (error || !data) return NextResponse.json({ erreur: 'FEC introuvable' }, { status: 404 })

  try {
    const ecritures = data.ecritures
    if (!Array.isArray(ecritures) || ecritures.length === 0) {
      return NextResponse.json({ erreur: 'FEC vide ou invalide' }, { status: 422 })
    }
    return NextResponse.json(calculer(ecritures as LigneFEC[], annee, dateDebut || undefined, dateFin || undefined))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne du moteur comptable'
    return NextResponse.json({ erreur: message }, { status: 500 })
  }
}
