'use client'
import { useState } from 'react'
import PeriodSelector from '@/components/PeriodSelector'
import { useActiveCompany } from '@/hooks/useActiveCompany'

const fmtSiren = (s: string) => s.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')

interface TopBarProps {
  title: string
  annees?: number[]
  anneeActive?: number
  onChangerAnnee?: (annee: number) => void
  loading?: boolean
  periodeTab?: 'exercice' | 'perso'
  setPeriodeTab?: (v: 'exercice' | 'perso') => void
  dateDebut?: string
  setDateDebut?: (v: string) => void
  dateFin?: string
  setDateFin?: (v: string) => void
  anneeN1?: number
  setAnneeN1?: (a: number) => void
  dateDebutN1?: string
  setDateDebutN1?: (v: string) => void
  dateFinN1?: string
  setDateFinN1?: (v: string) => void
  showN1?: boolean
}

// Sélecteur de dossier — affiché uniquement à partir de 2 dossiers.
// Le changement émet l'événement écouté par useActiveCompany dans les pages,
// qui relancent alors leurs fetchs (rafraîchissement sans reload).
function CompanySelector() {
  const { companies, activeId, activeCompany, setActiveId } = useActiveCompany()
  const [open, setOpen] = useState(false)

  if (companies.length < 2) return null

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1A1A1A', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 500, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: 240 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeCompany?.nom || 'Dossier'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, zIndex: 100, minWidth: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '4px 14px 6px', fontSize: 10, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em', paddingTop: 10 }}>Dossiers</div>
            {companies.map(c => (
              <div key={c.id} onClick={() => { setActiveId(c.id); setOpen(false) }}
                style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: c.id === activeId ? '#B8A98A' : '#1A1A1A', background: c.id === activeId ? 'rgba(184,169,138,0.08)' : 'transparent', fontWeight: c.id === activeId ? 500 : 400, display: 'flex', flexDirection: 'column', gap: 2 }}
                onMouseEnter={e => { if (c.id !== activeId) (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = c.id === activeId ? 'rgba(184,169,138,0.08)' : 'transparent' }}>
                <span>{c.nom}</span>
                {c.siren && <span style={{ fontSize: 10, color: '#8C9BAB', fontVariantNumeric: 'tabular-nums' }}>{fmtSiren(c.siren)}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function EntityLabel() {
  const { activeCompany, companies } = useActiveCompany()
  // Si plusieurs dossiers, le sélecteur affiche déjà le nom → on n'affiche que le SIREN à droite.
  // Si un seul dossier, on affiche nom + SIREN à droite comme avant.
  const nom = activeCompany?.nom || ''
  const siren = activeCompany?.siren || ''
  if (!nom && !siren) return null
  const showName = companies.length < 2
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
      {showName && nom && (
        <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nom}
        </span>
      )}
      {siren && (
        <span style={{ fontSize: 11, color: '#8C9BAB', background: 'rgba(0,0,0,0.04)', borderRadius: 5, padding: '2px 8px', fontVariantNumeric: 'tabular-nums' }}>
          {fmtSiren(siren)}
        </span>
      )}
    </div>
  )
}

export default function TopBar({
  title, annees = [], anneeActive, onChangerAnnee, loading,
  periodeTab, setPeriodeTab,
  dateDebut, setDateDebut, dateFin, setDateFin,
  anneeN1, setAnneeN1,
  dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1,
  showN1 = true,
}: TopBarProps) {
  const hasPeriodSelector = !!(
    periodeTab && setPeriodeTab &&
    dateDebut !== undefined && setDateDebut &&
    dateFin !== undefined && setDateFin &&
    anneeN1 !== undefined && setAnneeN1 &&
    dateDebutN1 !== undefined && setDateDebutN1 &&
    dateFinN1 !== undefined && setDateFinN1
  )

  return (
    <div style={{
      background: '#fff',
      borderBottom: '0.5px solid rgba(0,0,0,0.07)',
      padding: '0 24px',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
      position: 'sticky' as const,
      top: 0,
      zIndex: 10,
    }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>{title}</span>

      <CompanySelector />

      {hasPeriodSelector ? (
        <PeriodSelector
          annees={annees}
          anneeActive={anneeActive!}
          setAnneeActive={(a) => onChangerAnnee?.(a)}
          periodeTab={periodeTab!}
          setPeriodeTab={setPeriodeTab!}
          dateDebut={dateDebut!}
          setDateDebut={setDateDebut!}
          dateFin={dateFin!}
          setDateFin={setDateFin!}
          anneeN1={anneeN1!}
          setAnneeN1={setAnneeN1!}
          dateDebutN1={dateDebutN1!}
          setDateDebutN1={setDateDebutN1!}
          dateFinN1={dateFinN1!}
          setDateFinN1={setDateFinN1!}
          showN1={showN1}
        />
      ) : (
        annees.length > 1 && annees.map(a => (
          <button key={a} onClick={() => onChangerAnnee?.(a)}
            style={{
              fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 6,
              border: '0.5px solid rgba(0,0,0,0.12)',
              background: a === anneeActive ? '#1A1A1A' : '#fff',
              color: a === anneeActive ? '#fff' : '#1A1A1A',
              cursor: 'pointer',
            }}>
            {a}
          </button>
        ))
      )}

      {loading && <span style={{ fontSize: 11, color: '#8C9BAB' }}>Chargement...</span>}

      <EntityLabel />
    </div>
  )
}
