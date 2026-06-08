'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import PeriodSelector from '@/components/PeriodSelector'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

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
}

export default function TopBar({
  title, annees = [], anneeActive, onChangerAnnee, loading,
  periodeTab, setPeriodeTab,
  dateDebut, setDateDebut, dateFin, setDateFin,
  anneeN1, setAnneeN1,
  dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1,
}: TopBarProps) {
  const [nomEntite, setNomEntite] = useState('')
  const [siren, setSiren] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data: profile } = await sb
        .from('user_profiles')
        .select('siren, entreprise')
        .eq('user_id', user.id)
        .single()
      if (profile?.siren) setSiren(profile.siren)
      if (profile?.entreprise?.nom) setNomEntite(profile.entreprise.nom)
    }
    load()
  }, [])

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

      {(nomEntite || siren) && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {nomEntite && (
            <span style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nomEntite}
            </span>
          )}
          {siren && (
            <span style={{ fontSize: 11, color: '#8C9BAB', background: 'rgba(0,0,0,0.04)', borderRadius: 5, padding: '2px 8px', fontVariantNumeric: 'tabular-nums' }}>
              {fmtSiren(siren)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
