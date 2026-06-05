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

function resolveCompte(compteNum: string, index: PCGIndex): { indicateur: string; sign: 1|-1; label: string } | null {
  for (const e of index.entries) {
    if (compteNum.startsWith(e.prefix)) return e
  }
  return null
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
