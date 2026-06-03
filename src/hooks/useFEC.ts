import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { PCGGroupe } from '@/hooks/usePCG'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export interface LigneFEC {
  CompteNum: string
  CompteLib: string
  Debit: number
  Credit: number
  EcritureDate: string
  EcritureLib: string
  PieceRef: string
}

export interface ExerciceData {
  annee: number
  lignes: LigneFEC[]
  nomFichier: string
}

export interface Indicateurs {
  ca: number
  achats: number
  ext: number
  mb: number
  imp63: number
  va: number
  pers64: number
  ebe: number
  dot68: number
  rex: number
  fin66: number
  fin76: number
  rfin: number
  exc67: number
  exc77: number
  is695: number
  rnet: number
  treso: number
  creances: number
  dettes: number
  bfr: number
  tauxMb: number
  tauxEbe: number
  tauxRex: number
  tauxRnet: number
  tauxPers: number
}

function toIso(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d.slice(0, 10)
  if (d.length === 8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)
  return d
}

export function filtrerLignes(lignes: LigneFEC[], periodeTab: 'exercice'|'perso', dateDebut: string, dateFin: string): LigneFEC[] {
  if (periodeTab === 'exercice' || (!dateDebut && !dateFin)) return lignes
  return lignes.filter(l => {
    const iso = toIso(l.EcritureDate)
    if (dateDebut && iso < dateDebut) return false
    if (dateFin && iso > dateFin) return false
    return true
  })
}

// Calcule le solde d'un indicateur PCG depuis les lignes FEC et le mapping Supabase
function soldePCG(lignes: LigneFEC[], indicateur: string, pcg: PCGGroupe): number {
  const groupe = pcg[indicateur]
  if (!groupe) return 0
  let total = 0
  for (const l of lignes) {
    for (const g of groupe) {
      if (g.prefixes.some(p => l.CompteNum.startsWith(p))) {
        total += (l.Debit - l.Credit) * g.sign
        break
      }
    }
  }
  return total
}

export function calculerIndicateurs(lignes: LigneFEC[], pcg: PCGGroupe): Indicateurs {
  const s = (indicateur: string) => soldePCG(lignes, indicateur, pcg)

  const ventesMarchandises    = s('ventesMarchandises')
  const coutMarchandises      = s('coutMarchandises')
  const margeCommerciale      = ventesMarchandises - coutMarchandises
  const productionVendue      = s('productionVendue')
  const productionStockee     = s('productionStockee')
  const productionImmobilisee = s('productionImmobilisee')
  const productionExercice    = productionVendue + productionStockee + productionImmobilisee
  const consommationsExt      = s('consommationsIntermediaires')
  const subventions           = s('subventions')
  const valeurAjoutee         = margeCommerciale + productionExercice - consommationsExt
  const impotsTaxes           = s('impotsTaxes')
  const chargesPersonnel      = s('chargesPersonnel')
  const ebe                   = valeurAjoutee + subventions - impotsTaxes - chargesPersonnel
  const dotations             = s('dotations')
  const reprises              = s('reprises')
  const transfertsCharges     = s('transfertsCharges')
  const autresProduits        = s('autresProduits')
  const autresCharges         = s('autresCharges')
  const rex                   = ebe - dotations + reprises + transfertsCharges + autresProduits - autresCharges
  const produitsFinanciers    = s('produitsFinanciers')
  const chargesFinancieres    = s('chargesFinancieres')
  const rfin                  = produitsFinanciers - chargesFinancieres
  const produitsExcep         = s('produitsExceptionnels')
  const chargesExcep          = s('chargesExceptionnelles')
  const participation         = s('participation')
  const is                    = s('is')
  const rnet                  = rex + rfin + (produitsExcep - chargesExcep) - participation - is
  const treso                 = s('tresorerie')
  const creances              = s('creancesClients')
  const dettes                = s('dettesFournisseurs')
  const bfr                   = creances - dettes
  const ca                    = productionVendue + ventesMarchandises

  return {
    ca,
    achats: coutMarchandises + consommationsExt,
    ext: consommationsExt,
    mb: margeCommerciale,
    imp63: impotsTaxes,
    va: valeurAjoutee,
    pers64: chargesPersonnel,
    ebe,
    dot68: dotations,
    rex,
    fin66: chargesFinancieres,
    fin76: produitsFinanciers,
    rfin,
    exc67: chargesExcep,
    exc77: produitsExcep,
    is695: is,
    rnet,
    treso,
    creances,
    dettes,
    bfr,
    tauxMb:   ca > 0 ? margeCommerciale/ca*100 : 0,
    tauxEbe:  ca > 0 ? ebe/ca*100 : 0,
    tauxRex:  ca > 0 ? rex/ca*100 : 0,
    tauxRnet: ca > 0 ? rnet/ca*100 : 0,
    tauxPers: ca > 0 ? chargesPersonnel/ca*100 : 0,
  }
}

export function getMonthlyCash(lignes: LigneFEC[], pcg: PCGGroupe): {m:string; val:number}[] {
  const tresoGroupe = pcg['tresorerie']
  if (!tresoGroupe) return []
  const byMonth: Record<string,number> = {}
  for (const l of lignes) {
    const match = tresoGroupe.some(g => g.prefixes.some(p => l.CompteNum.startsWith(p)))
    if (match) {
      const d = l.EcritureDate || ''
      const m = d.length === 8 ? d.slice(0,4)+'-'+d.slice(4,6) : d.length >= 7 ? d.slice(0,7) : 'ND'
      byMonth[m] = (byMonth[m] || 0) + (l.Debit - l.Credit)
    }
  }
  return Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).slice(-12).map(([m,v]) => ({ m: m.slice(5)||m, val: v }))
}

export function getDetailCompte(lignes: LigneFEC[], prefixes: string[]): {num:string;lib:string;solde:number;lignes:LigneFEC[]}[] {
  const comptes: Record<string,{lib:string;solde:number;lignes:LigneFEC[]}> = {}
  for (const l of lignes) {
    for (const p of prefixes) {
      if (l.CompteNum.startsWith(p)) {
        if (!comptes[l.CompteNum]) comptes[l.CompteNum] = { lib: l.CompteLib||'', solde: 0, lignes: [] }
        comptes[l.CompteNum].solde += l.Debit - l.Credit
        comptes[l.CompteNum].lignes.push(l)
        break
      }
    }
  }
  return Object.entries(comptes).map(([num,v]) => ({ num, ...v })).sort((a,b) => a.num.localeCompare(b.num))
}

export function useFEC() {
  const [exercices, setExercices] = useState<Record<number, ExerciceData>>({})
  const [anneeActive, setAnneeActive] = useState<number>(new Date().getFullYear())
  const [periodeTab, setPeriodeTab] = useState<'exercice'|'perso'>('exercice')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string|null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUserId(user.id)
      const { data } = await supabase.from('fec_exercices').select('annee, ecritures, nom_fichier').eq('user_id', user.id).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const map: Record<number, ExerciceData> = {}
        for (const row of data) {
          map[row.annee] = { annee: row.annee, lignes: row.ecritures as LigneFEC[], nomFichier: row.nom_fichier || `FEC ${row.annee}` }
        }
        setExercices(map)
        setAnneeActive(data[0].annee)
      }
      setLoading(false)
    }
    load()
  }, [])

  const lignesActives = (() => {
    if (periodeTab === 'perso' && dateDebut && dateFin) {
      const merged: LigneFEC[] = []
      for (const a of Object.keys(exercices).map(Number).sort((x,y) => x-y)) {
        const ex = exercices[a]; if (!ex) continue
        const dates = ex.lignes.map(l => toIso(l.EcritureDate)).filter(Boolean)
        const fin = dates[dates.length-1]||''; const debut = dates[0]||''
        if (toIso(fin) >= dateDebut && toIso(debut) <= dateFin) merged.push(...ex.lignes)
      }
      if (merged.length > 0) return filtrerLignes(merged, 'perso', dateDebut, dateFin)
    }
    return exercices[anneeActive]?.lignes ?? []
  })()

  const anneesDisponibles = Object.keys(exercices).map(Number).sort((a,b) => b-a)

  return {
    exercices, anneeActive, setAnneeActive,
    periodeTab, setPeriodeTab,
    dateDebut, setDateDebut, dateFin, setDateFin,
    loading, userId, lignesActives,
    anneesDisponibles,
  }
}
