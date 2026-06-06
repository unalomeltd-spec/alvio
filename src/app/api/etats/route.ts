import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// ALVIO — Moteur comptable v4
// Classification PCG 2025 (ANC 2022-06) + rétrocompatibilité
// Source : Valentin Dutote, expert-comptable — juin 2026
// 598 comptes — générée depuis PCG2025_Classification_Alvio.xlsx
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

type Destination =
  | 'immoIncorpBrut' | 'immoCorpBrut' | 'immoFinBrut'
  | 'amortIncorp' | 'amortCorp' | 'deprecImmoFin'
  | 'stocksMarchandises' | 'stocksMatieres' | 'stocksEncours' | 'stocksProduits' | 'deprecStocks'
  | 'creancesClients' | 'deprecCreances' | 'creancesEtat' | 'autresCreances' | 'chargesConstatees'
  | 'tresorerieActif' | 'deprecTreso' | 'capitalNonAppele'
  | 'capital' | 'primes' | 'ecarts' | 'reserves' | 'reportNouveau'
  | 'subventionsInvest' | 'provisionsReglementees' | 'provisionsRisques'
  | 'empruntsOblig' | 'empruntsEtablissement' | 'autresEmpruntsLT'
  | 'dettesFournisseurs' | 'dettesSociales' | 'dettesFiscales'
  | 'autresDettes' | 'produitsConstates' | 'tresoreriePassif'
  | 'ventesMarchandises' | 'productionVendue' | 'productionStockee' | 'productionImmobilisee'
  | 'subventionsExploit' | 'autresProduits' | 'reprises'
  | 'achatsMarchandises' | 'variationStocksMarch' | 'achatsMatieres' | 'variationStocksMat'
  | 'autresAchats' | 'servicesExt' | 'impotsTaxes' | 'chargesPersonnel' | 'remboursementsPers'
  | 'dotationsExploit' | 'autresChargesExploit'
  | 'produitsFinanciers' | 'reprisesFin' | 'chargesFinancieres' | 'dotationsFin'
  | 'produitsExcep' | 'reprisesExcep' | 'prixCession' | 'chargesExcep' | 'dotationsExcep' | 'vncActifsCedes'
  | 'participation' | 'is'

interface ClassificationResult {
  destination: Destination
  sens: 1 | -1
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

function classifyCompte(compteNum: string): ClassificationResult | null {
  // ──────── 5 chiffres
  if (compteNum.startsWith('44562')) return { destination: 'creancesEtat', sens: 1 }
  if (compteNum.startsWith('44566')) return { destination: 'creancesEtat', sens: 1 }
  if (compteNum.startsWith('44581')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('44583')) return { destination: 'creancesEtat', sens: 1 }
  if (compteNum.startsWith('44586')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('44587')) return { destination: 'creancesEtat', sens: 1 }
  // ──────── 4 chiffres
  if (compteNum.startsWith('1011')) return { destination: 'capitalNonAppele', sens: -1 }
  if (compteNum.startsWith('1012')) return { destination: 'capital', sens: -1 }
  if (compteNum.startsWith('1013')) return { destination: 'capital', sens: -1 }
  if (compteNum.startsWith('1018')) return { destination: 'capital', sens: -1 } // DOUTE
  if (compteNum.startsWith('1041')) return { destination: 'primes', sens: -1 }
  if (compteNum.startsWith('1042')) return { destination: 'primes', sens: -1 }
  if (compteNum.startsWith('1043')) return { destination: 'primes', sens: -1 }
  if (compteNum.startsWith('1044')) return { destination: 'primes', sens: -1 }
  if (compteNum.startsWith('1051')) return { destination: 'ecarts', sens: -1 }
  if (compteNum.startsWith('1052')) return { destination: 'ecarts', sens: -1 }
  if (compteNum.startsWith('1061')) return { destination: 'reserves', sens: -1 }
  if (compteNum.startsWith('1062')) return { destination: 'reserves', sens: -1 }
  if (compteNum.startsWith('1063')) return { destination: 'reserves', sens: -1 }
  if (compteNum.startsWith('1064')) return { destination: 'reserves', sens: -1 }
  if (compteNum.startsWith('1068')) return { destination: 'reserves', sens: -1 }
  if (compteNum.startsWith('1209')) return { destination: 'capital', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1511')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('1512')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('1513')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('1514')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('1515')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('1516')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('1518')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('1521')) return { destination: 'provisionsRisques', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1522')) return { destination: 'provisionsRisques', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1523')) return { destination: 'provisionsRisques', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1524')) return { destination: 'provisionsRisques', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1525')) return { destination: 'provisionsRisques', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1526')) return { destination: 'provisionsRisques', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1527')) return { destination: 'provisionsRisques', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1611')) return { destination: 'empruntsOblig', sens: -1 }
  if (compteNum.startsWith('1618')) return { destination: 'autresEmpruntsLT', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1638')) return { destination: 'autresEmpruntsLT', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1641')) return { destination: 'empruntsEtablissement', sens: -1 }
  if (compteNum.startsWith('1643')) return { destination: 'empruntsEtablissement', sens: -1 }
  if (compteNum.startsWith('1644')) return { destination: 'empruntsEtablissement', sens: -1 }
  if (compteNum.startsWith('1648')) return { destination: 'autresEmpruntsLT', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1658')) return { destination: 'autresEmpruntsLT', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1668')) return { destination: 'autresEmpruntsLT', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('1674')) return { destination: 'autresEmpruntsLT', sens: -1 } // DOUTE
  if (compteNum.startsWith('1681')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('1683')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('1684')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('1687')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('2051')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('2052')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('2053')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('2054')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('2055')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('2056')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('2111')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2112')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2113')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2114')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2115')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2131')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2132')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2135')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2138')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2151')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2153')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2154')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2155')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2157')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2181')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2182')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2183')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2184')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2185')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2186')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('2801')) return { destination: 'amortIncorp', sens: -1 }
  if (compteNum.startsWith('2803')) return { destination: 'amortIncorp', sens: -1 }
  if (compteNum.startsWith('2805')) return { destination: 'amortIncorp', sens: -1 }
  if (compteNum.startsWith('2807')) return { destination: 'amortIncorp', sens: -1 }
  if (compteNum.startsWith('2808')) return { destination: 'amortIncorp', sens: -1 }
  if (compteNum.startsWith('2812')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('2813')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('2814')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('2815')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('2818')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('2841')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('2843')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('2845')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('2848')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('2849')) return { destination: 'amortCorp', sens: -1 } // amortCorp — droits d'utilisation immo corp
  if (compteNum.startsWith('2905')) return { destination: 'amortIncorp', sens: -1 }
  if (compteNum.startsWith('2907')) return { destination: 'amortIncorp', sens: -1 }
  if (compteNum.startsWith('4011')) return { destination: 'dettesFournisseurs', sens: -1 }
  if (compteNum.startsWith('4017')) return { destination: 'dettesFournisseurs', sens: 1 } // RRR à accorder — vient en déduction dettes fourn. — basculement débiteur géré dans getDestinationEffective // DOUTE
  if (compteNum.startsWith('4091')) return { destination: 'autresCreances', sens: 1 }
  if (compteNum.startsWith('4096')) return { destination: 'autresCreances', sens: 1 }
  if (compteNum.startsWith('4097')) return { destination: 'autresCreances', sens: 1 }
  if (compteNum.startsWith('4111')) return { destination: 'creancesClients', sens: 1 }
  if (compteNum.startsWith('4117')) return { destination: 'creancesClients', sens: -1 } // RRR à accorder clients — vient en déduction créances — DOUTE : 4117 débiteur non capté par basculement actuel // DOUTE
  if (compteNum.startsWith('4191')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('4196')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('4197')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('4282')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('4286')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('4287')) return { destination: 'autresCreances', sens: 1 } // DOUTE
  if (compteNum.startsWith('4382')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('4386')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('4411')) return { destination: 'creancesEtat', sens: 1 }
  if (compteNum.startsWith('4412')) return { destination: 'creancesEtat', sens: 1 }
  if (compteNum.startsWith('4418')) return { destination: 'creancesEtat', sens: 1 }
  if (compteNum.startsWith('4421')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('4427')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('4451')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('4452')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('4455')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('4456')) return { destination: 'creancesEtat', sens: 1 }
  if (compteNum.startsWith('4457')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('4458')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('4482')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('4486')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('4487')) return { destination: 'creancesEtat', sens: 1 }
  if (compteNum.startsWith('4686')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('4687')) return { destination: 'autresCreances', sens: 1 }
  if (compteNum.startsWith('5181')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('5186')) return { destination: 'tresoreriePassif', sens: -1 }
  if (compteNum.startsWith('5191')) return { destination: 'tresoreriePassif', sens: -1 }
  if (compteNum.startsWith('5199')) return { destination: 'tresoreriePassif', sens: -1 }
  if (compteNum.startsWith('6011')) return { destination: 'achatsMatieres', sens: 1 }
  if (compteNum.startsWith('6012')) return { destination: 'achatsMatieres', sens: 1 }
  if (compteNum.startsWith('6013')) return { destination: 'achatsMatieres', sens: 1 }
  if (compteNum.startsWith('6014')) return { destination: 'achatsMatieres', sens: 1 }
  if (compteNum.startsWith('6015')) return { destination: 'achatsMatieres', sens: 1 }
  if (compteNum.startsWith('6016')) return { destination: 'autresAchats', sens: 1 } // DOUTE
  if (compteNum.startsWith('6017')) return { destination: 'autresAchats', sens: 1 }
  if (compteNum.startsWith('6019')) return { destination: 'achatsMatieres', sens: -1 }
  if (compteNum.startsWith('6031')) return { destination: 'variationStocksMat', sens: -1 }
  if (compteNum.startsWith('6032')) return { destination: 'variationStocksMat', sens: -1 } // DOUTE
  if (compteNum.startsWith('6037')) return { destination: 'variationStocksMarch', sens: -1 }
  if (compteNum.startsWith('6061')) return { destination: 'autresAchats', sens: 1 }
  if (compteNum.startsWith('6063')) return { destination: 'autresAchats', sens: 1 }
  if (compteNum.startsWith('6064')) return { destination: 'autresAchats', sens: 1 }
  if (compteNum.startsWith('6068')) return { destination: 'autresAchats', sens: 1 }
  if (compteNum.startsWith('6071')) return { destination: 'achatsMarchandises', sens: 1 }
  if (compteNum.startsWith('6097')) return { destination: 'achatsMarchandises', sens: -1 }
  if (compteNum.startsWith('6122')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6125')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6151')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6155')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6156')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6181')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6183')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6221')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6222')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6224')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6225')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6226')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6227')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6228')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6231')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6232')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6233')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6234')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6235')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6236')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6237')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6238')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6241')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6242')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6243')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6244')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6247')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6248')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6251')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6255')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6256')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6257')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6271')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6272')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6275')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6278')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6281')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6282')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6283')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6284')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6285')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6288')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('6311')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('6312')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('6313')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('6314')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('6318')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('6351')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('6352')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('6353')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('6354')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('6358')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('6411')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6412')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6413')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6414')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6415')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6416')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6417')) return { destination: 'chargesPersonnel', sens: 1 } // DOUTE
  if (compteNum.startsWith('6418')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6451')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6452')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6453')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6454')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6458')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6471')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6472')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6473')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6474')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6475')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6478')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('6511')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('6516')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('6541')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('6544')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('6611')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('6612')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('6615')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('6616')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('6617')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('6618')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('6671')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('6711')) return { destination: 'chargesExcep', sens: 1 }
  if (compteNum.startsWith('6712')) return { destination: 'chargesExcep', sens: 1 }
  if (compteNum.startsWith('6713')) return { destination: 'chargesExcep', sens: 1 }
  if (compteNum.startsWith('6714')) return { destination: 'chargesExcep', sens: 1 }
  if (compteNum.startsWith('6717')) return { destination: 'chargesExcep', sens: 1 }
  if (compteNum.startsWith('6718')) return { destination: 'chargesExcep', sens: 1 }
  if (compteNum.startsWith('6811')) return { destination: 'dotationsExploit', sens: 1 }
  if (compteNum.startsWith('6812')) return { destination: 'dotationsExploit', sens: 1 }
  if (compteNum.startsWith('6813')) return { destination: 'dotationsExploit', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('6815')) return { destination: 'dotationsExploit', sens: 1 }
  if (compteNum.startsWith('6816')) return { destination: 'dotationsExploit', sens: 1 }
  if (compteNum.startsWith('6817')) return { destination: 'dotationsExploit', sens: 1 }
  if (compteNum.startsWith('6861')) return { destination: 'dotationsFin', sens: 1 }
  if (compteNum.startsWith('6862')) return { destination: 'dotationsFin', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('6865')) return { destination: 'dotationsFin', sens: 1 }
  if (compteNum.startsWith('6866')) return { destination: 'dotationsFin', sens: 1 }
  if (compteNum.startsWith('6871')) return { destination: 'dotationsExcep', sens: 1 }
  if (compteNum.startsWith('6872')) return { destination: 'dotationsExcep', sens: 1 }
  if (compteNum.startsWith('6873')) return { destination: 'dotationsExcep', sens: 1 }
  if (compteNum.startsWith('6874')) return { destination: 'dotationsExcep', sens: 1 }
  if (compteNum.startsWith('6875')) return { destination: 'dotationsExcep', sens: 1 }
  if (compteNum.startsWith('6876')) return { destination: 'dotationsExcep', sens: 1 }
  if (compteNum.startsWith('6951')) return { destination: 'is', sens: 1 }
  if (compteNum.startsWith('6952')) return { destination: 'is', sens: 1 }
  if (compteNum.startsWith('6954')) return { destination: 'impotsTaxes', sens: 1 } // DOUTE
  if (compteNum.startsWith('7011')) return { destination: 'productionVendue', sens: -1 }
  if (compteNum.startsWith('7013')) return { destination: 'productionVendue', sens: -1 }
  if (compteNum.startsWith('7071')) return { destination: 'ventesMarchandises', sens: -1 }
  if (compteNum.startsWith('7073')) return { destination: 'ventesMarchandises', sens: -1 }
  if (compteNum.startsWith('7081')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('7082')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('7083')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('7084')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('7085')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('7086')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('7087')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('7088')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('7091')) return { destination: 'productionVendue', sens: 1 }
  if (compteNum.startsWith('7097')) return { destination: 'ventesMarchandises', sens: 1 }
  if (compteNum.startsWith('7133')) return { destination: 'productionStockee', sens: -1 }
  if (compteNum.startsWith('7134')) return { destination: 'productionStockee', sens: -1 }
  if (compteNum.startsWith('7135')) return { destination: 'productionStockee', sens: -1 }
  if (compteNum.startsWith('7181')) return { destination: 'productionStockee', sens: -1 }
  if (compteNum.startsWith('7587')) return { destination: 'autresProduits', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('7671')) return { destination: 'produitsFinanciers', sens: -1 }
  if (compteNum.startsWith('7711')) return { destination: 'produitsExcep', sens: -1 }
  if (compteNum.startsWith('7714')) return { destination: 'produitsExcep', sens: -1 }
  if (compteNum.startsWith('7715')) return { destination: 'produitsExcep', sens: -1 }
  if (compteNum.startsWith('7717')) return { destination: 'produitsExcep', sens: -1 }
  if (compteNum.startsWith('7718')) return { destination: 'produitsExcep', sens: -1 }
  if (compteNum.startsWith('7811')) return { destination: 'reprises', sens: -1 }
  if (compteNum.startsWith('7813')) return { destination: 'reprises', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('7815')) return { destination: 'reprises', sens: -1 }
  if (compteNum.startsWith('7816')) return { destination: 'reprises', sens: -1 }
  if (compteNum.startsWith('7817')) return { destination: 'reprises', sens: -1 }
  if (compteNum.startsWith('7865')) return { destination: 'reprisesFin', sens: -1 }
  if (compteNum.startsWith('7866')) return { destination: 'reprisesFin', sens: -1 }
  if (compteNum.startsWith('7872')) return { destination: 'reprisesExcep', sens: -1 }
  if (compteNum.startsWith('7873')) return { destination: 'reprisesExcep', sens: -1 }
  if (compteNum.startsWith('7874')) return { destination: 'reprisesExcep', sens: -1 }
  if (compteNum.startsWith('7875')) return { destination: 'reprisesExcep', sens: -1 }
  if (compteNum.startsWith('7876')) return { destination: 'reprisesExcep', sens: -1 }
  // ──────── 3 chiffres
  if (compteNum.startsWith('101')) return { destination: 'capital', sens: -1 }
  if (compteNum.startsWith('102')) return { destination: 'capital', sens: -1 }
  if (compteNum.startsWith('104')) return { destination: 'primes', sens: -1 }
  if (compteNum.startsWith('105')) return { destination: 'ecarts', sens: -1 }
  if (compteNum.startsWith('106')) return { destination: 'reserves', sens: -1 }
  if (compteNum.startsWith('107')) return { destination: 'ecarts', sens: -1 } // DOUTE
  if (compteNum.startsWith('108')) return { destination: 'capital', sens: -1 }
  if (compteNum.startsWith('109')) return { destination: 'capitalNonAppele', sens: 1 }
  if (compteNum.startsWith('110')) return { destination: 'reportNouveau', sens: -1 }
  if (compteNum.startsWith('119')) return { destination: 'reportNouveau', sens: 1 }
  if (compteNum.startsWith('120')) return { destination: 'reportNouveau', sens: -1 } // DOUTE
  if (compteNum.startsWith('129')) return { destination: 'reportNouveau', sens: 1 } // DOUTE
  if (compteNum.startsWith('131')) return { destination: 'subventionsInvest', sens: -1 }
  if (compteNum.startsWith('138')) return { destination: 'subventionsInvest', sens: -1 } // rétrocompat
  if (compteNum.startsWith('139')) return { destination: 'subventionsInvest', sens: 1 }
  if (compteNum.startsWith('141')) return { destination: 'provisionsReglementees', sens: -1 } // rétrocompat
  if (compteNum.startsWith('142')) return { destination: 'provisionsReglementees', sens: -1 } // rétrocompat
  if (compteNum.startsWith('143')) return { destination: 'provisionsReglementees', sens: -1 }
  if (compteNum.startsWith('144')) return { destination: 'provisionsReglementees', sens: -1 } // rétrocompat
  if (compteNum.startsWith('145')) return { destination: 'provisionsReglementees', sens: -1 }
  if (compteNum.startsWith('146')) return { destination: 'provisionsReglementees', sens: -1 } // rétrocompat
  if (compteNum.startsWith('147')) return { destination: 'provisionsReglementees', sens: -1 } // rétrocompat
  if (compteNum.startsWith('148')) return { destination: 'provisionsReglementees', sens: -1 }
  if (compteNum.startsWith('151')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('153')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('154')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('155')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('156')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('157')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('158')) return { destination: 'provisionsRisques', sens: -1 }
  if (compteNum.startsWith('161')) return { destination: 'empruntsOblig', sens: -1 }
  if (compteNum.startsWith('163')) return { destination: 'empruntsOblig', sens: -1 }
  if (compteNum.startsWith('164')) return { destination: 'empruntsEtablissement', sens: -1 }
  if (compteNum.startsWith('165')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('166')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('167')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('168')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('169')) return { destination: 'autresDettes', sens: -1 } // versements restants sur titres immo — dette envers associés — Valentin Dutote // DOUTE
  if (compteNum.startsWith('171')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('174')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('178')) return { destination: 'autresEmpruntsLT', sens: -1 }
  if (compteNum.startsWith('181')) return { destination: 'autresDettes', sens: -1 } // DOUTE
  if (compteNum.startsWith('182')) return { destination: 'autresDettes', sens: -1 } // DOUTE
  if (compteNum.startsWith('201')) return { destination: 'immoIncorpBrut', sens: 1 } // DOUTE
  if (compteNum.startsWith('202')) return { destination: 'immoIncorpBrut', sens: 1 } // DOUTE
  if (compteNum.startsWith('203')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('204')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('205')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('206')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('207')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('208')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('211')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('212')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('213')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('214')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('215')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('218')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('231')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('232')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('237')) return { destination: 'immoIncorpBrut', sens: 1 }
  if (compteNum.startsWith('238')) return { destination: 'immoCorpBrut', sens: 1 }
  if (compteNum.startsWith('241')) return { destination: 'immoCorpBrut', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('242')) return { destination: 'immoCorpBrut', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('243')) return { destination: 'immoCorpBrut', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('245')) return { destination: 'immoCorpBrut', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('248')) return { destination: 'immoCorpBrut', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('249')) return { destination: 'immoIncorpBrut', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('251')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('253')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('255')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('258')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('261')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('262')) return { destination: 'immoFinBrut', sens: 1 } // DOUTE
  if (compteNum.startsWith('263')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('264')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('265')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('266')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('267')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('268')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('269')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('271')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('272')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('273')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('274')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('275')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('276')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('277')) return { destination: 'immoFinBrut', sens: 1 } // DOUTE
  if (compteNum.startsWith('278')) return { destination: 'immoFinBrut', sens: 1 }
  if (compteNum.startsWith('279')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('280')) return { destination: 'amortIncorp', sens: -1 }
  if (compteNum.startsWith('281')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('284')) return { destination: 'amortCorp', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('290')) return { destination: 'amortIncorp', sens: -1 }
  if (compteNum.startsWith('291')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('293')) return { destination: 'amortCorp', sens: -1 }
  if (compteNum.startsWith('294')) return { destination: 'amortCorp', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('296')) return { destination: 'deprecImmoFin', sens: -1 }
  if (compteNum.startsWith('297')) return { destination: 'deprecImmoFin', sens: -1 }
  if (compteNum.startsWith('321')) return { destination: 'stocksMatieres', sens: 1 }
  if (compteNum.startsWith('322')) return { destination: 'stocksMatieres', sens: 1 }
  if (compteNum.startsWith('326')) return { destination: 'stocksMatieres', sens: 1 }
  if (compteNum.startsWith('351')) return { destination: 'stocksProduits', sens: 1 }
  if (compteNum.startsWith('355')) return { destination: 'stocksProduits', sens: 1 }
  if (compteNum.startsWith('358')) return { destination: 'stocksProduits', sens: 1 }
  if (compteNum.startsWith('391')) return { destination: 'deprecStocks', sens: -1 }
  if (compteNum.startsWith('392')) return { destination: 'deprecStocks', sens: -1 }
  if (compteNum.startsWith('393')) return { destination: 'deprecStocks', sens: -1 }
  if (compteNum.startsWith('394')) return { destination: 'deprecStocks', sens: -1 }
  if (compteNum.startsWith('395')) return { destination: 'deprecStocks', sens: -1 }
  if (compteNum.startsWith('397')) return { destination: 'deprecStocks', sens: -1 }
  if (compteNum.startsWith('401')) return { destination: 'dettesFournisseurs', sens: -1 }
  if (compteNum.startsWith('403')) return { destination: 'dettesFournisseurs', sens: -1 }
  if (compteNum.startsWith('404')) return { destination: 'dettesFournisseurs', sens: -1 }
  if (compteNum.startsWith('405')) return { destination: 'dettesFournisseurs', sens: -1 }
  if (compteNum.startsWith('408')) return { destination: 'dettesFournisseurs', sens: -1 }
  if (compteNum.startsWith('409')) return { destination: 'autresCreances', sens: 1 }
  if (compteNum.startsWith('411')) return { destination: 'creancesClients', sens: 1 }
  if (compteNum.startsWith('413')) return { destination: 'creancesClients', sens: 1 }
  if (compteNum.startsWith('416')) return { destination: 'creancesClients', sens: 1 }
  if (compteNum.startsWith('418')) return { destination: 'creancesClients', sens: 1 }
  if (compteNum.startsWith('419')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('421')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('422')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('424')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('425')) return { destination: 'autresCreances', sens: 1 }
  if (compteNum.startsWith('426')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('427')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('428')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('431')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('432')) return { destination: 'dettesSociales', sens: -1 } // mutuelles, prévoyance — Valentin Dutote
  if (compteNum.startsWith('436')) return { destination: 'dettesSociales', sens: -1 } // ARRCO/AGIRC retraite complémentaire — Valentin Dutote
  if (compteNum.startsWith('437')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('438')) return { destination: 'dettesSociales', sens: -1 }
  if (compteNum.startsWith('441')) return { destination: 'creancesEtat', sens: 1 }
  if (compteNum.startsWith('442')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('443')) return { destination: 'creancesEtat', sens: 1 }
  if (compteNum.startsWith('444')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('446')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('447')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('448')) return { destination: 'dettesFiscales', sens: -1 }
  if (compteNum.startsWith('451')) return { destination: 'autresCreances', sens: 1 }
  if (compteNum.startsWith('452')) return { destination: 'capital', sens: -1 } // associés — apports en société — Valentin Dutote // DOUTE
  if (compteNum.startsWith('455')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('456')) return { destination: 'capital', sens: -1 }
  if (compteNum.startsWith('457')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('458')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('461')) return { destination: 'autresCreances', sens: 1 }
  if (compteNum.startsWith('462')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('463')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('464')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('465')) return { destination: 'autresCreances', sens: 1 }
  if (compteNum.startsWith('467')) return { destination: 'autresCreances', sens: 1 } // DOUTE
  if (compteNum.startsWith('468')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('471')) return { destination: 'autresCreances', sens: 1 } // DOUTE
  if (compteNum.startsWith('472')) return { destination: 'autresCreances', sens: 1 } // DOUTE
  if (compteNum.startsWith('476')) return { destination: 'autresCreances', sens: 1 }
  if (compteNum.startsWith('477')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('478')) return { destination: 'autresCreances', sens: 1 } // DOUTE
  if (compteNum.startsWith('481')) return { destination: 'chargesConstatees', sens: 1 }
  if (compteNum.startsWith('486')) return { destination: 'chargesConstatees', sens: 1 }
  if (compteNum.startsWith('487')) return { destination: 'produitsConstates', sens: -1 }
  if (compteNum.startsWith('488')) return { destination: 'chargesConstatees', sens: 1 } // DOUTE
  if (compteNum.startsWith('489')) return { destination: 'chargesConstatees', sens: 1 } // DOUTE
  if (compteNum.startsWith('491')) return { destination: 'deprecCreances', sens: -1 }
  if (compteNum.startsWith('495')) return { destination: 'deprecCreances', sens: -1 }
  if (compteNum.startsWith('496')) return { destination: 'deprecCreances', sens: -1 }
  if (compteNum.startsWith('501')) return { destination: 'tresorerieActif', sens: 1 } // DOUTE
  if (compteNum.startsWith('502')) return { destination: 'tresorerieActif', sens: 1 } // DOUTE
  if (compteNum.startsWith('503')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('504')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('505')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('506')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('507')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('508')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('509')) return { destination: 'autresDettes', sens: -1 }
  if (compteNum.startsWith('511')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('512')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('513')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('514')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('515')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('516')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('517')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('518')) return { destination: 'tresorerieActif', sens: 1 } // DOUTE
  if (compteNum.startsWith('519')) return { destination: 'tresoreriePassif', sens: -1 }
  if (compteNum.startsWith('531')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('532')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('590')) return { destination: 'deprecTreso', sens: -1 }
  if (compteNum.startsWith('591')) return { destination: 'deprecTreso', sens: -1 }
  if (compteNum.startsWith('601')) return { destination: 'achatsMatieres', sens: 1 }
  if (compteNum.startsWith('602')) return { destination: 'achatsMatieres', sens: 1 }
  if (compteNum.startsWith('604')) return { destination: 'autresAchats', sens: 1 }
  if (compteNum.startsWith('605')) return { destination: 'autresAchats', sens: 1 } // DOUTE
  if (compteNum.startsWith('606')) return { destination: 'autresAchats', sens: 1 }
  if (compteNum.startsWith('607')) return { destination: 'achatsMarchandises', sens: 1 }
  if (compteNum.startsWith('609')) return { destination: 'achatsMatieres', sens: -1 } // DOUTE
  if (compteNum.startsWith('611')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('612')) return { destination: 'servicesExt', sens: 1 } // DOUTE
  if (compteNum.startsWith('613')) return { destination: 'servicesExt', sens: 1 } // DOUTE
  if (compteNum.startsWith('614')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('615')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('616')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('617')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('618')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('619')) return { destination: 'servicesExt', sens: -1 }
  if (compteNum.startsWith('621')) return { destination: 'servicesExt', sens: 1 } // servicesExt — liasse 2053 — Valentin Dutote juin 2026
  if (compteNum.startsWith('622')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('623')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('624')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('625')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('626')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('627')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('628')) return { destination: 'servicesExt', sens: 1 }
  if (compteNum.startsWith('629')) return { destination: 'servicesExt', sens: -1 }
  if (compteNum.startsWith('631')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('633')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('635')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('637')) return { destination: 'impotsTaxes', sens: 1 }
  if (compteNum.startsWith('641')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('645')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('647')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('648')) return { destination: 'chargesPersonnel', sens: 1 }
  if (compteNum.startsWith('649')) return { destination: 'remboursementsPers', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('651')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('652')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('653')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('654')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('655')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('656')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('657')) return { destination: 'autresChargesExploit', sens: 1 } // PCG 2025 NOUVEAU — cessions immos incorp/corp — Valentin Dutote juin 2026
  if (compteNum.startsWith('658')) return { destination: 'autresChargesExploit', sens: 1 }
  if (compteNum.startsWith('661')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('662')) return { destination: 'chargesFinancieres', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('664')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('665')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('666')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('667')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('668')) return { destination: 'chargesFinancieres', sens: 1 }
  if (compteNum.startsWith('671')) return { destination: 'chargesExcep', sens: 1 }
  if (compteNum.startsWith('672')) return { destination: 'chargesExcep', sens: 1 }
  if (compteNum.startsWith('675')) return { destination: 'vncActifsCedes', sens: 1 }
  if (compteNum.startsWith('676')) return { destination: 'chargesExcep', sens: 1 }
  if (compteNum.startsWith('678')) return { destination: 'chargesExcep', sens: 1 }
  if (compteNum.startsWith('681')) return { destination: 'dotationsExploit', sens: 1 }
  if (compteNum.startsWith('686')) return { destination: 'dotationsFin', sens: 1 }
  if (compteNum.startsWith('687')) return { destination: 'dotationsExcep', sens: 1 }
  if (compteNum.startsWith('691')) return { destination: 'participation', sens: 1 }
  if (compteNum.startsWith('695')) return { destination: 'is', sens: 1 }
  if (compteNum.startsWith('697')) return { destination: 'is', sens: 1 }
  if (compteNum.startsWith('699')) return { destination: 'is', sens: -1 }
  if (compteNum.startsWith('701')) return { destination: 'productionVendue', sens: -1 }
  if (compteNum.startsWith('702')) return { destination: 'productionVendue', sens: -1 }
  if (compteNum.startsWith('703')) return { destination: 'productionVendue', sens: -1 }
  if (compteNum.startsWith('704')) return { destination: 'productionVendue', sens: -1 }
  if (compteNum.startsWith('705')) return { destination: 'productionVendue', sens: -1 }
  if (compteNum.startsWith('706')) return { destination: 'productionVendue', sens: -1 }
  if (compteNum.startsWith('707')) return { destination: 'ventesMarchandises', sens: -1 }
  if (compteNum.startsWith('708')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('709')) return { destination: 'ventesMarchandises', sens: 1 } // DOUTE
  if (compteNum.startsWith('713')) return { destination: 'productionStockee', sens: -1 }
  if (compteNum.startsWith('721')) return { destination: 'productionImmobilisee', sens: -1 }
  if (compteNum.startsWith('722')) return { destination: 'productionImmobilisee', sens: -1 }
  if (compteNum.startsWith('724')) return { destination: 'productionImmobilisee', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('741')) return { destination: 'subventionsExploit', sens: -1 }
  if (compteNum.startsWith('742')) return { destination: 'subventionsExploit', sens: -1 }
  if (compteNum.startsWith('743')) return { destination: 'subventionsExploit', sens: -1 }
  if (compteNum.startsWith('744')) return { destination: 'subventionsExploit', sens: -1 }
  if (compteNum.startsWith('747')) return { destination: 'subventionsExploit', sens: -1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('748')) return { destination: 'subventionsExploit', sens: -1 }
  if (compteNum.startsWith('751')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('752')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('753')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('754')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('755')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('756')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('757')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('758')) return { destination: 'autresProduits', sens: -1 }
  if (compteNum.startsWith('761')) return { destination: 'produitsFinanciers', sens: -1 }
  if (compteNum.startsWith('762')) return { destination: 'produitsFinanciers', sens: -1 }
  if (compteNum.startsWith('763')) return { destination: 'produitsFinanciers', sens: -1 }
  if (compteNum.startsWith('764')) return { destination: 'produitsFinanciers', sens: -1 }
  if (compteNum.startsWith('765')) return { destination: 'produitsFinanciers', sens: -1 }
  if (compteNum.startsWith('766')) return { destination: 'produitsFinanciers', sens: -1 }
  if (compteNum.startsWith('767')) return { destination: 'produitsFinanciers', sens: -1 }
  if (compteNum.startsWith('768')) return { destination: 'produitsFinanciers', sens: -1 }
  if (compteNum.startsWith('771')) return { destination: 'produitsExcep', sens: -1 }
  if (compteNum.startsWith('772')) return { destination: 'produitsExcep', sens: -1 }
  if (compteNum.startsWith('775')) return { destination: 'prixCession', sens: -1 }
  if (compteNum.startsWith('777')) return { destination: 'reprisesExcep', sens: -1 }
  if (compteNum.startsWith('778')) return { destination: 'produitsExcep', sens: -1 }
  if (compteNum.startsWith('781')) return { destination: 'reprises', sens: -1 }
  if (compteNum.startsWith('786')) return { destination: 'reprisesFin', sens: -1 }
  if (compteNum.startsWith('787')) return { destination: 'reprisesExcep', sens: -1 }
  if (compteNum.startsWith('791')) return { destination: 'autresProduits', sens: -1 } // rétrocompat
  if (compteNum.startsWith('796')) return { destination: 'produitsFinanciers', sens: -1 } // rétrocompat
  if (compteNum.startsWith('797')) return { destination: 'produitsExcep', sens: -1 } // rétrocompat
  // ──────── 2 chiffres
  if (compteNum.startsWith('22')) return { destination: 'immoCorpBrut', sens: 1 } // DOUTE
  if (compteNum.startsWith('24')) return { destination: 'immoCorpBrut', sens: 1 } // PCG 2025 NOUVEAU
  if (compteNum.startsWith('31')) return { destination: 'stocksMatieres', sens: 1 }
  if (compteNum.startsWith('32')) return { destination: 'stocksMatieres', sens: 1 }
  if (compteNum.startsWith('33')) return { destination: 'stocksEncours', sens: 1 }
  if (compteNum.startsWith('34')) return { destination: 'stocksEncours', sens: 1 }
  if (compteNum.startsWith('35')) return { destination: 'stocksProduits', sens: 1 }
  if (compteNum.startsWith('36')) return { destination: 'stocksMatieres', sens: 1 } // DOUTE
  if (compteNum.startsWith('37')) return { destination: 'stocksMarchandises', sens: 1 }
  if (compteNum.startsWith('38')) return { destination: 'stocksMatieres', sens: 1 } // DOUTE
  if (compteNum.startsWith('52')) return { destination: 'tresorerieActif', sens: 1 } // DOUTE
  if (compteNum.startsWith('54')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('58')) return { destination: 'tresorerieActif', sens: 1 }
  if (compteNum.startsWith('59')) return { destination: 'deprecTreso', sens: -1 }

  // ─── Fallbacks hiérarchiques ─────────────────────────────────
  // Couvrent les sous-comptes personnalisés absents du référentiel
  // Préfixes 2 chiffres — déduits des règles de sous-comptes
  if (compteNum.startsWith('10')) return { destination: 'capital', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('11')) return { destination: 'reportNouveau', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('12')) return { destination: 'reportNouveau', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('13')) return { destination: 'subventionsInvest', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('14')) return { destination: 'provisionsReglementees', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('15')) return { destination: 'provisionsRisques', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('16')) return { destination: 'empruntsOblig', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('17')) return { destination: 'autresEmpruntsLT', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('18')) return { destination: 'autresDettes', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('20')) return { destination: 'immoIncorpBrut', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('21')) return { destination: 'immoCorpBrut', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('23')) return { destination: 'immoCorpBrut', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('25')) return { destination: 'immoFinBrut', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('26')) return { destination: 'immoFinBrut', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('27')) return { destination: 'immoFinBrut', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('28')) return { destination: 'amortCorp', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('29')) return { destination: 'amortCorp', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('39')) return { destination: 'deprecStocks', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('40')) return { destination: 'dettesFournisseurs', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('41')) return { destination: 'creancesClients', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('42')) return { destination: 'dettesSociales', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('43')) return { destination: 'dettesSociales', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('44')) return { destination: 'dettesFiscales', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('45')) return { destination: 'autresCreances', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('46')) return { destination: 'autresCreances', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('47')) return { destination: 'autresCreances', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('48')) return { destination: 'chargesConstatees', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('49')) return { destination: 'deprecCreances', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('50')) return { destination: 'tresorerieActif', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('51')) return { destination: 'tresorerieActif', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('53')) return { destination: 'tresorerieActif', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('60')) return { destination: 'autresAchats', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('61')) return { destination: 'servicesExt', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('62')) return { destination: 'servicesExt', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('63')) return { destination: 'impotsTaxes', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('64')) return { destination: 'chargesPersonnel', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('65')) return { destination: 'autresChargesExploit', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('66')) return { destination: 'chargesFinancieres', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('67')) return { destination: 'chargesExcep', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('68')) return { destination: 'dotationsExploit', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('69')) return { destination: 'is', sens: 1 } // fallback 2 chiffres
  if (compteNum.startsWith('70')) return { destination: 'productionVendue', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('71')) return { destination: 'productionStockee', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('72')) return { destination: 'productionImmobilisee', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('74')) return { destination: 'subventionsExploit', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('75')) return { destination: 'autresProduits', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('76')) return { destination: 'produitsFinanciers', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('77')) return { destination: 'produitsExcep', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('78')) return { destination: 'reprises', sens: -1 } // fallback 2 chiffres
  if (compteNum.startsWith('79')) return { destination: 'autresProduits', sens: -1 } // fallback 2 chiffres
  // Préfixes 1 chiffre — dernier recours
  if (compteNum.startsWith('1')) return { destination: 'autresEmpruntsLT', sens: -1 } // fallback 1 chiffre
  if (compteNum.startsWith('2')) return { destination: 'immoCorpBrut', sens: 1 } // fallback 1 chiffre
  if (compteNum.startsWith('3')) return { destination: 'stocksMatieres', sens: 1 } // fallback 1 chiffre
  if (compteNum.startsWith('4')) return { destination: 'autresCreances', sens: 1 } // fallback 1 chiffre
  if (compteNum.startsWith('5')) return { destination: 'tresorerieActif', sens: 1 } // fallback 1 chiffre
  if (compteNum.startsWith('6')) return { destination: 'autresChargesExploit', sens: 1 } // fallback 1 chiffre
  if (compteNum.startsWith('7')) return { destination: 'autresProduits', sens: -1 } // fallback 1 chiffre
  return null // Compte non reconnu par le PCG 2025
}

// ─── Agrégation depuis la balance ────────────────────────────
// Applique les règles de sens anormal (L2 — Valentin Dutote)

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
  'capital','primes','ecarts','reserves','reportNouveau','subventionsInvest',
  'provisionsReglementees','provisionsRisques',
  'empruntsOblig','empruntsEtablissement','autresEmpruntsLT',
  'dettesFournisseurs','dettesSociales','dettesFiscales','autresDettes','produitsConstates','tresoreriePassif',
]

// Règles de basculement selon solde réel (L2 — Valentin Dutote)
// Quand un compte a un solde inverse à son sens normal, il change de destination
function getDestinationEffective(
  compteNum: string,
  destination: Destination,
  solde: number,
  sens: 1 | -1
): { destination: Destination; valeur: number } {
  const c2 = compteNum.slice(0, 2)
  const c3 = compteNum.slice(0, 3)
  const c4 = compteNum.slice(0, 4)

  // Trésorerie actif créditrice → découvert → passif
  if (destination === 'tresorerieActif' && solde < 0) {
    return { destination: 'tresoreriePassif', valeur: -solde }
  }

  // Clients créditeurs → avances reçues → dettes
  // (411, 413, 418 — hors 419 déjà destination autresDettes)
  if (destination === 'creancesClients' && solde < 0) {
    return { destination: 'autresDettes', valeur: -solde }
  }

  // Fournisseurs débiteurs → trop-payés → créances
  // (401, 403, 404, 408 — hors 409 déjà destination autresCreances)
  if (destination === 'dettesFournisseurs' && solde > 0) {
    return { destination: 'autresCreances', valeur: solde }
  }

  // IS — créance si acomptes > IS dû (444 débiteur)
  if ((c3 === '444') && destination === 'dettesFiscales' && solde > 0) {
    return { destination: 'creancesEtat', valeur: solde }
  }

  // TVA à décaisser (4451) débiteur → crédit de TVA → créance
  if (c4 === '4451' && destination === 'dettesFiscales' && solde > 0) {
    return { destination: 'creancesEtat', valeur: solde }
  }

  // Dettes sociales débitrices (421 — avance nette > salaire)
  if (c3 === '421' && destination === 'dettesSociales' && solde > 0) {
    return { destination: 'autresCreances', valeur: solde }
  }

  // Cotisations trop payées (431 débiteur)
  if (c2 === '43' && destination === 'dettesSociales' && solde > 0) {
    return { destination: 'creancesEtat', valeur: solde }
  }

  // Associés compte courant débiteur (455)
  if (c3 === '455' && destination === 'autresDettes' && solde > 0) {
    return { destination: 'autresCreances', valeur: solde }
  }

  // Comptes 45/46/47/48 (hors 486/487) — sens par solde réel
  if (
    destination === 'autresCreances' &&
    (c2 === '45' || c2 === '46' || c2 === '47' || (c2 === '48' && c3 !== '486' && c3 !== '487'))
  ) {
    if (solde >= 0) return { destination: 'autresCreances', valeur: solde }
    else return { destination: 'autresDettes', valeur: -solde }
  }

  // Comptes de liaison 18x — sens par solde réel
  if (c2 === '18' && (destination === 'autresDettes' || destination === 'autresCreances')) {
    if (solde >= 0) return { destination: 'autresCreances', valeur: solde }
    else return { destination: 'autresDettes', valeur: -solde }
  }

  // Virements internes 58 et 515 — sens par solde réel
  if ((c2 === '58' || c3 === '515') && destination === 'tresorerieActif') {
    if (solde >= 0) return { destination: 'autresCreances', valeur: solde }
    else return { destination: 'autresDettes', valeur: -solde }
  }

  // Calcul standard : contribution = solde × sens
  // sens  1 : compte débiteur contribue positivement (actif, charges)
  // sens -1 : compte créditeur contribue positivement (passif, produits)
  return { destination, valeur: solde * sens }
}

function buildStatements(balance: Balance): { aggregats: Aggregats; comptesNonReconnus: string[] } {
  const agg = {} as Aggregats
  for (const d of DESTINATIONS) agg[d] = 0

  const comptesNonReconnus: string[] = []

  for (const compte of balance.values()) {
    // Ignorer les comptes à solde nul
    if (Math.abs(compte.solde) < 0.01) continue

    const classification = classifyCompte(compte.compteNum)
    if (!classification) {
      comptesNonReconnus.push(`${compte.compteNum} (${compte.compteLib || '?'}) solde=${compte.solde}`)
      continue
    }

    const { destination: destEffective, valeur } = getDestinationEffective(
      compte.compteNum,
      classification.destination,
      compte.solde,
      classification.sens
    )

    agg[destEffective] += valeur
  }

  for (const d of DESTINATIONS) agg[d] = Math.round(agg[d] * 100) / 100

  // Remboursements de charges personnel (649 — rétrocompat 791) déduits des charges personnel
  agg['chargesPersonnel'] = Math.round((agg['chargesPersonnel'] - agg['remboursementsPers']) * 100) / 100

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
  comptesNonReconnus: string[]
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
    comptesNonReconnus: comptesNonReconnus.slice(0, 30),
    comptesNonReconnusTotal: comptesNonReconnus.length,
  }
}

// ─── Pipeline ────────────────────────────────────────────────

function calculer(lignes: LigneFEC[], annee: number) {
  const { balance, totalDebit, totalCredit, nbLignes, nbLignesAN67, nbLignes89 } = buildBalance(lignes)
  const { aggregats, comptesNonReconnus } = buildStatements(balance)
  const sig   = buildSIG(aggregats)
  const cr    = buildCR(aggregats, sig)
  const bilan = buildBilan(aggregats, sig.resultatNet)
  const controles = buildControles(totalDebit, totalCredit, bilan, sig, nbLignes, nbLignesAN67, nbLignes89, comptesNonReconnus)
  return { annee, controles, sig, cr, bilan }
}

// ─── Route Next.js ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const annee  = parseInt(searchParams.get('annee')   || '0')
  const userId = searchParams.get('user_id') || ''
  if (!annee || !userId) return NextResponse.json({ erreur: 'annee et user_id requis' }, { status: 400 })
  if (annee < 2000 || annee > 2030) return NextResponse.json({ erreur: 'annee invalide (2000–2030)' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await admin.from('fec_exercices').select('ecritures').eq('user_id', userId).eq('annee', annee).single()
  if (error || !data) return NextResponse.json({ erreur: 'FEC introuvable' }, { status: 404 })

  try {
    const ecritures = data.ecritures
    if (!Array.isArray(ecritures) || ecritures.length === 0) {
      return NextResponse.json({ erreur: 'FEC vide ou invalide' }, { status: 422 })
    }
    return NextResponse.json(calculer(ecritures as LigneFEC[], annee))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne du moteur comptable'
    return NextResponse.json({ erreur: message }, { status: 500 })
  }
}
