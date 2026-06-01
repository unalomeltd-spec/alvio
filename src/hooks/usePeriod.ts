import { useState } from 'react'

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
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : {} } catch { return {} }
}

function save(s: Partial<PeriodState>) {
  try {
    const prev = load()
    localStorage.setItem(KEY, JSON.stringify({ ...prev, ...s }))
  } catch {}
}

export function usePeriod(defaultAnnee: number) {
  const saved = load()
  const [anneeActive, _setAnneeActive]     = useState<number>(saved.anneeActive ?? defaultAnnee)
  const [periodeTab, _setPeriodeTab]       = useState<'exercice'|'perso'>(saved.periodeTab ?? 'exercice')
  const [dateDebut, _setDateDebut]         = useState<string>(saved.dateDebut ?? '')
  const [dateFin, _setDateFin]             = useState<string>(saved.dateFin ?? '')
  const [anneeN1, _setAnneeN1]             = useState<number>(saved.anneeN1 ?? defaultAnnee - 1)
  const [dateDebutN1, _setDateDebutN1]     = useState<string>(saved.dateDebutN1 ?? '')
  const [dateFinN1, _setDateFinN1]         = useState<string>(saved.dateFinN1 ?? '')

  const setAnneeActive = (v: number)           => { _setAnneeActive(v);  save({ anneeActive: v }) }
  const setPeriodeTab  = (v: 'exercice'|'perso') => { _setPeriodeTab(v); save({ periodeTab: v }) }
  const setDateDebut   = (v: string)           => { _setDateDebut(v);   save({ dateDebut: v }) }
  const setDateFin     = (v: string)           => { _setDateFin(v);     save({ dateFin: v }) }
  const setAnneeN1     = (v: number)           => { _setAnneeN1(v);     save({ anneeN1: v }) }
  const setDateDebutN1 = (v: string)           => { _setDateDebutN1(v); save({ dateDebutN1: v }) }
  const setDateFinN1   = (v: string)           => { _setDateFinN1(v);   save({ dateFinN1: v }) }

  return { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 }
}
