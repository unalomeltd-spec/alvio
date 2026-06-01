'use client'
import { useState, useEffect } from 'react'
import { usePeriod } from '@/hooks/usePeriod'
import { createClient } from '@supabase/supabase-js'
import Sidebar from '@/components/Sidebar'
import PeriodSelector from '@/components/PeriodSelector'
import { calculerIndicateurs, filtrerLignes, getMonthlyCash } from '@/hooks/useFEC'
import AlvioInsight from '@/components/AlvioInsight'
import type { LigneFEC, Indicateurs } from '@/hooks/useFEC'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'

function toIso(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d.slice(0, 10)
  if (d.length === 8) return d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)
  return d
}

export default function CashFlowPage() {
  const [exercices, setExercices] = useState<Record<number,{annee:number;lignes:LigneFEC[]}>>({})
  const { anneeActive, setAnneeActive, periodeTab, setPeriodeTab, dateDebut, setDateDebut, dateFin, setDateFin, anneeN1, setAnneeN1, dateDebutN1, setDateDebutN1, dateFinN1, setDateFinN1 } = usePeriod(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

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
  const monthly = lignesActives.length > 0 ? getMonthlyCash(lignesActives) : []
  const maxVal = monthly.length > 0 ? Math.max(...monthly.map(m => Math.abs(m.val))) || 1 : 1
  const joursCharges = ind && ind.ebe > 0 ? Math.round(ind.treso / (ind.ebe / 365)) : 0

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="cash-flow"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="cash-flow"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0, position:'sticky' as const, top:0, zIndex:10 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Trésorerie</span>
          {ind && <PeriodSelector annees={anneesDisponibles} anneeActive={anneeActive} setAnneeActive={setAnneeActive} periodeTab={periodeTab} setPeriodeTab={setPeriodeTab} dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} anneeN1={anneeN1} setAnneeN1={setAnneeN1} dateDebutN1={dateDebutN1} setDateDebutN1={setDateDebutN1} dateFinN1={dateFinN1} setDateFinN1={setDateFinN1} />}
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {!ind ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth:960 }}>
              <AlvioInsight payload={{ page:'cash-flow', annee:anneeActive, periode: periodeTab==='perso'&&dateDebut&&dateFin?`${dateDebut} → ${dateFin}`:undefined, indicateurs:{ ca:ind.ca, treso:ind.treso, ebe:ind.ebe, bfr:ind.bfr, tauxMb:ind.tauxMb } }} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
                {[
                  { label:'Trésorerie nette', val:fmt(ind.treso), color:ind.treso>=0?'#1D9E75':'#D85A30', accent:ind.treso>=0?'#1D9E75':'#D85A30' },
                  { label:'EBITDA', val:fmt(ind.ebe), color:ind.ebe>=0?'#1D9E75':'#D85A30', accent:'#B8A98A' },
                  { label:'Jours de trésorerie', val:joursCharges>0?`${joursCharges} jours`:'—', color:joursCharges>60?'#1D9E75':joursCharges>30?'#B8A98A':'#D85A30', accent:'#8C9BAB' },
                ].map(k => (
                  <div key={k.label} style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', borderTop:`3px solid ${k.accent}`, padding:'14px 16px' }}>
                    <div style={{ fontSize:10, fontWeight:500, color:'#8C9BAB', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{k.label}</div>
                    <div style={{ fontSize:22, fontWeight:500, color:k.color }}>{k.val}</div>
                  </div>
                ))}
              </div>
              {monthly.length > 0 && (
                <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px', marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A', marginBottom:16 }}>Évolution de la trésorerie cumulée</div>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:120 }}>
                    {monthly.map((m,i) => {
                      const h = Math.max(Math.abs(m.val)/maxVal*100, 4)
                      return (
                        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                          <div style={{ width:'100%', height:`${h}%`, minHeight:4, background:i===monthly.length-1?'#1A1A1A':m.val>=0?'#1D9E75':'#D85A30', borderRadius:'3px 3px 0 0' }}/>
                          <span style={{ fontSize:9, color:'#8C9BAB', whiteSpace:'nowrap' }}>{m.m}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
                <div style={{ fontSize:13, fontWeight:500, color:'#1A1A1A', marginBottom:12 }}>Besoin en fonds de roulement (BFR)</div>
                <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ flex:1, height:10, background:'#F2F3F5', borderRadius:5, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(Math.abs(ind.bfr)/Math.max(Math.abs(ind.treso),Math.abs(ind.bfr),1)*100,100)}%`, background:ind.bfr>0?'#D85A30':'#1D9E75', borderRadius:5 }}/>
                  </div>
                  <div style={{ fontSize:14, fontWeight:500, color:ind.bfr>0?'#D85A30':'#1D9E75', minWidth:110, textAlign:'right' }}>{fmt(ind.bfr)}</div>
                </div>
                <div style={{ fontSize:11, color:'#8C9BAB', marginTop:8 }}>
                  {ind.bfr>0?"BFR positif : vos clients vous doivent plus que vous devez à vos fournisseurs.":"BFR négatif : vos fournisseurs vous financent — situation favorable."}
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
