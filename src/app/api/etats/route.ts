// ALVIO — Moteur comptable v6.3
// Source de vérité unique : @/lib/pcg-reference
// v6.3 (10 juin 2026) — Derniers points Valentin (audit 5 dossiers, tour 2) :
//   FIX C — 627x Services bancaires et assimiles → servicesExt (exploitation, pas financier).
//     Valentin : classe sur le numero de compte, jamais sur le libelle. 627 = classe 62.
//   FIX D — Normalisation 44x : suffixes analytiques Pennylane (ex. 4456400009 = 44564 + code
//     regime TVA "00009") tronques aux 5 premiers chiffres dans buildBalance. Les sous-comptes
//     analytiques d'un meme compte TVA se compensent naturellement (44564 + 4456400009 → solde
//     net 6695,97 → dettesFiscales). Regle Valentin : TVA = position nette par declaration.
// v6.2 (10 juin 2026) — Regles comptables validees par Valentin (audit 5 dossiers) :
//   • GROSS-UP DES BIVALENTS (item #5) — non-compensation PCG au grain TIERS (CompAuxNum).
//     On gross-up les comptes de tiers (classe 4 hors dépréciations 49) et les banques (51x) :
//     un fournisseur débiteur / une TVA inversée / un compte courant passe du bon côté du bilan.
//     Les comptes monovalents (classe 1/2/3, caisse 53) NE basculent jamais → signalés en anomalie.
//   • CA — 708 « activités annexes » DANS le CA ; 709 « RRR accordés » EN MOINS du CA.
//   • AN 6/7 — on n'exclut que les reprises de résultat (contrepartie 11/12) ; un produit/charge
//     mal journalisé en AN (contrepartie tiers) est CONSERVÉ et signalé.
//   ⚠ Requiert que les écritures stockées portent le CompAuxNum (sinon gross-up 401/411 dégradé).
// v6.1 (10 juin 2026) — Audit non-régression (5 dossiers Pennylane) :
//   • FIX A — détection de régime durcie : bascule après-affectation UNIQUEMENT si le
//     résultat est réellement viré dans les comptes 12x (solde 12x non nul). Une écriture
//     touchant par hasard un 12x et un 6/7 (ex : différence de lettrage) ne suffit plus.
//   • FIX B — équilibre FEC évalué sur le FICHIER BRUT (avant exclusions analytiques),
//     pour ne plus déclencher de faux « FEC déséquilibré » sur les exclusions légitimes.
// v6 (10 juin 2026) — Refonte du SIGNE : lecture native du FEC, jamais d'absolutisation.
//   • Corrige le CA/SIG faussés par les comptes à contre-sens (709 RRR, 603/713 variations).
//   • Subventions d'exploitation (74) à l'EBE (et non en VA) — règle CNOEC / Valentin.
//   • Détection de régime (avant/après affectation) et découplage CR → Bilan.
//   • Gate dur : équilibre FEC strict 0,00 + réconciliation résultat. Bloque SIG/IA si KO.
// Validé au centime contre Pennylane sur BONVARLET, CARGONAUTES, PATHTECH.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { classifyCompte, getDestinationEffective, type Destination } from '@/lib/pcg-reference'

interface LigneFEC {
  CompteNum: string; CompteLib?: string; Debit: number | string; Credit: number | string
  JournalCode?: string; EcritureNum?: string; EcritureDate?: string; EcritureLib?: string; PieceRef?: string; CompAuxNum?: string
}
interface SoldeCompte { compteNum: string; compteLib: string; debit: number; credit: number; solde: number; aux: string }
type Balance = Map<string, SoldeCompte>

function r(n: number): number { return Math.round(n * 100) / 100 }

function parseLigne(l: LigneFEC) {
  const compteNum = (l.CompteNum || '').trim()
  if (!compteNum) return null
  const debit  = typeof l.Debit  === 'string' ? parseFloat(l.Debit.replace(',', '.'))  || 0 : (l.Debit  || 0)
  const credit = typeof l.Credit === 'string' ? parseFloat(l.Credit.replace(',', '.')) || 0 : (l.Credit || 0)
  return {
    compteNum, compteLib: (l.CompteLib || '').trim(),
    debit: r(debit), credit: r(credit),
    journal: (l.JournalCode || '').trim().toUpperCase(),
    ecritureNum: (l.EcritureNum || '').trim(),
    aux: (l.CompAuxNum || '').trim(),
  }
}

// ─── Détection de régime (avant / après affectation) ─────────────
// FIX A (audit 10/06/2026) — Signal d'affectation FIABLE : le résultat n'est en régime
// "après affectation" QUE s'il a réellement été viré dans les comptes 12x (solde 12x non
// nul). En avant affectation les 12x sont vides → on ne masque AUCUNE écriture. Une simple
// écriture touchant par hasard un 12x ET un 6/7 (ex : OD de différence de lettrage) ne
// bascule plus le régime, et l'écriture de clôture doit porter un montant 6/7 matériel.
function detecterRegime(lignes: LigneFEC[]): { regime: 'avant_affectation' | 'apres_affectation'; ecrituresClotureNum: Set<string> } {
  const parEcriture = new Map<string, { classes: Set<string>; montant67: number }>()
  let solde12 = 0
  for (const raw of lignes) {
    const l = parseLigne(raw)
    if (!l) continue
    const classe = l.compteNum[0]
    if (l.compteNum.startsWith('12')) solde12 += l.debit - l.credit
    if (!l.ecritureNum) continue
    const key = `${l.journal}#${l.ecritureNum}`
    let e = parEcriture.get(key)
    if (!e) { e = { classes: new Set<string>(), montant67: 0 }; parEcriture.set(key, e) }
    if (classe === '6' || classe === '7') { e.classes.add('gestion'); e.montant67 += l.debit + l.credit }
    if (l.compteNum.startsWith('12')) e.classes.add('resultat12')
  }
  solde12 = r(solde12)
  const aRes12 = Math.abs(solde12) > 1
  const ecrituresClotureNum = new Set<string>()
  if (aRes12) {
    for (const [key, e] of parEcriture)
      if (e.classes.has('gestion') && e.classes.has('resultat12') && e.montant67 > 1) ecrituresClotureNum.add(key)
  }
  return { regime: (aRes12 && ecrituresClotureNum.size > 0) ? 'apres_affectation' : 'avant_affectation', ecrituresClotureNum }
}

// ─── Balance ─────────────────────────────────────────────────────
// L3 (Valentin) : AN exclu des classes 6/7 ; classes 8/9 ignorées ;
// en régime "après affectation", les OD de solde 6/7 sont exclues du calcul de R1.
function buildBalance(lignes: LigneFEC[], ecrituresCloture: Set<string>, anReprise: Set<string>) {
  const balance: Balance = new Map()
  let totalDebit = 0, totalCredit = 0, nbLignesAN67 = 0, nbLignes89 = 0, nbLignesCloture67 = 0
  for (const raw of lignes) {
    const l = parseLigne(raw)
    if (!l) continue
    const classe = l.compteNum[0]
    if (classe === '8' || classe === '9') { nbLignes89++; continue }
    // AN 6/7 (règle Valentin affinée) : on N'EXCLUT QUE les reprises de résultat (écriture AN
    // dont la contrepartie est un 11/12). Un vrai produit/charge mal journalisé en AN
    // (contrepartie tiers) est CONSERVÉ et signalé, jamais absorbé en silence.
    if (l.journal === 'AN' && (classe === '6' || classe === '7') && anReprise.has(`${l.journal}#${l.ecritureNum}`)) { nbLignesAN67++; continue }
    // Régime après affectation : neutraliser les écritures de solde 6/7 pour reconstruire R1
    if ((classe === '6' || classe === '7') && ecrituresCloture.has(`${l.journal}#${l.ecritureNum}`)) { nbLignesCloture67++; continue }
    totalDebit += l.debit; totalCredit += l.credit
    // Cle au grain TIERS (40x/41x : CompteNum complet + aux pour le gross-up par tiers).
    // 44x avec > 5 chiffres : tronques aux 5 premiers (FIX D — suffixes analytiques Pennylane :
    //   4456400009 = 44564 + code regime → meme cle "44564" que le compte racine).
    // Regle Valentin : TVA = position nette par declaration (44564 + 4456400009 → solde net).
    let canonical = l.compteNum
    if (l.compteNum.startsWith('44') && l.compteNum.length > 5) canonical = l.compteNum.slice(0, 5)
    const key = `${canonical}|${l.aux}`
    const ex = balance.get(key)
    if (ex) { ex.debit += l.debit; ex.credit += l.credit; ex.solde = ex.debit - ex.credit; if (!ex.compteLib && l.compteLib) ex.compteLib = l.compteLib }
    else balance.set(key, { compteNum: canonical, compteLib: l.compteLib, debit: l.debit, credit: l.credit, solde: l.debit - l.credit, aux: l.aux })
  }
  for (const s of balance.values()) { s.debit = r(s.debit); s.credit = r(s.credit); s.solde = r(s.solde) }
  return { balance, totalDebit: r(totalDebit), totalCredit: r(totalCredit), nbLignesAN67, nbLignes89, nbLignesCloture67 }
}

// ─── Agrégation ──────────────────────────────────────────────────
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

// ─── FIX item #5 — Gross-up des comptes bivalents (règles Valentin, 10/06/2026) ───
// Non-compensation du PCG appréciée AU NIVEAU DU TIERS (compte auxiliaire). On ne gross-up
// QUE les comptes de tiers (classe 4, hors dépréciations 49) et les comptes financiers
// bivalents de classe 5 (banques 51x). Tout le reste suit son signe natif ; un solde inversé
// sur un compte monovalent (classe 1/2/3, caisse 53…) est une ANOMALIE signalée, jamais basculée.
const FAMILLE_TIERS: Array<[string, Destination, Destination]> = [
  // préfixe, destination si solde DÉBITEUR (→ actif), destination si solde CRÉDITEUR (→ passif)
  ['40', 'autresCreances', 'dettesFournisseurs'],
  ['41', 'creancesClients', 'autresDettes'],
  ['42', 'autresCreances', 'dettesSociales'],
  ['43', 'autresCreances', 'dettesSociales'],
  ['44', 'creancesEtat', 'dettesFiscales'],
  ['45', 'autresCreances', 'autresEmpruntsLT'],   // comptes courants d'associés / groupe
  ['46', 'autresCreances', 'autresDettes'],
  ['47', 'autresCreances', 'autresDettes'],
]
function grossUpRoute(compteNum: string, solde: number): { destination: Destination; valeur: number } | null {
  const c = compteNum
  if (c[0] === '5') {                                                  // banques bivalentes uniquement
    if (c.startsWith('51')) return solde >= 0 ? { destination: 'tresorerieActif', valeur: solde } : { destination: 'tresoreriePassif', valeur: -solde }
    return null                                                        // 53 caisse, 50 VMP, 58 virements : signe natif
  }
  if (c[0] !== '4') return null
  if (c.startsWith('49')) return null                                  // dépréciations de tiers = contra, signe natif
  if (c.startsWith('486')) return solde >= 0 ? { destination: 'chargesConstatees', valeur: solde } : null
  if (c.startsWith('487')) return solde <= 0 ? { destination: 'produitsConstates', valeur: -solde } : null
  for (const [p, dActif, dPassif] of FAMILLE_TIERS)
    if (c.startsWith(p)) return solde >= 0 ? { destination: dActif, valeur: solde } : { destination: dPassif, valeur: -solde }
  return solde >= 0 ? { destination: 'autresCreances', valeur: solde } : { destination: 'autresDettes', valeur: -solde }
}
// Anomalies « signaler, ne pas basculer » : solde inversé sur compte monovalent (classe 1/2/3, caisse).
function detectAnomalie(c: string, solde: number): string | null {
  const cl = c[0]
  if (cl === '2' && !c.startsWith('28') && !c.startsWith('29') && solde < -0.01) return `${c} : actif immobilisé à solde créditeur (${solde} €) — anomalie, à remonter en révision`
  if (cl === '3' && !c.startsWith('39') && solde < -0.01) return `${c} : stock à solde créditeur (${solde} €) — anomalie`
  if (c.startsWith('53') && solde < -0.01) return `${c} : caisse à solde créditeur (${solde} €) — impossible, à corriger`
  if ((c.startsWith('455') || c.startsWith('451')) && solde > 0.01) return `${c} : compte courant/groupe débiteur (${solde} €) — avance possible, à vérifier`
  return null
}

function buildStatements(balance: Balance) {
  const agg = {} as Aggregats
  for (const d of DESTINATIONS) agg[d] = 0
  const comptesNonReconnus: string[] = []
  const anomalies: string[] = []
  for (const compte of balance.values()) {
    if (Math.abs(compte.solde) < 0.01) continue
    const rule = classifyCompte(compte.compteNum)
    if (!rule) { comptesNonReconnus.push(`${compte.compteNum} (${compte.compteLib || '?'}) solde=${compte.solde}`); continue }
    const ano = detectAnomalie(compte.compteNum, compte.solde); if (ano) anomalies.push(ano)
    // FIX C — 627x Services bancaires → exploitation (Valentin, 10/06/2026).
    // Classe 62 = services exterieurs. "Frais sur emission emprunts" sonne financier
    // mais le PCG range la remuneration du service bancaire en 62, pas en 66.
    if (compte.compteNum.startsWith('627')) { agg['servicesExt'] += compte.solde; continue }
        // CA (Valentin) : 708 « activités annexes » DANS le CA ; 709 « RRR accordés » EN MOINS.
    // Les deux portent leur signe natif → contribution = -solde (708 créditeur ↑ CA ; 709 débiteur ↓ CA).
    if (compte.compteNum.startsWith('708') || compte.compteNum.startsWith('709')) { agg['productionVendue'] += -compte.solde; continue }
    // Gross-up des bivalents (tiers classe 4 + banques classe 5) — routage par signe réel.
    const gu = grossUpRoute(compte.compteNum, compte.solde)
    if (gu) { agg[gu.destination] += gu.valeur; continue }
    // Sinon : mapping naturel (signe natif) de pcg-reference (source de vérité).
    const { destination, valeur } = getDestinationEffective(compte.compteNum, compte.solde, rule)
    agg[destination] += valeur
  }
  for (const d of DESTINATIONS) agg[d] = r(agg[d])
  agg['chargesPersonnel'] = r(agg['chargesPersonnel'] - agg['remboursementsPers'])
  return { aggregats: agg, comptesNonReconnus, anomalies }
}

// ─── SIG (signe natif déjà porté par les agrégats) ───────────────
function buildSIG(a: Aggregats) {
  const coutMarchandises   = r(a.achatsMarchandises + a.variationStocksMarch)
  const margeCommerciale   = r(a.ventesMarchandises - coutMarchandises)
  const prodExercice       = r(a.productionVendue + a.productionStockee + a.productionImmobilisee)
  const cosoIntermediaires = r(a.achatsMatieres + a.variationStocksMat + a.autresAchats + a.servicesExt)
  const valeurAjoutee      = r(margeCommerciale + prodExercice - cosoIntermediaires)
  const ebe                = r(valeurAjoutee + a.subventionsExploit - a.impotsTaxes - a.chargesPersonnel)
  const rex                = r(ebe - a.dotationsExploit + a.reprises + a.autresProduits - a.autresChargesExploit)
  const rfin               = r(a.produitsFinanciers + a.reprisesFin - a.chargesFinancieres - a.dotationsFin)
  const rcai               = r(rex + rfin)
  const rexcep             = r(a.produitsExcep + a.reprisesExcep + a.prixCession - a.chargesExcep - a.dotationsExcep - a.vncActifsCedes)
  const rnetCR             = r(rcai + rexcep - a.participation - a.is)
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
    rfin, rcai, produitsExcep: r(a.produitsExcep), chargesExcep: r(a.chargesExcep), rexcep,
    participation: r(a.participation), is: r(a.is), resultatNet: rnetCR,
    tauxMb: ca > 0 ? r(margeCommerciale / ca * 100) : 0,
    tauxEbe: ca > 0 ? r(ebe / ca * 100) : 0,
    tauxRex: ca > 0 ? r(rex / ca * 100) : 0,
    tauxRnet: ca > 0 ? r(rnetCR / ca * 100) : 0,
    tauxPers: ca > 0 ? r(a.chargesPersonnel / ca * 100) : 0,
  }
}

function buildCR(a: Aggregats, sig: ReturnType<typeof buildSIG>) {
  return {
    produitsExploitation: {
      ventesMarchandises: r(a.ventesMarchandises), productionVendue: r(a.productionVendue),
      productionStockee: r(a.productionStockee), productionImmobilisee: r(a.productionImmobilisee),
      subventions: r(a.subventionsExploit), autresProduits: r(a.autresProduits), reprises: r(a.reprises),
      total: r(a.ventesMarchandises + a.productionVendue + a.productionStockee + a.productionImmobilisee + a.subventionsExploit + a.autresProduits + a.reprises),
    },
    chargesExploitation: {
      achatsMarchandises: r(a.achatsMarchandises), variationStocksMarch: r(a.variationStocksMarch),
      achatsMatieres: r(a.achatsMatieres), variationStocksMat: r(a.variationStocksMat),
      autresAchats: r(a.autresAchats), servicesExt: r(a.servicesExt),
      impotsTaxes: r(a.impotsTaxes), chargesPersonnel: r(a.chargesPersonnel),
      dotations: r(a.dotationsExploit), autresCharges: r(a.autresChargesExploit),
      total: r(a.achatsMarchandises + a.variationStocksMarch + a.achatsMatieres + a.variationStocksMat + a.autresAchats + a.servicesExt + a.impotsTaxes + a.chargesPersonnel + a.dotationsExploit + a.autresChargesExploit),
    },
    resultatExploitation: sig.rex,
    produitsFinanciers: r(a.produitsFinanciers), chargesFinancieres: r(a.chargesFinancieres), resultatFinancier: sig.rfin,
    resultatCourantAvantImpots: sig.rcai,
    produitsExcep: r(a.produitsExcep), chargesExcep: r(a.chargesExcep), resultatExceptionnel: sig.rexcep,
    participation: r(a.participation), is: r(a.is), resultatNet: sig.resultatNet,
  }
}

// ─── Bilan (résultat propre, découplé du CR) ─────────────────────
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
    actif: { actifImmoNet, stocksNets, creancesClients: creancesNettes, creancesEtat: r(a.creancesEtat), autresCreances: r(a.autresCreances), chargesConstatees: r(a.chargesConstatees), tresorerie: tresoActifNet, totalActif },
    passif: { capital: r(a.capital), reserves: r(a.reserves), reportNouveau: r(a.reportNouveau), resultatNet, capitauxPropres: capPropres, dettesLT, dettesCT, dettesFournisseurs: r(a.dettesFournisseurs), dettesSociales: r(a.dettesSociales), dettesFiscales: r(a.dettesFiscales), autresDettes: r(a.autresDettes), produitsConstates: r(a.produitsConstates), totalPassif },
  }
}

// ─── Gate dur ────────────────────────────────────────────────────
function buildGate(ecartFEC: number, regime: string, resultatCR: number, resultat12: number, comptesNonReconnus: number, ecartBilan: number) {
  const raisons: string[] = []
  const equilibreFEC = ecartFEC < 0.005
  if (!equilibreFEC) raisons.push(`FEC déséquilibré : débit ≠ crédit (écart ${r(ecartFEC)} €). Fichier corrompu ou tronqué.`)
  if (comptesNonReconnus > 0) raisons.push(`${comptesNonReconnus} compte(s) non classé(s) — certification impossible.`)
  // Réconciliation résultat : seulement contraignante en régime après affectation.
  let reconciliationOK = true
  if (regime === 'apres_affectation') {
    const ecartR = Math.abs(resultatCR - resultat12)
    reconciliationOK = ecartR < 1
    if (!reconciliationOK) raisons.push(`Résultat CR (${r(resultatCR)}) ≠ résultat comptable 12x (${r(resultat12)}), écart ${r(ecartR)} € > 1 €.`)
  }
  const passed = equilibreFEC && comptesNonReconnus === 0 && reconciliationOK
  return { passed, bloquant: !passed, raisons, equilibreFEC, reconciliationOK, ecartBilanInfo: r(ecartBilan) }
}

function normaliserDate(d: string){ return d.replace(/-/g, '') }
function filtrerParPeriode(lignes: LigneFEC[], dd: string, df: string){
  const a = normaliserDate(dd), b = normaliserDate(df)
  return lignes.filter(l => { if (!l.EcritureDate) return true; const d = normaliserDate(String(l.EcritureDate)); if (d.length !== 8) return true; return d >= a && d <= b })
}

// ─── Pipeline ────────────────────────────────────────────────────
function calculer(lignes: LigneFEC[], annee: number, dateDebut?: string, dateFin?: string) {
  const lignesFiltrees = (dateDebut && dateFin) ? filtrerParPeriode(lignes, dateDebut, dateFin) : lignes

  const { regime, ecrituresClotureNum } = detecterRegime(lignesFiltrees)
  // AN reprise de résultat : écriture du journal AN touchant un compte 11/12 (report/affectation).
  // Seules celles-ci justifient d'exclure les lignes 6/7 de l'AN (règle AN affinée).
  const anReprise = new Set<string>()
  {
    const anEc = new Map<string, { a67: boolean; res: boolean }>()
    for (const raw of lignesFiltrees) {
      const l = parseLigne(raw); if (!l || l.journal !== 'AN' || !l.ecritureNum) continue
      const k = `${l.journal}#${l.ecritureNum}`; let e = anEc.get(k); if (!e) { e = { a67: false, res: false }; anEc.set(k, e) }
      const cl = l.compteNum[0]; if (cl === '6' || cl === '7') e.a67 = true
      if (l.compteNum.startsWith('11') || l.compteNum.startsWith('12')) e.res = true
    }
    for (const [k, e] of anEc) if (e.a67 && e.res) anReprise.add(k)
  }
  const { balance, totalDebit, totalCredit, nbLignesAN67, nbLignes89, nbLignesCloture67 } = buildBalance(lignesFiltrees, ecrituresClotureNum, anReprise)
  const { aggregats, comptesNonReconnus, anomalies } = buildStatements(balance)

  // R2 — résultat comptable lu directement sur les comptes 12x (signe natif, bénéfice positif)
  let solde12 = 0
  for (const s of balance.values()) if (s.compteNum.startsWith('12')) solde12 += s.solde
  const resultat12 = r(-solde12)

  const sig   = buildSIG(aggregats)
  const cr    = buildCR(aggregats, sig)
  // En régime avant affectation, le résultat de l'exercice vit dans les 6/7 (R1) → capitaux propres.
  // En régime après affectation, il est déjà dans les 12x (R2).
  const resultatBilan = regime === 'apres_affectation' ? resultat12 : sig.resultatNet
  const bilan = buildBilan(aggregats, resultatBilan)

  // FIX B (audit 10/06/2026) — L'équilibre FEC est une propriété du FICHIER BRUT
  // (débit = crédit sur toutes les lignes), indépendante des exclusions analytiques
  // (classes 8/9, AN 6/7, OD de clôture). On l'évalue donc sur l'entrée brute, sinon une
  // exclusion légitime déclenche un faux « FEC déséquilibré ».
  let rawDebit = 0, rawCredit = 0
  for (const raw of lignesFiltrees) { const l = parseLigne(raw); if (!l) continue; rawDebit += l.debit; rawCredit += l.credit }
  const ecartFEC   = Math.abs(r(rawDebit) - r(rawCredit))
  const ecartBilan = Math.abs(bilan.actif.totalActif - bilan.passif.totalPassif)
  const gate = buildGate(ecartFEC, regime, sig.resultatNet, resultat12, comptesNonReconnus.length, ecartBilan)

  const controles = {
    regime, nbLignesAN67, nbLignes89, nbLignesCloture67,
    debitTotal: totalDebit, creditTotal: totalCredit, ecartFEC: r(ecartFEC), equilibreFEC: ecartFEC < 0.005,
    totalActif: bilan.actif.totalActif, totalPassif: bilan.passif.totalPassif, ecartBilan: r(ecartBilan),
    resultatCR: sig.resultatNet, resultat12, resultatBilan,
    comptesNonReconnus: comptesNonReconnus.slice(0, 30), comptesNonReconnusTotal: comptesNonReconnus.length,
    anomalies: anomalies.slice(0, 50), anomaliesTotal: anomalies.length,
  }
  const periode = (dateDebut && dateFin) ? { type: 'perso' as const, dateDebut, dateFin } : { type: 'exercice' as const, dateDebut: `${annee}-01-01`, dateFin: `${annee}-12-31` }
  return { annee, periode, regime, gate, controles, sig, cr, bilan }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const annee = parseInt(searchParams.get('annee') || '0')
  const userId = searchParams.get('user_id') || ''
  const dateDebut = searchParams.get('dateDebut') || ''
  const dateFin = searchParams.get('dateFin') || ''
  if (!annee || !userId) return NextResponse.json({ erreur: 'annee et user_id requis' }, { status: 400 })
  if (annee < 2000 || annee > 2030) return NextResponse.json({ erreur: 'annee invalide (2000–2030)' }, { status: 400 })
  if ((dateDebut && !dateFin) || (!dateDebut && dateFin)) return NextResponse.json({ erreur: 'dateDebut et dateFin doivent être fournis ensemble' }, { status: 400 })
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await admin.from('fec_exercices').select('ecritures').eq('user_id', userId).eq('annee', annee).single()
  if (error || !data) return NextResponse.json({ erreur: 'FEC introuvable' }, { status: 404 })
  try {
    const ecritures = data.ecritures
    if (!Array.isArray(ecritures) || ecritures.length === 0) return NextResponse.json({ erreur: 'FEC vide ou invalide' }, { status: 422 })
    return NextResponse.json(calculer(ecritures as LigneFEC[], annee, dateDebut || undefined, dateFin || undefined))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne du moteur comptable'
    return NextResponse.json({ erreur: message }, { status: 500 })
  }
}
