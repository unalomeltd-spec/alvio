'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const fmtSiren = (s: string) => s.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3')

interface TopBarProps {
  title: string
  annees?: number[]
  anneeActive?: number
  onChangerAnnee?: (annee: number) => void
  loading?: boolean
}

export default function TopBar({ title, annees = [], anneeActive, onChangerAnnee, loading }: TopBarProps) {
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
      {annees.length > 1 && annees.map(a => (
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
      ))}
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
