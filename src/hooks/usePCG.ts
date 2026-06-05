import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { LigneFEC } from '@/hooks/useFEC'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type TypePCG = 'classique' | 'asso'

export interface PCGEntry {
  prefixes: string[]
  label: string
  sign: 1 | -1
}

export type PCGGroupe = Record<string, PCGEntry[]>

export interface PCGIndex {
  entries: { prefix: string; indicateur: string; sign: 1|-1; label: string }[]
}

export interface PCGMappings {
  sig: PCGGroupe
  bilan: PCGGroupe
  sigIndex: PCGIndex
  bilanIndex: PCGIndex
  allIndex: PCGIndex
  typePcg: TypePCG
}

function buildGroupe(rows: { compte_prefix: string; compte_label: string; indicateur: string; signe: string }[]): PCGGroupe {
  const result: PCGGroupe = {}
  for (const row of rows) {
    if (!result[row.indicateur]) result[row.indicateur] = []
    result[row.indicateur].push({
      prefixes: [row.compte_prefix],
      label: row.compte_label,
      sign: parseInt(row.signe) as 1 | -1,
    })
  }
  return result
}

function buildIndex(rows: { compte_prefix: string; compte_label: string; indicateur: string; signe: string }[]): PCGIndex {
  const entries = rows.map(r => ({
    prefix: r.compte_prefix,
    indicateur: r.indicateur,
    sign: parseInt(r.signe) as 1|-1,
    label: r.compte_label,
  }))
  entries.sort((a, b) => b.prefix.length - a.prefix.length)
  return { entries }
}


function fallbackParClasse(compteNum: string): { indicateur: string; sign: 1|-1; label: string } | null {
  const cl  = compteNum[0]
  const sc  = compteNum.slice(0, 2)
  const ssc = compteNum.slice(0, 3)
  if (cl === '1') {
    if (sc >= '10' && sc <= '13') return { indicateur: 'capital', sign: -1, label: 'Capitaux propres' }
    if (sc === '14')              return { indicateur: 'provisionsReglementees', sign: -1, label: 'Provisions reglementees' }
    if (sc === '15')              return { indicateur: 'provisions', sign: -1, label: 'Provisions pour risques' }
    if (sc >= '16' && sc <= '19') return { indicateur: 'autresEmprunts', sign: -1, label: 'Emprunts et dettes LT' }
  }
  if (cl === '2') {
    if (sc === '20')              return { indicateur: 'immobIncorporelBrut', sign: 1, label: 'Immo incorporelles' }
    if (sc >= '21' && sc <= '25') return { indicateur: 'immobCorporelBrut', sign: 1, label: 'Immo corporelles' }
    if (sc >= '26' && sc <= '27') return { indicateur: 'immobFinancierBrut', sign: 1, label: 'Immo financieres' }
    if (ssc === '280')            return { indicateur: 'immobIncorporelAmort', sign: -1, label: 'Amort incorporels' }
    if (sc === '28')              return { indicateur: 'immobCorporelAmort', sign: -1, label: 'Amort corporels' }
    if (sc === '29')              return { indicateur: 'immobCorporelAmort', sign: -1, label: 'Depreciations immo' }
  }
  if (cl === '3') {
    if (sc === '30' || sc === '36' || sc === '37') return { indicateur: 'stocksMarchandises', sign: 1, label: 'Stocks marchandises' }
    if (sc >= '31' && sc <= '32') return { indicateur: 'stocksMP', sign: 1, label: 'Matieres premieres' }
    if (sc >= '33' && sc <= '34') return { indicateur: 'stocksEncours', sign: 1, label: 'En-cours' }
    if (sc === '35')              return { indicateur: 'stocksProduits', sign: 1, label: 'Produits finis' }
    if (sc === '39')              return { indicateur: 'stocksMarchandises', sign: -1, label: 'Depreciations stocks' }
  }
  if (cl === '4') {
    if (sc === '40')                return { indicateur: 'dettesFournisseurs', sign: -1, label: 'Fournisseurs' }
    if (sc === '41')                return { indicateur: 'creancesClients', sign: 1, label: 'Clients' }
    if (sc === '42' || sc === '43') return { indicateur: 'dettesSociales', sign: -1, label: 'Personnel et orga sociaux' }
    if (ssc === '445')              return { indicateur: 'creancesEtat', sign: 1, label: 'TVA deductible' }
    if (sc === '44')                return { indicateur: 'dettesFiscales', sign: -1, label: 'Etat et collectivites' }
    if (sc === '45')                return { indicateur: 'autresDettes', sign: -1, label: 'Groupe et associes' }
    if (ssc === '486')              return { indicateur: 'autresCreances', sign: 1, label: 'Charges constatees avance' }
    if (ssc === '487')              return { indicateur: 'autresDettes', sign: -1, label: 'Produits constates avance' }
    if (sc === '46' || sc === '47' || sc === '48') return { indicateur: 'autresCreances', sign: 1, label: 'Debiteurs divers' }
    if (sc === '49')                return { indicateur: 'creancesClients', sign: -1, label: 'Depreciations creances' }
  }
  if (cl === '5') {
    if (sc >= '50' && sc <= '58') return { indicateur: 'tresorerie', sign: 1, label: 'Comptes financiers' }
    if (sc === '59')              return { indicateur: 'tresorerie', sign: -1, label: 'Depreciations financieres' }
  }
  if (cl === '6') {
    if (sc === '60') {
      if (ssc === '603') return { indicateur: 'coutMarchandises', sign: 1, label: 'Variation de stocks' }
      return { indicateur: 'coutMarchandises', sign: 1, label: 'Achats' }
    }
    if (sc === '61' || sc === '62') return { indicateur: 'consommationsIntermediaires', sign: 1, label: 'Services exterieurs' }
    if (sc === '63') return { indicateur: 'impotsTaxes', sign: 1, label: 'Impots et taxes' }
    if (sc === '64') return { indicateur: 'chargesPersonnel', sign: 1, label: 'Charges de personnel' }
    if (sc === '65') return { indicateur: 'autresCharges', sign: 1, label: 'Autres charges' }
    if (sc === '66') return { indicateur: 'chargesFinancieres', sign: 1, label: 'Charges financieres' }
    if (sc === '67') return { indicateur: 'chargesExceptionnelles', sign: 1, label: 'Charges exceptionnelles' }
    if (sc === '68') return { indicateur: 'dotations', sign: 1, label: 'Dotations' }
    if (sc === '69') return { indicateur: 'is', sign: 1, label: 'IS' }
  }
  if (cl === '7') {
    if (sc === '70') return { indicateur: 'ventesMarchandises', sign: -1, label: 'Ventes' }
    if (sc === '71') return { indicateur: 'productionStockee', sign: -1, label: 'Production stockee' }
    if (sc === '72') return { indicateur: 'productionImmobilisee', sign: -1, label: 'Production immobilisee' }
    if (sc === '73') return { indicateur: 'productionVendue', sign: -1, label: 'Ventes produits' }
    if (sc === '74') return { indicateur: 'subventions', sign: -1, label: 'Subventions exploitation' }
    if (sc === '75') return { indicateur: 'autresProduits', sign: -1, label: 'Autres produits' }
    if (sc === '76') return { indicateur: 'produitsFinanciers', sign: -1, label: 'Produits financiers' }
    if (sc === '77') return { indicateur: 'produitsExceptionnels', sign: -1, label: 'Produits exceptionnels' }
    if (sc === '78') return { indicateur: 'reprises', sign: -1, label: 'Reprises' }
    if (sc === '79') return { indicateur: 'autresProduits', sign: -1, label: 'Transferts de charges (ancien)' }
  }
  return null
}

function resolveCompte(compteNum: string, index: PCGIndex): { indicateur: string; sign: 1|-1; label: string } | null {
  for (const e of index.entries) {
    if (compteNum.startsWith(e.prefix)) return e
  }
  return fallbackParClasse(compteNum)
}

export function getSousComptes(
  lignes: LigneFEC[],
  groupeKeys: string | string[],
  pcg: PCGGroupe,
  index?: PCGIndex
): { prefix: string; label: string; valeur: number; ecritures: LigneFEC[] }[] {
  const keys = new Set(Array.isArray(groupeKeys) ? groupeKeys : [groupeKeys])
  const byCompte: Record<string, { label: string; valeur: number; ecritures: LigneFEC[] }> = {}

  for (const l of lignes) {
    if (index) {
      const resolved = resolveCompte(l.CompteNum, index)
      if (!resolved || !keys.has(resolved.indicateur)) continue
      if (!byCompte[l.CompteNum]) byCompte[l.CompteNum] = { label: l.CompteLib || resolved.label, valeur: 0, ecritures: [] }
      byCompte[l.CompteNum].valeur += (l.Debit - l.Credit) * resolved.sign
      byCompte[l.CompteNum].ecritures.push(l)
    } else {
      for (const key of keys) {
        const groupe = pcg[key]
        if (!groupe) continue
        for (const g of groupe) {
          if (g.prefixes.some(p => l.CompteNum.startsWith(p))) {
            const ck = l.CompteNum
            if (!byCompte[ck]) byCompte[ck] = { label: l.CompteLib || g.label, valeur: 0, ecritures: [] }
            byCompte[ck].valeur += (l.Debit - l.Credit) * g.sign
            byCompte[ck].ecritures.push(l)
            break
          }
        }
      }
    }
  }

  return Object.entries(byCompte)
    .map(([num, d]) => ({ prefix: num, label: d.label, valeur: d.valeur, ecritures: d.ecritures }))
    .filter(s => Math.abs(s.valeur) > 0.5)
    .sort((a, b) => a.prefix.localeCompare(b.prefix))
}

export function soldePCG(lignes: LigneFEC[], groupeKey: string | string[], pcg: PCGGroupe, index?: PCGIndex): number {
  return getSousComptes(lignes, groupeKey, pcg, index).reduce((s, c) => s + c.valeur, 0)
}

function buildMappings(data: any[], typePcg: TypePCG): PCGMappings {
  const sigRows   = data.filter((r: any) => r.contexte === 'sig')
  const bilanRows = data.filter((r: any) => r.contexte === 'bilan')
  const allRows   = [...sigRows, ...bilanRows]
  return {
    sig:        buildGroupe(sigRows),
    bilan:      buildGroupe(bilanRows),
    sigIndex:   buildIndex(sigRows),
    bilanIndex: buildIndex(bilanRows),
    allIndex:   buildIndex(allRows),
    typePcg,
  }
}

// Hook principal — prend le type PCG de la fiche entreprise
// typePcg = null tant que la fiche n'est pas chargée → on attend
export function usePCG(typePcg: TypePCG | null): {
  mappings: PCGMappings | null
  pcgLoading: boolean
  pcgError: string | null
} {
  const [mappings, setMappings] = useState<PCGMappings | null>(null)
  const [pcgLoading, setPcgLoading] = useState(true)
  const [pcgError, setPcgError] = useState<string | null>(null)

  useEffect(() => {
    if (typePcg === null) return  // attendre que le type soit connu

    setPcgLoading(true)
    const load = async () => {
      const { data, error } = await supabase
        .from('pcg_mappings')
        .select('compte_prefix, compte_label, indicateur, signe, contexte')
        .eq('actif', true)
        .eq('type_pcg', typePcg)
        .order('ordre', { ascending: true })

      if (error) {
        setPcgError(error.message)
        setPcgLoading(false)
        return
      }

      setMappings(buildMappings(data, typePcg))
      setPcgLoading(false)
    }
    load()
  }, [typePcg])

  return { mappings, pcgLoading, pcgError }
}
