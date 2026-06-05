import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// ALVIO — Moteur comptable v2 — TypeScript
// Architecture : FEC → Balance → CR + Bilan → SIG
// Classification PCG hiérarchique codée en dur
// Zéro dépendance à pcg_mappings pour le calcul
// ============================================================

interface LigneFEC {
  CompteNum: string
  Debit: number
  Credit: number
  JournalCode?: string
}

interface Etats {
  annee: number
  nbLignes: number
  controles: {
    debitTotal: number
    creditTotal: number
    equilibreFEC: boolean
    totalActif: number
    totalPassif: number
    equilibreBilan: boolean
    resultatCR: number
    resultatBilan: number
  }
  sig: Record<string, number>
  cr: Record<string, unknown>
  bilan: Record<string, unknown>
}

function r(n: number): number { return Math.round(n * 100) / 100 }

function calculer(lignes: LigneFEC[], annee: number): Etats {
  // CR
  let ventesMarchandises = 0, productionVendue = 0, productionStockee = 0
  let productionImmobilisee = 0, subventionsExploit = 0, autresProduits = 0
  let reprises = 0, transfertsCharges = 0
  let achatsMarchandises = 0, variationStocksMarch = 0
  let achatsMatieres = 0, variationStocksMat = 0, autresAchats = 0
  let servicesExt = 0, impotsTaxes = 0
  let chargesPersonnel = 0, remboursementsPers = 0
  let dotationsExploit = 0, autresChargesExploit = 0
  let produitsFinanciers = 0, chargesFinancieres = 0
  let reprisesFin = 0, dotationsFin = 0
  let produitsExcep = 0, chargesExcep = 0
  let reprisesExcep = 0, dotationsExcep = 0
  let prixCession = 0, vncActifsCedes = 0
  let participation = 0, is = 0

  // Bilan Actif
  let immoIncorpBrut = 0, immoCorpBrut = 0, immoFinBrut = 0
  let amortIncorp = 0, amortCorp = 0, deprecImmoFin = 0
  let stocksMarchandises = 0, stocksMatieres = 0, stocksEncours = 0, stocksProduits = 0
  let deprecStocks = 0
  let creancesClients = 0, deprecCreances = 0
  let creancesEtat = 0, autresCreances = 0, chargesConstatees = 0
  let tresorerieActif = 0, deprecTreso = 0, capitalNonAppele = 0

  // Bilan Passif
  let capital = 0, primes = 0, ecarts = 0, reserves = 0, reportNouveau = 0
  let subventionsInvest = 0, provisionsReglementees = 0, provisionsRisques = 0
  let empruntsOblig = 0, empruntsEtablissement = 0, autresEmpruntsLT = 0
  let dettesFournisseurs = 0, dettesSociales = 0, dettesFiscales = 0
  let autresDettes = 0, produitsConstates = 0, tresoreriePassif = 0

  let totalDebit = 0, totalCredit = 0

  for (const l of lignes) {
    const compte = l.CompteNum
    if (!compte || compte.length === 0) continue

    const d = l.Debit || 0
    const c = l.Credit || 0
    const journal = l.JournalCode || ''
    const classe = compte[0]
    const c2 = compte.slice(0, 2)
    const c3 = compte.slice(0, 3)
    const c4 = compte.slice(0, 4)

    totalDebit += d
    totalCredit += c

    // Exclure AN des classes 6 et 7
    if (journal === 'AN' && (classe === '6' || classe === '7')) continue

    // CLASSE 1 — Capitaux
    if (classe === '1') {
      const solde = c - d
      if (c2 === '10') {
        if (['101','102','103','108'].includes(c3)) capital += solde
        else if (c3 === '104') primes += solde
        else if (c3 === '105') ecarts += solde
        else if (c3 === '106' || c3 === '107') reserves += solde
        else if (c3 === '109') capitalNonAppele += (d - c)
      } else if (c2 === '11' || c2 === '12') {
        reportNouveau += solde
      } else if (c2 === '13') {
        subventionsInvest += solde
      } else if (c2 === '14') {
        provisionsReglementees += solde
      } else if (c2 === '15') {
        provisionsRisques += solde
      } else if (['16','17','18','19'].includes(c2)) {
        if (c3 === '161' || c3 === '163') empruntsOblig += solde
        else if (c3 === '164') empruntsEtablissement += solde
        else autresEmpruntsLT += solde
      }
    }

    // CLASSE 2 — Immobilisations
    else if (classe === '2') {
      if (c2 === '20') immoIncorpBrut += (d - c)
      else if (['21','22','23','24','25'].includes(c2)) immoCorpBrut += (d - c)
      else if (c2 === '26' || c2 === '27') immoFinBrut += (d - c)
      else if (c2 === '28') {
        if (c3 === '280') amortIncorp += (c - d)
        else amortCorp += (c - d)
      }
      else if (c2 === '29') {
        if (c3 === '296' || c3 === '297') deprecImmoFin += (c - d)
        else amortCorp += (c - d)
      }
    }

    // CLASSE 3 — Stocks
    else if (classe === '3') {
      if (c2 === '30' || c2 === '36' || c2 === '37') stocksMarchandises += (d - c)
      else if (c2 === '31' || c2 === '32') stocksMatieres += (d - c)
      else if (c2 === '33' || c2 === '34') stocksEncours += (d - c)
      else if (c2 === '35') stocksProduits += (d - c)
      else if (c2 === '39') deprecStocks += (c - d)
    }

    // CLASSE 4 — Tiers
    else if (classe === '4') {
      if (c2 === '40') {
        if (c3 === '409') autresCreances += (d - c)
        else dettesFournisseurs += (c - d)
      } else if (c2 === '41') {
        if (c3 === '419') autresDettes += (c - d)
        else creancesClients += (d - c)
      } else if (c2 === '42' || c2 === '43') {
        dettesSociales += (c - d)
      } else if (c2 === '44') {
        if (['441','442','449'].includes(c3)) creancesEtat += (d - c)
        else if (c3 === '445') {
          if (['4456','4458','4459'].includes(c4)) creancesEtat += (d - c)
          else dettesFiscales += (c - d)
        } else dettesFiscales += (c - d)
      } else if (c2 === '45' || c2 === '46' || c2 === '47') {
        const solde = d - c
        if (solde >= 0) autresCreances += solde
        else autresDettes += (-solde)
      } else if (c2 === '48') {
        if (c3 === '486') chargesConstatees += (d - c)
        else if (c3 === '487') produitsConstates += (c - d)
        else autresCreances += (d - c)
      } else if (c2 === '49') {
        deprecCreances += (c - d)
      }
    }

    // CLASSE 5 — Financiers
    else if (classe === '5') {
      if (c3 === '519') {
        tresoreriePassif += (c - d)
      } else if (c2 >= '50' && c2 <= '58') {
        tresorerieActif += (d - c)
      } else if (c2 === '59') {
        deprecTreso += (c - d)
      }
    }

    // CLASSE 6 — Charges
    else if (classe === '6') {
      const solde = d - c
      if (c2 === '60') {
        if (c3 === '607') achatsMarchandises += solde
        else if (c3 === '603') variationStocksMarch += solde
        else if (c3 === '601' || c3 === '602') achatsMatieres += solde
        else if (c3 === '609') achatsMarchandises -= solde // RRR obtenus
        else autresAchats += solde
      } else if (c2 === '61' || c2 === '62') {
        servicesExt += solde
      } else if (c2 === '63') {
        impotsTaxes += solde
      } else if (c2 === '64') {
        if (c3 === '649') remboursementsPers += solde
        else chargesPersonnel += solde
      } else if (c2 === '65') {
        autresChargesExploit += solde
      } else if (c2 === '66') {
        chargesFinancieres += solde
      } else if (c2 === '67') {
        if (c3 === '675') vncActifsCedes += solde
        else chargesExcep += solde
      } else if (c2 === '68') {
        if (c3 === '686') dotationsFin += solde
        else if (c3 === '687') dotationsExcep += solde
        else dotationsExploit += solde
      } else if (c2 === '69') {
        if (c3 === '691') participation += solde
        else is += solde
      }
    }

    // CLASSE 7 — Produits
    else if (classe === '7') {
      const solde = c - d
      if (c2 === '70') {
        if (c3 === '707') ventesMarchandises += solde
        else if (c3 === '709') ventesMarchandises -= solde // RRR accordés
        else productionVendue += solde
      } else if (c2 === '71') {
        productionStockee += solde
      } else if (c2 === '72') {
        productionImmobilisee += solde
      } else if (c2 === '73') {
        productionVendue += solde
      } else if (c2 === '74') {
        subventionsExploit += solde
      } else if (c2 === '75') {
        autresProduits += solde
      } else if (c2 === '76') {
        produitsFinanciers += solde
      } else if (c2 === '77') {
        if (c3 === '775') prixCession += solde
        else if (c3 === '777' || c3 === '747') {
          subventionsInvest -= solde
          autresProduits += solde
        } else produitsExcep += solde
      } else if (c2 === '78') {
        if (c3 === '786') reprisesFin += solde
        else if (c3 === '787') reprisesExcep += solde
        else reprises += solde
      } else if (c2 === '79') {
        transfertsCharges += solde
      }
    }
  }

  // Charges personnel nettes
  chargesPersonnel = chargesPersonnel - remboursementsPers

  // SIG
  const coutMarchandises = achatsMarchandises + variationStocksMarch
  const margeCommerciale = ventesMarchandises - coutMarchandises
  const prodExercice = productionVendue + productionStockee + productionImmobilisee
  const cosoIntermediaires = achatsMatieres + variationStocksMat + autresAchats + servicesExt
  const valeurAjoutee = margeCommerciale + prodExercice - cosoIntermediaires
  const ebe = valeurAjoutee + subventionsExploit - impotsTaxes - chargesPersonnel
  const rex = ebe - dotationsExploit + reprises + autresProduits + transfertsCharges - autresChargesExploit
  const rfin = produitsFinanciers + reprisesFin - chargesFinancieres - dotationsFin
  const rexcep = produitsExcep + reprisesExcep + prixCession - chargesExcep - dotationsExcep - vncActifsCedes
  const rnetCR = rex + rfin + rexcep - participation - is
  const ca = ventesMarchandises + productionVendue

  // Bilan
  const actifImmoNet = (immoIncorpBrut + immoCorpBrut + immoFinBrut) - (amortIncorp + amortCorp + deprecImmoFin)
  const stocksNets = stocksMarchandises + stocksMatieres + stocksEncours + stocksProduits - deprecStocks
  const creancesNettes = creancesClients - deprecCreances
  const tresoActifNet = tresorerieActif - deprecTreso
  const totalActif = capitalNonAppele + actifImmoNet + stocksNets + creancesNettes + creancesEtat + autresCreances + chargesConstatees + tresoActifNet

  const capPropres = capital + primes + ecarts + reserves + reportNouveau + rnetCR + subventionsInvest + provisionsReglementees
  const dettesLT = provisionsRisques + empruntsOblig + empruntsEtablissement + autresEmpruntsLT
  const dettesCT = dettesFournisseurs + dettesSociales + dettesFiscales + autresDettes + produitsConstates + tresoreriePassif
  const totalPassif = capPropres + dettesLT + dettesCT

  const sig = {
    ca: r(ca),
    ventesMarchandises: r(ventesMarchandises),
    coutMarchandises: r(coutMarchandises),
    margeCommerciale: r(margeCommerciale),
    productionVendue: r(productionVendue),
    productionStockee: r(productionStockee),
    productionImmobilisee: r(productionImmobilisee),
    productionExercice: r(prodExercice),
    consommationsInt: r(cosoIntermediaires),
    subventions: r(subventionsExploit),
    valeurAjoutee: r(valeurAjoutee),
    impotsTaxes: r(impotsTaxes),
    chargesPersonnel: r(chargesPersonnel),
    ebe: r(ebe),
    dotations: r(dotationsExploit),
    reprises: r(reprises),
    autresProduits: r(autresProduits),
    autresCharges: r(autresChargesExploit),
    rex: r(rex),
    produitsFinanciers: r(produitsFinanciers),
    chargesFinancieres: r(chargesFinancieres),
    rfin: r(rfin),
    produitsExcep: r(produitsExcep),
    chargesExcep: r(chargesExcep),
    rexcep: r(rexcep),
    participation: r(participation),
    is: r(is),
    resultatNet: r(rnetCR),
    tauxMb: ca > 0 ? r(margeCommerciale / ca * 100) : 0,
    tauxEbe: ca > 0 ? r(ebe / ca * 100) : 0,
    tauxRex: ca > 0 ? r(rex / ca * 100) : 0,
    tauxRnet: ca > 0 ? r(rnetCR / ca * 100) : 0,
    tauxPers: ca > 0 ? r(chargesPersonnel / ca * 100) : 0,
  }

  const cr = {
    produitsExploitation: {
      ventesMarchandises: r(ventesMarchandises),
      productionVendue: r(productionVendue),
      productionStockee: r(productionStockee),
      productionImmobilisee: r(productionImmobilisee),
      subventions: r(subventionsExploit),
      autresProduits: r(autresProduits),
      reprises: r(reprises),
      transfertsCharges: r(transfertsCharges),
      total: r(ventesMarchandises + productionVendue + productionStockee + productionImmobilisee + subventionsExploit + autresProduits + reprises + transfertsCharges),
    },
    chargesExploitation: {
      achatsMarchandises: r(achatsMarchandises),
      variationStocksMarch: r(variationStocksMarch),
      autresAchats: r(autresAchats),
      servicesExt: r(servicesExt),
      impotsTaxes: r(impotsTaxes),
      chargesPersonnel: r(chargesPersonnel),
      dotations: r(dotationsExploit),
      autresCharges: r(autresChargesExploit),
      total: r(coutMarchandises + autresAchats + servicesExt + impotsTaxes + chargesPersonnel + dotationsExploit + autresChargesExploit),
    },
    resultatExploitation: r(rex),
    resultatFinancier: r(rfin),
    resultatExceptionnel: r(rexcep),
    participation: r(participation),
    is: r(is),
    resultatNet: r(rnetCR),
  }

  const bilan = {
    actif: {
      immoIncorpBrut: r(immoIncorpBrut),
      immoCorpBrut: r(immoCorpBrut),
      immoFinBrut: r(immoFinBrut),
      amortIncorp: r(amortIncorp),
      amortCorp: r(amortCorp),
      deprecImmoFin: r(deprecImmoFin),
      actifImmoNet: r(actifImmoNet),
      stocksMarchandises: r(stocksMarchandises),
      stocksMatieres: r(stocksMatieres),
      stocksEncours: r(stocksEncours),
      stocksProduits: r(stocksProduits),
      deprecStocks: r(deprecStocks),
      creancesClients: r(creancesNettes),
      creancesEtat: r(creancesEtat),
      autresCreances: r(autresCreances),
      chargesConstatees: r(chargesConstatees),
      tresorerie: r(tresoActifNet),
      totalActif: r(totalActif),
    },
    passif: {
      capital: r(capital),
      primes: r(primes),
      reserves: r(reserves),
      reportNouveau: r(reportNouveau),
      resultatNet: r(rnetCR),
      subventionsInvest: r(subventionsInvest),
      provisionsReglementees: r(provisionsReglementees),
      capitauxPropres: r(capPropres),
      provisionsRisques: r(provisionsRisques),
      empruntsOblig: r(empruntsOblig),
      empruntsEtablissement: r(empruntsEtablissement),
      autresEmpruntsLT: r(autresEmpruntsLT),
      dettesFournisseurs: r(dettesFournisseurs),
      dettesSociales: r(dettesSociales),
      dettesFiscales: r(dettesFiscales),
      autresDettes: r(autresDettes),
      produitsConstates: r(produitsConstates),
      tresoreriePassif: r(tresoreriePassif),
      totalPassif: r(totalPassif),
    }
  }

  return {
    annee,
    nbLignes: lignes.length,
    controles: {
      debitTotal: r(totalDebit),
      creditTotal: r(totalCredit),
      equilibreFEC: Math.abs(totalDebit - totalCredit) < 1,
      totalActif: r(totalActif),
      totalPassif: r(totalPassif),
      equilibreBilan: Math.abs(totalActif - totalPassif) < 1,
      resultatCR: r(rnetCR),
      resultatBilan: r(rnetCR),
    },
    sig,
    cr,
    bilan,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const annee = parseInt(searchParams.get('annee') || '0')
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
  const etats = calculer(lignes, annee)

  return NextResponse.json(etats)
}
