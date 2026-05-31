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

export default function ProfitabilityPage() {
  const [exercices, setExercices] = useState<Record<number,{annee:number;lignes:LigneFEC[]}>>({})
  const [anneeActive, setAnneeActive] = useState(new Date().getFullYear())
  const [periodeTab, setPeriodeTab] = useState<'exercice'|'perso'>('exercice')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [loading, setLoading] = useState(true)
  const [hov, setHov] = useState<number|null>(null)

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
  const indN1: Indicateurs | null = exercices[anneeActive-1] ? calculerIndicateurs(exercices[anneeActive-1].lignes) : null

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  const kpis = ind ? [
    { label:'Marge brute', val:fmt(ind.mb), pct:fmtP(ind.tauxMb), color:'#B8A98A', delta: indN1 ? {val:ind.mb-indN1.mb, pct:(ind.mb-indN1.mb)/Math.abs(indN1.mb||1)*100} : null },
    { label:'EBITDA', val:fmt(ind.ebe), pct:fmtP(ind.tauxEbe), color:ind.tauxEbe>=10?'#1D9E75':'#D85A30', delta: indN1 ? {val:ind.ebe-indN1.ebe, pct:(ind.ebe-indN1.ebe)/Math.abs(indN1.ebe||1)*100} : null },
    { label:"Résultat d'exploitation", val:fmt(ind.rex), pct:fmtP(ind.tauxRex), color:ind.rex>=0?'#1D9E75':'#D85A30', delta: indN1 ? {val:ind.rex-indN1.rex, pct:(ind.rex-indN1.rex)/Math.abs(indN1.rex||1)*100} : null },
    { label:'Résultat net', val:fmt(ind.rnet), pct:fmtP(ind.tauxRnet), color:ind.rnet>=0?'#1D9E75':'#D85A30', delta: indN1 ? {val:ind.rnet-indN1.rnet, pct:(ind.rnet-indN1.rnet)/Math.abs(indN1.rnet||1)*100} : null },
  ] : []

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="profitability"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Rentabilité</span>
          {ind && <PeriodSelector annees={anneesDisponibles} anneeActive={anneeActive} setAnneeActive={setAnneeActive} periodeTab={periodeTab} setPeriodeTab={setPeriodeTab} dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} />}
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!ind ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth:960 }}>
              <AlvioInsight payload={{ page:'profitability', annee:anneeActive, periode: periodeTab==='perso'&&dateDebut&&dateFin?`${dateDebut} → ${dateFin}`:undefined, indicateurs:{ ca:ind.ca, mb:ind.mb, ebe:ind.ebe, rex:ind.rex, rnet:ind.rnet, tauxMb:ind.tauxMb, tauxEbe:ind.tauxEbe, tauxRex:ind.tauxRex, tauxRnet:ind.tauxRnet, tauxPers:ind.tauxPers, pers64:ind.pers64 } }} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
                {kpis.map((k,i) => (
                  <div key={k.label} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                    style={{ background:hov===i?'#1A1A1A':'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', borderTop:`3px solid ${k.color}`, padding:'14px 16px', transition:'all 0.25s', transform:hov===i?'translateY(-3px)':'none', boxShadow:hov===i?'0 12px 28px rgba(0,0,0,0.1)':'none', cursor:'default' }}>
                    <div style={{ fontSize:10, fontWeight:500, color:hov===i?'rgba(255,255,255,0.5)':'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{k.label}</div>
                    <div style={{ fontSize:20, fontWeight:500, color:hov===i?'#fff':'#1A1A1A' }}>{k.val}</div>
                    <div style={{ fontSize:11, color:hov===i?'rgba(255,255,255,0.7)':k.color, marginTop:4, fontWeight:500 }}>{k.pct} du CA</div>
                    {k.delta && <div style={{ fontSize:10, color:k.delta.val>=0?'#1D9E75':'#D85A30', marginTop:4 }}>{k.delta.val>=0?'▲':'▼'} {k.delta.val>=0?'+':''}{fmt(k.delta.val)}</div>}
                  </div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A', marginBottom:16 }}>Décomposition du CA</div>
                  {[
                    { label:"Chiffre d'affaires", val:ind.ca, pct:100, color:'#1A1A1A', bg:'#F2F3F5' },
                    { label:'Achats & charges externes', val:-(ind.achats+ind.ext), pct:-(ind.achats+ind.ext)/ind.ca*100, color:'#D85A30', bg:'rgba(216,90,48,0.08)' },
                    { label:'= Marge brute', val:ind.mb, pct:ind.tauxMb, color:'#B8A98A', bg:'rgba(184,169,138,0.08)' },
                    { label:'Charges de personnel', val:-ind.pers64, pct:-ind.pers64/ind.ca*100, color:'#D85A30', bg:'rgba(216,90,48,0.08)' },
                    { label:'= EBITDA', val:ind.ebe, pct:ind.tauxEbe, color:ind.ebe>=0?'#1D9E75':'#D85A30', bg:ind.ebe>=0?'rgba(29,158,117,0.08)':'rgba(216,90,48,0.08)' },
                  ].map(r => (
                    <div key={r.label} style={{ display:'flex', alignItems:'center', padding:'7px 10px', borderRadius:6, background:r.bg, marginBottom:4 }}>
                      <div style={{ flex:1, fontSize:12, color:'#1A1A1A' }}>{r.label}</div>
                      <div style={{ fontSize:13, fontWeight:500, color:r.color, minWidth:90, textAlign:'right' }}>{fmt(r.val)}</div>
                      <div style={{ fontSize:10, color:'#8C9BAB', minWidth:50, textAlign:'right' }}>{r.pct>0?'+':''}{fmtP(r.pct)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A', marginBottom:16 }}>Thermomètre de santé</div>
                  {[
                    { label:'Taux de marge brute', val:ind.tauxMb, max:80, good:'> 40%', warn:'< 30%', inverse:false },
                    { label:"Taux d'EBITDA", val:ind.tauxEbe, max:30, good:'> 15%', warn:'< 10%', inverse:false },
                    { label:'Masse salariale / CA', val:ind.tauxPers, max:80, good:'< 45%', warn:'> 55%', inverse:true },
                  ].map(m => {
                    const pct = Math.min(Math.max(m.val,0),m.max)/m.max*100
                    const ok = m.inverse ? m.val<55 : m.val>(m.max*0.33)
                    return (
                      <div key={m.label} style={{ marginBottom:18 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                          <span style={{ fontSize:12, color:'#1A1A1A' }}>{m.label}</span>
                          <span style={{ fontSize:12, fontWeight:500, color:ok?'#1D9E75':'#D85A30' }}>{fmtP(m.val)}</span>
                        </div>
                        <div style={{ height:6, background:'#F2F3F5', borderRadius:3, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background:ok?'#1D9E75':'#D85A30', borderRadius:3 }}/>
                        </div>
                        <div style={{ fontSize:10, color:'#8C9BAB', marginTop:3 }}>Bon : {m.good} · Alerte : {m.warn}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  )
}
