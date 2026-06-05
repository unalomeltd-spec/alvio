import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// ALVIO — Moteur comptable v3
// Architecture : FEC → Balance → CR + Bilan → SIG
//
// Étape 1 : parseFEC        — normalisation des lignes brutes
// Étape 2 : buildBalance    — solde par compte (vérité unique)
// Étape 3 : classifyBalance — classification PCG hiérarchique
// Étape 4 : buildStatements — CR + Bilan depuis la balance
// Étape 5 : buildSIG        — SIG depuis le CR validé
// Étape 6 : controls        — invariants comptables
//
// Règles :
// - Journal AN exclu des classes 6 et 7 (charges/produits N-1)
// - Classification par préfixe le plus long disponible
// - Zéro dépendance externe — moteur 100% déterministe
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

interface LigneNormalisee {
  compteNum: string
  compteLib: string
  debit: number
  credit: number
  journal: string
}

interface SoldeCompte {
  compteNum: string
  compteLib: string
  debit: number    // total mouvements débiteurs
  credit: number   // total mouvements créditeurs
  solde: number    // debit - credit (positif = débiteur)
}

type Balance = Map<string, SoldeCompte>

// Destination comptable d'un compte dans les états financiers
type Destination =
  // CR — Produits exploitation
  | 'ventesMarchandises'
  | 'productionVendue'
  | 'productionStockee'
  | 'productionImmobilisee'
  | 'subventionsExploit'
  | 'autresProduits'
  | 'reprises'
  | 'transfertsCharges'
  // CR — Charges exploitation
  | 'achatsMarchandises'
  | 'variationStocksMarch'
  | 'achatsMatieres'
  | 'variationStocksMat'
  | 'autresAchats'
  | 'servicesExt'
  | 'impotsTaxes'
  | 'chargesPersonnel'
  | 'remboursementsPers'
  | 'dotationsExploit'
  | 'autresChargesExploit'
  // CR — Financier
  | 'produitsFinanciers'
  | 'reprisesFin'
  | 'chargesFinancieres'
  | 'dotationsFin'
  // CR — Exceptionnel
  | 'produitsExcep'
  | 'reprisesExcep'
  | 'prixCession'
  | 'chargesExcep'
  | 'dotationsExcep'
  | 'vncActifsCedes'
  // CR — Résultat
  | 'participation'
  | 'is'
  // Bilan Actif
  | 'immoIncorpBrut'
  | 'immoCorpBrut'
  | 'immoFinBrut'
  | 'amortIncorp'
  | 'amortCorp'
  | 'deprecImmoFin'
  | 'stocksMarchandises'
  | 'stocksMatieres'
  | 'stocksEncours'
  | 'stocksProduits'
  | 'deprecStocks'
  | 'creancesClients'
  | 'deprecCreances'
  | 'creancesEtat'
  | 'autresCreances'
  | 'chargesConstatees'
  | 'tresorerieActif'
  | 'deprecTreso'
  | 'capitalNonAppele'
  // Bilan Passif
  | 'capital'
  | 'primes'
  | 'ecarts'
  | 'reserves'
  | 'reportNouveau'
  | 'subventionsInvest'
  | 'provisionsReglementees'
  | 'provisionsRisques'
  | 'empruntsOblig'
  | 'empruntsEtablissement'
  | 'autresEmpruntsLT'
  | 'dettesFournisseurs'
  | 'dettesSociales'
  | 'dettesFiscales'
  | 'autresDettes'
  | 'produitsConstates'
  | 'tresoreriePassif'

interface ClassificationResult {
  destination: Destination
  // Signe d'application : +1 ou -1
  // Définit comment le solde du compte contribue à l'agrégat
  // +1 : solde débiteur augmente l'agrégat (charges, actif)
  // -1 : solde créditeur augmente l'agrégat (produits, passif)
  sens: 1 | -1
}

// ─── Étape 1 : Normalisation ─────────────────────────────────

function parseLigne(l: LigneFEC): LigneNormalisee | null {
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

// ─── Étape 2 : Balance générale ──────────────────────────────
// La balance est la seule vérité intermédiaire.
// Chaque compte a un solde unique, calculé depuis toutes ses écritures.
// L'exclusion AN classes 6/7 est appliquée ici, à la source.

function buildBalance(lignes: LigneFEC[]): {
  balance: Balance
  totalDebit: number
  totalCredit: number
  nbLignes: number
  nbLignesAN67: number
} {
  const balance: Balance = new Map()
  let totalDebit = 0
  let totalCredit = 0
  let nbLignesAN67 = 0

  for (const raw of lignes) {
    const l = parseLigne(raw)
    if (!l) continue

    totalDebit  += l.debit
    totalCredit += l.credit

    // Exclusion AN classes 6 et 7
    // Les à-nouveaux de charges/produits ne font pas partie du résultat N
    if (l.journal === 'AN' && (l.compteNum[0] === '6' || l.compteNum[0] === '7')) {
      nbLignesAN67++
      continue
    }

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

  // Arrondi final des soldes
  for (const s of balance.values()) {
    s.debit  = Math.round(s.debit  * 100) / 100
    s.credit = Math.round(s.credit * 100) / 100
    s.solde  = Math.round(s.solde  * 100) / 100
  }

  return {
    balance,
    totalDebit:  Math.round(totalDebit  * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    nbLignes: lignes.length,
    nbLignesAN67,
  }
}

// ─── Étape 3 : Classification PCG ────────────────────────────
// Classification hiérarchique : préfixe le plus long en premier.
// Exhaustive : tout compte PCG français est couvert.
// Déterministe : une règle et une seule par compte.

function classifyCompte(compteNum: string): ClassificationResult | null {
  const c1 = compteNum[0]
  const c2 = compteNum.slice(0, 2)
  const c3 = compteNum.slice(0, 3)
  const c4 = compteNum.slice(0, 4)

  // ── CLASSE 1 — Capitaux ──────────────────────────────────
  if (c1 === '1') {
    if (c3 === '109') return { destination: 'capitalNonAppele',       sens:  1 }
    if (c3 === '101' || c3 === '102' || c3 === '103' || c3 === '108')
                       return { destination: 'capital',               sens: -1 }
    if (c3 === '104') return { destination: 'primes',                 sens: -1 }
    if (c3 === '105') return { destination: 'ecarts',                 sens: -1 }
    if (c3 === '106' || c3 === '107')
                       return { destination: 'reserves',              sens: -1 }
    if (c2 === '10')   return { destination: 'reserves',              sens: -1 } // 108x divers
    if (c2 === '11' || c2 === '12')
                       return { destination: 'reportNouveau',         sens: -1 }
    if (c2 === '13')   return { destination: 'subventionsInvest',     sens: -1 }
    if (c2 === '14')   return { destination: 'provisionsReglementees',sens: -1 }
    if (c2 === '15')   return { destination: 'provisionsRisques',     sens: -1 }
    if (c3 === '161' || c3 === '163')
                       return { destination: 'empruntsOblig',         sens: -1 }
    if (c3 === '164')  return { destination: 'empruntsEtablissement', sens: -1 }
    if (c1 === '1')    return { destination: 'autresEmpruntsLT',      sens: -1 }
  }

  // ── CLASSE 2 — Immobilisations ───────────────────────────
  if (c1 === '2') {
    if (c2 === '20')   return { destination: 'immoIncorpBrut',  sens:  1 }
    if (c2 === '21' || c2 === '22' || c2 === '23' || c2 === '24' || c2 === '25')
                       return { destination: 'immoCorpBrut',    sens:  1 }
    if (c2 === '26' || c2 === '27')
                       return { destination: 'immoFinBrut',     sens:  1 }
    if (c3 === '280')  return { destination: 'amortIncorp',     sens: -1 }
    if (c2 === '28')   return { destination: 'amortCorp',       sens: -1 }
    if (c3 === '296' || c3 === '297')
                       return { destination: 'deprecImmoFin',   sens: -1 }
    if (c2 === '29')   return { destination: 'amortCorp',       sens: -1 } // dépréciations immo corp
  }

  // ── CLASSE 3 — Stocks ────────────────────────────────────
  if (c1 === '3') {
    if (c2 === '39')   return { destination: 'deprecStocks',       sens: -1 }
    if (c2 === '30' || c2 === '36' || c2 === '37')
                       return { destination: 'stocksMarchandises',  sens:  1 }
    if (c2 === '31' || c2 === '32')
                       return { destination: 'stocksMatieres',      sens:  1 }
    if (c2 === '33' || c2 === '34')
                       return { destination: 'stocksEncours',       sens:  1 }
    if (c2 === '35')   return { destination: 'stocksProduits',      sens:  1 }
    if (c2 === '38')   return { destination: 'stocksMarchandises',  sens:  1 } // stocks en transit
  }

  // ── CLASSE 4 — Tiers ─────────────────────────────────────
  if (c1 === '4') {
    if (c3 === '409')  return { destination: 'autresCreances',      sens:  1 } // fournisseurs débiteurs
    if (c2 === '40')   return { destination: 'dettesFournisseurs',  sens: -1 }
    if (c3 === '419')  return { destination: 'autresDettes',        sens: -1 } // clients créditeurs
    if (c2 === '41')   return { destination: 'creancesClients',     sens:  1 }
    if (c2 === '49')   return { destination: 'deprecCreances',      sens: -1 }
    if (c2 === '42' || c2 === '43')
                       return { destination: 'dettesSociales',      sens: -1 }
    // Comptes 44 — État : distinguer créances et dettes
    if (c3 === '441' || c3 === '442' || c3 === '443' || c3 === '444' || c3 === '449')
                       return { destination: 'creancesEtat',        sens:  1 }
    if (c4 === '4452' || c4 === '4453' || c4 === '4454' || c4 === '4455')
                       return { destination: 'dettesFiscales',      sens: -1 } // TVA collectée, due
    if (c4 === '4456' || c4 === '4457' || c4 === '4458' || c4 === '4459')
                       return { destination: 'creancesEtat',        sens:  1 } // TVA déductible, crédit
    if (c3 === '445')  return { destination: 'dettesFiscales',      sens: -1 } // 445x non couverts → dette par défaut
    if (c3 === '447' || c3 === '448')
                       return { destination: 'dettesFiscales',      sens: -1 }
    if (c3 === '446')  return { destination: 'dettesFiscales',      sens: -1 }
    if (c2 === '44')   return { destination: 'dettesFiscales',      sens: -1 }
    if (c3 === '486')  return { destination: 'chargesConstatees',   sens:  1 }
    if (c3 === '487')  return { destination: 'produitsConstates',   sens: -1 }
    if (c2 === '45' || c2 === '46' || c2 === '47' || c2 === '48')
                       return { destination: 'autresCreances',      sens:  1 } // traitement par solde dans buildStatements
  }

  // ── CLASSE 5 — Trésorerie ────────────────────────────────
  if (c1 === '5') {
    if (c3 === '519')  return { destination: 'tresoreriePassif',  sens: -1 } // concours bancaires courants
    if (c2 === '59')   return { destination: 'deprecTreso',       sens: -1 }
    if (c1 === '5')    return { destination: 'tresorerieActif',   sens:  1 }
  }

  // ── CLASSE 6 — Charges ───────────────────────────────────
  if (c1 === '6') {
    // 60 — Achats
    if (c3 === '609')  return { destination: 'achatsMarchandises',  sens: -1 } // RRR obtenus sur marchandises
    if (c3 === '607')  return { destination: 'achatsMarchandises',  sens:  1 }
    if (c3 === '603')  return { destination: 'variationStocksMarch',sens:  1 } // variation stocks marchandises
    if (c3 === '604' || c3 === '605' || c3 === '606' || c3 === '608')
                       return { destination: 'autresAchats',        sens:  1 } // autres achats non stockés
    if (c3 === '601' || c3 === '602')
                       return { destination: 'achatsMatieres',      sens:  1 }
    if (c3 === '600')  return { destination: 'achatsMatieres',      sens:  1 } // achats divers classe 60
    if (c2 === '60')   return { destination: 'autresAchats',        sens:  1 }
    // 61/62 — Services extérieurs
    if (c2 === '61' || c2 === '62')
                       return { destination: 'servicesExt',         sens:  1 }
    // 63 — Impôts et taxes
    if (c2 === '63')   return { destination: 'impotsTaxes',         sens:  1 }
    // 64 — Charges de personnel
    if (c3 === '649')  return { destination: 'remboursementsPers',  sens:  1 } // remboursements → déduits
    if (c2 === '64')   return { destination: 'chargesPersonnel',    sens:  1 }
    // 65 — Autres charges
    if (c2 === '65')   return { destination: 'autresChargesExploit',sens:  1 }
    // 66 — Charges financières
    if (c2 === '66')   return { destination: 'chargesFinancieres',  sens:  1 }
    // 67 — Charges exceptionnelles
    if (c3 === '675')  return { destination: 'vncActifsCedes',      sens:  1 } // VNC actifs cédés
    if (c2 === '67')   return { destination: 'chargesExcep',        sens:  1 }
    // 68 — Dotations
    if (c3 === '686')  return { destination: 'dotationsFin',        sens:  1 }
    if (c3 === '687')  return { destination: 'dotationsExcep',      sens:  1 }
    if (c2 === '68')   return { destination: 'dotationsExploit',    sens:  1 }
    // 69 — IS et participation
    if (c3 === '691')  return { destination: 'participation',       sens:  1 }
    if (c2 === '69')   return { destination: 'is',                  sens:  1 }
  }

  // ── CLASSE 7 — Produits ──────────────────────────────────
  if (c1 === '7') {
    // 70 — Ventes et production vendue
    if (c3 === '709')  return { destination: 'ventesMarchandises',    sens:  1 } // RRR accordés (réduisent les ventes)
    if (c3 === '707')  return { destination: 'ventesMarchandises',    sens: -1 }
    if (c3 === '708')  return { destination: 'autresProduits',        sens: -1 } // produits accessoires
    if (c2 === '70')   return { destination: 'productionVendue',      sens: -1 } // 701→706 : production vendue
    // 71 — Production stockée
    if (c2 === '71')   return { destination: 'productionStockee',     sens: -1 }
    // 72 — Production immobilisée
    if (c2 === '72')   return { destination: 'productionImmobilisee', sens: -1 }
    // 73 — Produits nets partiels / production vendue
    if (c2 === '73')   return { destination: 'productionVendue',      sens: -1 }
    // 74 — Subventions d'exploitation
    if (c2 === '74')   return { destination: 'subventionsExploit',    sens: -1 }
    // 75 — Autres produits de gestion courante
    if (c2 === '75')   return { destination: 'autresProduits',        sens: -1 }
    // 76 — Produits financiers
    if (c2 === '76')   return { destination: 'produitsFinanciers',    sens: -1 }
    // 77 — Produits exceptionnels
    if (c3 === '775')  return { destination: 'prixCession',           sens: -1 } // produits cessions actifs
    if (c3 === '777')  return { destination: 'autresProduits',        sens: -1 } // quote-part subventions virée au résultat
    if (c2 === '77')   return { destination: 'produitsExcep',         sens: -1 }
    // 78 — Reprises sur dépréciations et provisions
    if (c3 === '786')  return { destination: 'reprisesFin',           sens: -1 }
    if (c3 === '787')  return { destination: 'reprisesExcep',         sens: -1 }
    if (c2 === '78')   return { destination: 'reprises',              sens: -1 }
    // 79 — Transferts de charges
    if (c2 === '79')   return { destination: 'transfertsCharges',     sens: -1 }
  }

  // Compte non reconnu — ne doit pas arriver avec un FEC PCG conforme
  return null
}

// ─── Étape 4 : Construction des états depuis la balance ──────

type Aggregats = Record<Destination, number>

function buildStatements(balance: Balance): Aggregats {
  const agg = {} as Aggregats

  // Initialisation à zéro
  const destinations: Destination[] = [
    'ventesMarchandises','productionVendue','productionStockee','productionImmobilisee',
    'subventionsExploit','autresProduits','reprises','transfertsCharges',
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
    'capital','primes','ecarts','reserves','reportNouveau','subventionsInvest',
    'provisionsReglementees','provisionsRisques',
    'empruntsOblig','empruntsEtablissement','autresEmpruntsLT',
    'dettesFournisseurs','dettesSociales','dettesFiscales','autresDettes',
    'produitsConstates','tresoreriePassif',
  ]
  for (const d of destinations) agg[d] = 0

  for (const compte of balance.values()) {
    const classification = classifyCompte(compte.compteNum)
    if (!classification) continue

    const { destination, sens } = classification

    // Pour les comptes 45/46/47/48 (hors 486/487), le sens réel dépend du solde
    // Un compte débiteur → créance, un compte créditeur → dette
    if (
      destination === 'autresCreances' &&
      (compte.compteNum.slice(0,2) === '45' ||
       compte.compteNum.slice(0,2) === '46' ||
       compte.compteNum.slice(0,2) === '47' ||
       (compte.compteNum.slice(0,2) === '48' &&
        compte.compteNum.slice(0,3) !== '486' &&
        compte.compteNum.slice(0,3) !== '487'))
    ) {
      if (compte.solde >= 0) {
        agg['autresCreances'] += compte.solde
      } else {
        agg['autresDettes'] += (-compte.solde)
      }
      continue
    }

    // Contribution = solde × sens
    // sens  1 : solde débiteur (d-c > 0) augmente l'agrégat
    // sens -1 : solde créditeur (c-d > 0, solde < 0) augmente l'agrégat
    agg[destination] += compte.solde * sens
  }

  // Arrondi final
  for (const d of destinations) {
    agg[d] = Math.round(agg[d] * 100) / 100
  }

  // Charges personnel nettes (649 déduit)
  agg['chargesPersonnel'] = Math.round((agg['chargesPersonnel'] - agg['remboursementsPers']) * 100) / 100

  return agg
}

// ─── Étape 5 : SIG, CR, Bilan ────────────────────────────────

function r(n: number): number { return Math.round(n * 100) / 100 }

function buildSIG(a: Aggregats) {
  const coutMarchandises   = r(a.achatsMarchandises + a.variationStocksMarch)
  const margeCommerciale   = r(a.ventesMarchandises - coutMarchandises)
  const prodExercice       = r(a.productionVendue + a.productionStockee + a.productionImmobilisee)
  const cosoIntermediaires = r(a.achatsMatieres + a.variationStocksMat + a.autresAchats + a.servicesExt)
  const valeurAjoutee      = r(margeCommerciale + prodExercice - cosoIntermediaires)
  const ebe                = r(valeurAjoutee + a.subventionsExploit - a.impotsTaxes - a.chargesPersonnel)
  const rex                = r(ebe - a.dotationsExploit + a.reprises + a.autresProduits + a.transfertsCharges - a.autresChargesExploit)
  const rfin               = r(a.produitsFinanciers + a.reprisesFin - a.chargesFinancieres - a.dotationsFin)
  const rexcep             = r(a.produitsExcep + a.reprisesExcep + a.prixCession - a.chargesExcep - a.dotationsExcep - a.vncActifsCedes)
  const rnetCR             = r(rex + rfin + rexcep - a.participation - a.is)
  const ca                 = r(a.ventesMarchandises + a.productionVendue)

  return {
    ca,
    ventesMarchandises:    r(a.ventesMarchandises),
    coutMarchandises,
    margeCommerciale,
    productionVendue:      r(a.productionVendue),
    productionStockee:     r(a.productionStockee),
    productionImmobilisee: r(a.productionImmobilisee),
    productionExercice:    prodExercice,
    consommationsInt:      cosoIntermediaires,
    subventions:           r(a.subventionsExploit),
    valeurAjoutee,
    impotsTaxes:           r(a.impotsTaxes),
    chargesPersonnel:      r(a.chargesPersonnel),
    ebe,
    dotations:             r(a.dotationsExploit),
    reprises:              r(a.reprises),
    autresProduits:        r(a.autresProduits),
    autresCharges:         r(a.autresChargesExploit),
    rex,
    produitsFinanciers:    r(a.produitsFinanciers),
    chargesFinancieres:    r(a.chargesFinancieres),
    rfin,
    produitsExcep:         r(a.produitsExcep),
    chargesExcep:          r(a.chargesExcep),
    rexcep,
    participation:         r(a.participation),
    is:                    r(a.is),
    resultatNet:           rnetCR,
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
      ventesMarchandises:    r(a.ventesMarchandises),
      productionVendue:      r(a.productionVendue),
      productionStockee:     r(a.productionStockee),
      productionImmobilisee: r(a.productionImmobilisee),
      subventions:           r(a.subventionsExploit),
      autresProduits:        r(a.autresProduits),
      reprises:              r(a.reprises),
      transfertsCharges:     r(a.transfertsCharges),
      total: r(
        a.ventesMarchandises + a.productionVendue + a.productionStockee +
        a.productionImmobilisee + a.subventionsExploit + a.autresProduits +
        a.reprises + a.transfertsCharges
      ),
    },
    chargesExploitation: {
      achatsMarchandises:  r(a.achatsMarchandises),
      variationStocksMarch:r(a.variationStocksMarch),
      achatsMatieres:      r(a.achatsMatieres),
      variationStocksMat:  r(a.variationStocksMat),
      autresAchats:        r(a.autresAchats),
      servicesExt:         r(a.servicesExt),
      impotsTaxes:         r(a.impotsTaxes),
      chargesPersonnel:    r(a.chargesPersonnel),
      dotations:           r(a.dotationsExploit),
      autresCharges:       r(a.autresChargesExploit),
      total: r(
        sig.coutMarchandises + a.achatsMatieres + a.variationStocksMat +
        a.autresAchats + a.servicesExt + a.impotsTaxes + a.chargesPersonnel +
        a.dotationsExploit + a.autresChargesExploit
      ),
    },
    resultatExploitation: sig.rex,
    produitsFinanciers:   r(a.produitsFinanciers),
    chargesFinancieres:   r(a.chargesFinancieres),
    resultatFinancier:    sig.rfin,
    produitsExcep:        r(a.produitsExcep),
    chargesExcep:         r(a.chargesExcep),
    resultatExceptionnel: sig.rexcep,
    participation:        r(a.participation),
    is:                   r(a.is),
    resultatNet:          sig.resultatNet,
  }
}

function buildBilan(a: Aggregats, resultatNet: number) {
  const actifImmoNet = r(
    (a.immoIncorpBrut + a.immoCorpBrut + a.immoFinBrut) -
    (a.amortIncorp + a.amortCorp + a.deprecImmoFin)
  )
  const stocksNets    = r(a.stocksMarchandises + a.stocksMatieres + a.stocksEncours + a.stocksProduits - a.deprecStocks)
  const creancesNettes= r(a.creancesClients - a.deprecCreances)
  const tresoActifNet = r(a.tresorerieActif - a.deprecTreso)
  const totalActif    = r(
    a.capitalNonAppele + actifImmoNet + stocksNets +
    creancesNettes + a.creancesEtat + a.autresCreances +
    a.chargesConstatees + tresoActifNet
  )

  const capPropres = r(
    a.capital + a.primes + a.ecarts + a.reserves + a.reportNouveau +
    resultatNet + a.subventionsInvest + a.provisionsReglementees
  )
  const dettesLT   = r(a.provisionsRisques + a.empruntsOblig + a.empruntsEtablissement + a.autresEmpruntsLT)
  const dettesCT   = r(
    a.dettesFournisseurs + a.dettesSociales + a.dettesFiscales +
    a.autresDettes + a.produitsConstates + a.tresoreriePassif
  )
  const totalPassif = r(capPropres + dettesLT + dettesCT)

  return {
    actif: {
      immoIncorpBrut:   r(a.immoIncorpBrut),
      immoCorpBrut:     r(a.immoCorpBrut),
      immoFinBrut:      r(a.immoFinBrut),
      amortIncorp:      r(a.amortIncorp),
      amortCorp:        r(a.amortCorp),
      deprecImmoFin:    r(a.deprecImmoFin),
      actifImmoNet,
      stocksMarchandises: r(a.stocksMarchandises),
      stocksMatieres:   r(a.stocksMatieres),
      stocksEncours:    r(a.stocksEncours),
      stocksProduits:   r(a.stocksProduits),
      deprecStocks:     r(a.deprecStocks),
      stocksNets,
      creancesClients:  creancesNettes,
      creancesEtat:     r(a.creancesEtat),
      autresCreances:   r(a.autresCreances),
      chargesConstatees:r(a.chargesConstatees),
      tresorerie:       tresoActifNet,
      totalActif,
    },
    passif: {
      capital:              r(a.capital),
      primes:               r(a.primes),
      ecarts:               r(a.ecarts),
      reserves:             r(a.reserves),
      reportNouveau:        r(a.reportNouveau),
      resultatNet,
      subventionsInvest:    r(a.subventionsInvest),
      provisionsReglementees: r(a.provisionsReglementees),
      capitauxPropres:      capPropres,
      provisionsRisques:    r(a.provisionsRisques),
      empruntsOblig:        r(a.empruntsOblig),
      empruntsEtablissement:r(a.empruntsEtablissement),
      autresEmpruntsLT:     r(a.autresEmpruntsLT),
      dettesLT,
      dettesFournisseurs:   r(a.dettesFournisseurs),
      dettesSociales:       r(a.dettesSociales),
      dettesFiscales:       r(a.dettesFiscales),
      autresDettes:         r(a.autresDettes),
      produitsConstates:    r(a.produitsConstates),
      tresoreriePassif:     r(a.tresoreriePassif),
      dettesCT,
      totalPassif,
    }
  }
}

// ─── Étape 6 : Contrôles ─────────────────────────────────────

function buildControles(
  totalDebit: number,
  totalCredit: number,
  bilan: ReturnType<typeof buildBilan>,
  sig: ReturnType<typeof buildSIG>,
  nbLignes: number,
  nbLignesAN67: number,
  comptesNonReconnus: string[]
) {
  const ecartFEC   = Math.abs(totalDebit - totalCredit)
  const ecartBilan = Math.abs(bilan.actif.totalActif - bilan.passif.totalPassif)

  return {
    nbLignes,
    nbLignesAN67,
    debitTotal:     totalDebit,
    creditTotal:    totalCredit,
    equilibreFEC:   ecartFEC < 1,
    ecartFEC:       r(ecartFEC),
    totalActif:     bilan.actif.totalActif,
    totalPassif:    bilan.passif.totalPassif,
    equilibreBilan: ecartBilan < 1,
    ecartBilan:     r(ecartBilan),
    resultatCR:     sig.resultatNet,
    resultatBilan:  bilan.passif.resultatNet,
    coherenceResultat: Math.abs(sig.resultatNet - bilan.passif.resultatNet) < 1,
    // Comptes présents dans le FEC mais non couverts par la classification PCG
    // En production normale ce tableau doit être vide
    comptesNonReconnus: comptesNonReconnus.slice(0, 20),
  }
}

// ─── Pipeline principal ───────────────────────────────────────

function calculer(lignes: LigneFEC[], annee: number) {
  // 1. Balance
  const { balance, totalDebit, totalCredit, nbLignes, nbLignesAN67 } = buildBalance(lignes)

  // 2. Classification + agrégation depuis la balance
  const aggregats = buildStatements(balance)

  // Comptes non reconnus (diagnostic)
  const comptesNonReconnus: string[] = []
  for (const compte of balance.values()) {
    if (!classifyCompte(compte.compteNum)) {
      comptesNonReconnus.push(`${compte.compteNum} (${compte.compteLib || '?'})`)
    }
  }

  // 3. SIG
  const sig = buildSIG(aggregats)

  // 4. CR
  const cr = buildCR(aggregats, sig)

  // 5. Bilan
  const bilan = buildBilan(aggregats, sig.resultatNet)

  // 6. Contrôles
  const controles = buildControles(
    totalDebit, totalCredit,
    bilan, sig,
    nbLignes, nbLignesAN67,
    comptesNonReconnus
  )

  return { annee, controles, sig, cr, bilan }
}

// ─── Route Next.js ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const annee  = parseInt(searchParams.get('annee')   || '0')
  const userId = searchParams.get('user_id') || ''

  if (!annee || !userId) {
    return NextResponse.json({ erreur: 'annee et user_id requis' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from('fec_exercices')
    .select('ecritures')
    .eq('user_id', userId)
    .eq('annee', annee)
    .single()

  if (error || !data) {
    return NextResponse.json({ erreur: 'FEC introuvable' }, { status: 404 })
  }

  const lignes = data.ecritures as LigneFEC[]
  const etats  = calculer(lignes, annee)

  return NextResponse.json(etats)
}
