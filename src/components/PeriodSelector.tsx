'use client'
import { useState } from 'react'

interface PeriodSelectorProps {
  annees: number[]
  anneeActive: number
  setAnneeActive: (a: number) => void
  periodeTab: 'exercice' | 'perso'
  setPeriodeTab: (v: 'exercice' | 'perso') => void
  dateDebut: string
  setDateDebut: (v: string) => void
  dateFin: string
  setDateFin: (v: string) => void
}

export default function PeriodSelector({ annees, anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false)

  const setPreset = (debut: string, fin: string) => {
    setDateDebut(debut); setDateFin(fin); setPeriodeTab('perso'); setOpen(false)
  }

  const presets = (annee: number) => {
    const y = annee
    return [
      { label: 'T1', debut: `${y}-01-01`, fin: `${y}-03-31` },
      { label: 'T2', debut: `${y}-04-01`, fin: `${y}-06-30` },
      { label: 'T3', debut: `${y}-07-01`, fin: `${y}-09-30` },
      { label: 'T4', debut: `${y}-10-01`, fin: `${y}-12-31` },
      { label: '6 derniers mois', debut: `${y}-07-01`, fin: `${y}-12-31` },
      { label: 'Semestre 1', debut: `${y}-01-01`, fin: `${y}-06-30` },
    ]
  }

  const label = (() => {
    if (periodeTab === 'exercice') return `Exercice ${anneeActive}`
    if (dateDebut && dateFin) {
      const fd = (d: string) => d.slice(8,10) + '/' + d.slice(5,7) + '/' + d.slice(0,4)
      return `${fd(dateDebut)} → ${fd(dateFin)}`
    }
    return 'Période personnalisée'
  })()

  return (
    <div style={{ position: 'relative', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F2F3F5', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 500, color: '#1A1A1A', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="#8C9BAB" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, zIndex: 100, minWidth: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>

            {/* Exercices disponibles */}
            <div style={{ padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '4px 14px 6px', fontSize: 10, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Exercice</div>
              {annees.map(a => (
                <div key={a} onClick={() => { setAnneeActive(a); setPeriodeTab('exercice'); setOpen(false) }}
                  style={{ padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: anneeActive === a && periodeTab === 'exercice' ? '#B8A98A' : '#1A1A1A', background: anneeActive === a && periodeTab === 'exercice' ? 'rgba(184,169,138,0.08)' : 'transparent', fontWeight: anneeActive === a && periodeTab === 'exercice' ? 500 : 400 }}
                  onMouseEnter={e => { if (!(anneeActive === a && periodeTab === 'exercice')) (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = anneeActive === a && periodeTab === 'exercice' ? 'rgba(184,169,138,0.08)' : 'transparent' }}>
                  Exercice {a} — complet
                </div>
              ))}
            </div>

            {/* Trimestres & semestres */}
            <div style={{ padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '4px 14px 6px', fontSize: 10, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Périodes {anneeActive}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: '0 8px' }}>
                {presets(anneeActive).map(p => (
                  <div key={p.label} onClick={() => setPreset(p.debut, p.fin)}
                    style={{ padding: '6px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 6, color: dateDebut === p.debut && dateFin === p.fin ? '#B8A98A' : '#1A1A1A', background: dateDebut === p.debut && dateFin === p.fin ? 'rgba(184,169,138,0.1)' : 'transparent', textAlign: 'center', fontWeight: 500 }}
                    onMouseEnter={e => { if (!(dateDebut === p.debut && dateFin === p.fin)) (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = dateDebut === p.debut && dateFin === p.fin ? 'rgba(184,169,138,0.1)' : 'transparent' }}>
                    {p.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Dates personnalisées */}
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Personnalisé</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="date" value={dateDebut} onChange={e => { setDateDebut(e.target.value); setPeriodeTab('perso') }}
                  style={{ flex: 1, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', color: '#1A1A1A', background: '#fff' }} />
                <span style={{ fontSize: 11, color: '#8C9BAB', flexShrink: 0 }}>→</span>
                <input type="date" value={dateFin} onChange={e => { setDateFin(e.target.value); setPeriodeTab('perso') }}
                  style={{ flex: 1, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', color: '#1A1A1A', background: '#fff' }} />
              </div>
              {dateDebut && dateFin && periodeTab === 'perso' && (
                <button onClick={() => setOpen(false)}
                  style={{ marginTop: 8, width: '100%', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6, padding: '6px', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                  Appliquer
                </button>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  )
}
