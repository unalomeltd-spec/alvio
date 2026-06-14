'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useActiveCompany } from '@/hooks/useActiveCompany'

const supabase = createClient()

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
  // N-1 comparatif
  dateDebutN1: string
  setDateDebutN1: (v: string) => void
  dateFinN1: string
  setDateFinN1: (v: string) => void
  anneeN1: number
  setAnneeN1: (a: number) => void
  showN1?: boolean
}

function shiftYearMinus1(d: string): string {
  if (!d) return ''
  const y = parseInt(d.slice(0, 4)) - 1
  return y + d.slice(4)
}

// ── Dates : blocs calés sur l'ouverture de l'exercice ──────────────
function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCMonth(dt.getUTCMonth() + n)
  return dt.toISOString().slice(0, 10)
}
function minusOneDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}
// T = blocs de 3 mois depuis l'ouverture, S = blocs de 6 mois, dernier bloc borné à la clôture.
// Pour un exercice civil, reproduit janv→mars, etc.
function buildPresets(debut: string, fin: string) {
  const clamp = (d: string) => (d > fin ? fin : d)
  const block = (off: number, len: number) => ({
    debut: addMonths(debut, off),
    fin: clamp(minusOneDay(addMonths(debut, off + len))),
  })
  return [
    { label: 'T1', ...block(0, 3) },
    { label: 'T2', ...block(3, 3) },
    { label: 'T3', ...block(6, 3) },
    { label: 'T4', debut: addMonths(debut, 9), fin },
    { label: 'S1', ...block(0, 6) },
    { label: 'S2', debut: addMonths(debut, 6), fin },
  ].filter(p => p.debut <= fin)
}

const fdc = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4)
const estCivil = (m: { debut: string; fin: string }) =>
  m.debut.slice(5) === '01-01' && m.fin.slice(5) === '12-31' && m.debut.slice(0, 4) === m.fin.slice(0, 4)

export default function PeriodSelector({
  annees, anneeActive, setAnneeActive,
  periodeTab, setPeriodeTab,
  dateDebut, setDateDebut, dateFin, setDateFin,
  dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1,
  anneeN1, setAnneeN1,
  showN1 = true,
}: PeriodSelectorProps) {
  const { activeId } = useActiveCompany()
  const [open, setOpen] = useState(false)
  const [n1Open, setN1Open] = useState(false)
  const [n1Custom, setN1Custom] = useState(false)
  const [exMeta, setExMeta] = useState<Record<number, { debut: string; fin: string }>>({})

  // Bornes réelles des exercices du dossier (date_debut / date_fin), RLS appliquée.
  useEffect(() => {
    if (!activeId) { setExMeta({}); return }
    let cancel = false
    ;(async () => {
      const { data } = await supabase
        .from('fec_exercices')
        .select('annee, date_debut, date_fin')
        .eq('company_id', activeId)
      if (cancel || !data) return
      const map: Record<number, { debut: string; fin: string }> = {}
      for (const row of data) {
        if (row.date_debut && row.date_fin) map[row.annee] = { debut: row.date_debut, fin: row.date_fin }
      }
      setExMeta(map)
    })()
    return () => { cancel = true }
  }, [activeId])

  const activeMeta = exMeta[anneeActive]
  const exoDebut = activeMeta?.debut || `${anneeActive}-01-01`
  const exoFin   = activeMeta?.fin   || `${anneeActive}-12-31`
  const presetList = buildPresets(exoDebut, exoFin)
  const spanExo = (a: number): string | null => {
    const m = exMeta[a]
    return m && !estCivil(m) ? `${fdc(m.debut)} → ${fdc(m.fin)}` : null
  }

  const setPreset = (debut: string, fin: string) => {
    setDateDebut(debut)
    setDateFin(fin)
    setPeriodeTab('perso')
    // Auto N-1
    if (!n1Custom) {
      setDateDebutN1(shiftYearMinus1(debut))
      setDateFinN1(shiftYearMinus1(fin))
      setAnneeN1(parseInt(debut.slice(0, 4)) - 1)
    }
    setOpen(false)
  }

  const handleExercice = (a: number) => {
    setAnneeActive(a)
    setPeriodeTab('exercice')
    if (!n1Custom) setAnneeN1(a - 1)
    setOpen(false)
  }

  const handleCustomDates = (debut: string, fin: string) => {
    if (debut) setDateDebut(debut)
    if (fin) setDateFin(fin)
    setPeriodeTab('perso')
    if (!n1Custom) {
      if (debut) setDateDebutN1(shiftYearMinus1(debut))
      if (fin) setDateFinN1(shiftYearMinus1(fin))
    }
  }

  const labelN = (() => {
    if (periodeTab === 'exercice') return `Exercice ${anneeActive}`
    if (dateDebut && dateFin) return `${fdc(dateDebut)} → ${fdc(dateFin)}`
    return 'Période'
  })()

  const labelN1 = (() => {
    if (!n1Custom && periodeTab === 'exercice') return `vs Exercice ${anneeN1}`
    if (dateDebutN1 && dateFinN1) return `vs ${fdc(dateDebutN1)} → ${fdc(dateFinN1)}`
    return `vs Exercice ${anneeN1}`
  })()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Sélecteur période N */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => { setOpen(o => !o); setN1Open(false) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F2F3F5', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 500, color: '#1A1A1A', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {labelN}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="#8C9BAB" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, zIndex: 100, minWidth: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>

              {/* Exercices */}
              <div style={{ padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '4px 14px 6px', fontSize: 10, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Exercice</div>
                {annees.map(a => {
                  const actif = anneeActive === a && periodeTab === 'exercice'
                  const sub = spanExo(a)
                  return (
                    <div key={a} onClick={() => handleExercice(a)}
                      style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: actif ? '#B8A98A' : '#1A1A1A', background: actif ? 'rgba(184,169,138,0.08)' : 'transparent', fontWeight: actif ? 500 : 400 }}
                      onMouseEnter={e => { if (!actif) (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = actif ? 'rgba(184,169,138,0.08)' : 'transparent' }}>
                      <span>Exercice {a} — complet</span>
                      {sub && <span style={{ fontSize: 10, color: '#8C9BAB', fontVariantNumeric: 'tabular-nums' }}>{sub}</span>}
                    </div>
                  )
                })}
              </div>

              {/* Trimestres & semestres */}
              <div style={{ padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '4px 14px 6px', fontSize: 10, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Périodes de l'exercice</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: '0 8px' }}>
                  {presetList.map(p => {
                    const actif = dateDebut === p.debut && dateFin === p.fin
                    return (
                      <div key={p.label} onClick={() => setPreset(p.debut, p.fin)}
                        style={{ padding: '6px 8px', fontSize: 11, cursor: 'pointer', borderRadius: 6, color: actif ? '#B8A98A' : '#1A1A1A', background: actif ? 'rgba(184,169,138,0.1)' : 'transparent', textAlign: 'center', fontWeight: 500 }}
                        onMouseEnter={e => { if (!actif) (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = actif ? 'rgba(184,169,138,0.1)' : 'transparent' }}>
                        {p.label}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Dates personnalisées */}
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Personnalisé</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="date" value={dateDebut} onChange={e => handleCustomDates(e.target.value, '')}
                    style={{ flex: 1, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', color: '#1A1A1A', background: '#fff' }} />
                  <span style={{ fontSize: 11, color: '#8C9BAB', flexShrink: 0 }}>→</span>
                  <input type="date" value={dateFin} onChange={e => handleCustomDates('', e.target.value)}
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

      {/* Séparateur */}
      {showN1 && <span style={{ fontSize: 11, color: '#8C9BAB' }}>·</span>}

      {/* Sélecteur N-1 */}
      {showN1 && <div style={{ position: 'relative' }}>
        <button onClick={() => { setN1Open(o => !o); setOpen(false) }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'transparent', border: 'none', borderRadius: 7, padding: '5px 8px', fontSize: 11, fontWeight: 400, color: '#8C9BAB', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {labelN1}
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.2s', transform: n1Open ? 'rotate(180deg)' : 'none' }}>
            <path d="M2 3.5L5 6.5L8 3.5" stroke="#8C9BAB" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {n1Open && (
          <>
            <div onClick={() => setN1Open(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, zIndex: 100, minWidth: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden' }}>

              {/* Auto */}
              <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                <div onClick={() => { setN1Custom(false); if (periodeTab === 'exercice') setAnneeN1(anneeActive - 1); else { setDateDebutN1(shiftYearMinus1(dateDebut)); setDateFinN1(shiftYearMinus1(dateFin)) }; setN1Open(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${!n1Custom ? '#B8A98A' : '#D0D5DD'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {!n1Custom && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#B8A98A' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A' }}>Automatique</div>
                    <div style={{ fontSize: 10, color: '#8C9BAB' }}>Même période, exercice précédent</div>
                  </div>
                </div>
              </div>

              {/* Exercices N-1 disponibles */}
              <div style={{ padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '4px 14px 6px', fontSize: 10, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Exercice comparatif</div>
                {annees.filter(a => a < anneeActive).map(a => {
                  const actif = n1Custom && anneeN1 === a
                  const sub = spanExo(a)
                  return (
                    <div key={a} onClick={() => { setN1Custom(true); setAnneeN1(a); setPeriodeTab('exercice'); setN1Open(false) }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: actif ? '#B8A98A' : '#1A1A1A', background: actif ? 'rgba(184,169,138,0.08)' : 'transparent' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#F7F8FA' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = actif ? 'rgba(184,169,138,0.08)' : 'transparent' }}>
                      <span>Exercice {a}</span>
                      {sub && <span style={{ fontSize: 10, color: '#8C9BAB', fontVariantNumeric: 'tabular-nums' }}>{sub}</span>}
                    </div>
                  )
                })}
              </div>

              {/* Dates personnalisées N-1 */}
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#8C9BAB', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Période personnalisée</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="date" value={dateDebutN1} onChange={e => { setDateDebutN1(e.target.value); setN1Custom(true) }}
                    style={{ flex: 1, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', color: '#1A1A1A' }} />
                  <span style={{ fontSize: 11, color: '#8C9BAB' }}>→</span>
                  <input type="date" value={dateFinN1} onChange={e => { setDateFinN1(e.target.value); setN1Custom(true) }}
                    style={{ flex: 1, border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '5px 8px', fontSize: 11, outline: 'none', color: '#1A1A1A' }} />
                </div>
                {dateDebutN1 && dateFinN1 && (
                  <button onClick={() => setN1Open(false)}
                    style={{ marginTop: 8, width: '100%', background: '#1A1A1A', color: '#fff', border: 'none', borderRadius: 6, padding: '6px', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                    Appliquer
                  </button>
                )}
              </div>

            </div>
          </>
        )}
      </div>}

    </div>
  )
}
