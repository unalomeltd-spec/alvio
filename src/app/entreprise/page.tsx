'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface EntrepriseInfo {
  siren: string
  siret_siege: string
  nom: string
  forme_juridique: string
  capital: number | null
  date_creation: string
  code_naf: string
  libelle_naf: string
  adresse: string
  ville: string
  code_postal: string
  tranche_effectif: string
  dirigeants: { nom: string; fonction: string }[]
}

interface ExerciceResume {
  annee: number
  ca: number
  margebrute: number
  tauxMargebrute: number
  ebe: number
  tauxEbe: number
  resultatNet: number
  tresorerie: number
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'

const fmtPct = (n: number) =>
  (Math.round(n * 10) / 10).toFixed(1) + ' %'

export default function EntreprisePage() {
  const [entreprise, setEntreprise]   = useState<EntrepriseInfo | null>(null)
  const [exercices, setExercices]     = useState<ExerciceResume[]>([])
  const [userEmail, setUserEmail]     = useState('')
  const [siren, setSiren]             = useState('')
  const [chargement, setChargement]   = useState(true)
  const [sirenInput, setSirenInput]   = useState('')
  const [sirenLoading, setSirenLoading] = useState(false)
  const [sirenError, setSirenError]   = useState('')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)

  useEffect(() => {
    const charger = async () => {
      setChargement(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { window.location.href = '/'; return }

        setUserEmail(user.email ?? '')
        const meta = user.user_metadata ?? {}

        if (meta.entreprise) {
          setEntreprise(meta.entreprise as EntrepriseInfo)
          setSiren(meta.siren ?? '')
          setSirenInput(meta.siren ?? '')
        }

        // Charger les exercices FEC depuis Supabase
        const { data: fecData } = await supabase
          .from('fec_exercices')
          .select('annee, ecritures')
          .eq('user_id', user.id)
          .order('annee', { ascending: false })

        if (fecData && fecData.length > 0) {
          const resumes: ExerciceResume[] = fecData.map(row => {
            const lignes = row.ecritures as Array<{
              CompteNum: string; Debit: number; Credit: number
            }>

            const solde = (racines: string[]) => {
              let t = 0
              for (const l of lignes) {
                for (const r of racines) {
                  if (l.CompteNum.startsWith(r)) { t += l.Debit - l.Credit; break }
                }
              }
              return t
            }

            const ca = -solde(['701','702','703','704','705','706','707','708'])
            const achats = solde(['601','602','603','604','605','606','607','608','609'])
            const ext = solde(['61','62'])
            const imp63 = solde(['63'])
            const pers64 = solde(['64'])
            const dot68 = solde(['681','686','687'])
            const fin66 = solde(['66'])
            const fin76 = -solde(['76'])
            const exc67 = solde(['67'])
            const exc77 = -solde(['77'])
            const is695 = solde(['695','696','697','698','699'])
            const treso = solde(['512','530'])

            const margebrute = ca - achats - ext
            const tauxMargebrute = ca > 0 ? (margebrute / ca) * 100 : 0
            const va = margebrute - imp63
            const ebe = va - pers64
            const tauxEbe = ca > 0 ? (ebe / ca) * 100 : 0
            const rex = ebe - dot68
            const resultatNet = rex + (fin76 - fin66) + (exc77 - exc67) - is695

            return { annee: row.annee, ca, margebrute, tauxMargebrute, ebe, tauxEbe, resultatNet, tresorerie: treso }
          })
          setExercices(resumes)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setChargement(false)
      }
    }
    charger()
  }, [])

  const handleSirenLookup = async (v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 9)
    setSirenInput(clean)
    setSirenError('')
    setEntreprise(null)
    if (clean.length !== 9) return
    setSirenLoading(true)
    try {
      const res = await fetch(`/api/siren?siren=${clean}`)
      const data = await res.json()
      if (!res.ok) setSirenError(data.error || 'Entreprise non trouvee')
      else setEntreprise(data)
    } catch { setSirenError('Erreur reseau') }
    finally { setSirenLoading(false) }
  }

  const handleSave = async () => {
    if (!entreprise) return
    setSaving(true)
    try {
      await supabase.auth.updateUser({
        data: { siren: sirenInput, entreprise }
      })
      setSiren(sirenInput)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  if (chargement) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif", alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '2px solid #F2F3F5', borderTop: '2px solid #B8A98A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 13, color: '#8C9BAB' }}>Chargement...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.06)', padding: '18px 20px', ...style }}>
      {children}
    </div>
  )

  const lbl = (text: string) => (
    <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }}>{text}</div>
  )

  const val = (text: string) => (
    <div style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>{text || '—'}</div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F3F5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width: 216, minWidth: 216, background: '#1A1A1A', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '0.5px solid rgba(184,169,138,0.18)' }}>
          <div style={{ color: '#B8A98A', fontSize: 15, fontWeight: 500, letterSpacing: '0.05em' }}>Alvio</div>
          <div style={{ color: '#8C9BAB', fontSize: 9, marginTop: 3 }}>Intelligence financiere en temps reel</div>
        </div>
        <div style={{ flex: 1, padding: '10px 0' }}>
          <div style={{ padding: '10px 20px 4px', color: 'rgba(140,155,171,0.5)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Analyse</div>
          {[
            { label: 'KPIs & SIG',    href: '/dashboard', d: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
            { label: 'Tresorerie',    href: '/dashboard', d: 'M3 3v18h18M7 16l4-4 4 4 5-5' },
            { label: 'Previsionnel',  href: '/dashboard', d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
            { label: 'Simulations',   href: '/dashboard', d: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
            { label: 'Export',        href: '/dashboard', d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' },
          ].map(item => (
            <a key={item.label} href={item.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', borderLeft: '2px solid transparent', color: '#8C9BAB', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={item.d} /></svg>
              {item.label}
            </a>
          ))}
          <div style={{ padding: '10px 20px 4px', color: 'rgba(140,155,171,0.5)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>Mon espace</div>
          <a href="/entreprise" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', borderLeft: '2px solid #B8A98A', background: 'rgba(184,169,138,0.1)', color: '#B8A98A', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Fiche societe
          </a>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(184,169,138,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8A98A', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
              {userEmail.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#F2F3F5', fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
              <div style={{ color: '#8C9BAB', fontSize: 9 }}>{entreprise?.nom || 'Beta'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ background: '#fff', borderBottom: '0.5px solid rgba(0,0,0,0.07)', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A' }}>Fiche societe</span>
          {entreprise && (
            <div style={{ fontSize: 11, color: '#8C9BAB', fontStyle: 'italic' }}>
              SIREN <strong style={{ color: '#1A1A1A', fontStyle: 'normal' }}>{siren}</strong>
            </div>
          )}
        </div>

        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>

          {/* Si pas de SIREN — zone de saisie */}
          {!entreprise && (
            <div style={{ maxWidth: 480, margin: '40px auto' }}>
              {card(
                <>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 6 }}>Associer votre entreprise</div>
                  <div style={{ fontSize: 12, color: '#8C9BAB', marginBottom: 20 }}>Saisissez votre SIREN pour afficher la fiche legale et croiser avec vos donnees financieres.</div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#5C6670', letterSpacing: '.04em', textTransform: 'uppercase' as const, marginBottom: 6, display: 'block' }}>SIREN</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      style={{ width: '100%', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, padding: '10px 36px 10px 12px', fontSize: 13, color: '#1A1A1A', fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none', boxSizing: 'border-box' as const }}
                      type="text" placeholder="9 chiffres"
                      value={sirenInput}
                      onChange={e => handleSirenLookup(e.target.value)}
                      maxLength={9}
                    />
                    {sirenLoading && (
                      <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin .7s linear infinite' }}><circle cx="7" cy="7" r="5" stroke="rgba(184,169,138,.3)" strokeWidth="1.5"/><path d="M7 2a5 5 0 015 5" stroke="#B8A98A" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </div>
                    )}
                  </div>
                  {sirenError && <div style={{ fontSize: 11, color: '#e25c5c', marginTop: 6 }}>{sirenError}</div>}
                </>
              )}
            </div>
          )}

          {/* Fiche entreprise */}
          {entreprise && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960 }}>

              {/* Header entreprise */}
              <div style={{ background: '#1A1A1A', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(184,169,138,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#F2F3F5', fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{entreprise.nom}</div>
                  <div style={{ color: '#8C9BAB', fontSize: 12 }}>{entreprise.forme_juridique} · SIREN {siren} · {entreprise.ville}</div>
                </div>
                <button
                  onClick={() => { setEntreprise(null); setSirenInput('') }}
                  style={{ background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 14px', fontSize: 11, color: '#8C9BAB', cursor: 'pointer' }}
                >
                  Modifier
                </button>
              </div>

              {/* Infos légales */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {card(
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 16 }}>Informations legales</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      {[
                        ['SIREN', siren],
                        ['SIRET siege', entreprise.siret_siege],
                        ['Forme juridique', entreprise.forme_juridique],
                        ['Date de creation', entreprise.date_creation],
                        ['Code NAF', entreprise.code_naf],
                        ['Activite', entreprise.libelle_naf],
                        ['Effectif', entreprise.tranche_effectif || 'Non renseigne'],
                        ['Capital', entreprise.capital ? fmt(entreprise.capital) : 'Non renseigne'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          {lbl(k)}
                          {val(v)}
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 14 }}>
                      {lbl('Siege social')}
                      {val(entreprise.adresse || `${entreprise.code_postal} ${entreprise.ville}`)}
                    </div>
                  </>
                )}

                {card(
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 16 }}>Dirigeants</div>
                    {entreprise.dirigeants.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#8C9BAB', fontStyle: 'italic' }}>Aucun dirigeant renseigne</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {entreprise.dirigeants.map((d, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(184,169,138,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B8A98A', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                              {d.nom.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A' }}>{d.nom}</div>
                              <div style={{ fontSize: 11, color: '#8C9BAB' }}>{d.fonction || 'Dirigeant'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* KPIs financiers par exercice */}
              {exercices.length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 500, color: '#8C9BAB', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                    Synthese financiere — {exercices.map(e => e.annee).join(' · ')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(exercices.length, 3)}, 1fr)`, gap: 14 }}>
                    {exercices.map(ex => (
                      <div key={ex.annee}>
                        {card(
                          <>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#8C9BAB', marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
                              <span>Exercice {ex.annee}</span>
                              <span style={{ fontSize: 10, background: 'rgba(184,169,138,0.1)', color: '#B8A98A', padding: '2px 8px', borderRadius: 4 }}>FEC importe</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {[
                                { label: "Chiffre d affaires", value: fmt(ex.ca), accent: '#B8A98A' },
                                { label: 'Marge brute', value: `${fmt(ex.margebrute)} (${fmtPct(ex.tauxMargebrute)})`, accent: '#B8A98A' },
                                { label: 'EBITDA', value: `${fmt(ex.ebe)} (${fmtPct(ex.tauxEbe)})`, accent: ex.tauxEbe >= 10 ? '#1D9E75' : '#D85A30' },
                                { label: 'Resultat net', value: fmt(ex.resultatNet), accent: ex.resultatNet >= 0 ? '#1D9E75' : '#D85A30' },
                                { label: 'Tresorerie', value: fmt(ex.tresorerie), accent: ex.tresorerie >= 0 ? '#1D9E75' : '#D85A30' },
                              ].map(({ label, value, accent }) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8, borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                                  <span style={{ fontSize: 11, color: '#8C9BAB' }}>{label}</span>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: accent }}>{value}</span>
                                </div>
                              ))}
                            </div>
                          </>,
                          { borderTop: '3px solid #B8A98A' }
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {exercices.length === 0 && card(
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(184,169,138,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B8A98A" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 3 }}>Aucune donnee financiere</div>
                    <div style={{ fontSize: 12, color: '#8C9BAB' }}>Importez un FEC depuis le dashboard KPIs pour voir la synthese financiere ici.</div>
                  </div>
                  <a href="/dashboard" style={{ marginLeft: 'auto', background: '#1A1A1A', color: '#F2F3F5', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' as const }}>
                    Aller au dashboard
                  </a>
                </div>
              )}

              {/* Bouton sauvegarde si modif */}
              {entreprise && sirenInput !== siren && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ background: saved ? '#1D9E75' : '#1A1A1A', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {saving ? 'Enregistrement...' : saved ? 'Enregistre' : 'Enregistrer les modifications'}
                </button>
              )}

            </div>
          )}

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
