'use client'
import { useState, useCallback } from 'react'

const KEY = 'alvio-period'

interface PeriodState {
  anneeActive: number
  periodeTab: 'exercice' | 'perso'
  dateDebut: string
  dateFin: string
  anneeN1: number
  dateDebutN1: string
  dateFinN1: string
}

function load(): Partial<PeriodState> {
  if (typeof window === 'undefined') return {}
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : {} } catch { return {} }
}

function persist(patch: Partial<PeriodState>) {
  if (typeof window === 'undefined') return
  try {
    const prev = load()
    localStorage.setItem(KEY, JSON.stringify({ ...prev, ...patch }))
  } catch {}
}

export function hasSavedPeriod(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem(KEY)
}

export function usePeriod(defaultAnnee: number) {
  const saved = load()

  const [anneeActive, _setAnneeActive] = useState<number>(saved.anneeActive ?? defaultAnnee)
  const [periodeTab, _setPeriodeTab] = useState<'exercice'|'perso'>(saved.periodeTab ?? 'exercice')
  const [dateDebut, _setDateDebut] = useState<string>(saved.dateDebut ?? '')
  const [dateFin, _setDateFin] = useState<string>(saved.dateFin ?? '')
  const [anneeN1, _setAnneeN1] = useState<number>(saved.anneeN1 ?? defaultAnnee - 1)
  const [dateDebutN1, _setDateDebutN1] = useState<string>(saved.dateDebutN1 ?? '')
  const [dateFinN1, _setDateFinN1] = useState<string>(saved.dateFinN1 ?? '')

  const setAnneeActive = useCallback((v: number) => { _setAnneeActive(v); persist({ anneeActive: v }) }, [])
  const setPeriodeTab = useCallback((v: 'exercice'|'perso') => { _setPeriodeTab(v); persist({ periodeTab: v }) }, [])
  const setDateDebut = useCallback((v: string) => { _setDateDebut(v); persist({ dateDebut: v }) }, [])
  const setDateFin = useCallback((v: string) => { _setDateFin(v); persist({ dateFin: v }) }, [])
  const setAnneeN1 = useCallback((v: number) => { _setAnneeN1(v); persist({ anneeN1: v }) }, [])
  const setDateDebutN1 = useCallback((v: string) => { _setDateDebutN1(v); persist({ dateDebutN1: v }) }, [])
  const setDateFinN1 = useCallback((v: string) => { _setDateFinN1(v); persist({ dateFinN1: v }) }, [])

  return { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 }
}
