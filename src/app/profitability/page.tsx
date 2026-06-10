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
  const pct = ca > 0 ? value / ca * 100 : 0
  const pctN1 = (caN1 ?? 0) > 0 && valueN1 != null ? valueN1 / caN1! * 100 : 0
  const bg = highlight ? '#1A1A1A' : '#fff'
  const mutedColor = highlight ? 'rgba(255,255,255,0.45)' : '#8C9BAB'
  const c = color || (highlight ? '#B8A98A' : '#8C9BAB')
  const hasDeductions = deductions && deductions.length > 0
  const cols = hasN1 ? '1fr 120px 120px' : '1fr 120px'
  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:cols, alignItems:'center', background:bg, border:`0.5px solid ${highlight ? '#1A1A1A' : 'rgba(0,0,0,0.06)'}`, borderLeft:`3px solid ${c}`, borderRadius:'0 10px 10px 0', padding:'8px 14px', marginBottom: hasDeductions ? 0 : 2 }}>
        <div style={{ fontSize:11, fontWeight: highlight ? 600 : 500, color: highlight ? 'rgba(255,255,255,0.85)' : '#1A1A1A', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:13, fontWeight:600, color: highlight ? (color || '#B8A98A') : (color || '#1A1A1A') }}>{fmt(value)}</div>
          <div style={{ fontSize:10, color:mutedColor, marginTop:1 }}>{fmtP(pct)}</div>
        </div>
        {hasN1 && (
          <div style={{ textAlign:'right' }}>
            {valueN1 != null ? (
              <>
                <div style={{ fontSize:13, fontWeight:500, color:'#8C9BAB' }}>{fmt(valueN1)}</div>
                <div style={{ fontSize:10, color:'#8C9BAB', marginTop:1 }}>{fmtP(pctN1)}</div>
              </>
            ) : (
              <span style={{ fontSize:10, color: highlight ? 'rgba(255,255,255,0.3)' : '#8C9BAB' }}>—</span>
            )}
          </div>
        )}
      </div>
      {deductions?.map((d, i) => (
        <div key={i} style={{ display:'grid', gridTemplateColumns:cols, alignItems:'center', padding:'4px 14px 4px 28px', borderTop:'0.5px solid rgba(0,0,0,0.04)', background:'rgba(0,0,0,0.015)', marginBottom: i === (deductions.length - 1) ? 2 : 0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:11, color:'#B8A98A' }}>↳</span>
            <span style={{ fontSize:11, color:'#8C9BAB' }}>{d.value < 0 ? '+' : '−'} {d.label}</span>
          </div>
          <div style={{ textAlign:'right' }}>
            <span style={{ fontSize:11, fontWeight:500, color:'#8C9BAB' }}>{fmt(Math.abs(d.value))}</span>
          </div>
          {hasN1 && (
            <div style={{ textAlign:'right' }}>
              {d.valueN1 != null ? (
                <span style={{ fontSize:11, color:'#8C9BAB' }}>{fmt(Math.abs(d.valueN1))}</span>
              ) : (
                <span style={{ fontSize:10, color:'#8C9BAB' }}>—</span>
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
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
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
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth:900 }}>
              <AlvioInsight payload={{ page:'profitability', annee:anneeActive, indicateurs:{ ca:sig.ca, mb:sig.margeCommerciale, ebe:sig.ebe, rex:sig.rex, rnet:sig.resultatNet, tauxMb:sig.tauxMb, tauxEbe:sig.tauxEbe, tauxRex:sig.tauxRex, tauxRnet:sig.tauxRnet, tauxPers:sig.tauxPers, pers64:sig.chargesPersonnel } }} />
              <div style={{ fontSize:11, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Soldes intermédiaires de gestion</div>

              <div style={{ display:'grid', gridTemplateColumns: hasN1 ? '1fr 120px 120px' : '1fr 120px 80px', padding:'0 14px 8px 14px', marginBottom:4 }}>
                <div style={{ fontSize:9, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.09em' }}>Indicateur</div>
                <div style={{ fontSize:9, fontWeight:600, color:'#1A1A1A', textTransform:'uppercase', letterSpacing:'0.09em', textAlign:'right' }}>Exercice {anneeActive}</div>
                {hasN1 && <div style={{ fontSize:9, fontWeight:600, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.09em', textAlign:'right' }}>{anneeActive - 1}</div>}
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
