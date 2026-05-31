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

export default function BalanceSheetPage() {
  const [exercices, setExercices] = useState<Record<number,{annee:number;lignes:LigneFEC[]}>>({})
  const [anneeActive, setAnneeActive] = useState(new Date().getFullYear())
  const [periodeTab, setPeriodeTab] = useState<'exercice'|'perso'>('exercice')
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
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

  const solde = (lignes: LigneFEC[], rs: string[]) => {
    let t = 0
    for (const l of lignes) for (const r of rs) if (l.CompteNum.startsWith(r)) { t += l.Debit - l.Credit; break }
    return t
  }

  const actif = lignesActives.length > 0 ? [
    { label:'Immobilisations incorporelles', val:solde(lignesActives,['20']), color:'#B8A98A' },
    { label:'Immobilisations corporelles', val:solde(lignesActives,['21','22','23']), color:'#8C9BAB' },
    { label:'Immobilisations financières', val:solde(lignesActives,['26','27']), color:'#5C6670' },
    { label:'Stocks', val:solde(lignesActives,['3']), color:'#B8A98A' },
    { label:'Créances clients', val:solde(lignesActives,['41','44','45','46']), color:'#1A1A1A' },
    { label:'Trésorerie active', val:solde(lignesActives,['51','53']), color:'#1D9E75' },
  ].filter(r => Math.abs(r.val) > 0) : []

  const passif = lignesActives.length > 0 ? [
    { label:'Capitaux propres', val:-solde(lignesActives,['10','11','12','13']), color:'#1D9E75' },
    { label:'Dettes financières LT', val:-solde(lignesActives,['16']), color:'#D85A30' },
    { label:"Dettes d'exploitation", val:-solde(lignesActives,['40','42','43','44','45','46']), color:'#8C9BAB' },
    { label:'Trésorerie passive', val:-solde(lignesActives,['50','52','54']), color:'#5C6670' },
  ].filter(r => Math.abs(r.val) > 0) : []

  const totalActif = actif.reduce((s,r) => s + Math.abs(r.val), 0)
  const totalPassif = passif.reduce((s,r) => s + Math.abs(r.val), 0)
  const ind = lignesActives.length > 0 ? (() => {
    const s = (rs: string[]) => { let t=0; for(const l of lignesActives) for(const r of rs) if(l.CompteNum.startsWith(r)){t+=l.Debit-l.Credit;break}; return t }
    return { treso: s(['51','53']), bfr: s(['41'])-(-s(['40','42','43'])), ca: -s(['701','702','703','704','705','706','707','708']) }
  })() : null

  if (loading) return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="balance-sheet"/>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ width:36, height:36, border:'2px solid #F2F3F5', borderTop:'2px solid #B8A98A', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    </div>
  )

  const BarSide = ({ items, total }: { items: typeof actif, total: number }) => (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {items.map((r,i) => {
        const pct = total > 0 ? Math.max(Math.abs(r.val)/total*100, 3) : 0
        return (
          <div key={i}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:12, color:'#1A1A1A' }}>{r.label}</span>
              <div style={{ textAlign:'right' }}>
                <span style={{ fontSize:12, fontWeight:500, color:r.color }}>{fmt(r.val)}</span>
                <span style={{ fontSize:10, color:'#8C9BAB', marginLeft:6 }}>{fmtP(pct)}</span>
              </div>
            </div>
            <div style={{ height:8, background:'#F2F3F5', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct}%`, background:r.color, borderRadius:4, transition:'width 0.6s ease' }}/>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#F2F3F5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <Sidebar activePage="balance-sheet"/>
      <div style={{ flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ background:'#fff', borderBottom:'0.5px solid rgba(0,0,0,0.07)', padding:'0 24px', height:52, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:500, color:'#1A1A1A' }}>Bilan</span>
          {actif.length > 0 && <PeriodSelector annees={anneesDisponibles} anneeActive={anneeActive} setAnneeActive={setAnneeActive} periodeTab={periodeTab} setPeriodeTab={setPeriodeTab} dateDebut={dateDebut} setDateDebut={setDateDebut} dateFin={dateFin} setDateFin={setDateFin} />}
        </div>
        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {actif.length === 0 ? (
            <div style={{ maxWidth:480, margin:'60px auto', textAlign:'center', background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:24 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'#1A1A1A', marginBottom:8 }}>Aucune donnée disponible</div>
              <a href="/dashboard" style={{ background:'#1A1A1A', color:'#fff', borderRadius:8, padding:'10px 20px', fontSize:13, textDecoration:'none' }}>Aller à la Synthèse</a>
            </div>
          ) : (
            <div style={{ maxWidth:960 }}>
              {ind && <AlvioInsight payload={{ page:'balance-sheet', annee:anneeActive, periode: periodeTab==='perso'&&dateDebut&&dateFin?`${dateDebut} → ${dateFin}`:undefined, indicateurs:{ treso:ind.treso, bfr:ind.bfr, ca:ind.ca } }} />}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:'#1A1A1A' }}>Actif</span>
                    <span style={{ fontSize:13, fontWeight:500, color:'#B8A98A' }}>{fmt(totalActif)}</span>
                  </div>
                  <BarSide items={actif} total={totalActif}/>
                </div>
                <div style={{ background:'#fff', borderRadius:10, border:'0.5px solid rgba(0,0,0,0.06)', padding:'18px 20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:'#1A1A1A' }}>Passif</span>
                    <span style={{ fontSize:13, fontWeight:500, color:'#B8A98A' }}>{fmt(totalPassif)}</span>
                  </div>
                  <BarSide items={passif} total={totalPassif}/>
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
