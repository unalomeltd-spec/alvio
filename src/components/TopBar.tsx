'use client'

interface TopBarProps {
  title: string
  annees?: number[]
  anneeActive?: number
  onChangerAnnee?: (annee: number) => void
  loading?: boolean
}

export default function TopBar({ title, annees = [], anneeActive, onChangerAnnee, loading }: TopBarProps) {
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
    </div>
  )
}
