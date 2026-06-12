'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { usePeriod } from '@/hooks/usePeriod'
import { useActiveCompany } from '@/hooks/useActiveCompany'
import AlvioInsight from '@/components/AlvioInsight'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

function SigRow({ label, value, ca, color, highlight, deductions, valueN1, caN1, hasN1 }: {
  label: string; value: number; ca: number; color?: string; highlight?: boolean
  deductions?: { label: string; value: number; valueN1?: number }[]
  valueN1?: number; caN1?: number; hasN1?: boolean
}) {
  const pct = ca > 0 ? Math.max(0, Math.min(100, value / ca * 100)) : 0
  const pctN1 = (caN1 ?? 0) > 0 && valueN1 != null ? valueN1 / caN1! * 100 : 0
  const bg = highlight ? '#FBF9F5' : 'var(--bg-card)'
  const borderCol = highlight ? 'var(--alvio-champagne-light)' : 'var(--border-light)'
  const accentCol = color || (highlight ? 'var(--alvio-champagne)' : 'var(--alvio-champagne)')
  const mutedColor = highlight ? 'var(--alvio-champagne-dark)' : 'var(--text-muted)'
  const labelColor = 'var(--text-primary)'
  const valColor = highlight ? (color || 'var(--alvio-champagne)') : (color || 'var(--text-primary)')
  const hasDeductions = deductions && deductions.length > 0
  const cols = hasN1 ? '1fr 120px 120px' : '1fr 120px'
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:cols, alignItems:'center', background:bg, border:`1px solid ${borderCol}`, borderLeft:`3px solid ${accentCol}`, borderRadius:'0 10px 10px 0', padding:'5px 14px', marginBottom: hasDeductions ? 0 : 1, position:'relative', overflow:'hidden' }}>
        {/* Barre inline % du CA */}
        {!highlight && pct > 0 && (
          <div style={{ position:'absolute', left:3, top:0, bottom:0, width:`${pct}%`, background:'var(--alvio-champagne-subtle)', opacity:0.7, zIndex:0, pointerEvents:'none' }} />
        )}
        <div style={{ fontSize:11, fontWeight: highlight ? 600 : 400, color:labelColor, textTransform:'uppercase', letterSpacing:'0.05em', position:'relative', zIndex:1 }}>{label}</div>
        <div style={{ textAlign:'right', position:'relative', zIndex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:valColor }}>{fmt(value)}</div>
          <div style={{ fontSize:10, color:mutedColor, marginTop:1 }}>{fmtP(pct)}</div>
        </div>
        {hasN1 && (
          <div style={{ textAlign:'right', position:'relative', zIndex:1 }}>
            {valueN1 != null ? (
              <>
                <div style={{ fontSize:13, fontWeight:500, color:'var(--text-muted)' }}>{fmt(valueN1)}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>{fmtP(pctN1)}</div>
              </>
            ) : (
              <span style={{ fontSize:10, color:'var(--text-muted)' }}>—</span>
            )}
          </div>
        )}
      </div>
      {deductions?.map((d, i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns:cols, alignItems:'center', padding:'3px 14px 3px 28px', borderTop:'1px solid var(--border-soft)', background:'var(--bg-main)', marginBottom: i === (deductions.length - 1) ? 2 : 0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:11, color:'var(--alvio-champagne)' }}>↳</span>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{d.value < 0 ? '+' : '−'} {d.label}</span>
          </div>
          <div style={{ textAlign:'right' }}>
            <span style={{ fontSize:11, fontWeight:500, color:'var(--text-secondary)' }}>{fmt(Math.abs(d.value))}</span>
          </div>
          {hasN1 && (
            <div style={{ textAlign:'right' }}>
              {d.valueN1 != null ? (
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{fmt(Math.abs(d.valueN1))}</span>
              ) : (
                <span style={{ fontSize:10, color:'var(--text-muted)' }}>—</span>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  )
}

export default function ProfitabilityPage() {
  const [etats, setEtats] = useState<any>(null)
  const [etatsN1, setEtatsN1] = useState<any>(null)
  const [annees, setAnnees] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>('')
  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const { activeId } = useActiveCompany()
  const periodeParams = periodeTab === 'perso' && dateDebut && dateFin
    ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
  const periodeParamsN1 = periodeTab === 'perso' && dateDebutN1 && dateFinN1
    ? `&dateDebut=${dateDebutN1}&dateFin=${dateFinN1}` : ''

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUserId(user.id)
      if (!activeId) return  // attend la résolution du dossier actif (spinner maintenu)
      const { data } = await sb.from('fec_exercices').select('annee').eq('company_id', activeId).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const anneesDispos = data.map((r: any) => r.annee as number)
        setAnnees(anneesDispos)
        const annee = anneesDispos.includes(anneeActive) ? anneeActive : anneesDispos[0]
        if (annee !== anneeActive) setAnneeActive(annee)
        const fetches: Promise<void>[] = [
          fetch(`/api/etats?annee=${annee}&company_id=${activeId}${periodeParams}`).then(r => r.ok ? r.json() : null).then(d => d && setEtats(d)),
        ]
        if (anneesDispos.includes(annee - 1)) {
          fetches.push(fetch(`/api/etats?annee=${annee - 1}&company_id=${activeId}${periodeParamsN1}`).then(r => r.ok ? r.json() : null).then(d => d && setEtatsN1(d)))
        }
        await Promise.all(fetches)
      }
      setLoading(false)
    }
    load()
  }, [activeId])

  // Relance le fetch quand la période change
  useEffect(() => {
    if (!activeId || !annees.length) return
    const params = periodeTab === 'perso' && dateDebut && dateFin
      ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    const paramsN1 = periodeTab === 'perso' && dateDebutN1 && dateFinN1
      ? `&dateDebut=${dateDebutN1}&dateFin=${dateFinN1}` : ''
    fetch(`/api/etats?annee=${anneeActive}&company_id=${activeId}${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setEtats(d))
    if (annees.includes(anneeActive - 1)) {
      fetch(`/api/etats?annee=${anneeActive - 1}&company_id=${activeId}${paramsN1}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setEtatsN1(d))
    }
  }, [periodeTab, dateDebut, dateFin, dateDebutN1, dateFinN1])

  const changerAnnee = async (annee: number) => {
    setAnneeActive(annee)
    const params = periodeTab === 'perso' && dateDebut && dateFin
      ? `&dateDebut=${dateDebut}&dateFin=${dateFin}` : ''
    const paramsN1 = periodeTab === 'perso' && dateDebutN1 && dateFinN1
      ? `&dateDebut=${dateDebutN1}&dateFin=${dateFinN1}` : ''
    const res = await fetch(`/api/etats?annee=${annee}&company_id=${activeId}${params}`)
    if (res.ok) setEtats(await res.json())
    if (annees.includes(annee - 1)) {
      const resN1 = await fetch(`/api/etats?annee=${annee - 1}&company_id=${activeId}${paramsN1}`)
      if (resN1.ok) setEtatsN1(await resN1.json())
    } else {
      }
  }

  const sig = etats?.sig
  const sigN1 = etatsN1?.sig
  const hasN1 = !!sigN1

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-main)' }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid var(--bg-main)', borderTop:'2px solid var(--alvio-champagne)', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-main)' }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <TopBar title="Rentabilité" annees={annees} anneeActive={anneeActive} onChangerAnnee={changerAnnee}
          periodeTab={periodeTab} setPeriodeTab={setPeriodeTab}
          dateDebut={dateDebut} setDateDebut={setDateDebut}
          dateFin={dateFin} setDateFin={setDateFin}
          anneeN1={anneeN1} setAnneeN1={setAnneeN1}
          dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1}
          dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!sig ? (
            <div style={{ maxWidth:420, margin:'80px auto', textAlign:'center' }}>
              <div style={{ width:64, height:64, borderRadius:18, background:'rgba(198,162,117,0.08)', border:'1px solid rgba(198,162,117,0.18)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
                <svg viewBox="80 34 340 315" width="32" height="32">
                  <path fill="#C6A275" d="M247.73,149.32c-2.59,6.14-5,11.83-7.39,17.53c-6.89,16.45-13.73,32.91-20.71,49.32c-0.48,1.14-1.79,2.14-2.95,2.74c-11.04,5.76-22.82,9.46-34.94,12.07c-6.36,1.37-12.82,2.3-19.23,3.41c-0.7,0.12-1.42,0.11-2.47,0.18c29.27-66.95,58.4-133.57,87.75-200.71c29.3,67.03,58.43,133.68,87.71,200.69c-1.62-0.15-2.96-0.21-4.29-0.41c-18.25-2.72-36.04-7.01-52.67-15.28c-0.98-0.49-2.09-1.34-2.5-2.29c-7.21-16.95-14.33-33.95-21.46-50.94C252.35,160.35,250.13,155.05,247.73,149.32z"/>
                  <path fill="#C6A275" d="M385.17,348.23c-6.27-4.19-12.55-8.37-18.82-12.57c-22.52-15.1-45.04-30.19-67.51-45.35c-0.75-0.51-1.44-1.71-1.47-2.6c-0.14-5.04-0.11-10.08,0-15.11c0.02-0.78,0.55-1.95,1.19-2.26c14.39-7.07,28.83-14.05,43.55-21.18c14.63,33.23,29.04,65.95,43.45,98.67C385.43,347.97,385.3,348.1,385.17,348.23z"/>
                  <path fill="#C6A275" d="M109.7,348.63c14.61-33.3,28.96-66,43.42-98.96c1.92,0.78,3.85,1.45,5.68,2.32c12.68,6.04,25.36,12.1,37.99,18.24c0.66,0.32,1.33,1.39,1.35,2.13c0.1,5.19,0.1,10.38-0.04,15.56c-0.02,0.83-0.73,1.93-1.45,2.41c-14.41,9.76-28.87,19.46-43.33,29.15c-13.72,9.2-27.46,18.36-41.19,27.54C111.52,347.45,110.9,347.85,109.7,348.63z"/>
                  <path fill="#C6A275" d="M247.84,298.64c-2.69-5.84-5.39-11.34-7.78-16.97c-4.01-9.44-10.74-16.15-19.82-20.67c-3.97-1.98-7.94-3.95-11.91-5.93c-0.65-0.32-1.29-0.65-1.95-0.98c4.52-2.14,8.92-4.19,13.3-6.3c9.92-4.79,16.68-12.53,21.08-22.51c2.28-5.17,4.65-10.3,7-15.49c2.28,5.06,4.43,10.13,6.84,15.09c1.58,3.25,3.45,6.37,5.31,9.47c4.49,7.48,11.95,11.29,19.28,15.17c3.06,1.62,6.29,2.93,9.69,4.5c-1.41,0.69-2.67,1.26-3.89,1.92c-4.75,2.55-9.49,5.13-14.24,7.71c-6.45,3.5-10.76,8.97-13.92,15.39c-2.8,5.7-5.35,11.52-8,17.29C248.52,296.98,248.26,297.66,247.84,298.64z"/>
                </svg>
              </div>
              <div style={{ fontSize:16, fontWeight:700, color:'#242628', marginBottom:8, letterSpacing:'-0.02em' }}>Aucune donnée disponible</div>
              <div style={{ fontSize:13, color:'#6E7378', marginBottom:28, lineHeight:1.7 }}>Importez un FEC ou connectez Pennylane pour accéder à l'analyse de rentabilité.</div>
              <a href="/entreprise" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#C6A275', color:'#fff', borderRadius:10, padding:'11px 24px', fontSize:13, fontWeight:600, textDecoration:'none' }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.5" stroke="#fff" strokeWidth="1.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M4.4 15.6l1.4-1.4M14.2 5.8l1.4-1.4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
                Accéder aux paramétrages
              </a>
            </div>
          ) : (
            <div style={{ maxWidth:900 }}>
              <AlvioInsight payload={{ page:'profitability', annee:anneeActive, indicateurs:{ ca:sig.ca, mb:sig.margeCommerciale, ebe:sig.ebe, rex:sig.rex, rnet:sig.resultatNet, tauxMb:sig.tauxMb, tauxEbe:sig.tauxEbe, tauxRex:sig.tauxRex, tauxRnet:sig.tauxRnet, tauxPers:sig.tauxPers, pers64:sig.chargesPersonnel } }} />
              <div style={{ fontSize:10, fontWeight:500, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Soldes intermédiaires de gestion</div>

              <div style={{ display:'grid', gridTemplateColumns: hasN1 ? '1fr 120px 120px' : '1fr 120px 80px', padding:'0 14px 6px 14px', marginBottom:2 }}>
                <div style={{ fontSize:9, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.09em' }}>Indicateur</div>
                <div style={{ fontSize:9, fontWeight:600, color:'var(--text-primary)', textTransform:'uppercase', letterSpacing:'0.09em', textAlign:'right' }}>Exercice {anneeActive}</div>
                {hasN1 && <div style={{ fontSize:9, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.09em', textAlign:'right' }}>{anneeActive - 1}</div>}
              </div>

              <SigRow label="Chiffre d'affaires" value={sig.ca} ca={sig.ca} color="#B8A98A" hasN1={hasN1} valueN1={sigN1?.ca} caN1={sigN1?.ca} />
              {Math.abs(sig.ventesMarchandises) > 0.5 && <SigRow label="Ventes de marchandises" value={sig.ventesMarchandises} ca={sig.ca} color="#B8A98A" hasN1={hasN1} valueN1={sigN1?.ventesMarchandises} caN1={sigN1?.ca} />}
              {Math.abs(sig.margeCommerciale) > 0.5 && (
                <SigRow label="Marge commerciale" value={sig.margeCommerciale} ca={sig.ca} color="#B8A98A" hasN1={hasN1} valueN1={sigN1?.margeCommerciale} caN1={sigN1?.ca}
                  deductions={Math.abs(sig.coutMarchandises) > 0.5 ? [{ label:"Coût d'achat des marchandises", value: sig.coutMarchandises, valueN1: sigN1?.coutMarchandises }] : []} />
              )}
              {Math.abs(sig.productionExercice) > 0.5 && (
                <SigRow label="Production de l'exercice" value={sig.productionExercice} ca={sig.ca} hasN1={hasN1} valueN1={sigN1?.productionExercice} caN1={sigN1?.ca}
                  deductions={[
                    ...(Math.abs(sig.productionStockee) > 0.5 ? [{ label:'Production stockée', value: -sig.productionStockee, valueN1: sigN1 ? -sigN1.productionStockee : undefined }] : []),
                    ...(Math.abs(sig.productionImmobilisee) > 0.5 ? [{ label:'Production immobilisée', value: -sig.productionImmobilisee, valueN1: sigN1 ? -sigN1.productionImmobilisee : undefined }] : []),
                  ]} />
              )}
              <SigRow label="Valeur ajoutée" value={sig.valeurAjoutee} ca={sig.ca} hasN1={hasN1} valueN1={sigN1?.valeurAjoutee} caN1={sigN1?.ca}
                deductions={[
                  { label:'Consommations externes', value: sig.consommationsInt, valueN1: sigN1?.consommationsInt },
                  ...(Math.abs(sig.subventions) > 0.5 ? [{ label:"Subventions d'exploitation", value: -sig.subventions, valueN1: sigN1 ? -sigN1.subventions : undefined }] : []),
                ]} />
              <SigRow label="EBE — Excédent Brut d'Exploitation" value={sig.ebe} ca={sig.ca}
                color={sig.tauxEbe >= 10 ? '#1D9E75' : '#D85A30'} highlight={true}
                hasN1={hasN1} valueN1={sigN1?.ebe} caN1={sigN1?.ca}
                deductions={[
                  ...(Math.abs(sig.impotsTaxes) > 0.5 ? [{ label:'Impôts & taxes', value: sig.impotsTaxes, valueN1: sigN1?.impotsTaxes }] : []),
                  { label:'Charges de personnel', value: sig.chargesPersonnel, valueN1: sigN1?.chargesPersonnel },
                ]} />
              <SigRow label="Résultat d'exploitation" value={sig.rex} ca={sig.ca}
                color={sig.rex >= 0 ? '#1D9E75' : '#D85A30'} hasN1={hasN1} valueN1={sigN1?.rex} caN1={sigN1?.ca}
                deductions={[
                  ...(Math.abs(sig.dotations) > 0.5 ? [{ label:'Dotations aux amortissements', value: sig.dotations, valueN1: sigN1?.dotations }] : []),
                  ...(Math.abs(sig.reprises) > 0.5 ? [{ label:'Reprises sur provisions', value: -sig.reprises, valueN1: sigN1 ? -sigN1.reprises : undefined }] : []),
                  ...(Math.abs(sig.autresProduits) > 0.5 ? [{ label:'Autres produits (75)', value: -sig.autresProduits, valueN1: sigN1 ? -sigN1.autresProduits : undefined }] : []),
                  ...(Math.abs(sig.autresCharges) > 0.5 ? [{ label:'Autres charges (65)', value: sig.autresCharges, valueN1: sigN1?.autresCharges }] : []),
                ]} />
              {Math.abs(sig.rfin) > 0.5 && (
                <SigRow label="Résultat courant avant impôts" value={sig.rex + sig.rfin} ca={sig.ca}
                  color={(sig.rex + sig.rfin) >= 0 ? '#1D9E75' : '#D85A30'} hasN1={hasN1}
                  valueN1={sigN1 ? sigN1.rex + sigN1.rfin : undefined} caN1={sigN1?.ca}
                  deductions={[
                    ...(Math.abs(sig.produitsFinanciers) > 0.5 ? [{ label:'Produits financiers', value: -sig.produitsFinanciers, valueN1: sigN1 ? -sigN1.produitsFinanciers : undefined }] : []),
                    ...(Math.abs(sig.chargesFinancieres) > 0.5 ? [{ label:'Charges financières', value: sig.chargesFinancieres, valueN1: sigN1?.chargesFinancieres }] : []),
                  ]} />
              )}
              {Math.abs(sig.rexcep) > 0.5 && (
                <SigRow label="Résultat exceptionnel" value={sig.rexcep} ca={sig.ca}
                  color={sig.rexcep >= 0 ? '#1D9E75' : '#D85A30'} hasN1={hasN1} valueN1={sigN1?.rexcep} caN1={sigN1?.ca} />
              )}
              <SigRow label="Résultat net" value={sig.resultatNet} ca={sig.ca}
                color={sig.resultatNet >= 0 ? '#1D9E75' : '#D85A30'} hasN1={hasN1} valueN1={sigN1?.resultatNet} caN1={sigN1?.ca}
                deductions={[
                  ...(Math.abs(sig.participation) > 0.5 ? [{ label:'Participation des salariés', value: sig.participation, valueN1: sigN1?.participation }] : []),
                  ...(Math.abs(sig.is) > 0.5 ? [{ label:'Impôt sur les sociétés', value: sig.is, valueN1: sigN1?.is }] : []),
                ]} />
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
