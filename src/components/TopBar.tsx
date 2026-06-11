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

/* ─── CompanySelector ─────────────────────────────────── */

function CompanySelector() {
  const { companies, activeId, activeCompany, setActiveId } = useActiveCompany()
  const [open, setOpen] = useState(false)

  if (companies.length < 2) return null

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: 7, padding: '5px 11px',
          fontSize: 12, fontWeight: 500,
          color: 'var(--text-primary)',
          cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: 240,
          transition: 'border-color 0.12s, background 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--alvio-champagne-light)'}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-light)'}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--alvio-champagne)" strokeWidth="1.8">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeCompany?.nom || 'Dossier'}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 6,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 10, zIndex: 100, minWidth: 240,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)', overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Dossiers
            </div>
            {companies.map(c => (
              <div
                key={c.id}
                onClick={() => { setActiveId(c.id); setOpen(false) }}
                style={{
                  padding: '8px 14px', fontSize: 12, cursor: 'pointer',
                  color: c.id === activeId ? 'var(--alvio-champagne-dark)' : 'var(--text-primary)',
                  background: c.id === activeId ? 'var(--alvio-champagne-subtle)' : 'transparent',
                  fontWeight: c.id === activeId ? 500 : 400,
                  display: 'flex', flexDirection: 'column', gap: 2,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (c.id !== activeId) (e.currentTarget as HTMLElement).style.background = 'var(--bg-main)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = c.id === activeId ? 'var(--alvio-champagne-subtle)' : 'transparent' }}
              >
                <span>{c.nom}</span>
                {c.siren && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtSiren(c.siren)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── EntityLabel ─────────────────────────────────────── */

function EntityLabel() {
  const { activeCompany, companies } = useActiveCompany()
  const nom = activeCompany?.nom || ''
  const siren = activeCompany?.siren || ''
  if (!nom && !siren) return null
  const showName = companies.length < 2
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
      {showName && nom && (
        <span style={{
          fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
          maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {nom}
        </span>
      )}
      {siren && (
        <span style={{
          fontSize: 11, color: 'var(--text-muted)',
          background: 'var(--bg-main)',
          borderRadius: 5, padding: '2px 8px',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.02em',
        }}>
          {fmtSiren(siren)}
        </span>
      )}
    </div>
  )
}

/* ─── TopBar ──────────────────────────────────────────── */

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
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-light)',
      padding: '0 24px',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
      position: 'sticky' as const,
      top: 0,
      zIndex: 10,
    }}>
      {/* Titre page */}
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginRight: 2 }}>
        {title}
      </span>

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
          <button
            key={a}
            onClick={() => onChangerAnnee?.(a)}
            style={{
              fontSize: 12, fontWeight: 500,
              padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${a === anneeActive ? 'var(--alvio-champagne-light)' : 'var(--border-light)'}`,
              background: a === anneeActive ? 'var(--alvio-champagne-subtle)' : 'var(--bg-card)',
              color: a === anneeActive ? 'var(--alvio-champagne-dark)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'background 0.12s, border-color 0.12s',
              fontFamily: 'inherit',
            }}
          >
            {a}
          </button>
        ))
      )}

      {loading && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chargement…</span>
      )}

      {/* Bouton musique */}
      <button
        onClick={() => window.open('https://www.youtube.com/watch?v=jYmlBFzBzP4&list=RDjYmlBFzBzP4&start_radio=1', '_blank')}
        title="Jouer de la musique"
        style={{
          marginLeft: 'auto',
          width: 30, height: 30, borderRadius: 7,
          border: '1px solid var(--border-light)',
          background: 'var(--bg-card)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
          transition: 'border-color 0.12s, background 0.12s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--alvio-champagne)'
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--alvio-champagne-subtle)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-light)'
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--alvio-champagne)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      </button>

    </div>
  )
}
