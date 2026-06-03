import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface PCGEntry {
  prefixes: string[]
  label: string
  sign: 1 | -1
}

export type PCGGroupe = Record<string, PCGEntry[]>

export interface PCGMappings {
  sig: PCGGroupe
  bilan: PCGGroupe
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

export function usePCG(): { mappings: PCGMappings | null; pcgLoading: boolean; pcgError: string | null } {
  const [mappings, setMappings] = useState<PCGMappings | null>(null)
  const [pcgLoading, setPcgLoading] = useState(true)
  const [pcgError, setPcgError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('pcg_mappings')
        .select('compte_prefix, compte_label, indicateur, signe, contexte')
        .eq('actif', true)
        .order('ordre', { ascending: true })

      if (error) {
        setPcgError(error.message)
        setPcgLoading(false)
        return
      }

      setMappings({
        sig:   buildGroupe(data.filter((r: any) => r.contexte === 'sig')),
        bilan: buildGroupe(data.filter((r: any) => r.contexte === 'bilan')),
      })
      setPcgLoading(false)
    }
    load()
  }, [])

  return { mappings, pcgLoading, pcgError }
}
