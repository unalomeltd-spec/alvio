'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import PeriodSelector from '@/components/PeriodSelector'
import { calculerIndicateurs, filtrerLignes } from '@/hooks/useFEC'
import AlvioInsight from '@/components/AlvioInsight'
import type { LigneFEC, Indicateurs } from '@/hooks/useFEC'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'
const fmtP = (n: number) => (Math.round(n * 10) / 10).toFixed(1) + ' %'

function toIso(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d.slice(0, 10)
  if (d.length === 8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)
  return d
}

export default function IncomeStatementPage() {
  const [exercices, setExercices] = useState<Record<number,{annee:number;lignes:LigneFEC[]}>>({})
  const [anneeActive, setAnneeActive] = useState(new Date().getFullYear())
  const [periodeTab, setPeriodeTab] = useState<'exercice'|'perso'>('exercice')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Record<string,boolean>>({ prod:true, charges:true, fin:false, exc:false })

  useEffect(() => {
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/'; return }
      const { data } = await sb.from('fec_exercices').select('annee, ecritures').eq('user_id', user.id).order('annee', { ascending: false })
      if (data && data.length > 0) {
        const map: Record<number,any> = {}
        for (const row of data) map[row.annee] = { annee: row.annee, lignes: row.ecritures as LigneFEC[] }
        setExercices(map)
        setAnneeActive(data[0].annee)
      }
      setLoading(false)
    })
  }, [])

  const lignesActives: LigneFEC[] = (() => {
    if (periodeTab === 'perso' && dateDebut && dateFin) {
      const merged: LigneFEC[] = []
      for (const a of Object.keys(exercices).map(Number).sort((x,y) => x-y)) {
        const ex = exercices[a]; if (!ex) continue
        const dates = ex.lignes.map((l:LigneFEC) => toIso(l.EcritureDate)).filter(Boolean).sort()
        if (dates.length && toIso(dates[dates.length-1]) >= dateDebut && toIso(dates[0]) <= dateFin)
          merged.push(...filtrerLignes(ex.lignes, 'perso', dateDebut, dateFin))
      }
      if (merged.length > 0) return merged
    }
    return exercices[anneeActive]?.lignes ?? []
  })()

  const anneesDisponibles = Object.keys(exercices).map(Number).sort((a,b) => b-a)
  const ind: Indicateurs | null = lignesActives.length > 0 ? calculerIndicateurs(lignesActives) : null

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="income-statement"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  const rows = ind ? [
    { section:'prod', label:"Chiffre d'affaires", val:ind.ca, pct:100, indent:true },
    { section:'prod', sub:true, label:'Production totale', val:ind.ca, color:'#B8A98A' },
    { section:'charges', label:'Achats et charges externes', val:-(ind.achats+ind.ext), pct:ind.ca>0?-(ind.achats+ind.ext)/ind.ca*100:0, indent:true },
    { section:'charges', label:'Impôts et taxes', val:-ind.imp63, pct:ind.ca>0?-ind.imp63/ind.ca*100:0, indent:true },
    { section:'charges', label:'Charges de personnel', val:-ind.pers64, pct:ind.ca>0?-ind.pers64/ind.ca*100:0, indent:true, alert:ind.tauxPers>55 },
    { section:'charges', label:'Dotations aux amortissements', val:-ind.dot68, pct:ind.ca>0?-ind.dot68/ind.ca*100:0, indent:true },
    { section:'charges', sub:true, label:"Résultat d'exploitation", val:ind.rex, pct:ind.ca>0?ind.rex/ind.ca*100:0, color:ind.rex>=0?'#1D9E75':'#D85A30', bold:true },
    { section:'fin', label:'Produits financiers', val:ind.fin76, pct:ind.ca>0?ind.fin76/ind.ca*100:0, indent:true },
    { section:'fin', label:'Charges financières', val:-ind.fin66, pct:ind.ca>0?-ind.fin66/ind.ca*100:0, indent:true },
    { section:'fin', sub:true, label:'Résultat financier', val:ind.rfin, pct:ind.ca>0?ind.rfin/ind.ca*100:0, color:ind.rfin>=0?'#1D9E75':'#D85A30' },
    { section:'exc', label:'Produits exceptionnels', val:ind.exc77, pct:ind.ca>0?ind.exc77/ind.ca*100:0, indent:true },
    { section:'exc', label:'Charges exceptionnelles', val:-ind.exc67, pct:ind.ca>0?-ind.exc67/ind.ca*100:0, indent:true },
    { section:'exc', label:'IS et participation', val:-ind.is695, pct:ind.ca>0?-ind.is695/ind.ca*100:0, indent:true },
    { large:true, label:'RÉSULTAT NET', val:ind.rnet, pct:ind.ca>0?ind.rnet/ind.ca*100:0, color:ind.rnet>=0?'#1D9E75':'#D85A30', bold:true },
  ] : []

  const sectionTitle: Record<string,string> = { prod:'Production & ventes', charges:"Charges d'exploitation", fin:'Résultat financier', exc:'Exceptionnel & IS' }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="income-statement"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Compte de résultat</span>
          {ind && <PeriodSelector annees={anneesDisponibles} anneeActive={anneeActive} setAnneeActive={setAnneeActive} periodeTab={periodeTab} setPeriodeTab={setPeriodeTab} dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} />}
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!ind ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth:800 }}>
              <AlvioInsight payload={{ page:'income-statement', annee:anneeActive, periode: periodeTab==='perso'&&dateDebut&&dateFin?`${dateDebut} → ${dateFin}`:undefined, indicateurs:{ ca:ind.ca, mb:ind.mb, rex:ind.rex, rnet:ind.rnet, rfin:ind.rfin, tauxMb:ind.tauxMb, tauxRnet:ind.tauxRnet } }} />
              <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', overflow:'hidden' }}>
                <div style={{ display:'flex', background:'#1A1A1A', padding:'10px 16px' }}>
                  <div style={{ flex:1, fontSize:11, fontWeight:500, color:'#F2F3F5', textTransform:'uppercase', letterSpacing:'0.06em' }}>Libellé</div>
                  <div style={{ width:110, textAlign:'right', fontSize:11, fontWeight:500, color:'#F2F3F5' }}>Montant</div>
                  <div style={{ width:60, textAlign:'right', fontSize:11, color:'#8C9BAB' }}>% CA</div>
                </div>
                {['prod','charges','fin','exc'].map(sec => (
                  <div key={sec}>
                    <div onClick={() => setOpen(o => ({ ...o, [sec]:!o[sec] }))}
                      style={{ display:'flex', alignItems:'center', padding:'9px 16px', background:'rgba(184,169,138,0.06)', cursor:'pointer', borderTop:'0.5px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ flex:1, fontSize:12, fontWeight:500, color:'#1A1A1A', display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:9, color:'#B8A98A', display:'inline-block', transition:'transform 0.2s', transform:open[sec]?'rotate(90deg)':'none' }}>▶</span>
                        {sectionTitle[sec]}
                      </div>
                    </div>
                    {open[sec] && rows.filter(r => r.section === sec && !r.large).map((r,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', padding:r.sub?'8px 16px':'6px 16px', background:r.sub?'rgba(0,0,0,0.02)':'transparent', borderTop:'0.5px solid rgba(0,0,0,0.04)' }}>
                        <div style={{ flex:1, fontSize:12, fontWeight:r.bold?500:400, color:(r as any).alert?'#D85A30':'#1A1A1A', paddingLeft:r.indent?20:0 }}>{r.label}</div>
                        <div style={{ width:110, textAlign:'right', fontSize:12, fontWeight:r.bold?500:400, color:(r as any).color||(r.val>=0?'#1A1A1A':'#D85A30') }}>{fmt(r.val)}</div>
                        <div style={{ width:60, textAlign:'right', fontSize:10, color:'#8C9BAB' }}>{r.pct!==undefined?fmtP(r.pct):''}</div>
                      </div>
                    ))}
                  </div>
                ))}
                {rows.filter(r => r.large).map((r,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1A1A1A', borderTop:'0.5px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ flex:1, fontSize:13, fontWeight:500, color:'#F2F3F5' }}>{r.label}</div>
                    <div style={{ width:110, textAlign:'right', fontSize:14, fontWeight:500, color:(r as any).color }}>{fmt(r.val)}</div>
                    <div style={{ width:60, textAlign:'right', fontSize:10, color:'#8C9BAB' }}>{fmtP(r.pct!)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
