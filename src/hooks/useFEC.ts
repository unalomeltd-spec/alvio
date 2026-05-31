import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

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

export function calculerIndicateurs(lignes: LigneFEC[]): Indicateurs {
  const solde = (rs: string[]) => { let t = 0; for (const l of lignes) for (const r of rs) if (l.CompteNum.startsWith(r)) { t += l.Debit - l.Credit; break }; return t }
  const ca = -solde(['701','702','703','704','705','706','707','708'])
  const achats = solde(['601','602','603','604','605','606','607','608','609'])
  const ext = solde(['61','62'])
  const mb = ca - achats - ext
  const imp63 = solde(['63'])
  const va = mb - imp63
  const pers64 = solde(['64'])
  const ebe = va - pers64
  const dot68 = solde(['681','686','687'])
  const rex = ebe - dot68
  const fin66 = solde(['66']); const fin76 = -solde(['76'])
  const rfin = fin76 - fin66
  const exc67 = solde(['67']); const exc77 = -solde(['77'])
  const is695 = solde(['695','696','697','698','699'])
  const rnet = rex + rfin + (exc77 - exc67) - is695
  const treso = solde(['51','53'])
  const creances = solde(['41'])
  const dettes = -solde(['40','42','43'])
  const bfr = creances - dettes
  return {
    ca, achats, ext, mb, imp63, va, pers64, ebe, dot68, rex,
    fin66, fin76, rfin, exc67, exc77, is695, rnet,
    treso, creances, dettes, bfr,
    tauxMb: ca > 0 ? mb/ca*100 : 0,
    tauxEbe: ca > 0 ? ebe/ca*100 : 0,
    tauxRex: ca > 0 ? rex/ca*100 : 0,
    tauxRnet: ca > 0 ? rnet/ca*100 : 0,
    tauxPers: ca > 0 ? pers64/ca*100 : 0,
  }
}

export function getMonthlyCash(lignes: LigneFEC[]): {m:string; val:number}[] {
  const byMonth: Record<string,number> = {}
  for (const l of lignes) {
    if (l.CompteNum.startsWith('51') || l.CompteNum.startsWith('53')) {
      const d = l.EcritureDate || ''
      const m = d.length === 8 ? d.slice(0,4)+'-'+d.slice(4,6) : d.length >= 7 ? d.slice(0,7) : 'ND'
      byMonth[m] = (byMonth[m] || 0) + (l.Debit - l.Credit)
    }
  }
  let cum = 0
  return Object.entries(byMonth).sort(([a],[b]) => a.localeCompare(b)).slice(-12)
    .map(([m,v]) => { cum += v; return { m: m.slice(5)||m, val: cum } })
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
  const ind = lignesActives.length > 0 ? calculerIndicateurs(lignesActives) : null
  const indN1 = exercices[anneeActive-1] ? calculerIndicateurs(exercices[anneeActive-1].lignes) : null

  return {
    exercices, anneeActive, setAnneeActive,
    periodeTab, setPeriodeTab,
    dateDebut, setDateDebut, dateFin, setDateFin,
    loading, userId, lignesActives,
    anneesDisponibles, ind, indN1,
  }
}
