// ALVIO — Moteur comptable v6
// Source de vérité unique : @/lib/pcg-reference
// v6 (10 juin 2026) — Refonte du SIGNE : lecture native du FEC, jamais d'absolutisation.
//   • Corrige le CA/SIG faussés par les comptes à contre-sens (709 RRR, 603/713 variations).
//   • Subventions d'exploitation (74) à l'EBE (et non en VA) — règle CNOEC / Valentin.
//   • Détection de régime (avant/après affectation) et découplage CR → Bilan.
//   • Gate dur : équilibre FEC strict 0,00 + réconciliation résultat. Bloque SIG/IA si KO.
// Validé au centime contre Pennylane sur BONVARLET, CARGONAUTES, PATHTECH.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyCompte, getDestinationEffective, type Destination } from '@/lib/pcg-reference'
import { computeHealthMetrics, type FecLine } from '@/lib/health-metrics'

interface LigneFEC {
  CompteNum: string; CompteLib?: string; Debit: number | string; Credit: number | string
  JournalCode?: string; EcritureNum?: string; EcritureDate?: string; EcritureLib?: string; PieceRef?: string
}
interface SoldeCompte { compteNum: string; compteLib: string; debit: number; credit: number; solde: number }
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
  }
}

// ─── Détection de régime (avant / après affectation) ─────────────
// Signal : une écriture qui solde les classes 6/7 contre un compte 12x dans
// le même mouvement (OD de clôture / OD_AFF). On la DÉTECTE, on ne la masque pas.
function detecterRegime(lignes: LigneFEC[]): { regime: 'avant_affectation' | 'apres_affectation'; ecrituresClotureNum: Set<string> } {
  const parEcriture = new Map<string, Set<string>>() // ecritureNum -> classes touchées
  for (const raw of lignes) {
    const l = parseLigne(raw)
    if (!l || !l.ecritureNum) continue
    const classe = l.compteNum[0]
    const key = `${l.journal}#${l.ecritureNum}`
    if (!parEcriture.has(key)) parEcriture.set(key, new Set())
    if (classe === '6' || classe === '7') parEcriture.get(key)!.add('gestion')
    if (l.compteNum.startsWith('12')) parEcriture.get(key)!.add('resultat12')
  }
  const ecrituresClotureNum = new Set<string>()
  for (const [key, classes] of parEcriture) if (classes.has('gestion') && classes.has('resultat12')) ecrituresClotureNum.add(key)
  return { regime: ecrituresClotureNum.size > 0 ? 'apres_affectation' : 'avant_affectation', ecrituresClotureNum }
}

// ─── Balance ─────────────────────────────────────────────────────
// L3 (Valentin) : AN exclu des classes 6/7 ; classes 8/9 ignorées ;
// en régime "après affectation", les OD de solde 6/7 sont exclues du calcul de R1.
function buildBalance(lignes: LigneFEC[], ecrituresCloture: Set<string>) {
  const balance: Balance = new Map()
  let totalDebit = 0, totalCredit = 0, nbLignesAN67 = 0, nbLignes89 = 0, nbLignesCloture67 = 0
  for (const raw of lignes) {
    const l = parseLigne(raw)
    if (!l) continue
    const classe = l.compteNum[0]
    if (classe === '8' || classe === '9') { nbLignes89++; continue }
    if (l.journal === 'AN' && (classe === '6' || classe === '7')) { nbLignesAN67++; continue }
    // Régime après affectation : neutraliser les écritures de solde 6/7 pour reconstruire R1
    if ((classe === '6' || classe === '7') && ecrituresCloture.has(`${l.journal}#${l.ecritureNum}`)) { nbLignesCloture67++; continue }
    totalDebit += l.debit; totalCredit += l.credit
    const ex = balance.get(l.compteNum)
    if (ex) { ex.debit += l.debit; ex.credit += l.credit; ex.solde = ex.debit - ex.credit; if (!ex.compteLib && l.compteLib) ex.compteLib = l.compteLib }
    else balance.set(l.compteNum, { compteNum: l.compteNum, compteLib: l.compteLib, debit: l.debit, credit: l.credit, solde: l.debit - l.credit })
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

function buildStatements(balance: Balance) {
  const agg = {} as Aggregats
  for (const d of DESTINATIONS) agg[d] = 0
  const comptesNonReconnus: string[] = []
  const anomaliesPlan: string[] = []
  const DEPREC_DESTS = new Set<Destination>(['amortIncorp','amortCorp','deprecImmoFin','deprecStocks','deprecCreances','deprecTreso'])
  for (const compte of balance.values()) {
    if (Math.abs(compte.solde) < 0.01) continue
    const rule = classifyCompte(compte.compteNum)
    if (!rule) { comptesNonReconnus.push(`${compte.compteNum} (${compte.compteLib || '?'}) solde=${compte.solde}`); continue }
    let { destination, valeur } = getDestinationEffective(compte.compteNum, compte.solde, rule)
    // Anomalie de plan comptable : compte courant d'associé/groupe logé sur un numéro
    // PCG réservé aux dépréciations. On suit la NATURE (libellé + sens), pas le numéro.
    // Un vrai compte de dépréciation porte le mot « dépréciation/provision » au libellé → exclu.
    const lib = (compte.compteLib || '').toLowerCase()
    if (DEPREC_DESTS.has(destination)
        && /(courant|associ|groupe)/.test(lib)
        && !/(d[eé]pr[eé]ciation|provision|amort)/.test(lib)) {
      const cible: Destination = compte.solde < 0 ? 'autresDettes' : 'autresCreances'
      valeur = cible === 'autresCreances' ? compte.solde : -compte.solde
      anomaliesPlan.push(`${compte.compteNum} « ${compte.compteLib} » : numéro de dépréciation mais libellé de compte courant — reclassé en ${cible} (solde ${compte.solde}). À valider par l'expert-comptable.`)
      destination = cible
    }
    agg[destination] += valeur
  }
  for (const d of DESTINATIONS) agg[d] = r(agg[d])
  agg['chargesPersonnel'] = r(agg['chargesPersonnel'] - agg['remboursementsPers'])
  return { aggregats: agg, comptesNonReconnus, anomaliesPlan }
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
    passif: { capital: r(a.capital), reserves: r(a.reserves), reportNouveau: r(a.reportNouveau), resultatNet, capitauxPropres: capPropres, dettesLT, dettesCT, dettesFournisseurs: r(a.dettesFournisseurs), dettesSociales: r(a.dettesSociales), dettesFiscales: r(a.dettesFiscales), autresDettes: r(a.autresDettes), totalPassif },
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

// ─── Agrégats dashboard (vivant) ─────────────────────────────────
// Mensuel : produits (classe 7) et charges (classe 6) par mois, signe natif
// (produit = crédit − débit, charge = débit − crédit), cohérent avec le moteur v6.
// On réutilise EXACTEMENT les exclusions de la balance (AN 6/7, 8/9, OD de clôture)
// pour ne jamais double-compter le résultat.
const MOIS_LABELS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']
function buildMensuel(lignes: LigneFEC[], ecrituresCloture: Set<string>) {
  const prod = new Array(12).fill(0)
  const chg = new Array(12).fill(0)
  for (const raw of lignes) {
    const l = parseLigne(raw)
    if (!l) continue
    const classe = l.compteNum[0]
    if (classe !== '6' && classe !== '7') continue
    if (l.journal === 'AN') continue
    if (ecrituresCloture.has(`${l.journal}#${l.ecritureNum}`)) continue
    const d = normaliserDate(String(raw.EcritureDate || ''))
    if (d.length !== 8) continue
    const m = parseInt(d.slice(4, 6), 10) - 1
    if (m < 0 || m > 11) continue
    if (classe === '7') prod[m] += l.credit - l.debit
    else chg[m] += l.debit - l.credit
  }
  return MOIS_LABELS.map((label, i) => ({ mois: i + 1, label, produits: r(prod[i]), charges: r(chg[i]) }))
}

// Réordonne les 12 mois pour que l'axe commence au mois d'ouverture de l'exercice (et non janvier).
function orienterMensuel(mois: ReturnType<typeof buildMensuel>, exDebut: string): ReturnType<typeof buildMensuel> {
  const m0 = parseInt((exDebut || '').slice(5, 7), 10) - 1
  if (isNaN(m0) || m0 <= 0 || m0 > 11) return mois  // janvier ou invalide → ordre civil
  return [...mois.slice(m0), ...mois.slice(0, m0)]
}

// Ventilation des charges par nature — branchée sur les agrégats du moteur
// (classification PCG via @/lib/pcg-reference). Aucun préfixe en dur.
// Les variations de stocks sont nettées dans « Achats consommés ». Buckets négatifs
// (ex. variation de stock favorable) ramenés à 0 pour le donut.
function buildChargesParNature(a: Aggregats) {
  const buckets = [
    { key: 'achats',         label: 'Achats consommés',           montant: a.achatsMarchandises + a.variationStocksMarch + a.achatsMatieres + a.variationStocksMat + a.autresAchats },
    { key: 'externes',       label: 'Charges externes',           montant: a.servicesExt },
    { key: 'personnel',      label: 'Charges de personnel',       montant: a.chargesPersonnel },
    { key: 'impots',         label: 'Impôts & taxes',             montant: a.impotsTaxes },
    { key: 'dotations',      label: 'Dotations & amortissements', montant: a.dotationsExploit + a.dotationsFin + a.dotationsExcep },
    { key: 'financieres',    label: 'Charges financières',        montant: a.chargesFinancieres },
    { key: 'autres',         label: 'Autres charges',             montant: a.autresChargesExploit + a.chargesExcep + a.vncActifsCedes },
    { key: 'impotBenefices', label: 'Impôt sur les bénéfices',    montant: a.participation + a.is },
  ]
  return buckets
    .map(b => ({ key: b.key, label: b.label, montant: r(Math.max(0, b.montant)) }))
    .filter(b => b.montant > 0)
    .sort((x, y) => y.montant - x.montant)
}

// ─── Pipeline ────────────────────────────────────────────────────
function calculer(lignes: LigneFEC[], annee: number, dateDebut?: string, dateFin?: string, exDebut?: string | null, exFin?: string | null) {
  const lignesFiltrees = (dateDebut && dateFin) ? filtrerParPeriode(lignes, dateDebut, dateFin) : lignes

  const { regime, ecrituresClotureNum } = detecterRegime(lignesFiltrees)
  const { balance, totalDebit, totalCredit, nbLignesAN67, nbLignes89, nbLignesCloture67 } = buildBalance(lignesFiltrees, ecrituresClotureNum)
  const { aggregats, comptesNonReconnus, anomaliesPlan } = buildStatements(balance)

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

  const ecartFEC   = Math.abs(totalDebit - totalCredit)
  const ecartBilan = Math.abs(bilan.actif.totalActif - bilan.passif.totalPassif)
  const gate = buildGate(ecartFEC, regime, sig.resultatNet, resultat12, comptesNonReconnus.length, ecartBilan)

  const controles = {
    regime, nbLignesAN67, nbLignes89, nbLignesCloture67,
    debitTotal: totalDebit, creditTotal: totalCredit, ecartFEC: r(ecartFEC), equilibreFEC: ecartFEC < 0.005,
    totalActif: bilan.actif.totalActif, totalPassif: bilan.passif.totalPassif, ecartBilan: r(ecartBilan),
    resultatCR: sig.resultatNet, resultat12, resultatBilan,
    comptesNonReconnus: comptesNonReconnus.slice(0, 30), comptesNonReconnusTotal: comptesNonReconnus.length,
    anomaliesPlan, anomaliesPlanTotal: anomaliesPlan.length,
  }
  // Bornes réelles de l'exercice (date_debut / date_fin) ; repli année civile si dates absentes (ligne pas encore ré-importée).
  const exoDebut = exDebut || `${annee}-01-01`
  const exoFin   = exFin   || `${annee}-12-31`
  const periode = (dateDebut && dateFin) ? { type: 'perso' as const, dateDebut, dateFin } : { type: 'exercice' as const, dateDebut: exoDebut, dateFin: exoFin }

  // Santé financière — calculée sur les écritures brutes (détail ligne par ligne),
  // pas sur la balance agrégée : l'aging par tiers a besoin de CompAuxNum + EcritureDate.
  // Fonction pure, dégradation gracieuse (jamais de NaN). N'altère aucun calcul existant.
  const sante = computeHealthMetrics(lignesFiltrees as unknown as FecLine[], {
    exerciceDebut: periode.dateDebut,
    dateReference: periode.type === 'perso' ? periode.dateFin : undefined,
    tresorerieFinExercice: bilan.actif.tresorerie,
  })

  // Mensuel calé sur l'ouverture de l'exercice (1er mois = mois de date_debut), pas forcément janvier.
  const mensuel = orienterMensuel(buildMensuel(lignesFiltrees, ecrituresClotureNum), exoDebut)
  const chargesParNature = buildChargesParNature(aggregats)

  return { annee, periode, regime, gate, controles, sig, cr, bilan, sante, mensuel, chargesParNature }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const annee = parseInt(searchParams.get('annee') || '0')
  const companyId = searchParams.get('company_id') || ''
  const dateDebut = searchParams.get('dateDebut') || ''
  const dateFin = searchParams.get('dateFin') || ''
  if (!annee || !companyId) return NextResponse.json({ erreur: 'annee et company_id requis' }, { status: 400 })
  if (annee < 2000 || annee > 2030) return NextResponse.json({ erreur: 'annee invalide (2000–2030)' }, { status: 400 })
  if ((dateDebut && !dateFin) || (!dateDebut && dateFin)) return NextResponse.json({ erreur: 'dateDebut et dateFin doivent être fournis ensemble' }, { status: 400 })

  // Client authentifié : la session vient des cookies, les RLS s'appliquent.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  // RLS : cette lecture ne renvoie la ligne QUE si le dossier appartient à l'utilisateur.
  // Un company_id falsifié → aucune ligne → 404. Isolation garantie par la base.
  const { data, error } = await supabase.from('fec_exercices').select('ecritures, date_debut, date_fin').eq('company_id', companyId).eq('annee', annee).single()
  if (error || !data) return NextResponse.json({ erreur: 'FEC introuvable' }, { status: 404 })
  try {
    const ecritures = data.ecritures
    if (!Array.isArray(ecritures) || ecritures.length === 0) return NextResponse.json({ erreur: 'FEC vide ou invalide' }, { status: 422 })
    return NextResponse.json(calculer(ecritures as LigneFEC[], annee, dateDebut || undefined, dateFin || undefined, data.date_debut ?? null, data.date_fin ?? null))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne du moteur comptable'
    return NextResponse.json({ erreur: message }, { status: 500 })
  }
}
